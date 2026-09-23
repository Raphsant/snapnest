import { apiClient } from './api';

export type MediaFileUploadStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
export type MediaFileSource = 'CAMERA' | 'GALLERY';
export type MediaFileType = 'PHOTO' | 'VIDEO' | 'AUDIO' | 'TRANSCRIPT' | 'SUBTITLE';

export type MediaFileFolder = {
  id: string;
  name: string;
};

export type MediaFile = {
  id: string;
  ownerId: string;
  folderId: string | null;
  fileName: string;
  mimeType: string;
  /** Sent as a string because backend stores BigInt. */
  sizeBytes: string;
  s3Key: string;
  fileType: MediaFileType;
  source: MediaFileSource;
  uploadStatus: MediaFileUploadStatus;
  /**
   * Server-assigned human name (Prompt A). Optional because older backends may
   * not return it on GET /files — consumers fall back to `fileName`.
   */
  displayName?: string | null;
  durationSeconds: number | null;
  thumbnailS3Key: string | null;
  /** ISO 8601 string. */
  createdAt: string;
  /** ISO 8601 string. */
  updatedAt: string;
  folder?: MediaFileFolder | null;
};

type FilesEnvelope = MediaFile[] | { items: MediaFile[] };

/** Backend may return either a bare array or `{ items }`. Tolerate both. */
function normalizeFilesResponse(data: FilesEnvelope): MediaFile[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return data.items;
  }
  return [];
}

export type FileViewUrl = {
  viewUrl: string;
  expiresAt: string;
  mimeType: string;
  fileName: string;
};

export type BatchFileViewUrlItem = {
  fileId: string;
  fullUrl: string;
  thumbnailUrl: string | null;
};

const VIEW_URL_TTL_MS = 60 * 60 * 1000;

/** GET /files?folderId=none — only files with folderId IS NULL. */
export const UNFILED_FILES_FOLDER_PARAM = 'none' as const;

export type GetUserFilesOptions = {
  /** Omit for all files; `'none'` for unfiled only; UUID for a specific folder. */
  folderId?: string;
};

/** Auth interceptor in apiClient attaches the JWT automatically. */
export async function getUserFiles(options?: GetUserFilesOptions): Promise<MediaFile[]> {
  const params =
    options?.folderId !== undefined ? { folderId: options.folderId } : undefined;
  const response = await apiClient.get<FilesEnvelope>('/files', { params });
  return normalizeFilesResponse(response.data);
}

/**
 * Presigned GET URLs for feed thumbnails and full-size viewing (1h TTL).
 * Pass `agencyId` to authorize by agency membership instead of personal ownership.
 */
export async function getBatchViewUrls(
  fileIds: string[],
  agencyId?: string,
): Promise<BatchFileViewUrlItem[]> {
  if (fileIds.length === 0) {
    return [];
  }
  const body: { fileIds: string[]; agencyId?: string } = { fileIds };
  if (agencyId !== undefined) {
    body.agencyId = agencyId;
  }
  const response = await apiClient.post<BatchFileViewUrlItem[]>('/files/view-urls', body);
  return response.data;
}

export type DeleteFileResponse = {
  success: boolean;
  deletedFileId: string;
};

/** Permanently deletes the cloud copy (S3 + DB). Does not remove from the device camera roll. */
export async function deleteFile(fileId: string): Promise<DeleteFileResponse> {
  const response = await apiClient.delete<DeleteFileResponse>(`/files/${fileId}`);
  return response.data;
}

/** Assign a file to a folder, or pass `null` to unfile it. */
export async function moveFileToFolder(
  fileId: string,
  folderId: string | null,
): Promise<MediaFile> {
  const response = await apiClient.patch<MediaFile>(`/files/${fileId}/folder`, {
    folderId,
  });
  const data = response.data;
  return {
    ...data,
    sizeBytes: String(data.sizeBytes),
  };
}

/**
 * Target folder for a batch move. A real folder id, or the literal string
 * `'none'` to unfile (the batch endpoint's convention — distinct from the
 * per-file endpoint above, which takes `null`).
 */
export const BATCH_MOVE_UNFILED = 'none';

/**
 * Result of a batch file operation. `skippedIds` are files the server declined
 * to act on (e.g. an agency-owned file in a personal move) — distinct from a
 * transport failure, which rejects the whole call.
 *
 * NOTE: response field names are assumed from the Phase 4b spec and NOT yet
 * verified against the backend. If the server returns different keys, correct
 * them here — every consumer reads through these two functions.
 */
export type BatchFileResult = {
  succeededIds: string[];
  skippedIds: string[];
};

type BatchMoveResponse = {
  movedIds?: string[];
  skippedIds?: string[];
};

type BatchDeleteResponse = {
  deletedIds?: string[];
  skippedIds?: string[];
};

/**
 * POST /files/batch/move — move many files at once. Named `…Request` to stay
 * distinct from the legacy per-file `batchMoveFiles` in utils/batchFileOperations.
 */
export async function requestBatchMove(
  fileIds: readonly string[],
  targetFolderId: string,
): Promise<BatchFileResult> {
  const response = await apiClient.post<BatchMoveResponse>('/files/batch/move', {
    fileIds,
    targetFolderId,
  });
  return {
    succeededIds: response.data.movedIds ?? [],
    skippedIds: response.data.skippedIds ?? [],
  };
}

/** POST /files/batch/delete — permanently delete many cloud files at once. */
export async function requestBatchDelete(fileIds: readonly string[]): Promise<BatchFileResult> {
  const response = await apiClient.post<BatchDeleteResponse>('/files/batch/delete', {
    fileIds,
  });
  return {
    succeededIds: response.data.deletedIds ?? [],
    skippedIds: response.data.skippedIds ?? [],
  };
}

/** Full-resolution presigned GET for the media viewer (uses batch endpoint). */
export async function getFileViewUrl(fileId: string): Promise<FileViewUrl> {
  const items = await getBatchViewUrls([fileId]);
  const item = items[0];
  if (item === undefined) {
    throw new Error('Media file not found or not ready to view');
  }
  return {
    viewUrl: item.fullUrl,
    expiresAt: new Date(Date.now() + VIEW_URL_TTL_MS).toISOString(),
    mimeType: '',
    fileName: '',
  };
}
