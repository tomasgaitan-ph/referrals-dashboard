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
