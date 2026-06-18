import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { deleteFolder } from '../services/foldersService';
import { queryClient } from '../services/queryClient';
import { FOLDERS_QUERY_KEY } from './useFolders';

export function useDeleteFolder(): UseMutationResult<void, Error, string> {
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteFolder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
    },
  });
}
