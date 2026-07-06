import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { EnqueueUploadInput, UploadQueueItem, UploadStatus } from '../types/upload';

const STORAGE_KEY = 'snapnest-upload-queue';

type UploadQueueState = {
  items: UploadQueueItem[];
};

type UploadQueueActions = {
  addItem: (input: EnqueueUploadInput) => string;
  updateItem: (id: string, partial: Partial<UploadQueueItem>) => void;
  removeItem: (id: string) => void;
  /** Marks the item ready for another attempt; processQueue must be kicked off by caller. */
  retryItem: (id: string) => void;
  clearCompleted: () => void;
  /** After a force-quit, items left in 'uploading' should be reattempted. */
  resetStuckUploads: () => void;
  /**
   * Session wipe: drops every queue item, including persisted ones (the
   * persist middleware writes the empty state back to AsyncStorage). Pending
   * uploads from the previous session must never run under the next account.
   */
  reset: () => void;
};

export const useUploadQueueStore = create<UploadQueueState & UploadQueueActions>()(
  persist(
    (set) => ({
      items: [],

      addItem: (input: EnqueueUploadInput): string => {
        const id = uuidv4();
        const newItem: UploadQueueItem = {
          id,
          localUri: input.localUri,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          source: input.source,
          status: 'queued',
          progress: 0,
          attemptCount: 0,
          errorMessage: null,
          backendFileId: null,
          backendUploadId: null,
          createdAt: Date.now(),
          agencyId: input.agencyId ?? null,
          folderId: input.folderId ?? null,
        };
        set((state) => ({ items: [...state.items, newItem] }));
        return id;
      },

      updateItem: (id: string, partial: Partial<UploadQueueItem>): void => {
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
        }));
      },

      removeItem: (id: string): void => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },

      retryItem: (id: string): void => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'queued',
                  progress: 0,
                  errorMessage: null,
                  attemptCount: item.attemptCount + 1,
                }
              : item,
          ),
        }));
      },

      clearCompleted: (): void => {
        set((state) => ({ items: state.items.filter((item) => item.status !== 'uploaded') }));
      },

      resetStuckUploads: (): void => {
        set((state) => ({
          items: state.items.map((item) =>
            item.status === 'uploading'
              ? { ...item, status: 'queued', progress: 0 }
              : item,
          ),
        }));
      },

      reset: (): void => {
        set({ items: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
      version: 1,
    },
  ),
);

const ACTIVE_STATUSES: ReadonlyArray<UploadStatus> = ['queued', 'uploading', 'failed'];

/** Selector — items the Activity tab cares about. */
export function selectActiveItems(state: UploadQueueState): UploadQueueItem[] {
  return state.items.filter((item) => ACTIVE_STATUSES.includes(item.status));
}

/** Selector — oldest queued item to be processed next. */
export function selectNextQueued(state: UploadQueueState): UploadQueueItem | undefined {
  return state.items
    .filter((item) => item.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)[0];
}
