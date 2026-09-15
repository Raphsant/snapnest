import { useEffect, useMemo, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { useUploadQueueStore } from '../store/uploadQueueStore';
import type { UploadQueueItem } from '../types/upload';

export type SyncStatusKind = 'ok' | 'uploading' | 'waiting' | 'offline';

export type SyncStatus = {
  kind: SyncStatusKind;
  /** NetInfo reported no connection. `null` (unknown) is treated as online. */
  isOffline: boolean;
  /** Items not yet uploaded (queued + uploading + failed). */
  pendingCount: number;
  /** Items in flight or about to be (uploading + queued) — the "Uploading N" count. */
  activeCount: number;
  /** The item currently uploading, or the oldest still-pending one as "next up". */
  currentItem: UploadQueueItem | undefined;
  /** currentItem's progress, 0–100. */
  progress: number;
};

/**
 * Single source of truth for "is my stuff backed up?", shared by the camera
 * status pill and the Folders/Uploads SyncStatusCard so the two can't drift.
 *
 * NOTE: there is no Wi-Fi-only upload setting in the app — uploads run on any
 * connection. So `waiting` here means "offline with a backlog", not "waiting for
 * Wi-Fi", and there is nothing to override while offline.
 */
export function useSyncStatus(): SyncStatus {
  const items = useUploadQueueStore((state) => state.items);

  // Own NetInfo subscription. null before the first event → treated as online so
  // nothing flashes "Offline" on mount.
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setIsConnected(netState.isConnected);
    });
    return unsubscribe;
  }, []);

  return useMemo((): SyncStatus => {
    const isOffline = isConnected === false;
    const pending = items.filter((item) => item.status !== 'uploaded');
    const uploadingItem = items.find((item) => item.status === 'uploading');
    const activeCount = items.filter(
      (item) => item.status === 'uploading' || item.status === 'queued',
    ).length;

    // Prefer the item actually moving bytes; otherwise the oldest pending one,
    // so the card can name what's "next up" while offline.
    const currentItem =
      uploadingItem ??
      pending.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
    const progress = currentItem?.progress ?? 0;

    let kind: SyncStatusKind;
    if (uploadingItem) {
      kind = 'uploading';
    } else if (isOffline && pending.length > 0) {
      kind = 'waiting';
    } else if (isOffline) {
      kind = 'offline';
    } else if (pending.length > 0) {
      // Online with a backlog but nothing mid-flight yet (retry backoff, or the
      // queue is about to claim it) — reads as uploading, not idle.
      kind = 'uploading';
    } else {
      kind = 'ok';
    }

    return {
      kind,
      isOffline,
      pendingCount: pending.length,
      activeCount,
      currentItem,
      progress,
    };
  }, [isConnected, items]);
}
