const BASE_URL = import.meta.env.VITE_N8N_BASE_URL
const API_KEY = import.meta.env.VITE_API_KEY

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
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 401) {
    throw new ApiError(401, 'API key inválida o no configurada')
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
