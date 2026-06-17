import { useQuery } from '@tanstack/react-query'
import { fetchReferralsList } from '../api/hubspot'

export function useReferrals({ unit = null } = {}) {
  return useQuery({
    queryKey: ['referrals', { unit }],
    queryFn: () => fetchReferralsList({ unit }),
  })
}
