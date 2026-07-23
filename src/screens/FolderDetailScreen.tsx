import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPickerSheet } from '../components/FolderPickerSheet';
import { GlassCard } from '../components/GlassCard';
import { GridSelectionToolbar } from '../components/GridSelectionToolbar';
import {
  MediaThumbnailGrid,
  type GridSelectionState,
} from '../components/MediaThumbnailGrid';
import { useMediaViewer } from '../context/MediaViewerContext';
import type { ActivityFeedItem } from '../hooks/useActivityFeed';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import { useFolderDetails } from '../hooks/useFolderDetails';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useUnfiledFiles } from '../hooks/useUnfiledFiles';
import { UNFILED_FILES_FOLDER_PARAM } from '../services/filesService';
import type { FolderDetailScreenProps } from '../navigation/foldersTypes';
import type { MediaFile } from '../services/filesService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { batchDeleteFiles, batchMoveFiles } from '../utils/batchFileOperations';

/** Matches FoldersScreen / ActivityScreen — clears floating GlassTabBar. */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

type Props = FolderDetailScreenProps;

function mediaFilesToFeedItems(files: MediaFile[]): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = files.map((file) => {
    const ts = Date.parse(file.createdAt);
    return {
      kind: 'file',
      item: file,
      createdAt: Number.isFinite(ts) ? ts : 0,
    };
  });
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

function showBatchResultAlert(action: 'move' | 'delete', succeeded: number, failed: number): void {
  if (failed === 0) {
    return;
  }
  const title = action === 'move' ? 'Move incomplete' : 'Delete incomplete';
  const body =
    failed === 1
      ? `${succeeded} succeeded, 1 failed.`
      : `${succeeded} succeeded, ${failed} failed.`;
  Alert.alert(title, body, [{ text: 'OK' }]);
}

