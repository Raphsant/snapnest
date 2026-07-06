import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getMe, type Me } from '../services/agencyService';

export const ME_QUERY_KEY = ['me'] as const;

const FIVE_MINUTES = 5 * 60 * 1000;

export function useMe(enabled = true): UseQueryResult<Me, Error> {
  return useQuery<Me, Error>({
    queryKey: ME_QUERY_KEY,
    queryFn: getMe,
    enabled,
    staleTime: FIVE_MINUTES,
    refetchOnWindowFocus: false,
  });
}
