import { useAuth } from '../auth/AuthContext'
import RefreshReminder from './RefreshReminder'

// Monta el recordatorio de Refresh a nivel app (persiste entre rutas: tabla y
// detalle) pero sólo para usuarios autenticados — no en la pantalla de login.
export default function GlobalRefreshReminder() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return null
  return <RefreshReminder />
}
