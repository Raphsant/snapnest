import { useMemo } from 'react';

import type { MediaFile } from '../services/filesService';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import type { UploadQueueItem } from '../types/upload';
import { useFiles } from './useFiles';

export type ActivityFeedItem =
  | { kind: 'queue'; item: UploadQueueItem; createdAt: number }
  | { kind: 'file'; item: MediaFile; createdAt: number };

type UseActivityFeedResult = {
  items: ActivityFeedItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isRefetching: boolean;
  refetch: () => Promise<unknown>;
};

/**
 * Combines local upload queue items with backend-stored MediaFiles
 * into one chronologically sorted feed (newest first).
 *
 * Queue items in status 'uploaded' are intentionally hidden — they appear
 * via GET /files instead once the cache is invalidated, so we don't show
 * the same capture as both a queue row and a file row.
 */
export function useActivityFeed(): UseActivityFeedResult {
  const queueItems = useUploadQueueStore((state) => state.items);
  const filesQuery = useFiles();

  const items = useMemo<ActivityFeedItem[]>(() => {
    const merged: ActivityFeedItem[] = [];

    for (const queueItem of queueItems) {
      if (queueItem.status === 'uploaded') {
        // Hide local row once backend has the record; useFiles will surface it.
        continue;
      }
      if (queueItem.agencyId) {
        // Agency submissions belong to the Agency tab, not the personal feed.
        continue;
      }
      merged.push({
        kind: 'queue',
        item: queueItem,
        createdAt: queueItem.createdAt,
      });
    }

    for (const file of filesQuery.data ?? []) {
      const ts = Date.parse(file.createdAt);
      merged.push({
        kind: 'file',
        item: file,
        // Fall back to 0 if backend ever returns a malformed date so sort doesn't NaN.
        createdAt: Number.isFinite(ts) ? ts : 0,
      });
    }

    // Newest first.
    merged.sort((a, b) => b.createdAt - a.createdAt);
    return merged;
  }, [queueItems, filesQuery.data]);

  return {
    items,
    isLoading: filesQuery.isLoading,
    isError: filesQuery.isError,
    error: filesQuery.error ?? null,
    isRefetching: filesQuery.isRefetching,
    refetch: filesQuery.refetch,
  };
}
