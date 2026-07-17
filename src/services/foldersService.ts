import { apiClient } from './api';
import type { MediaFile } from './filesService';

export type Folder = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  /** Exactly one folder per user (the "Unfiled" folder) has this true. */
  isSystem: boolean;
};

export type FolderDetails = {
  folder: Folder;
  files: MediaFile[];
};

type BackendFolderCount = {
  files: number;
};

/** Raw folder row from GET /folders (includes Prisma _count). */
type BackendFolderWithCount = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
  _count: BackendFolderCount;
};

/** POST /folders returns a folder row without _count. */
type BackendFolder = Omit<BackendFolderWithCount, '_count'>;

type BackendFolderWithFiles = BackendFolder & {
  files: BackendMediaFile[];
};

/** Folder detail files may omit serialized sizeBytes formatting. */
type BackendMediaFile = Omit<MediaFile, 'sizeBytes'> & {
  sizeBytes: string | number;
};

function mapFolder(row: BackendFolderWithCount): Folder {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    type: row.type,
    parentFolderId: row.parentFolderId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fileCount: row._count.files,
    isSystem: row.isSystem,
  };
}

function mapFolderFromBare(row: BackendFolder, fileCount: number): Folder {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    type: row.type,
    parentFolderId: row.parentFolderId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fileCount,
    isSystem: row.isSystem,
  };
}

function normalizeMediaFile(file: BackendMediaFile): MediaFile {
  return {
    ...file,
    sizeBytes: String(file.sizeBytes),
  };
}

/** Auth interceptor in apiClient attaches the JWT automatically. */
export async function getFolders(): Promise<Folder[]> {
  const response = await apiClient.get<BackendFolderWithCount[]>('/folders');
  return response.data.map(mapFolder);
}

export async function createFolder(name: string, parentFolderId?: string): Promise<Folder> {
  const body: { name: string; parentFolderId?: string } = { name: name.trim() };
  if (parentFolderId !== undefined) {
    body.parentFolderId = parentFolderId;
  }
  const response = await apiClient.post<BackendFolder>('/folders', body);
  return mapFolderFromBare(response.data, 0);
}

export async function updateFolder(id: string, name: string): Promise<Folder> {
  const response = await apiClient.patch<BackendFolder>(`/folders/${id}`, {
    name: name.trim(),
  });
  return mapFolderFromBare(response.data, 0);
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/folders/${id}`);
}

export async function getFolderDetails(id: string): Promise<FolderDetails> {
  const response = await apiClient.get<BackendFolderWithFiles>(`/folders/${id}`);
  const { files, ...folderRow } = response.data;
  const normalizedFiles = files.map(normalizeMediaFile);
  const folder = mapFolderFromBare(folderRow, normalizedFiles.length);
  return { folder, files: normalizedFiles };
}
