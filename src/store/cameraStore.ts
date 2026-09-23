import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = 'snapnest-camera';

/**
 * Camera-screen settings. The capture destination is persisted so the folder a
 * user picked is still selected after a relaunch (the chip should not silently
 * fall back to Unfiled between sessions).
 *
 * Account safety: `reset()` is called on session wipe and sets the selection
 * back to null, which the persist middleware writes through to storage — so a
 * destination can never rehydrate under the next account. And if the persisted
 * folder was deleted while the app was closed, CameraScreen's existing
 * folder-exists guard falls the chip back to Unfiled on next load.
 */
type CameraState = {
  /**
   * Selected upload destination for camera captures.
   * `null` means the system "Unfiled" folder — the folderId is omitted on
   * upload so the backend default is the source of truth.
   */
  destinationFolderId: string | null;
  /**
   * Whether a capture is also saved to the device's Photos library. On by
   * default (the long-standing behavior). A device preference, not account
   * data, so `reset()` leaves it untouched.
   */
  saveToPhotos: boolean;
};

type CameraActions = {
  setDestinationFolder: (folderId: string | null) => void;
  setSaveToPhotos: (value: boolean) => void;
  /** Session wipe — clears the selection so it never leaks across accounts. */
  reset: () => void;
};

export const useCameraStore = create<CameraState & CameraActions>()(
  persist(
    (set) => ({
      destinationFolderId: null,
      saveToPhotos: true,

      setDestinationFolder: (folderId: string | null) => {
        set({ destinationFolderId: folderId });
      },

      setSaveToPhotos: (value: boolean) => {
        set({ saveToPhotos: value });
      },

      // Only clears the destination — saveToPhotos is a device preference and
      // safe to keep across accounts.
      reset: () => {
        set({ destinationFolderId: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Actions are not state; persist the durable preferences.
      partialize: (state) => ({
        destinationFolderId: state.destinationFolderId,
        saveToPhotos: state.saveToPhotos,
      }),
    },
  ),
);
