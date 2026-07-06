import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  getAgencyFolderDetails,
  type AgencyFolderDetails,
} from '../services/agencyService';

export const agencyFolderDetailsQueryKey = (
  folderId: string,
): readonly ['agency', 'folder', string] => ['agency', 'folder', folderId] as const;

const SIXTY_SECONDS = 60_000;

export function useAgencyFolderDetails(
  folderId: string | undefined,
): UseQueryResult<AgencyFolderDetails, Error> {
  const id = folderId ?? '';
  return useQuery<AgencyFolderDetails, Error>({
    queryKey: agencyFolderDetailsQueryKey(id),
    queryFn: () => getAgencyFolderDetails(id),
    enabled: id.length > 0,
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
  });
}
