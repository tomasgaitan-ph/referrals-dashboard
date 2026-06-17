import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logomark from '../assets/logo.svg'
import brandTiles from '../assets/hero.png'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Espera a que cargue el script de Google Identity Services (cargado async en index.html).
function useGisReady() {
  const [ready, setReady] = useState(() => Boolean(window.google?.accounts?.id))
  useEffect(() => {
    if (ready) return
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true)
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [ready])
  return ready
}

// Wordmark de marca: logomark blanco + "PropHero" en tipografía display.
function Wordmark({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={logomark} alt="" className="h-7 w-auto" />
      <span className="font-display text-xl font-semibold tracking-tight text-white">PropHero</span>
    </div>
  )
}

export default function Login() {
  const { isAuthenticated, login, authError, setAuthError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const buttonRef = useRef(null)
  const gisReady = useGisReady()
  const from = location.state?.from?.pathname ?? '/'

  // Si ya hay sesión, salir del login.
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, from, navigate])

  // Inicializar y renderizar el botón de Google cuando el script esté listo.
  useEffect(() => {
    if (!gisReady || isAuthenticated) return
    if (!CLIENT_ID) {
      setAuthError('Falta configurar VITE_GOOGLE_CLIENT_ID.')
      return
    }
    const { id } = window.google.accounts
    id.initialize({
      client_id: CLIENT_ID,
      auto_select: false,
      callback: (response) => {
        const ok = login(response.credential)
        if (ok) navigate(from, { replace: true })
      },
    })
    if (buttonRef.current) {
      id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      })
    }
  }, [gisReady, isAuthenticated, login, navigate, from, setAuthError])

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr] bg-white font-display">

      {/* Panel de marca — solo desde lg */}
      <aside className="relative hidden overflow-hidden bg-space px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Curva de marca con degradé (azul → púrpura → rosa) */}
        <svg
          className="pointer-events-none absolute -top-20 right-0 w-[130%] opacity-90"
          viewBox="0 0 560 360" fill="none" aria-hidden="true"
        >
          <defs>
            <linearGradient id="phCurve" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#009CDF" />
              <stop offset="52%"  stopColor="#7A5CFF" />
              <stop offset="78%"  stopColor="#FF6B6B" />
              <stop offset="100%" stopColor="#009CDF" />
            </linearGradient>
            <filter id="phGlow"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <path d="M-20 70 C 150 30, 190 250, 330 240 S 520 110, 580 150"
                stroke="url(#phCurve)" strokeWidth="11" filter="url(#phGlow)" strokeLinecap="round" />
          <path d="M-20 70 C 150 30, 190 250, 330 240 S 520 110, 580 150"
                stroke="url(#phCurve)" strokeWidth="3" strokeLinecap="round" />
        </svg>

        {/* Forma orgánica ambiental */}
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-[40%] bg-ocean/15 blur-3xl" aria-hidden="true" />

        {/* Gráfico de marca (parcelas apiladas) */}
        <img
          src={brandTiles}
          alt=""
          className="pointer-events-none absolute -bottom-6 right-8 w-52 opacity-90 drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
        />

        <Wordmark className="relative" />

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-white text-balance">
            Todos los referrals, en un solo panel.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-sky">
            Seguí estados, pagos y descuentos de cada referral entre clientes de PropHero.
          </p>
        </div>

        <p className="relative text-xs font-medium tracking-wide text-white/40">
          Herramienta interna · PropHero
        </p>
      </aside>

      {/* Panel de inicio de sesión */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {/* Marca compacta para mobile (el panel de marca está oculto) */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-space">
              <img src={logomark} alt="" className="h-5 w-auto" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-space">PropHero</span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-space">
            Iniciá sesión
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Accedé con tu cuenta de PropHero para gestionar los referrals.
          </p>

          <div className="mt-8 flex min-h-[44px] items-center">
            {gisReady
              ? <div ref={buttonRef} />
              : (
                <div className="h-11 w-full max-w-[320px] animate-pulse rounded-md bg-slate-100" aria-hidden="true" />
              )}
          </div>

          {authError && (
            <p
              role="alert"
              className="mt-4 max-w-[320px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {authError}
            </p>
          )}

          <p className="mt-8 max-w-[320px] text-xs leading-relaxed text-slate-400">
            El acceso está restringido a cuentas <span className="font-medium text-slate-500">@prophero.com</span>.
          </p>
        </div>
      </main>
    </div>
  )
}
