import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getUserFiles, type MediaFile } from '../services/filesService';

export const FILES_QUERY_KEY = ['files'] as const;

const SIXTY_SECONDS = 60_000;

export function useFiles(): UseQueryResult<MediaFile[], Error> {
  return useQuery<MediaFile[], Error>({
    queryKey: FILES_QUERY_KEY,
    queryFn: getUserFiles,
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
  });
}
