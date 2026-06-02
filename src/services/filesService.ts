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

/** Auth interceptor in apiClient attaches the JWT automatically. */
export async function getUserFiles(): Promise<MediaFile[]> {
  const response = await apiClient.get<FilesEnvelope>('/files');
  return normalizeFilesResponse(response.data);
}
