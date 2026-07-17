import type { UploadSource } from '../services/uploadService';

export type UploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export type UploadQueueItem = {
  id: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: UploadSource;
  status: UploadStatus;
  progress: number;
  attemptCount: number;
  errorMessage: string | null;
  backendFileId: string | null;
  backendUploadId: string | null;
  createdAt: number;
  /** Local URI of the pre-generated JPEG thumbnail, or null if none was made. */
  thumbnailUri: string | null;
  /** Set when submitting into an agency workspace folder; null for personal captures. */
  agencyId: string | null;
  folderId: string | null;
};

export type EnqueueUploadInput = {
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: UploadSource;
  agencyId?: string | null;
  folderId?: string | null;
  thumbnailUri?: string | null;
};
