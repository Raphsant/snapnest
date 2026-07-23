import { FILES_QUERY_KEY } from '../hooks/useFiles';
import { folderDetailsQueryKey } from '../hooks/useFolderDetails';
import { FOLDERS_QUERY_KEY } from '../hooks/useFolders';
import { selectNextQueued, useUploadQueueStore } from '../store/uploadQueueStore';
import type { EnqueueUploadInput, UploadQueueItem } from '../types/upload';
import { queryClient } from './queryClient';
import {
  confirmUpload,
  requestPresignedUrl,
  uploadFileToS3,
  uploadThumbnailToS3,
} from './uploadService';

/** Max number of attempts (initial + retries) before we give up. */
const MAX_ATTEMPTS = 3;
/** Successful items linger for this long so the UI can show a "done" state. */
const SUCCESS_CLEANUP_MS = 3000;
/**
 * How many items may be in flight at once.
 *
 * This replaced a strict-FIFO singleton, under which a third rapid capture
 * waited on the first one's entire round trip before it so much as presigned.
 * Bursts are normal in a camera-first app, so that was a product failure, not
 * just a slow path. Items still START oldest-first; only the waiting is gone.
 */
const MAX_CONCURRENT_UPLOADS = 3;

/**
 * Count of in-flight processItem() calls. Retries share this lane — there is no
 * separate queue for them, so an older retry competes on equal terms with new
 * captures (and wins, since selection is by createdAt) and cannot be starved.
 */
let inFlight = 0;

/**
 * Thumbnails still being generated when their item was enqueued, keyed by item id.
 *
 * The eager path enqueues and presigns before a thumbnail exists — that is what
 * keeps the presign and the main PUT off the critical path of generation, which
 * costs 1s+ for video. processItem awaits this to learn the outcome.
 *
 * Memory-only by design; the store's thumbnailUri is the durable half. After a
 * relaunch this map is empty, at which point a thumbnail that finished before
 * the kill has already been persisted and one that didn't is treated as absent.
 */
const pendingThumbnails = new Map<string, Promise<string | null>>();

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
 *
 * `thumbnailPromise` lets a caller enqueue BEFORE its thumbnail exists, so the
 * presign and the main PUT don't wait on generation. The resolved URI is
 * written back to the store, which is what makes it survive a relaunch.
 * Callers that already hold a thumbnail (the gallery path) pass it in `input`
 * and omit this entirely.
 */
export function enqueueUpload(
  input: EnqueueUploadInput,
  options?: { thumbnailPromise?: Promise<string | null> },
): string {
  const id = getStore().addItem(input);

  const thumbnailPromise = options?.thumbnailPromise;
  if (thumbnailPromise) {
    // Registered before processQueue below, so the presign can already see that
    // a thumbnail is coming and ask for a URL to put it at.
    pendingThumbnails.set(
      id,
      thumbnailPromise
        .then((uri: string | null) => {
          if (uri) {
            getStore().updateItem(id, { thumbnailUri: uri });
          }
          return uri;
        })
        .catch((error: unknown) => {
          // generateThumbnail already swallows its own failures; this is here so
          // a caller passing a rejecting promise degrades to "no thumb" rather
          // than stalling the await in processItem.
          console.warn('[uploadManager] thumbnail promise rejected', { id, error });
          return null;
        }),
    );
  }

  processQueue();
  return id;
}

/**
 * Public — clears the failure state for one item and reattempts it.
 * Note: store.retryItem already increments attemptCount.
 */
export function retryUpload(itemId: string): void {
  getStore().retryItem(itemId);
  processQueue();
}

/**
 * Public — fills every free upload slot, oldest queued item first.
 *
 * Deliberately not a scheduler: it claims what it can and returns. Every
 * completion decrements the counter and calls back in, so slots refill on their
 * own. Safe to call redundantly (enqueue, retry, completion, app resume) — the
 * synchronous claim below is what makes re-entrant calls idempotent.
 */
export function processQueue(): void {
  while (inFlight < MAX_CONCURRENT_UPLOADS) {
    const next = selectNextQueued(getStore());
    if (next === undefined) {
      return;
    }

    inFlight += 1;
    // Claim the item SYNCHRONOUSLY, before the loop can come back around.
    // selectNextQueued only ever returns 'queued' items, so without flipping the
    // status right here the next pass would hand out this same item again.
    getStore().updateItem(next.id, { status: 'uploading', progress: 0, errorMessage: null });

    void processItem(next)
      // processItem owns its failure handling; this only keeps an unexpected
      // throw from escaping and leaking the slot it holds.
      .catch((error: unknown) => {
        console.error('[uploadManager] processItem threw unexpectedly', { id: next.id, error });
      })
      .finally(() => {
        inFlight -= 1;
        processQueue();
      });
  }
}

/**
 * The thumbnail for an item, waiting on generation if it is still running.
 *
 * Consume-once: the registry entry is dropped as soon as it is read, because
 * the resolved URI has by then been persisted to the store, which is where a
 * retry of this same item will find it.
 */
