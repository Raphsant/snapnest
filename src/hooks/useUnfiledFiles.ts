import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  UNFILED_FILES_FOLDER_PARAM,
  getUserFiles,
  type MediaFile,
} from '../services/filesService';

export const UNFILED_FILES_QUERY_KEY = ['files', UNFILED_FILES_FOLDER_PARAM] as const;

const SIXTY_SECONDS = 60_000;

export function useUnfiledFiles(): UseQueryResult<MediaFile[], Error> {
  return useQuery<MediaFile[], Error>({
    queryKey: UNFILED_FILES_QUERY_KEY,
    queryFn: () => getUserFiles({ folderId: UNFILED_FILES_FOLDER_PARAM }),
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
  });
}
