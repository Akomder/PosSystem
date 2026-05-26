import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

const AuthContext = createContext(null)

// Decode JWT payload without verifying signature (client-side only)
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const refreshTimerRef = useRef(null)

  // Re-connect socket for returning users (token already in localStorage)
  useEffect(() => {
    if (user?.token) connectSocket(user.token)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    disconnectSocket()
    setUser(null)
    localStorage.removeItem('pos_user')
  }, [])

  // Schedule a silent token refresh 30 minutes before the JWT expires
  const scheduleRefresh = useCallback((token, refreshToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const decoded = decodeJwt(token)
    if (!decoded?.exp) return

    const msLeft   = decoded.exp * 1000 - Date.now()
    const refreshIn = msLeft - 30 * 60 * 1000   // 30 min before expiry

    if (refreshIn <= 0) {
      // Token already expired or too close — refresh immediately
      authApi.refresh(refreshToken)
        .then(data => {
          const updated = {
            ...JSON.parse(localStorage.getItem('pos_user') || '{}'),
            token: data.token,
          }
          localStorage.setItem('pos_user', JSON.stringify(updated))
          setUser(updated)
          scheduleRefresh(data.token, refreshToken)
        })
        .catch(() => logout())
      return
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await authApi.refresh(refreshToken)
        const updated = {
          ...JSON.parse(localStorage.getItem('pos_user') || '{}'),
          token: data.token,
        }
        localStorage.setItem('pos_user', JSON.stringify(updated))
        setUser(updated)
        scheduleRefresh(data.token, refreshToken)
      } catch {
        logout()
      }
    }, refreshIn)
  }, [logout])

  // Kick off the refresh timer whenever the access token changes
  useEffect(() => {
    if (user?.token && user?.refreshToken) {
      scheduleRefresh(user.token, user.refreshToken)
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [user?.token, user?.refreshToken, scheduleRefresh])

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      localStorage.setItem('pos_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  const login = async (email, password) => {
    const data = await authApi.login(email, password)
    // data = { token, refreshToken, user }
    const userData = { ...data.user, token: data.token, refreshToken: data.refreshToken }
    setUser(userData)
    localStorage.setItem('pos_user', JSON.stringify(userData))
    connectSocket(data.token)
    return userData
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
