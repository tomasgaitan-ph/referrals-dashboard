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

const ENDPOINTS = {
  LIST: '/webhook/dashboard-referrals-list',
  DETAIL: '/webhook/dashboard-referral-detail',
  UPDATE: '/webhook/dashboard-referral-update',
  KPIS: '/webhook/dashboard-referrals-kpis',
  FISCAL_UPDATE: '/webhook/dashboard-update-referrer-fiscal',
}

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
    throw new ApiError(res.status, `Error ${res.status}: ${text || res.statusText}`)
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
  return request(ENDPOINTS.LIST, { unit, status, search })
}

export function fetchReferralDetail(referralId) {
  return request(ENDPOINTS.DETAIL, { referralId })
}

export function updateReferral(referralId, properties) {
  return request(ENDPOINTS.UPDATE, { referralId, properties })
}

export function fetchKPIs({ unit = null } = {}) {
  return request(ENDPOINTS.KPIS, { unit })
}

export function updateReferrerFiscalAndPay(referralId, referrerContactId, fiscalData) {
  const { iban, nif, address } = fiscalData
  return request(ENDPOINTS.FISCAL_UPDATE, { referralId, referrerContactId, iban, nif, address })
}
