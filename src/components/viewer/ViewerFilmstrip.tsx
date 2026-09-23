import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { DISABLED_OPACITY } from './viewerChrome';
import type { ViewUrlByFileId } from '../../hooks/useBatchViewUrls';
import type { MediaFile } from '../../services/filesService';
import { createThemedStyles } from '../../theme/createThemedStyles';

/** Thumbs shown at once, and how many of them sit before the current file. */
const WINDOW = 5;
const HALF = 2;

type ViewerFilmstripProps = {
  /** The gallery's sibling list — exactly what the pager swipes through. */
  files: MediaFile[];
  currentIndex: number;
  viewUrlByFileId?: ViewUrlByFileId;
  onSelect: (index: number) => void;
};

export function ViewerFilmstrip({
  files,
  currentIndex,
  viewUrlByFileId,
  onSelect,
}: ViewerFilmstripProps): React.ReactElement | null {
  const styles = useStyles();

  // Slide the window at the ends so the strip keeps its width instead of
  // shrinking; in the middle the current file sits in the centre.
  const start = Math.max(0, Math.min(currentIndex - HALF, files.length - WINDOW));
  const visible = useMemo(() => files.slice(start, start + WINDOW), [files, start]);

  // A single-file gallery (the Uploads tab opens one) has no siblings to show.
  if (files.length <= 1) {
    return null;
  }

  return (
    <View style={styles.strip}>
      {visible.map((file, offset) => {
        const index = start + offset;
        return (
          <Thumb
            key={file.id}
            file={file}
            index={index}
            thumbnailUri={viewUrlByFileId?.[file.id]?.thumbnailUrl ?? null}
            fullUri={viewUrlByFileId?.[file.id]?.fullUrl ?? null}
            isCurrent={index === currentIndex}
            onSelect={onSelect}
          />
        );
      })}
    </View>
  );
}

type ThumbProps = {
  file: MediaFile;
  index: number;
  thumbnailUri: string | null;
  fullUri: string | null;
  isCurrent: boolean;
  onSelect: (index: number) => void;
};

const Thumb = memo(function Thumb({
  file,
  index,
  thumbnailUri,
  fullUri,
  isCurrent,
  onSelect,
}: ThumbProps): React.ReactElement {
  const styles = useStyles();

  // Thumb → full-res fallback with the same cache keys the folder grid uses, so
  // an already-fetched thumbnail is reused rather than re-downloaded.
  const sources = useMemo((): ImageSource[] => {
    const chain: ImageSource[] = [];
    if (thumbnailUri !== null) {
      chain.push({ uri: thumbnailUri, cacheKey: `${file.id}:thumb` });
    }
    if (fullUri !== null) {
      chain.push({ uri: fullUri, cacheKey: `${file.id}:full` });
    }
    return chain;
  }, [file.id, thumbnailUri, fullUri]);

  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => {
    setSourceIndex(0);
  }, [sources]);
  const currentSource = sources[sourceIndex] ?? null;

  const handlePress = useCallback(() => onSelect(index), [index, onSelect]);
  const handleError = useCallback(() => setSourceIndex((i) => i + 1), []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={file.displayName ?? file.fileName}
      accessibilityState={{ selected: isCurrent }}
      onPress={handlePress}
      style={[styles.thumb, isCurrent ? styles.thumbCurrent : styles.thumbNeighbour]}
    >
      {currentSource ? (
        <Image
          source={currentSource}
          style={styles.image}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={handleError}
        />
      ) : null}
    </Pressable>
  );
});

const useStyles = createThemedStyles((t) => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    // Shows through for a file with no usable image yet (still uploading, or a
    // video the backend hasn't thumbnailed).
    backgroundColor: t.colors.darkSurface,
  },
  thumbCurrent: {
    height: 56,
    borderWidth: 2,
    borderColor: t.colors.cream,
  },
  thumbNeighbour: {
    opacity: DISABLED_OPACITY,
  },
  image: {
    width: '100%',
    height: '100%',
  },
}));
