import { FILES_QUERY_KEY } from '../hooks/useFiles';
import { selectNextQueued, useUploadQueueStore } from '../store/uploadQueueStore';
import type { EnqueueUploadInput, UploadQueueItem } from '../types/upload';
import { queryClient } from './queryClient';
import {
  confirmUpload,
  requestPresignedUrl,
  uploadFileToS3,
} from './uploadService';

/** Max number of attempts (initial + retries) before we give up. */
const MAX_ATTEMPTS = 3;
/** Successful items linger for this long so the UI can show a "done" state. */
const SUCCESS_CLEANUP_MS = 3000;

/**
 * Module-level singleton flag. Prevents concurrent processing — we want strict
 * FIFO uploads for MVP simplicity. processQueue() bails immediately if true.
 */
let isProcessing = false;

function getStore() {
  return useUploadQueueStore.getState();
}

function friendlyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (/network/i.test(msg)) {
      return 'Network error — will retry when connection improves.';
    }
    if (/401|unauthor/i.test(msg)) {
      return 'Sign-in expired. Log in again to resume uploads.';
    }
    return msg;
  }
  return 'Unknown upload error.';
}

/**
 * Public — adds a file to the queue and kicks off processing.
 * Fire-and-forget from the caller's perspective (CameraScreen).
 */
export function enqueueUpload(input: EnqueueUploadInput): string {
  const id = getStore().addItem(input);
  void processQueue();
  return id;
}

/**
 * Public — clears the failure state for one item and reattempts it.
 * Note: store.retryItem already increments attemptCount.
 */
export function retryUpload(itemId: string): void {
  getStore().retryItem(itemId);
  void processQueue();
}

/**
 * Public — drains the queue one item at a time.
 * Re-entrant calls during processing are no-ops thanks to `isProcessing`.
 */
export async function processQueue(): Promise<void> {
  if (isProcessing) {
    return;
  }
  isProcessing = true;

  try {
    let next = selectNextQueued(getStore());
    while (next !== undefined) {
      await processItem(next);
      next = selectNextQueued(getStore());
    }
  } finally {
    isProcessing = false;
  }
}

async function processItem(item: UploadQueueItem): Promise<void> {
  const { id } = item;
  const store = getStore();

  store.updateItem(id, { status: 'uploading', progress: 0, errorMessage: null });

  try {
    // 1. Ask backend for a presigned URL + register the MediaFile + UploadJob.
    const presigned = await requestPresignedUrl({
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      source: item.source,
    });

    getStore().updateItem(id, {
      backendFileId: presigned.fileId,
      backendUploadId: presigned.uploadId,
    });

    // 2. PUT the file to S3 with progress streaming back into the store.
    await uploadFileToS3(presigned.uploadUrl, item.localUri, item.mimeType, (pct) => {
      getStore().updateItem(id, { progress: pct });
    });

    // 3. Tell the backend the upload finished so it can flip MediaFile.uploadStatus.
    await confirmUpload(presigned.uploadId, presigned.fileId, presigned.s3Key);

    getStore().updateItem(id, { status: 'uploaded', progress: 100, errorMessage: null });

    // 4. Refresh the Activity tab's files list so the new MediaFile shows up.
    void queryClient.invalidateQueries({ queryKey: FILES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['batchViewUrls'] });

    // 5. Auto-clean successful items so Activity doesn't grow unbounded.
    setTimeout(() => {
      getStore().removeItem(id);
    }, SUCCESS_CLEANUP_MS);
  } catch (error: unknown) {
    console.error('[uploadManager] upload failed', { id, attempt: item.attemptCount + 1, error });

    const nextAttempt = item.attemptCount + 1;
    const message = friendlyError(error);

    if (nextAttempt < MAX_ATTEMPTS) {
      // Exponential backoff: 2s, 4s, 8s ...
      const backoffMs = 2000 * Math.pow(2, nextAttempt - 1);

      // Briefly mark 'failed' so the queue loop won't re-pick this item during the wait.
      getStore().updateItem(id, {
        status: 'failed',
        progress: 0,
        attemptCount: nextAttempt,
        errorMessage: message,
      });

      setTimeout(() => {
        // Only retry if user hasn't manually removed it in the meantime.
        const stillPresent = getStore().items.some((i) => i.id === id);
        if (!stillPresent) {
          return;
        }
        getStore().updateItem(id, { status: 'queued', errorMessage: null });
        void processQueue();
      }, backoffMs);
    } else {
      // Out of automatic retries — leave it visible as 'failed' for manual retry.
      getStore().updateItem(id, {
        status: 'failed',
        progress: 0,
        attemptCount: nextAttempt,
        errorMessage: message,
      });
    }
  }
}
