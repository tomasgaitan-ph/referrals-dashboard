const BASE_URL = import.meta.env.VITE_N8N_BASE_URL

// Token de auth (ID token de Google) inyectado por AuthContext. NO es un secret
// estático: es un JWT per-usuario, de vida corta, que n8n valida server-side.
let authToken = null
// Handler que se dispara ante un 401 (sesión vencida o no autorizada).
let onUnauthorized = null

export function setAuthToken(token) {
  authToken = token
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

// Sufijo de entorno: '-prod' en Production (Vercel), '' en dev/local.
// El base (VITE_N8N_BASE_URL) es el mismo host para dev y prod; sólo cambia
// el sufijo del path del webhook. Así main (Production) pega a prod y los
// branches de feature (Preview) + local pegan a dev, sin if de entorno.
const ENV_SUFFIX = import.meta.env.VITE_N8N_ENV_SUFFIX || ''

const ENDPOINTS = {
  LIST: `/webhook/dashboard-referrals-list${ENV_SUFFIX}`,
  DETAIL: `/webhook/dashboard-referral-detail${ENV_SUFFIX}`,
  KPIS: `/webhook/dashboard-referrals-kpis${ENV_SUFFIX}`,
  MARK_REFERRER_PAID: `/webhook/dashboard-mark-referrer-paid${ENV_SUFFIX}`,
}

// La lista (d1) pagina server-side (default pageSize 20, cap 200). Pedimos una
// sola página grande para conservar el modelo client-side actual (filtrado /
// orden / group-by-referrer / export / KPIs sobre el set completo). Mismo límite
// de 200 ya documentado. Cuando el volumen supere 200 hay que mover paginación y
// filtros al backend (ver "Próximos pasos" en CLAUDE.md).
const LIST_PAGE = 1
const LIST_PAGE_SIZE = 200

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request(endpoint, body = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (res.status === 401) {
    if (onUnauthorized) onUnauthorized()
    throw new ApiError(401, 'Sesión expirada o no autorizada')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // El back devuelve el motivo en JSON ({ error } / { message }); preferimos ese
    // mensaje legible (ej. 422 de mark-paid) antes que el body crudo.
    let detail = text || res.statusText
    if (text) {
      try {
        const parsed = JSON.parse(text)
        detail = parsed.error || parsed.message || text
      } catch {
        // body no-JSON: dejamos el texto tal cual
      }
    }
    throw new ApiError(res.status, detail)
  }

  const text = await res.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(res.status, `Respuesta inválida del servidor: ${text.slice(0, 100)}`)
  }
}

export function fetchReferralsList({ unit = null, status = null, search = null } = {}) {
  return request(ENDPOINTS.LIST, { unit, status, search, page: LIST_PAGE, pageSize: LIST_PAGE_SIZE })
}

export function fetchReferralDetail(referralId) {
  return request(ENDPOINTS.DETAIL, { referralId })
}

export function fetchKPIs({ unit = null } = {}) {
  return request(ENDPOINTS.KPIS, { unit })
}

// Marca el pago al referrer como pagado (acción manual desde el detalle). El back
// revalida (deal en pre-settlement + real_settlement_date) y es idempotente:
// 200 { success, action } al marcar, 200 { info } si ya estaba, 422 { error } si
// no aplica. Setea referrer_payment_status=paid, referral_status=paid y suma €500.
export function markReferrerPaid(referralId) {
  return request(ENDPOINTS.MARK_REFERRER_PAID, { referralId })
}
