import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { createFolder, type Folder } from '../services/foldersService';
import { queryClient } from '../services/queryClient';
import { FOLDERS_QUERY_KEY } from './useFolders';

type CreateFolderVariables = {
  name: string;
  parentFolderId?: string;
};

export function useCreateFolder(): UseMutationResult<Folder, Error, CreateFolderVariables> {
  return useMutation<Folder, Error, CreateFolderVariables>({
    mutationFn: ({ name, parentFolderId }) => createFolder(name, parentFolderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
    },
  });
}
