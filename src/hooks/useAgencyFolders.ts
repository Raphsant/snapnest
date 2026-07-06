import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getAgencyFolders, type AgencyFolder } from '../services/agencyService';

export const agencyFoldersQueryKey = (
  agencyId: string,
): readonly ['agency', 'folders', string] => ['agency', 'folders', agencyId] as const;

const SIXTY_SECONDS = 60_000;

export function useAgencyFolders(
  agencyId: string | undefined,
): UseQueryResult<AgencyFolder[], Error> {
  const id = agencyId ?? '';
  return useQuery<AgencyFolder[], Error>({
    queryKey: agencyFoldersQueryKey(id),
    queryFn: () => getAgencyFolders(id),
    enabled: id.length > 0,
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
  });
}
