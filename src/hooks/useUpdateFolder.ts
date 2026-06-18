import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { updateFolder, type Folder } from '../services/foldersService';
import { queryClient } from '../services/queryClient';
import { folderDetailsQueryKey } from './useFolderDetails';
import { FOLDERS_QUERY_KEY } from './useFolders';

type UpdateFolderVariables = {
  id: string;
  name: string;
};

export function useUpdateFolder(): UseMutationResult<Folder, Error, UpdateFolderVariables> {
  return useMutation<Folder, Error, UpdateFolderVariables>({
    mutationFn: ({ id, name }) => updateFolder(id, name),
    onSuccess: (_folder, variables) => {
      void queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: folderDetailsQueryKey(variables.id),
      });
    },
  });
}
