import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { deleteFile, type DeleteFileResponse } from '../services/filesService';
import { queryClient } from '../services/queryClient';

export type DeleteFileVariables = {
  fileId: string;
};

/**
 * Deleting a file changes the all-files list, folder counts, and folder contents.
 * Prefix-invalidating ['folder'] refreshes all folder-detail queries.
 */
export function useDeleteFile(): UseMutationResult<DeleteFileResponse, Error, DeleteFileVariables> {
  return useMutation<DeleteFileResponse, Error, DeleteFileVariables>({
    mutationFn: ({ fileId }) => deleteFile(fileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] });
      void queryClient.invalidateQueries({ queryKey: ['folders'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
    },
  });
}
