import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getFolders, type Folder } from '../services/foldersService';

export const FOLDERS_QUERY_KEY = ['folders'] as const;

const SIXTY_SECONDS = 60_000;

export function useFolders(): UseQueryResult<Folder[], Error> {
  return useQuery<Folder[], Error>({
    queryKey: FOLDERS_QUERY_KEY,
    queryFn: getFolders,
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
  });
}