export function FolderDetailScreen({ navigation, route }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { folderId, folderName } = route.params;
  const isUnfiledView = folderId === UNFILED_FILES_FOLDER_PARAM;
  const { openGallery } = useMediaViewer();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const unfiledFilesQuery = useUnfiledFiles();
  const folderDetailsQuery = useFolderDetails(folderId);

  const activeQuery = isUnfiledView ? unfiledFilesQuery : folderDetailsQuery;

  const files = useMemo((): MediaFile[] => {
    if (isUnfiledView) {
      return unfiledFilesQuery.data ?? [];
    }
    return folderDetailsQuery.data?.files ?? [];
  }, [isUnfiledView, unfiledFilesQuery.data, folderDetailsQuery.data?.files]);

  const feedItems = useMemo(() => mediaFilesToFeedItems(files), [files]);

  const selectableFileIds = useMemo((): string[] => {
    return feedItems
      .filter((entry) => entry.kind === 'file' && entry.item.uploadStatus === 'UPLOADED')
      .map((entry) => entry.item.id);
  }, [feedItems]);

  const uploadedFileIds = useMemo((): string[] => {
    return files
      .filter((file) => file.uploadStatus === 'UPLOADED')
      .map((file) => file.id);
  }, [files]);

  const { data: viewUrlByFileId } = useBatchViewUrls(uploadedFileIds);

  const listBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;

  const { isLoading, isError, error, refetch, isRefetching } = activeQuery;

  useEffect(() => {
    void refetch();
  }, [folderId, refetch]);

  // Covers the tab-switch return, which the mount effect above cannot see: this
  // screen stays mounted when the Folders tab blurs (detachInactiveScreens is
  // false), so capturing into this folder from the Camera tab and switching back
  // would otherwise show a stale grid. The hook skips its first focus, so this
  // does not double up with the mount refetch.
  useRefreshOnFocus(refetch);

  const exitSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setPickerVisible(false);
  }, []);

  const enterSelection = useCallback((initialFileId?: string) => {
    setIsSelecting(true);
    if (initialFileId !== undefined) {
      setSelectedIds(new Set([initialFileId]));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePressFile = useCallback(
    (file: MediaFile) => {
      if (isSelecting) {
        return;
      }
      const startIndex = files.findIndex((f) => f.id === file.id);
      if (startIndex < 0) {
        return;
      }
      openGallery(files, startIndex);
    },
    [files, isSelecting, openGallery],
  );

  const handleToggleSelect = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const handleLongPressFile = useCallback(
    (file: MediaFile) => {
      enterSelection(file.id);
    },
    [enterSelection],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectableFileIds));
  }, [selectableFileIds]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchFolderPicked = useCallback(
    (targetFolderId: string | null) => {
      const ids = [...selectedIds];
      setBatchBusy(true);
      void batchMoveFiles(ids, targetFolderId).then((result) => {
        setBatchBusy(false);
        showBatchResultAlert('move', result.succeeded, result.failed);
        exitSelection();
      });
    },
    [exitSelection, selectedIds],
  );

  const runBatchDelete = useCallback(() => {
    const ids = [...selectedIds];
    setBatchBusy(true);
    void batchDeleteFiles(ids).then((result) => {
      setBatchBusy(false);
      showBatchResultAlert('delete', result.succeeded, result.failed);
      exitSelection();
    });
  }, [exitSelection, selectedIds]);

  const handleDeletePress = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) {
      return;
    }
    const noun = count === 1 ? 'item' : 'items';
    Alert.alert(
      `Delete ${count} ${noun}?`,
      "This permanently removes them from your cloud. They'll stay in your camera roll.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runBatchDelete },
      ],
    );
  }, [runBatchDelete, selectedIds.size]);

  const selection = useMemo(
    (): GridSelectionState => ({
      isActive: isSelecting,
      selectedIds,
      onToggle: handleToggleSelect,
      onLongPressFile: handleLongPressFile,
    }),
    [handleLongPressFile, handleToggleSelect, isSelecting, selectedIds],
  );

  const showInitialLoading = isLoading && feedItems.length === 0;
  const showEmpty = !isLoading && !isError && feedItems.length === 0;
  const showError = isError && feedItems.length === 0;

  const emptyMessage = isUnfiledView
    ? 'No unfiled files'
    : 'No files in this folder yet';

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        tintColor={colors.accentBlue}
        colors={[colors.accentBlue]}
      />
    ),
    [handleRefresh, isRefetching],
  );

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          {!isSelecting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
            >
              <Ionicons name="chevron-back" size={28} color={colors.primaryNavy} />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}

          {isSelecting ? (
            <GridSelectionToolbar
              selectedCount={selectedIds.size}
              totalSelectable={selectableFileIds.length}
              isBusy={batchBusy}
              onCancel={exitSelection}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onMove={() => setPickerVisible(true)}
              onDelete={handleDeletePress}
            />
          ) : (
            <>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {folderName}
              </Text>
              {selectableFileIds.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select items"
                  hitSlop={8}
                  onPress={() => enterSelection()}
                  style={({ pressed }) => [styles.selectButton, pressed && styles.backPressed]}
                >
                  <Text style={styles.selectLabel}>Select</Text>
                </Pressable>
              ) : (
                <View style={styles.headerSpacer} />
              )}
            </>
          )}
        </View>

        {showInitialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : null}

        {showError ? (
          <View style={styles.centeredCard}>
            <GlassCard>
              <Text style={styles.errorTitle}>Could not load files</Text>
              <Text style={styles.errorBody}>
                {error instanceof Error ? error.message : 'Something went wrong.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handleRefresh}
                style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
              >
                <Text style={styles.retryLabel}>Tap to retry</Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.centeredCard}>
            <GlassCard>
              <View style={styles.emptyInner}>
                <Ionicons name="document-outline" size={32} color={colors.mutedText} />
                <Text style={styles.emptyTitle}>{emptyMessage}</Text>
                {!isUnfiledView ? (
                  <Text style={styles.emptyBody}>
                    Files will appear here once you assign them to this folder
                  </Text>
                ) : (
                  <Text style={styles.emptyBody}>
                    Files not in any folder will appear here
                  </Text>
                )}
              </View>
            </GlassCard>
          </View>
        ) : null}

        {!showInitialLoading && !showError && feedItems.length > 0 ? (
          <MediaThumbnailGrid
            items={feedItems}
            viewUrlByFileId={viewUrlByFileId}
            onPressFile={handlePressFile}
            selection={selection}
            contentPaddingBottom={listBottomPad}
            refreshControl={refreshControl}
          />
        ) : null}
      </SafeAreaView>

      <FolderPickerSheet
        visible={pickerVisible}
        file={null}
        batchCount={selectedIds.size}
        onClose={() => setPickerVisible(false)}
        onFolderPicked={handleBatchFolderPicked}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    paddingRight: spacing.sm,
    width: 36,
  },
  backPressed: {
    opacity: 0.7,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    flex: 1,
  },
  selectButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  selectLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 56,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  centeredCard: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
  },
  errorBody: {
    ...typography.body,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.accentBlueMuted,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
});
