import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPickerSheet } from './FolderPickerSheet';
import { useMediaViewer } from '../context/MediaViewerContext';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import type { MediaFile } from '../services/filesService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatFileSize, formatFullDateTime } from '../utils/formatRelativeTime';

const VIEWER_BACKGROUND = '#000000';
const METADATA_PANEL_HEIGHT = 320;
const METADATA_ANIM_MS = 250;
const PAGER_WINDOW_SIZE = 3;

function isVideoFile(file: MediaFile): boolean {
  return file.fileType === 'VIDEO' || file.mimeType.trim().toLowerCase().startsWith('video/');
}

function titleCaseSource(source: MediaFile['source']): string {
  if (source === 'CAMERA') {
    return 'Camera';
  }
  return 'Gallery';
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const total = Math.floor(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function folderLabel(file: MediaFile): string | null {
  if (file.folder?.name !== undefined && file.folder.name.trim() !== '') {
    return file.folder.name;
  }
  if (file.folderId === null) {
    return 'Unfiled';
  }
  return null;
}

type GalleryPageProps = {
  file: MediaFile;
  pageWidth: number;
  pageHeight: number;
  fullUrl: string | undefined;
  isUrlLoading: boolean;
  onToggleMetadata: () => void;
  onRetryUrls: () => void;
};

function GalleryPage({
  file,
  pageWidth,
  pageHeight,
  fullUrl,
  isUrlLoading,
  onToggleMetadata,
  onRetryUrls,
}: GalleryPageProps): React.ReactElement {
  const [imageError, setImageError] = useState(false);
  const isVideo = isVideoFile(file);

  useEffect(() => {
    setImageError(false);
  }, [file.id, fullUrl]);

  if (isVideo) {
    return (
      <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={72} color={colors.tabInactive} />
          <Text style={styles.videoTitle}>Video playback coming soon</Text>
        </View>
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
        <ActivityIndicator size="large" color={colors.card} />
      ) : null}

      {!isUrlLoading && (fullUrl === undefined || imageError) ? (
        <View style={styles.errorBox}>
          <Ionicons name="image-outline" size={40} color={colors.tabInactive} />
          <Text style={styles.errorTitle}>Couldn&apos;t load image</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading image"
            onPress={onRetryUrls}
            style={({ pressed }) => [styles.retryChip, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
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
  onMoveToFolder: () => void;
};

function MetadataPanel({
  file,
  showMetadata,
  bottomInset,
  translateY,
  onMoveToFolder,
}: MetadataPanelProps): React.ReactElement {
  const typeLabel = isVideoFile(file) ? 'Video' : 'Photo';
  const duration = formatDuration(file.durationSeconds);
  const folder = folderLabel(file) ?? 'Unfiled';

  const rows: { label: string; value: string }[] = [
    { label: 'Type', value: typeLabel },
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
          paddingBottom: bottomInset + spacing.md,
        },
      ]}
    >
      <BlurView intensity={48} tint="dark" style={styles.metadataBlur}>
        <View style={styles.metadataInner}>
          <View style={styles.grabber} />
          <Text style={styles.metadataFileName}>{file.fileName}</Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move to folder"
            onPress={onMoveToFolder}
            style={({ pressed }) => [styles.moveButton, pressed && styles.moveButtonPressed]}
          >
            <Ionicons name="folder-outline" size={20} color={colors.card} />
            <Text style={styles.moveButtonLabel}>Move to folder</Text>
          </Pressable>
        </View>
      </BlurView>
    </Animated.View>
  );
}

export function MediaViewerModal(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const queryClient = useQueryClient();

  const { isOpen, files, currentIndex, setCurrentIndex, close, updateFile } = useMediaViewer();
  const [showMetadata, setShowMetadata] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
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
  } = useBatchViewUrls(isOpen ? uploadedFileIds : []);

  const currentFile = files[currentIndex] ?? null;

  const pageHeight = screenHeight;

  useEffect(() => {
    if (!isOpen) {
      setShowMetadata(false);
      setPickerVisible(false);
      metadataY.setValue(METADATA_PANEL_HEIGHT);
    }
  }, [isOpen, metadataY]);

  const handleMoveToFolder = useCallback(() => {
    setPickerVisible(true);
  }, []);

  const handleFileMoved = useCallback(
    (updated: MediaFile) => {
      // Viewer keeps a snapshot of files from when the gallery opened; patch the
      // open item in context so metadata (Folder row) updates immediately without
      // waiting for ['files'] / ['folder'] queries to refetch.
      updateFile(updated);
      const message =
        updated.folder?.name !== undefined && updated.folder.name.trim() !== ''
          ? `Moved to “${updated.folder.name}”.`
          : 'File is now unfiled.';
      Alert.alert('Moved', message, [{ text: 'OK' }]);
    },
    [updateFile],
  );

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

  const renderPage: ListRenderItem<MediaFile> = useCallback(
    ({ item }) => (
      <GalleryPage
        file={item}
        pageWidth={screenWidth}
        pageHeight={pageHeight}
        fullUrl={viewUrlByFileId?.[item.id]?.fullUrl}
        isUrlLoading={urlsLoading && viewUrlByFileId?.[item.id] === undefined}
        onToggleMetadata={handleToggleMetadata}
        onRetryUrls={handleRetryUrls}
      />
    ),
    [
      handleRetryUrls,
      handleToggleMetadata,
      pageHeight,
      screenWidth,
      urlsLoading,
      viewUrlByFileId,
    ],
  );

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

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            hitSlop={16}
            onPress={close}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
          >
            <Ionicons name="close" size={28} color={colors.card} />
          </Pressable>
          <Text style={styles.counter}>
            {currentIndex + 1} of {files.length}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

        {currentFile !== null ? (
          <MetadataPanel
            file={currentFile}
            showMetadata={showMetadata}
            bottomInset={insets.bottom}
            translateY={metadataY}
            onMoveToFolder={handleMoveToFolder}
          />
        ) : null}

        <FolderPickerSheet
          visible={pickerVisible}
          file={currentFile}
          onClose={() => setPickerVisible(false)}
          onMoved={handleFileMoved}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: VIEWER_BACKGROUND,
  },
  pager: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VIEWER_BACKGROUND,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  videoTitle: {
    ...typography.body,
    color: colors.tabInactive,
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    ...typography.body,
    color: colors.tabInactive,
    textAlign: 'center',
  },
  retryChip: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  retryPressed: {
    opacity: 0.8,
  },
  retryLabel: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  closeButton: {
    padding: spacing.xs,
  },
  closePressed: {
    opacity: 0.75,
  },
  counter: {
    ...typography.bodySmall,
    color: colors.tabInactive,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  topBarSpacer: {
    width: 36,
  },
  metadataWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: METADATA_PANEL_HEIGHT,
  },
  metadataBlur: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  metadataInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: spacing.md,
  },
  metadataFileName: {
    ...typography.h2,
    color: colors.card,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.tabInactive,
    flexShrink: 0,
  },
  metaValue: {
    ...typography.bodySmall,
    color: colors.card,
    flex: 1,
    textAlign: 'right',
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  moveButtonPressed: {
    opacity: 0.85,
  },
  moveButtonLabel: {
    ...typography.body,
    color: colors.card,
    fontWeight: '600',
  },
});
