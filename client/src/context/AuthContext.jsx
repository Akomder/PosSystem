import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Re-connect socket for returning users (token already in localStorage)
  useEffect(() => {
    if (user?.token) connectSocket(user.token)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const data = await authApi.login(email, password)
    // data = { token, refreshToken, user }
    const userData = { ...data.user, token: data.token, refreshToken: data.refreshToken }
    setUser(userData)
    localStorage.setItem('pos_user', JSON.stringify(userData))
    connectSocket(data.token)
    return userData
  }

  const logout = () => {
    disconnectSocket()
    setUser(null)
    localStorage.removeItem('pos_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
