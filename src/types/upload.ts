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
};

export type EnqueueUploadInput = {
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: UploadSource;
};
