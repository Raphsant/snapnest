import { apiClient } from './api';

export type UploadSource = 'camera' | 'gallery';

export type UploadFileInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string;
  agencyId?: string;
  source: UploadSource;
  /** When true, the backend also issues a presigned PUT for a JPEG thumbnail. */
  hasThumbnail?: boolean;
};

export type PresignedUploadResponse = {
  uploadId: string;
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  /** Presigned PUT for the thumbnail (bound to Content-Type: image/jpeg). Null unless hasThumbnail was sent. */
  thumbnailUploadUrl: string | null;
};

/**
 * The complete endpoint derives everything from the uploadId in the URL; its
 * DTO whitelists only thumbnailUploaded (forbidNonWhitelisted rejects extras).
 */
type ConfirmUploadRequest = {
  /** Whether the thumbnail PUT succeeded. Must be sent explicitly whenever hasThumbnail was requested. */
  thumbnailUploaded?: boolean;
};

type ConfirmUploadResponse = {
  success: boolean;
};

type UploadVideoResult = {
  uploadId: string;
  fileId: string;
  s3Key: string;
  fileName: string;
};

export async function requestPresignedUrl(file: UploadFileInput): Promise<PresignedUploadResponse> {
  const response = await apiClient.post<PresignedUploadResponse>('/uploads', file);
  return response.data;
}

export async function uploadFileToS3(
  presignedUrl: string,
  fileUri: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const fileResponse = await fetch(fileUri);
  const fileBlob = await fileResponse.blob();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
      if (!event.lengthComputable) {
        return;
      }
      const percentage = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percentage);
    };

    xhr.onerror = () => {
      reject(new Error('Failed uploading file to storage.'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.send(fileBlob);
  });
}

/**
 * PUT a local JPEG thumbnail to its presigned URL.
 *
 * The presign is bound to `Content-Type: image/jpeg` exactly — any other value
 * (or an omitted header) is rejected by S3 with a 403. Resolves on 2xx, rejects
 * otherwise; callers decide whether a rejection should fail the parent upload.
 */
export async function uploadThumbnailToS3(presignedUrl: string, thumbnailUri: string): Promise<void> {
  const fileResponse = await fetch(thumbnailUri);
  const fileBlob = await fileResponse.blob();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');

    xhr.onerror = () => {
      reject(new Error('Failed uploading thumbnail to storage.'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Thumbnail upload failed with status ${xhr.status}`));
    };

    xhr.send(fileBlob);
  });
}

export async function confirmUpload(
  uploadId: string,
  thumbnailUploaded?: boolean,
): Promise<ConfirmUploadResponse> {
  const payload: ConfirmUploadRequest = {};
  if (thumbnailUploaded !== undefined) {
    payload.thumbnailUploaded = thumbnailUploaded;
  }
  const response = await apiClient.post<ConfirmUploadResponse>(`/uploads/${uploadId}/complete`, payload);
  return response.data;
}

export async function uploadVideoFromGallery(
  fileUri: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  onProgress?: (pct: number) => void,
): Promise<UploadVideoResult> {
  const presigned = await requestPresignedUrl({
    fileName,
    mimeType,
    sizeBytes,
    source: 'gallery',
  });

  await uploadFileToS3(presigned.uploadUrl, fileUri, mimeType, onProgress);
  await confirmUpload(presigned.uploadId);

  return {
    uploadId: presigned.uploadId,
    fileId: presigned.fileId,
    s3Key: presigned.s3Key,
    fileName,
  };
}
