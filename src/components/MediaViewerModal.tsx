import { useEvent } from 'expo';
import { BlurView } from 'expo-blur';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPickerSheet } from './FolderPickerSheet';
import { ViewerActionGrid } from './viewer/ViewerActionGrid';
import { ViewerFilmstrip } from './viewer/ViewerFilmstrip';
import { ViewerMetaChips } from './viewer/ViewerMetaChips';
import { ViewerTopBar } from './viewer/ViewerTopBar';
import {
  CREAM_12,
  CREAM_20,
  CREAM_60,
  folderLabel,
  formatClockTime,
  formatDayMonth,
  formatDuration,
  isVideoFile,
  kindLabel,
} from './viewer/viewerChrome';
import { useMediaViewer } from '../context/MediaViewerContext';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import { FOLDERS_QUERY_KEY } from '../hooks/useFolders';
import {
  BATCH_MOVE_UNFILED,
  requestBatchDelete,
  requestBatchMove,
  type MediaFile,
} from '../services/filesService';
import type { Folder } from '../services/foldersService';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';
import { formatFileSize, formatFullDateTime } from '../utils/formatRelativeTime';

/*
 * The viewer is a DARK screen in BOTH themes — the same rule as the camera, so
 * `darkBg` and the cream tints in ./viewer/viewerChrome are identical in
 * Comfort and Blue. Styles still go through createThemedStyles so this file
 * reads like every other screen (and picks up a theme switch while mounted).
 */

const METADATA_PANEL_HEIGHT = 320;
const METADATA_ANIM_MS = 250;
const PAGER_WINDOW_SIZE = 3;
const VIDEO_LOAD_ERROR_MESSAGE = 'Couldn’t load video';
const IMAGE_LOAD_ERROR_MESSAGE = 'Couldn’t load image';
/** Breathing room under the filmstrip when the action grid is hidden. */
const READ_ONLY_BOTTOM_GAP = 10;

function titleCaseSource(source: MediaFile['source']): string {
  if (source === 'CAMERA') {
    return 'Camera';
  }
  return 'Gallery';
}

type MediaLoadErrorProps = {
  message: string;
  onRetry: () => void;
};

function MediaLoadError({ message, onRetry }: MediaLoadErrorProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.errorBox}>
      <ImageOff size={34} color={CREAM_60} strokeWidth={2} />
      <Text style={styles.errorTitle}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry loading media"
        onPress={onRetry}
        style={({ pressed }) => [styles.retryChip, pressed && styles.pressed]}
      >
        <RotateCw size={14} color={theme.colors.cream} strokeWidth={2.4} />
        <Text style={styles.retryLabel}>Retry</Text>
      </Pressable>
    </View>
  );
}

type VideoPlaybackProps = {
  fullUrl: string;
  isActive: boolean;
  onRetryUrls: () => void;
};

/**
 * Mounted only once a presigned URL is available, so the player hook always
 * has a real source. `useVideoPlayer` releases the player on unmount and
 * recreates it when the URL changes (e.g. a fresh presigned URL after retry).
 */
