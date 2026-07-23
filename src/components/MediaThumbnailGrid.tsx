import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type RefreshControlProps,
} from 'react-native';

import type { ActivityFeedItem } from '../hooks/useActivityFeed';
import type { ViewUrlByFileId } from '../hooks/useBatchViewUrls';
import { retryUpload } from '../services/uploadManager';
import type { MediaFile } from '../services/filesService';
import type { UploadQueueItem } from '../types/upload';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

export type GridSelectionState = {
  isActive: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (fileId: string) => void;
  onLongPressFile: (file: MediaFile) => void;
};

type MediaThumbnailGridProps = {
  items: ActivityFeedItem[];
  viewUrlByFileId?: ViewUrlByFileId;
  onPressFile?: (file: MediaFile) => void;
  selection: GridSelectionState;
  contentPaddingBottom?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

type GridCellProps = {
  entry: ActivityFeedItem;
  size: number;
  marginRight: number;
  viewUrlByFileId?: ViewUrlByFileId;
  onPressFile?: (file: MediaFile) => void;
  selection: GridSelectionState;
};

const GridCell = memo(function GridCell({
  entry,
  size,
  marginRight,
  viewUrlByFileId,
  onPressFile,
  selection,
}: GridCellProps): React.ReactElement {
  if (entry.kind === 'file') {
    return (
      <FileGridCell
        file={entry.item}
        size={size}
        marginRight={marginRight}
        thumbnailUri={viewUrlByFileId?.[entry.item.id]?.thumbnailUrl ?? null}
        fullUri={viewUrlByFileId?.[entry.item.id]?.fullUrl ?? null}
        onPress={onPressFile}
        selection={selection}
      />
    );
  }

  return <QueueGridCell item={entry.item} size={size} marginRight={marginRight} />;
});

type FileGridCellProps = {
  file: MediaFile;
  size: number;
  marginRight: number;
  thumbnailUri: string | null;
  fullUri: string | null;
  onPress?: (file: MediaFile) => void;
  selection: GridSelectionState;
};

const FileGridCell = memo(function FileGridCell({
  file,
  size,
  marginRight,
  thumbnailUri,
  fullUri,
  onPress,
  selection,
}: FileGridCellProps): React.ReactElement {
  const isVideo = isVideoMime(file.mimeType);

  // Prefer the thumbnail, fall back to full-res on error (a stale thumb key can
  // 404). Advance through the chain on each onError; exhausting it shows the
  // placeholder icon rather than a broken tile.
  //
  // cacheKey — NOT the uri. Backend view URLs are presigned and re-issued on
  // every /files/view-urls fetch, so a URL-keyed cache misses on every refetch.
  // Keying on fileId makes the cache survive refetches. Thumb and full-res are
  // different images for the same fileId, so they take distinct suffixes — a
  // shared key would serve the wrong image once the chain falls back.
  //
  // Assumes thumbnails are immutable per fileId: the backend generates one at
  // upload and never regenerates it. If regeneration is ever added, it must
  // publish under a new key (or the suffix must carry a version) or clients
  // will keep serving the stale thumb from disk indefinitely.
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
  const showImage = currentSource !== null;
  const handleImageError = useCallback(() => {
    setSourceIndex((index) => index + 1);
  }, []);

  const isSelecting = selection.isActive;
  const isSelected = isSelecting && selection.selectedIds.has(file.id);

  const handlePress = useCallback(() => {
    if (isSelecting) {
      selection.onToggle(file.id);
      return;
    }
    onPress?.(file);
  }, [file, isSelecting, onPress, selection]);

  const handleLongPress = useCallback(() => {
    selection.onLongPressFile(file);
  }, [file, selection]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={file.fileName}
      accessibilityState={{ selected: isSelected }}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size, marginRight, marginBottom: GRID_GAP },
        pressed && styles.cellPressed,
        isSelected && styles.cellSelected,
      ]}
    >
      {showImage ? (
        <Image
          source={currentSource}
          style={styles.image}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          onError={handleImageError}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons
            name={isVideo ? 'videocam' : 'image'}
            size={28}
            color={colors.tabInactive}
          />
        </View>
      )}
      {isVideo ? (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={12} color={colors.card} />
        </View>
      ) : null}
      {isSelected ? (
        <>
          <View style={styles.selectedDim} />
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark-circle" size={26} color={colors.accentBlue} />
          </View>
        </>
      ) : null}
    </Pressable>
  );
});

