import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { setAuthToken, setUnauthorizedHandler } from '../api/hubspot'
import { decodeJwt, isProphero, isExpired } from './jwt'

// El token de sesión se guarda en sessionStorage: se borra al cerrar la pestaña.
const STORAGE_KEY = 'referrals-auth-token'

const AuthContext = createContext(null)

// Lee la sesión persistida (token vigente de @prophero.com) y sincroniza el token
// con la capa de API de forma síncrona, antes de que monte cualquier ruta protegida.
function restoreSession() {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (!stored) return { token: null, user: null }
  const claims = decodeJwt(stored)
  if (isProphero(claims) && !isExpired(claims)) {
    setAuthToken(stored)
    return { token: stored, user: claims }
  }
  sessionStorage.removeItem(STORAGE_KEY)
  return { token: null, user: null }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(restoreSession)
  const [authError, setAuthError] = useState(null)

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAuthToken(null)
    setSession({ token: null, user: null })
    // Evitar que Google re-loguee automáticamente tras cerrar sesión.
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }, [])

  const login = useCallback((credential) => {
    const claims = decodeJwt(credential)
    if (!isProphero(claims)) {
      setAuthError('Acceso permitido solo con cuentas @prophero.com.')
      return false
    }
    if (isExpired(claims)) {
      setAuthError('El token expiró. Probá iniciar sesión de nuevo.')
      return false
    }
    sessionStorage.setItem(STORAGE_KEY, credential)
    setAuthToken(credential)
    setSession({ token: credential, user: claims })
    setAuthError(null)
    return true
  }, [])

  // Ante un 401 de la API (token vencido o no autorizado) → cerrar sesión.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = {
    isAuthenticated: Boolean(session.token),
    user: session.user,
    token: session.token,
    authError,
    setAuthError,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocado con su provider (patrón estándar de Context)
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return ctx
}
