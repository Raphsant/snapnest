import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { MediaViewerModal } from '../components/MediaViewerModal';
import type { MediaFile } from '../services/filesService';

/** Extra context for a gallery session — e.g. agency-scoped, read-only viewing. */
export type OpenGalleryOptions = {
  /** When set, view URLs are authorized by agency membership instead of ownership. */
  agencyId?: string;
  /** Hides mutating actions (e.g. "Move to folder") — used for agency media. */
  readOnly?: boolean;
};

export type MediaViewerContextValue = {
  isOpen: boolean;
  files: MediaFile[];
  currentIndex: number;
  agencyId: string | null;
  readOnly: boolean;
  openGallery: (files: MediaFile[], startIndex: number, options?: OpenGalleryOptions) => void;
  /** Opens a single-file gallery (e.g. Activity tab). */
  openFile: (file: MediaFile) => void;
  close: () => void;
  setCurrentIndex: (index: number) => void;
  /** Keeps the open gallery in sync after metadata changes (e.g. move to folder). */
  updateFile: (file: MediaFile) => void;
};

const CLOSED_STATE = {
  isOpen: false,
  files: [] as MediaFile[],
  currentIndex: 0,
  agencyId: null as string | null,
  readOnly: false,
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), length - 1);
}

const MediaViewerContext = createContext<MediaViewerContextValue | null>(null);

export function MediaViewerProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState(CLOSED_STATE);

  const openGallery = useCallback(
    (files: MediaFile[], startIndex: number, options?: OpenGalleryOptions) => {
      if (files.length === 0) {
        return;
      }
      const index = clampIndex(startIndex, files.length);
      setState({
        isOpen: true,
        files,
        currentIndex: index,
        agencyId: options?.agencyId ?? null,
        readOnly: options?.readOnly ?? false,
      });
    },
    [],
  );

  const openFile = useCallback(
    (file: MediaFile) => {
      openGallery([file], 0);
    },
    [openGallery],
  );

  const close = useCallback(() => {
    setState(CLOSED_STATE);
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.isOpen || prev.files.length === 0) {
        return prev;
      }
      return {
        ...prev,
        currentIndex: clampIndex(index, prev.files.length),
      };
    });
  }, []);

  const updateFile = useCallback((updated: MediaFile) => {
    setState((prev) => {
      if (!prev.isOpen) {
        return prev;
      }
      const files = prev.files.map((f) => (f.id === updated.id ? updated : f));
      return { ...prev, files };
    });
  }, []);

  const value = useMemo(
    (): MediaViewerContextValue => ({
      isOpen: state.isOpen,
      files: state.files,
      currentIndex: state.currentIndex,
      agencyId: state.agencyId,
      readOnly: state.readOnly,
      openGallery,
      openFile,
      close,
      setCurrentIndex,
      updateFile,
    }),
    [close, openFile, openGallery, setCurrentIndex, state, updateFile],
  );

  return (
    <MediaViewerContext.Provider value={value}>
      {children}
      <MediaViewerModal />
    </MediaViewerContext.Provider>
  );
}

export function useMediaViewer(): MediaViewerContextValue {
  const ctx = useContext(MediaViewerContext);
  if (ctx === null) {
    throw new Error('useMediaViewer must be used within MediaViewerProvider');
  }
  return ctx;
}
