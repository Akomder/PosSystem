import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi, setAuthToken, clearAuthToken, onTokenExpired } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

// ─── Separate storage keys so SuperAdmin and restaurant sessions coexist ───────
const SA_KEY = 'pos_sa_user'   // SuperAdmin — one per browser (shared across SA tabs)
const RS_KEY = 'pos_user'      // Restaurant staff — one per browser (shared across RS tabs)

function storageKey(user) {
  return user?.isSuperAdmin ? SA_KEY : RS_KEY
}

/** Read stored session on page load — check both keys, prefer based on URL. */
function loadStoredUser() {
  const path = window.location.pathname
  const isSAPath = path.startsWith('/superadmin') || path === '/login'
  const keys = isSAPath ? [SA_KEY, RS_KEY] : [RS_KEY, SA_KEY]
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
  }
  return null
}

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
    const stored = loadStoredUser()
    if (stored?.token) setAuthToken(stored.token)
    return stored
  })

  const refreshTimerRef = useRef(null)

  // Re-connect socket for returning users (token already in localStorage)
  useEffect(() => {
    if (user?.token) connectSocket(user.token)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    disconnectSocket()
    clearAuthToken()
    // Clear from whichever key this session was stored under
    localStorage.removeItem(SA_KEY)
    localStorage.removeItem(RS_KEY)
    setUser(null)
  }, [])

  // Schedule a silent token refresh 30 minutes before the JWT expires
  const scheduleRefresh = useCallback((token, refreshToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const decoded = decodeJwt(token)
    if (!decoded?.exp) return

    const msLeft   = decoded.exp * 1000 - Date.now()
    const refreshIn = msLeft - 30 * 60 * 1000   // 30 min before expiry

    const applyRefresh = (newToken) => {
      setUser(prev => {
        if (!prev) return prev
        const updated = { ...prev, token: newToken }
        setAuthToken(newToken)
        localStorage.setItem(storageKey(prev), JSON.stringify(updated))
        return updated
      })
    }

    if (refreshIn <= 0) {
      authApi.refresh(refreshToken)
        .then(data => { applyRefresh(data.token); scheduleRefresh(data.token, refreshToken) })
        .catch(() => logout())
      return
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await authApi.refresh(refreshToken)
        applyRefresh(data.token)
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
      localStorage.setItem(storageKey(updated), JSON.stringify(updated))
      return updated
    })
  }, [])

  const login = async (email, password, restaurantSlug) => {
    const data = await authApi.login(email, password, restaurantSlug)
    const userData = { ...data.user, token: data.token, refreshToken: data.refreshToken }
    setAuthToken(data.token)
    // Store under role-appropriate key so sessions don't overwrite each other
    localStorage.setItem(storageKey(userData), JSON.stringify(userData))
    setUser(userData)
    connectSocket(data.token)
    return userData
  }

  // Register 401 handler — called by api.js when any request is unauthorised
  useEffect(() => {
    onTokenExpired(logout)
  }, [logout])

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
