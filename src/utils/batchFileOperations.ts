import { deleteFile, moveFileToFolder } from '../services/filesService';
import { queryClient } from '../services/queryClient';

export type BatchOperationResult = {
  succeeded: number;
  failed: number;
};

async function invalidateFileQueries(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['files'] }),
    queryClient.invalidateQueries({ queryKey: ['folders'] }),
    queryClient.invalidateQueries({ queryKey: ['folder'] }),
  ]);
}

export async function batchMoveFiles(
  fileIds: readonly string[],
  folderId: string | null,
): Promise<BatchOperationResult> {
  if (fileIds.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    fileIds.map((fileId) => moveFileToFolder(fileId, folderId)),
  );

  await invalidateFileQueries();

  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded: results.length - failed, failed };
}

export async function batchDeleteFiles(fileIds: readonly string[]): Promise<BatchOperationResult> {
  if (fileIds.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const results = await Promise.allSettled(fileIds.map((fileId) => deleteFile(fileId)));

  await invalidateFileQueries();

  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded: results.length - failed, failed };
}
