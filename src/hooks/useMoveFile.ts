import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { moveFileToFolder, type MediaFile } from '../services/filesService';
import { queryClient } from '../services/queryClient';

export type MoveFileVariables = {
  fileId: string;
  folderId: string | null;
};

/**
 * Moving a file changes the all-files list, every folder's file count, and the
 * contents of both the source and destination folders. Prefix-invalidating
 * ['folder'] refreshes all folder-detail queries without tracking which IDs
 * were involved.
 */
export function useMoveFile(): UseMutationResult<MediaFile, Error, MoveFileVariables> {
  return useMutation<MediaFile, Error, MoveFileVariables>({
    mutationFn: ({ fileId, folderId }) => moveFileToFolder(fileId, folderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] });
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
    },
  });
}
