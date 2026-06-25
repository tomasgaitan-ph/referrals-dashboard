import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { latestDataUpdate, formatLastUpdated } from '../lib/lastUpdated'

// Recordatorio periódico para que el usuario apriete "Refresh" (los datos no se
// refrescan solos: staleTime Infinity + cache persistida). Aparece abajo centrado
// cada REMINDER_INTERVAL_MS, dura REMINDER_DURATION_MS con una barra que se vacía.
// Se monta global (sobre cualquier pantalla) con timer continuo.
const REMINDER_INTERVAL_MS = 30 * 1000     // 30 s
const REMINDER_DURATION_MS = 6000          // 6 s visible

export default function RefreshReminder() {
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(false)
  const [shrink, setShrink] = useState(false)

  // Dispara el recordatorio cada REMINDER_INTERVAL_MS mientras está montado.
  useEffect(() => {
    const interval = setInterval(() => setVisible(true), REMINDER_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Mientras está visible: dispara la barra (full → 0) y auto-oculta al terminar.
  // El reset de `shrink` se hace al ocultar (dentro de callbacks, no en el cuerpo
  // del effect) para que la próxima aparición arranque la barra desde lleno.
  useEffect(() => {
    if (!visible) return
    const raf = requestAnimationFrame(() => setShrink(true))
    const hide = setTimeout(() => { setVisible(false); setShrink(false) }, REMINDER_DURATION_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hide)
    }
  }, [visible])

  function dismiss() {
    setVisible(false)
    setShrink(false)
  }

  if (!visible) return null

  const lastUpdated = latestDataUpdate(queryClient)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-sm text-slate-700">
              Don&apos;t forget to click the <span className="font-semibold text-primary">Refresh</span> button to update the data.
            </p>
            {lastUpdated > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                last updated {formatLastUpdated(lastUpdated)}
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 text-slate-400 transition-colors hover:text-slate-600 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="h-1 bg-secondary transition-[width] ease-linear"
          style={{ width: shrink ? '0%' : '100%', transitionDuration: `${REMINDER_DURATION_MS}ms` }}
        />
      </div>
    </div>
  )
}
