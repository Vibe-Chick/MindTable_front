import { createContext, useContext, useState } from 'react'
import { loadJson, saveJson } from '../utils'

const AuthContext = createContext(null)

const USER_KEY = 'mt_user'

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => loadJson(USER_KEY))

  const setUser = (next) => {
    setUserState(next)
    if (next) saveJson(USER_KEY, next)
    else localStorage.removeItem(USER_KEY)
  }

  const login = ({ token, refresh, user: u }) => {
    localStorage.setItem('mt_token', token)
    if (refresh) localStorage.setItem('mt_refresh', refresh)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('mt_token')
    localStorage.removeItem('mt_refresh')
    setUser(null)
  }

  const updateUser = (patch) => setUser({ ...user, ...patch })

  const value = { user, isLoggedIn: Boolean(user), login, logout, updateUser }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