async function resolveThumbnailUri(id: string, snapshotUri: string | null): Promise<string | null> {
  const pending = pendingThumbnails.get(id);
  if (pending) {
    pendingThumbnails.delete(id);
    return await pending;
  }
  // No generation in flight: read through to the store rather than trusting the
  // snapshot, which predates any thumbnail written while this item was queued.
  const current = getStore().items.find((queued) => queued.id === id);
  return current?.thumbnailUri ?? snapshotUri;
}

async function processItem(item: UploadQueueItem): Promise<void> {
  const { id } = item;

  // No status write here — processQueue already flipped this item to 'uploading'
  // when it claimed the slot, and it has to happen there to stay synchronous.

  // Whether a thumbnail exists OR is still being generated. Claimed
  // optimistically at presign time: the presign cannot wait for generation, and
  // the contract offers no way to request a thumbnail URL after the fact. What
  // actually happened is reported at /complete, which is the flag the backend
  // keys its fallback off — so an over-claim here costs nothing.
  const expectsThumbnail = pendingThumbnails.has(id) || item.thumbnailUri !== null;

  try {
    // 1. Ask backend for a presigned URL + register the MediaFile + UploadJob.
    //    hasThumbnail: true also yields a presigned PUT for the JPEG thumb.
    const presigned = await requestPresignedUrl({
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      source: item.source,
      ...(item.folderId ? { folderId: item.folderId } : {}),
      ...(item.agencyId ? { agencyId: item.agencyId } : {}),
      ...(expectsThumbnail ? { hasThumbnail: true } : {}),
    });

    getStore().updateItem(id, {
      backendFileId: presigned.fileId,
      backendUploadId: presigned.uploadId,
    });

    // 2. Start the main PUT NOW, and let it run. This is the point of the whole
    //    eager path: the file is handed to the native background session about
    //    one presign after the shutter, so locking the screen a second later no
    //    longer strands it. Everything below runs WHILE the bytes are moving.
    //
    //    Settled instead of awaited so that a rejection arriving during the
    //    thumbnail work can't surface as an unhandled rejection. Rethrown at (4).
    const mainUpload = uploadFileToS3(presigned.uploadUrl, item.localUri, item.mimeType, (pct) => {
      getStore().updateItem(id, { progress: pct });
    }).then(
      () => ({ ok: true }) as const,
      (error: unknown) => ({ ok: false, error }) as const,
    );

    // 3. Now wait for the thumbnail — generation may still be running — and PUT
    //    it. A thumb failure must never fail the parent upload: log and carry
    //    on, recording the outcome so /complete reports it truthfully and never
    //    leaves a dangling thumb key.
    let thumbnailUploaded: boolean | undefined;
    if (expectsThumbnail) {
      thumbnailUploaded = false;
      const thumbnailUri = await resolveThumbnailUri(id, item.thumbnailUri);
      if (presigned.thumbnailUploadUrl && thumbnailUri) {
        try {
          await uploadThumbnailToS3(presigned.thumbnailUploadUrl, thumbnailUri);
          thumbnailUploaded = true;
        } catch (thumbError: unknown) {
          console.warn('[uploadManager] thumbnail upload failed; continuing', { id, thumbError });
        }
      } else if (!presigned.thumbnailUploadUrl) {
        console.warn('[uploadManager] hasThumbnail set but no thumbnailUploadUrl issued', { id });
      }
      // A null thumbnailUri means generation failed. thumbnailUploaded stays
      // false; the backend regenerates for photos, videos keep the known gap.
    }

    // 4. Join the transfer that has been running since (2). Under lock this
    //    resolves on the next foreground — see uploadService for why it must
    //    never be raced against a timeout.
    const mainResult = await mainUpload;
    if (!mainResult.ok) {
      throw mainResult.error;
    }

    // 5. Tell the backend the upload finished so it can flip MediaFile.uploadStatus.
    //    thumbnailUploaded is sent explicitly whenever hasThumbnail was requested.
    await confirmUpload(presigned.uploadId, thumbnailUploaded);

    getStore().updateItem(id, { status: 'uploaded', progress: 100, errorMessage: null });

    // 6. Refresh every list that will surface the new MediaFile. Invalidating
    //    only ['files'] left the destination folder's own view stale, which is
    //    why a fresh capture needed a pull-to-refresh to appear.
    if (item.agencyId) {
      // Prefix match — already covers both ['agency','folders',id] and
      // ['agency','folder',id], so the destination folder is included.
      void queryClient.invalidateQueries({ queryKey: ['agency'] });
    } else {
      // Prefix-matches ['files','none'], so the legacy unfiled view rides along.
      void queryClient.invalidateQueries({ queryKey: FILES_QUERY_KEY });
      // Every folder row shows a file count, and one of them just changed.
      void queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });

      if (item.folderId) {
        void queryClient.invalidateQueries({
          queryKey: folderDetailsQueryKey(item.folderId),
        });
      } else {
        // No folderId means the backend files this into the per-user system
        // "Unfiled" folder, whose id we don't have here — and the Unfiled view
        // is keyed by that real id, not by 'none'. Sweep all folder details
        // instead. Cheap in practice: invalidate only refetches queries with
        // active observers, and at most one folder detail screen is mounted.
        void queryClient.invalidateQueries({ queryKey: ['folder'] });
      }
    }
    void queryClient.invalidateQueries({ queryKey: ['batchViewUrls'] });

    // 7. Auto-clean successful items so Activity doesn't grow unbounded.
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
