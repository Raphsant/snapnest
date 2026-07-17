import { create } from 'zustand';

/**
 * Ephemeral camera-screen settings. Deliberately NOT persisted: the capture
 * destination resets to the system "Unfiled" default on every app launch, and
 * a plain create() (no persist middleware) gives that for free.
 */
type CameraState = {
  /**
   * Selected upload destination for camera captures.
   * `null` means the system "Unfiled" folder — the folderId is omitted on
   * upload so the backend default is the source of truth.
   */
  destinationFolderId: string | null;
};

type CameraActions = {
  setDestinationFolder: (folderId: string | null) => void;
  /** Session wipe — clears the selection so it never leaks across accounts. */
  reset: () => void;
};

export const useCameraStore = create<CameraState & CameraActions>((set) => ({
  destinationFolderId: null,

  setDestinationFolder: (folderId: string | null) => {
    set({ destinationFolderId: folderId });
  },

  reset: () => {
    set({ destinationFolderId: null });
  },
}));
