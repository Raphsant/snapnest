import * as FileSystem from 'expo-file-system/legacy';

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

/** Shared options for every presigned PUT. BACKGROUND is what survives a lock. */
function putOptions(contentType: string): FileSystem.FileSystemUploadOptions {
  return {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    // Explicit even though it is the library default — this single line is the
    // difference between a transfer that survives screen-lock and one that dies.
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    headers: { 'Content-Type': contentType },
  };
}

/**
 * Normalize an upload task's outcome into the one failure channel callers expect.
 *
 * Two ways this differs from `xhr.onload`, both of which would otherwise be
 * read as success:
 *  - a non-2xx response RESOLVES, carrying the status in the result. Nothing
 *    else checks it, so an S3 403 would sail through to /complete and mark a
 *    MediaFile uploaded with no object behind it.
 *  - a cancelled task resolves `null`/`undefined` with no status at all.
 *
 * Thrown messages match the strings the XHR implementation produced, so
 * uploadManager's friendlyError() keeps classifying them the same way.
 */
function assertUploadSucceeded(
  result: FileSystem.FileSystemUploadResult | undefined | null,
  label: 'file' | 'thumbnail',
): void {
  if (!result) {
    throw new Error(`Failed uploading ${label} to storage.`);
  }
  if (result.status < 200 || result.status >= 300) {
    const prefix = label === 'thumbnail' ? 'Thumbnail upload' : 'Upload';
    throw new Error(`${prefix} failed with status ${result.status}`);
  }
}

/**
 * PUT a local file to its presigned S3 URL on a native background session.
 *
 * Why not fetch()+XHR (what this replaced): an RN network request lives on the
 * JS thread, so iOS suspending the app killed the transfer — capture, lock the
 * screen, and nothing uploaded until the app was reopened. `createUploadTask`
 * hands the PUT to a native NSURLSession with a background configuration,
 * which keeps running while the app is suspended. Streaming from disk also
 * removes the old fetch()->blob() step, which materialized the entire file in
 * JS memory (~100MB+ for a 60s 1080p video) before sending a single byte.
 *
 * TIMING — a resolution arriving long after this was called is NORMAL, not a
 * hang: while the device is locked the native task runs but JS is frozen, so
 * the result is delivered on the next foreground. Never wrap this in a timeout
 * or race it against one; doing so would abandon a transfer that is succeeding.
 *
 * ERRORS map onto the existing status machine — a throw here lands in
 * processItem's catch, which marks the item failed and schedules the normal
 * backoff retry. No new states.
 *
 * One behavior change worth knowing: an iOS background session does not fail
 * when the connection drops mid-transfer, it retries natively until it
 * succeeds. Connectivity lost after the PUT starts therefore keeps the item in
 * 'uploading' rather than bouncing it to 'failed' — the transfer resumes on its
 * own, without a re-presign (and so without a duplicate S3 object).
 */
export async function uploadFileToS3(
  presignedUrl: string,
  fileUri: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const task = FileSystem.createUploadTask(
    presignedUrl,
    fileUri,
    putOptions(mimeType),
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      // -1/0 means the total isn't known yet; skip rather than divide by it.
      if (totalBytesExpectedToSend <= 0) {
        return;
      }
      onProgress?.(Math.round((totalBytesSent / totalBytesExpectedToSend) * 100));
    },
  );

  const result = await task.uploadAsync();
  assertUploadSucceeded(result, 'file');
  onProgress?.(100);
}

/**
 * PUT a local JPEG thumbnail to its presigned URL.
 *
 * The presign is bound to `Content-Type: image/jpeg` exactly — any other value
 * (or an omitted header) is rejected by S3 with a 403. Resolves on 2xx, rejects
 * otherwise; callers decide whether a rejection should fail the parent upload.
 *
 * Same background session as the main file: a thumb PUT that is in flight when
 * the screen locks finishes natively instead of being dropped.
 */
export async function uploadThumbnailToS3(presignedUrl: string, thumbnailUri: string): Promise<void> {
  const task = FileSystem.createUploadTask(presignedUrl, thumbnailUri, putOptions('image/jpeg'));

  const result = await task.uploadAsync();
  assertUploadSucceeded(result, 'thumbnail');
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
