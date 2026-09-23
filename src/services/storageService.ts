import * as FileSystem from 'expo-file-system/legacy';

import { useUploadQueueStore } from '../store/uploadQueueStore';

/**
 * Local-storage accounting for the Storage screen.
 *
 * Scope + safety: this only ever looks at and deletes files under
 * `FileSystem.cacheDirectory` (captures land there, as do generated thumbnails
 * and expo-image's disk cache). It NEVER touches `documentDirectory`, the Photos
 * library, or any file still referenced by a pending upload.
 *
 * Precision caveat: once a capture uploads, its queue item (and the localUri
 * link) is dropped, so an uploaded local copy can't be told apart from other
 * cache. We therefore treat everything in cache that isn't needed by a pending
 * upload as "clearable" — safe to remove, re-derivable, or already in the cloud.
 */

export type StorageFileEntry = { uri: string; name: string; size: number };

export type StorageBreakdown = {
  /** Everything under cacheDirectory (plus pending files stored outside it). */
  total: number;
  /** Bytes held by pending uploads (queued/uploading/failed) — never deleted. */
  keepBytes: number;
  /** Bytes safe to reclaim. */
  clearableBytes: number;
  /** The exact files free-up will delete. */
  clearableUris: string[];
  /** Largest local files, for the read-only "Biggest items" list. */
  biggest: StorageFileEntry[];
};

const BIGGEST_LIMIT = 8;

function basename(uri: string): string {
  const clean = uri.endsWith('/') ? uri.slice(0, -1) : uri;
  return clean.slice(clean.lastIndexOf('/') + 1);
}

/** localUris of items that still need their local copy (not yet uploaded). */
function pendingLocalUris(): Set<string> {
  return new Set(
    useUploadQueueStore
      .getState()
      .items.filter((item) => item.status !== 'uploaded')
      .map((item) => item.localUri),
  );
}

async function walk(dir: string): Promise<StorageFileEntry[]> {
  const out: StorageFileEntry[] = [];
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const uri = dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        continue;
      }
      if (info.isDirectory) {
        out.push(...(await walk(uri)));
      } else {
        out.push({ uri, name, size: info.size ?? 0 });
      }
    } catch {
      // Unreadable entry — skip it rather than fail the whole scan.
    }
  }
  return out;
}

export async function scanStorage(): Promise<StorageBreakdown> {
  const keep = pendingLocalUris();
  const cacheDir = FileSystem.cacheDirectory;

  const files = cacheDir ? await walk(cacheDir) : [];

  let keepBytes = 0;
  let clearableBytes = 0;
  const clearableUris: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    seen.add(file.uri);
    if (keep.has(file.uri)) {
      keepBytes += file.size;
    } else {
      clearableBytes += file.size;
      clearableUris.push(file.uri);
    }
  }

  // A pending capture stored outside cacheDirectory still counts toward "keep"
  // (and, being pending, is never in the clearable set).
  for (const uri of keep) {
    if (seen.has(uri)) {
      continue;
    }
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory) {
        keepBytes += info.size ?? 0;
      }
    } catch {
      // ignore
    }
  }

  const biggest = files
    .slice()
    .sort((a, b) => b.size - a.size)
    .slice(0, BIGGEST_LIMIT);

  return {
    total: keepBytes + clearableBytes,
    keepBytes,
    clearableBytes,
    clearableUris,
    biggest,
  };
}

/**
 * Delete the given cache files, skipping any that a pending upload now needs
 * (re-checked at delete time, not just scan time). Returns bytes actually freed.
 */
export async function freeUpStorage(uris: readonly string[]): Promise<number> {
  const keep = pendingLocalUris();
  let freed = 0;
  for (const uri of uris) {
    if (keep.has(uri)) {
      continue;
    }
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory) {
        freed += info.size ?? 0;
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // Already gone or unreadable — nothing to free.
    }
  }
  return freed;
}
