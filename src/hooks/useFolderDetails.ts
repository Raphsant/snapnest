import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { UNFILED_FILES_FOLDER_PARAM } from '../services/filesService';
import { getFolderDetails, type FolderDetails } from '../services/foldersService';
import type { FolderDetailFolderId } from '../navigation/foldersTypes';

export const folderDetailsQueryKey = (folderId: string): readonly ['folder', string] =>
  ['folder', folderId] as const;

const SIXTY_SECONDS = 60_000;

export function useFolderDetails(
  folderId: FolderDetailFolderId | undefined,
): UseQueryResult<FolderDetails, Error> {
  const id = folderId ?? '';
  const enabled =
    folderId !== undefined &&
    folderId.length > 0 &&
    folderId !== UNFILED_FILES_FOLDER_PARAM;

  return useQuery<FolderDetails, Error>({
    queryKey: folderDetailsQueryKey(id),
    queryFn: () => getFolderDetails(id),
    staleTime: SIXTY_SECONDS,
    refetchOnWindowFocus: false,
    enabled,
  });
}