function VideoPlayback({ fullUrl, isActive, onRetryUrls }: VideoPlaybackProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const player = useVideoPlayer(fullUrl);
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Pause when the user swipes to a neighbouring page; the page itself stays
  // mounted (pager window), so audio would otherwise keep playing.
  useEffect(() => {
    if (!isActive) {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.videoFill}>
      {/* Native transport controls — the player owns play/pause/scrub, so the
          viewer draws no transport of its own. */}
      <VideoView
        player={player}
        style={styles.videoFill}
        contentFit="contain"
        nativeControls
      />
      {status === 'loading' ? (
        <View style={styles.videoOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.colors.cream} />
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={[styles.videoOverlay, styles.videoErrorBackdrop]}>
          <MediaLoadError message={VIDEO_LOAD_ERROR_MESSAGE} onRetry={onRetryUrls} />
        </View>
      ) : null}
    </View>
  );
}

type GalleryPageProps = {
  file: MediaFile;
  pageWidth: number;
  pageHeight: number;
  fullUrl: string | undefined;
  isUrlLoading: boolean;
  isActive: boolean;
  onToggleMetadata: () => void;
  onRetryUrls: () => void;
};

function GalleryPage({
  file,
  pageWidth,
  pageHeight,
  fullUrl,
  isUrlLoading,
  isActive,
  onToggleMetadata,
  onRetryUrls,
}: GalleryPageProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const [imageError, setImageError] = useState(false);
  const isVideo = isVideoFile(file);

  useEffect(() => {
    setImageError(false);
  }, [file.id, fullUrl]);

  if (isVideo) {
    return (
      <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
        {isUrlLoading ? <ActivityIndicator size="large" color={theme.colors.cream} /> : null}

        {!isUrlLoading && fullUrl === undefined ? (
          <MediaLoadError message={VIDEO_LOAD_ERROR_MESSAGE} onRetry={onRetryUrls} />
        ) : null}

        {!isUrlLoading && fullUrl !== undefined ? (
          <VideoPlayback fullUrl={fullUrl} isActive={isActive} onRetryUrls={onRetryUrls} />
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.page, { width: pageWidth, height: pageHeight }]}
      onPress={onToggleMetadata}
      accessibilityRole="button"
      accessibilityLabel="Toggle photo details"
    >
      {isUrlLoading ? (
        <ActivityIndicator size="large" color={theme.colors.cream} />
      ) : null}

      {!isUrlLoading && (fullUrl === undefined || imageError) ? (
        <MediaLoadError message={IMAGE_LOAD_ERROR_MESSAGE} onRetry={onRetryUrls} />
      ) : null}

      {!isUrlLoading && fullUrl !== undefined && !imageError ? (
        <Image
          source={{ uri: fullUrl }}
          style={styles.fullImage}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      ) : null}
    </Pressable>
  );
}

type MetadataPanelProps = {
  file: MediaFile;
  showMetadata: boolean;
  bottomInset: number;
  translateY: Animated.Value;
};

/**
 * The "…" sheet: everything the chips don't show (raw file name, capture
 * source, full date). Move used to live here and is now an action tile.
 */
function MetadataPanel({
  file,
  showMetadata,
  bottomInset,
  translateY,
}: MetadataPanelProps): React.ReactElement {
  const styles = useStyles();
  const duration = formatDuration(file.durationSeconds);
  const folder = folderLabel(file) ?? 'Unfiled';

  const rows: { label: string; value: string }[] = [
    { label: 'Type', value: kindLabel(file) },
    { label: 'Size', value: formatFileSize(file.sizeBytes) },
    { label: 'Date', value: formatFullDateTime(file.createdAt) },
    { label: 'Source', value: titleCaseSource(file.source) },
  ];

  if (duration !== null) {
    rows.push({ label: 'Duration', value: duration });
  }
  rows.push({ label: 'Folder', value: folder });

  return (
    <Animated.View
      pointerEvents={showMetadata ? 'auto' : 'none'}
      style={[
        styles.metadataWrap,
        {
          transform: [{ translateY }],
          paddingBottom: bottomInset + 12,
        },
      ]}
    >
      <BlurView intensity={48} tint="dark" style={styles.metadataBlur}>
        <View style={styles.metadataInner}>
          <View style={styles.grabber} />
          <Text style={styles.metadataFileName} numberOfLines={2}>
            {file.fileName}
          </Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </BlurView>
    </Animated.View>
  );
}

export function MediaViewerModal(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useStyles();
  const queryClient = useQueryClient();

  const { isOpen, files, currentIndex, agencyId, readOnly, setCurrentIndex, close, updateFile } =
    useMediaViewer();
  const [showMetadata, setShowMetadata] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  /** A move or delete is in flight — the action tiles go quiet until it lands. */
  const [busy, setBusy] = useState(false);
  /** Measured height of the media area; the pager's pages are sized to it. */
  const [pageHeight, setPageHeight] = useState(0);
  const metadataY = useRef(new Animated.Value(METADATA_PANEL_HEIGHT)).current;
  const pagerRef = useRef<FlatList<MediaFile>>(null);
  const wasOpenRef = useRef(false);

  const uploadedFileIds = useMemo(
    (): string[] => files.filter((f) => f.uploadStatus === 'UPLOADED').map((f) => f.id),
    [files],
  );

  const {
    data: viewUrlByFileId,
    isLoading: urlsLoading,
    refetch: refetchUrls,
  } = useBatchViewUrls(isOpen ? uploadedFileIds : [], agencyId ?? undefined);

  const currentFile = files[currentIndex] ?? null;
  const currentUrl = currentFile === null ? undefined : viewUrlByFileId?.[currentFile.id]?.fullUrl;

  useEffect(() => {
    if (!isOpen) {
      setShowMetadata(false);
      setPickerVisible(false);
      setBusy(false);
      metadataY.setValue(METADATA_PANEL_HEIGHT);
    }
  }, [isOpen, metadataY]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current && files.length > 0) {
      const index = Math.min(Math.max(currentIndex, 0), files.length - 1);
      requestAnimationFrame(() => {
        pagerRef.current?.scrollToIndex({ index, animated: false });
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, currentIndex, files.length]);

  useEffect(() => {
    Animated.timing(metadataY, {
      toValue: showMetadata ? 0 : METADATA_PANEL_HEIGHT,
      duration: METADATA_ANIM_MS,
      useNativeDriver: true,
    }).start();
  }, [showMetadata, metadataY]);

  const handleToggleMetadata = useCallback(() => {
    setShowMetadata((prev) => !prev);
  }, []);

  const handleRetryUrls = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['batchViewUrls'] });
    void refetchUrls();
  }, [queryClient, refetchUrls]);

  const handleMediaLayout = useCallback((event: LayoutChangeEvent) => {
    setPageHeight(event.nativeEvent.layout.height);
  }, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<MediaFile> | null | undefined, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / screenWidth);
      setCurrentIndex(index);
    },
    [screenWidth, setCurrentIndex],
  );

  /** Filmstrip tap. A programmatic scroll fires no momentum event, so the
   *  index is set here rather than waiting for the pager to report it. */
  const handleSelectIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      pagerRef.current?.scrollToIndex({ index, animated: false });
    },
    [setCurrentIndex],
  );

  /**
   * Refresh what a move or delete changed. Deliberately NOT ['batchViewUrls']:
   * re-signing would swap the open photo's URL (reload) and recreate the video
   * player mid-playback, and neither operation moves the bytes in S3.
   */
  const reconcile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['folders'] });
    void queryClient.invalidateQueries({ queryKey: ['folder'] });
    void queryClient.invalidateQueries({ queryKey: ['files'] });
  }, [queryClient]);

  const handleShare = useCallback(() => {
    if (currentUrl === undefined) {
      return;
    }
    void Share.share({ url: currentUrl }).catch(() => {
      // User-cancelled or failed share — nothing to recover.
    });
  }, [currentUrl]);

  const handleFolderPicked = useCallback(
    (pickedFolderId: string | null) => {
      const file = currentFile;
      if (file === null || file.folderId === pickedFolderId) {
        return;
      }

      // Read the folder list from cache rather than subscribing: the picker the
      // user just used has already filled it, and the viewer is mounted for the
      // whole app session — a live query here would fetch on every launch.
      const folders = queryClient.getQueryData<Folder[]>(FOLDERS_QUERY_KEY) ?? [];
      const target = pickedFolderId === null
        ? null
        : folders.find((f) => f.id === pickedFolderId) ?? null;

      setBusy(true);
      void requestBatchMove([file.id], pickedFolderId ?? BATCH_MOVE_UNFILED)
        .then((result) => {
          if (result.skippedIds.includes(file.id)) {
            Alert.alert('Not moved', 'The server declined to move this file.');
            return;
          }
          // Patch the open file so the folder chip updates immediately, without
          // waiting for the folder/file queries to come back.
          updateFile({
            ...file,
            folderId: pickedFolderId,
            folder: target === null ? null : { id: target.id, name: target.name },
          });
          reconcile();
          let message = 'Moved.';
          if (target !== null) {
            message = `Moved to “${target.name}”.`;
          } else if (pickedFolderId === null) {
            message = 'File is now unfiled.';
          }
          Alert.alert('Moved', message, [{ text: 'OK' }]);
        })
        .catch(() => {
          Alert.alert('Move failed', 'Check your connection and try again.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [currentFile, queryClient, reconcile, updateFile],
  );

  const runDelete = useCallback(() => {
    const file = currentFile;
    if (file === null) {
      return;
    }
    setBusy(true);
    void requestBatchDelete([file.id])
      .then((result) => {
        if (result.skippedIds.includes(file.id)) {
          Alert.alert('Not deleted', 'The server declined to delete this file.');
          return;
        }
        reconcile();
        close();
      })
      .catch(() => {
        Alert.alert('Delete failed', 'Check your connection and try again.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [close, currentFile, reconcile]);

  const handleDeletePress = useCallback(() => {
    Alert.alert(
      'Delete this item?',
      "It'll be removed from the cloud too. It stays in your camera roll.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ],
    );
  }, [runDelete]);

  const renderPage: ListRenderItem<MediaFile> = useCallback(
    ({ item, index }) => (
      <GalleryPage
        file={item}
        pageWidth={screenWidth}
        pageHeight={pageHeight}
        fullUrl={viewUrlByFileId?.[item.id]?.fullUrl}
        isUrlLoading={urlsLoading && viewUrlByFileId?.[item.id] === undefined}
        isActive={index === currentIndex}
        onToggleMetadata={handleToggleMetadata}
        onRetryUrls={handleRetryUrls}
      />
    ),
    [
      currentIndex,
      handleRetryUrls,
      handleToggleMetadata,
      pageHeight,
      screenWidth,
      urlsLoading,
      viewUrlByFileId,
    ],
  );

  const title = currentFile === null ? '' : currentFile.displayName ?? currentFile.fileName;

  const subtitle = useMemo((): string => {
    if (currentFile === null) {
      return '';
    }
    if (isVideoFile(currentFile)) {
      // "Video · 1:04 · 18.8 MB" — the duration drops out when unknown.
      return [kindLabel(currentFile), formatDuration(currentFile.durationSeconds), formatFileSize(currentFile.sizeBytes)]
        .filter((part): part is string => part !== null)
        .join(' · ');
    }
    return `${formatDayMonth(currentFile.createdAt)} · ${formatClockTime(currentFile.createdAt)}`;
  }, [currentFile]);

  /** Stable per gallery session — must not include currentIndex (would remount on swipe). */
  const listKey = files.map((f) => f.id).join('-') || 'empty';

  const modalVisible = isOpen && files.length > 0;

  return (
    <Modal
      visible={modalVisible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <ViewerTopBar
          title={title}
          subtitle={subtitle}
          topInset={insets.top}
          onBack={close}
          onMore={handleToggleMetadata}
        />

        <View style={styles.mediaArea} onLayout={handleMediaLayout}>
          <FlatList
            ref={pagerRef}
            key={listKey}
            data={files}
            onScrollToIndexFailed={(info) => {
              pagerRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              });
            }}
            renderItem={renderPage}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentIndex}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumScrollEnd}
            windowSize={PAGER_WINDOW_SIZE}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            removeClippedSubviews
            style={styles.pager}
          />
        </View>

        {currentFile !== null ? <ViewerMetaChips file={currentFile} /> : null}

        <ViewerFilmstrip
          files={files}
          currentIndex={currentIndex}
          viewUrlByFileId={viewUrlByFileId}
          onSelect={handleSelectIndex}
        />

        {readOnly ? (
          // Agency media stays read-only (Phase 8): no move, no delete, and no
          // sharing someone else's folder out of the app. Details still open.
          <View style={{ height: insets.bottom + READ_ONLY_BOTTOM_GAP }} />
        ) : (
          <ViewerActionGrid
            canShare={currentFile?.uploadStatus === 'UPLOADED' && currentUrl !== undefined}
            busy={busy}
            bottomInset={insets.bottom}
            onShare={handleShare}
            onMove={() => setPickerVisible(true)}
            onDelete={handleDeletePress}
          />
        )}

        {currentFile !== null ? (
          <MetadataPanel
            file={currentFile}
            showMetadata={showMetadata}
            bottomInset={insets.bottom}
            translateY={metadataY}
          />
        ) : null}

        <FolderPickerSheet
          visible={pickerVisible}
          file={currentFile}
          onClose={() => setPickerVisible(false)}
          onFolderPicked={handleFolderPicked}
        />
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.darkBg,
  },
  mediaArea: {
    flex: 1,
    paddingVertical: 10,
  },
  pager: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  videoFill: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoErrorBackdrop: {
    backgroundColor: theme.colors.darkBg,
  },
  pressed: {
    opacity: 0.75,
  },

  // Load failure ---------------------------------------------------------------
  errorBox: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontFamily: theme.typography.body[500],
    fontSize: 13.5,
    color: CREAM_60,
    textAlign: 'center',
  },
  retryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: CREAM_12,
  },
  retryLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.cream,
  },

  // "…" details panel ----------------------------------------------------------
  metadataWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: METADATA_PANEL_HEIGHT,
  },
  metadataBlur: {
    flex: 1,
    // Literal radius: `radius.*` differs per palette and this chrome does not.
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.darkGlass,
  },
  metadataInner: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: CREAM_20,
    marginBottom: 14,
  },
  metadataFileName: {
    fontFamily: theme.typography.body[600],
    fontSize: 15,
    color: theme.colors.cream,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  metaLabel: {
    fontFamily: theme.typography.body[500],
    fontSize: 11.5,
    color: CREAM_60,
    flexShrink: 0,
  },
  metaValue: {
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.cream,
    flex: 1,
    textAlign: 'right',
  },
}));
