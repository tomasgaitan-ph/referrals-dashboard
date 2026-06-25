// Fuente de verdad única para el "last updated" que se muestra en el header del
// dashboard, el header del detalle y el recordatorio de Refresh. Devuelve el
// timestamp (ms) más reciente entre las queries de datos (lista, detalle, kpis),
// leído del cache de React Query — así los tres lugares muestran la misma hora sin
// importar desde qué pantalla se haya actualizado. 0 si todavía no hay datos.
const DATA_QUERY_KEYS = [['referrals'], ['referral'], ['kpis']]

export function latestDataUpdate(queryClient) {
  const cache = queryClient.getQueryCache()
  let max = 0
  for (const key of DATA_QUERY_KEYS) {
    for (const q of cache.findAll({ queryKey: key })) {
      max = Math.max(max, q.state.dataUpdatedAt || 0)
    }
  }
  return max
}

// Formatea el timestamp como en los headers: "dd/mm/aaaa - hh:mm" (es-ES).
export function formatLastUpdated(ts) {
  const d = new Date(ts)
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${date} - ${time}`
}
