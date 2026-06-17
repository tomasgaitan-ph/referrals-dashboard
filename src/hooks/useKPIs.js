import { useQuery } from '@tanstack/react-query'
import { fetchKPIs } from '../api/hubspot'

export function useKPIs({ unit = null } = {}) {
  return useQuery({
    queryKey: ['kpis', { unit }],
    queryFn: () => fetchKPIs({ unit }),
  })
}
