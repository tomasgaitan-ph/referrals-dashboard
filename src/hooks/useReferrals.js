import { useQuery } from '@tanstack/react-query'
import { fetchReferralsList } from '../api/hubspot'

export function useReferrals() {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: () => fetchReferralsList(),
  })
}
