import { apiClient } from './api';

export type UploadSource = 'camera' | 'gallery';

export type UploadFileInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string;
  agencyId?: string;
  source: UploadSource;
};

export type PresignedUploadResponse = {
  uploadId: string;
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
};

type ConfirmUploadRequest = {
  fileId: string;
  s3Key: string;
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

export async function confirmUpload(uploadId: string, fileId: string, s3Key: string): Promise<ConfirmUploadResponse> {
  const payload: ConfirmUploadRequest = { fileId, s3Key };
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
  await confirmUpload(presigned.uploadId, presigned.fileId, presigned.s3Key);

  return {
    uploadId: presigned.uploadId,
    fileId: presigned.fileId,
    s3Key: presigned.s3Key,
    fileName,
  };
}
