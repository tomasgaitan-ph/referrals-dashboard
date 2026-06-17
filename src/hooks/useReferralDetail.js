import { useQuery } from '@tanstack/react-query'
import { fetchReferralDetail } from '../api/hubspot'

export function useReferralDetail(referralId) {
  return useQuery({
    queryKey: ['referral', referralId],
    queryFn: () => fetchReferralDetail(referralId),
    enabled: Boolean(referralId),
  })
}
