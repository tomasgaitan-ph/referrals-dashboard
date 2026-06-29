// Lógica pura de filtrado y agrupación de referrals (extraída del Dashboard para
// testearla de forma aislada y mantener la UI sin lógica de negocio).

import { productChoiceToProgram } from './program'

// Aplica los filtros del dashboard sobre la lista de referrals.
// Todos los filtros son opcionales; un valor vacío no filtra.
export function filterReferrals(list, {
  search = '',
  programFilter = '',
  statusFilter = '',
  paymentFilter = '',
  discountFilter = '',
  dateFrom = '',
  dateTo = '',
} = {}) {
  let result = list ?? []

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(r =>
      r.referral_id?.toLowerCase().includes(q) ||
      `${r.referrer?.firstname ?? ''} ${r.referrer?.lastname ?? ''}`.toLowerCase().includes(q) ||
      `${r.referido?.firstname ?? ''} ${r.referido?.lastname ?? ''}`.toLowerCase().includes(q) ||
      r.deal?.dealname?.toLowerCase().includes(q)
    )
  }
  // Programa: client-side, derivado de deal.product_choice (no de unit). Referrals
  // sin product_choice (programa null) quedan fuera de cualquier programa elegido.
  if (programFilter)  result = result.filter(r => productChoiceToProgram(r.deal?.product_choice) === programFilter)
  if (statusFilter)   result = result.filter(r => r.referral_status         === statusFilter)
  if (paymentFilter)  result = result.filter(r => r.referrer_payment_status  === paymentFilter)
  if (discountFilter) result = result.filter(r => r.referido_discount_status === discountFilter)
  if (dateFrom) {
    const from = new Date(dateFrom)
    result = result.filter(r => r.created_date && new Date(r.created_date) >= from)
  }
  if (dateTo) {
    const to = new Date(dateTo)
    to.setHours(23, 59, 59, 999)
    result = result.filter(r => r.created_date && new Date(r.created_date) <= to)
  }

  return result
}

// Estado de pago del referrer para mostrar (solo display, no toca el dato crudo
// ni los filtros): si el pago está pendiente pero el descuento ya se aplicó, el
// referrer está listo para transferir → 'ready_to_transfer'. Resto: valor crudo.
export function referrerPaymentStatus(referral) {
  const payment = referral?.referrer_payment_status
  if (payment === 'pending' && referral?.referido_discount_status === 'applied') {
    return 'ready_to_transfer'
  }
  return payment
}

// Estado del botón "Mark as paid" del detalle, por prioridad:
//   'paid'        → ya pagado: mostrar "completed", sin botón.
//   'available'   → el back habilita el pago ahora (canMarkReferrerPaid): botón ON.
//   'unavailable' → todavía no corresponde: botón OFF (tooltip).
// La condición por producto (SP = pre-settlement + fecha; VH/IH = Investment Ticket
// en Closed Won) la calcula el back y llega ya resuelta en canMarkReferrerPaid; el
// front no la conoce. 'paid' tiene prioridad sobre el flag (defensivo ante choque).
export function referrerPaymentButtonState(referral, canMarkReferrerPaid) {
  if (referral?.referrer_payment_status === 'paid') return 'paid'
  if (canMarkReferrerPaid === true) return 'available'
  return 'unavailable'
}

// Rango [start, end] del período pedido relativo a `now`. Semana = lunes–domingo;
// mes = mes calendario. Devuelve null para 'all'/vacío (sin filtro).
function periodRange(period, now) {
  if (period === 'week') {
    const dow = (now.getDay() + 6) % 7 // 0 = lunes … 6 = domingo
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow, 0, 0, 0, 0)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }
  if (period === 'last_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    }
  }
  return null
}

// Filtra por settlement date (deal.real_settlement_date, anidado en el objeto deal
// que devuelve d1) dentro del período elegido. 'all'/vacío no filtra. Referrals sin
// deal o sin settlement date quedan fuera de cualquier período acotado.
export function filterByPeriod(list, period, now = new Date()) {
  const range = periodRange(period, now)
  if (!range) return list ?? []
  return (list ?? []).filter(r => {
    const settlement = r.deal?.real_settlement_date
    if (!settlement) return false
    const t = new Date(settlement)
    return t >= range.start && t <= range.end
  })
}

function fullName(c) {
  if (!c) return ''
  return [c.firstname, c.lastname].filter(Boolean).join(' ')
}

// Accesores por columna (las keys matchean las columnas de ReferralTable).
const SORT_ACCESSORS = {
  referral_id:     r => r.referral_id,
  program:         r => productChoiceToProgram(r.deal?.product_choice),
  referrer:        r => fullName(r.referrer),
  referrer_code:   r => r.referrer?.referrer_code,
  total_referrals: r => r.referrer?.total_referrals,
  referido:        r => fullName(r.referido),
  deal:            r => r.deal?.dealname,
  status:          r => r.referral_status,
  pago:            r => r.referrer_payment_status,
  descuento:       r => r.referido_discount_status,
  fecha:           r => r.created_date,
}

const NUMERIC_KEYS = new Set(['total_referrals'])
const DATE_KEYS    = new Set(['fecha'])

// Ordena las filas por la columna `key` en dirección `dir` ('asc' | 'desc').
// Los valores vacíos/nulos van siempre al final. Key desconocida → sin cambios.
export function sortReferrals(rows, key, dir = 'asc') {
  const accessor = SORT_ACCESSORS[key]
  if (!accessor) return rows ?? []
  const sign = dir === 'desc' ? -1 : 1
  return [...(rows ?? [])].sort((a, b) => {
    const va = accessor(a)
    const vb = accessor(b)
    const aEmpty = va === null || va === undefined || va === ''
    const bEmpty = vb === null || vb === undefined || vb === ''
    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1   // vacíos al final, sin importar la dirección
    if (bEmpty) return -1
    if (NUMERIC_KEYS.has(key)) return (Number(va) - Number(vb)) * sign
    if (DATE_KEYS.has(key))    return (new Date(va) - new Date(vb)) * sign
    return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * sign
  })
}

// Agrupa por referrer (referrer_code, o referralHsId como fallback), conservando el
// referral más reciente de cada uno, y ordena por fecha de creación descendente.
export function groupByReferrer(list) {
  const grouped = new Map()
  for (const r of (list ?? [])) {
    const key = r.referrer?.referrer_code ?? r.referralHsId
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, r)
    } else {
      const dExisting = new Date(existing.created_date ?? 0)
      const dCurrent  = new Date(r.created_date ?? 0)
      if (dCurrent > dExisting) grouped.set(key, r)
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.created_date ?? 0) - new Date(a.created_date ?? 0))
}
