// Lógica pura de filtrado y agrupación de referrals (extraída del Dashboard para
// testearla de forma aislada y mantener la UI sin lógica de negocio).

// Aplica los filtros del dashboard sobre la lista de referrals.
// Todos los filtros son opcionales; un valor vacío no filtra.
export function filterReferrals(list, {
  search = '',
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

function fullName(c) {
  if (!c) return ''
  return [c.firstname, c.lastname].filter(Boolean).join(' ')
}

// Accesores por columna (las keys matchean las columnas de ReferralTable).
const SORT_ACCESSORS = {
  referral_id:     r => r.referral_id,
  unit:            r => r.unit,
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