type QueueGridCellProps = {
  item: UploadQueueItem;
  size: number;
  marginRight: number;
};

const QueueGridCell = memo(function QueueGridCell({
  item,
  size,
  marginRight,
}: QueueGridCellProps): React.ReactElement {
  const isVideo = isVideoMime(item.mimeType);
  const showLocalPreview = isImageMime(item.mimeType);

  const inner = (
    <>
      {showLocalPreview ? (
        // Already-on-disk capture: memory cache only. The uri is a stable local
        // path, so no cacheKey is needed and a disk copy would just duplicate it.
        <Image
          source={{ uri: item.localUri }}
          style={styles.image}
          contentFit="cover"
          transition={0}
          cachePolicy="memory"
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons
            name={isVideo ? 'videocam' : 'image'}
            size={28}
            color={colors.tabInactive}
          />
        </View>
      )}
      <QueueOverlay item={item} />
    </>
  );

  if (item.status === 'failed') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry upload"
        onPress={() => retryUpload(item.id)}
        style={({ pressed }) => [
          styles.cell,
          { width: size, height: size, marginRight, marginBottom: GRID_GAP },
          pressed && styles.cellPressed,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.cell, { width: size, height: size, marginRight, marginBottom: GRID_GAP }]}>
      {inner}
    </View>
  );
});

function QueueOverlay({ item }: { item: UploadQueueItem }): React.ReactElement {
  if (item.status === 'uploading') {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="small" color={colors.card} />
        <Text style={styles.overlayText}>{`${item.progress}%`}</Text>
      </View>
    );
  }

  if (item.status === 'failed') {
    return (
      <View style={[styles.overlay, styles.overlayError]}>
        <Ionicons name="alert-circle" size={22} color={colors.card} />
        <Text style={styles.overlayText}>Tap to retry</Text>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <Text style={styles.overlayText}>Queued</Text>
    </View>
  );
}

function MediaThumbnailGridBase({
  items,
  viewUrlByFileId,
  onPressFile,
  selection,
  contentPaddingBottom = 0,
  refreshControl,
}: MediaThumbnailGridProps): React.ReactElement {
  const { width: screenWidth } = useWindowDimensions();

  const cellSize = useMemo((): number => {
    const totalGap = GRID_GAP * (GRID_COLUMNS - 1);
    return Math.floor((screenWidth - totalGap) / GRID_COLUMNS);
  }, [screenWidth]);

  const keyExtractor = useCallback((entry: ActivityFeedItem): string => {
    return entry.kind === 'queue' ? `queue:${entry.item.id}` : `file:${entry.item.id}`;
  }, []);

  const renderItem: ListRenderItem<ActivityFeedItem> = useCallback(
    ({ item, index }) => {
      const col = index % GRID_COLUMNS;
      const marginRight = col < GRID_COLUMNS - 1 ? GRID_GAP : 0;
      return (
        <GridCell
          entry={item}
          size={cellSize}
          marginRight={marginRight}
          viewUrlByFileId={viewUrlByFileId}
          onPressFile={onPressFile}
          selection={selection}
        />
      );
    },
    [cellSize, viewUrlByFileId, onPressFile, selection],
  );

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      numColumns={GRID_COLUMNS}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
      extraData={[selection.isActive, selection.selectedIds]}
    />
  );
}

export const MediaThumbnailGrid = memo(MediaThumbnailGridBase);

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  cell: {
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  cellPressed: {
    opacity: 0.88,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: colors.accentBlue,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(130, 154, 177, 0.12)',
  },
  videoBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(16, 42, 67, 0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  selectedDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 42, 67, 0.35)',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.card,
    borderRadius: 13,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 42, 67, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  overlayError: {
    backgroundColor: 'rgba(235, 87, 87, 0.55)',
  },
  overlayText: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
    fontSize: 11,
  },
});
