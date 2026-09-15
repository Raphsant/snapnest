import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderPickerSheet } from '../components/FolderPickerSheet';
import { FolderMediaGrid } from '../components/FolderMediaGrid';
import { SelectionTray } from '../components/SelectionTray';
import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { Toast } from '../components/ui/Toast';
import { useMediaViewer } from '../context/MediaViewerContext';
import { useBatchViewUrls } from '../hooks/useBatchViewUrls';
import { folderDetailsQueryKey, useFolderDetails } from '../hooks/useFolderDetails';
import { useFolders } from '../hooks/useFolders';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { UNFILED_FILES_QUERY_KEY, useUnfiledFiles } from '../hooks/useUnfiledFiles';
import {
  BATCH_MOVE_UNFILED,
  UNFILED_FILES_FOLDER_PARAM,
  requestBatchDelete,
  requestBatchMove,
  type MediaFile,
} from '../services/filesService';
import type { FolderDetails } from '../services/foldersService';
import { queryClient } from '../services/queryClient';
import type { FolderDetailScreenProps } from '../navigation/foldersTypes';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

/** Content scrolls under the floating tab bar; clear it. */
const BOTTOM_PADDING = 150;
const TOAST_MS = 2600;

type Props = FolderDetailScreenProps;
type FilterKind = 'all' | 'photos' | 'videos' | 'notBacked';
type ToastState = { title: string; subtitle?: string } | null;

function isPhoto(file: MediaFile): boolean {
  return file.fileType === 'PHOTO' || file.mimeType.startsWith('image/');
}
function isVideoFile(file: MediaFile): boolean {
  return file.fileType === 'VIDEO' || file.mimeType.startsWith('video/');
}

export function FolderDetailScreen({ navigation, route }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const { folderId, folderName } = route.params;
  const isUnfiledView = folderId === UNFILED_FILES_FOLDER_PARAM;
  const { openGallery } = useMediaViewer();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unfiledFilesQuery = useUnfiledFiles();
  const folderDetailsQuery = useFolderDetails(folderId);
  const activeQuery = isUnfiledView ? unfiledFilesQuery : folderDetailsQuery;
  const { data: allFolders } = useFolders();

  const files = useMemo((): MediaFile[] => {
    if (isUnfiledView) {
      return unfiledFilesQuery.data ?? [];
    }
    return folderDetailsQuery.data?.files ?? [];
  }, [isUnfiledView, unfiledFilesQuery.data, folderDetailsQuery.data?.files]);

  const uploadedFileIds = useMemo(
    () => files.filter((f) => f.uploadStatus === 'UPLOADED').map((f) => f.id),
    [files],
  );
  const { data: viewUrlByFileId } = useBatchViewUrls(uploadedFileIds);

  const { isLoading, isError, error, refetch, isRefetching } = activeQuery;

  useEffect(() => {
    void refetch();
  }, [folderId, refetch]);
  useRefreshOnFocus(refetch);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // Counts (over the full list, independent of the active filter).
  const counts = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let notBacked = 0;
    for (const file of files) {
      if (isPhoto(file)) photos += 1;
      else if (isVideoFile(file)) videos += 1;
      if (file.uploadStatus !== 'UPLOADED') notBacked += 1;
    }
    return { total: files.length, photos, videos, notBacked };
  }, [files]);

  const filteredFiles = useMemo((): MediaFile[] => {
    switch (filter) {
      case 'photos':
        return files.filter(isPhoto);
      case 'videos':
        return files.filter(isVideoFile);
      case 'notBacked':
        return files.filter((f) => f.uploadStatus !== 'UPLOADED');
      default:
        return files;
    }
  }, [files, filter]);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedIds.has(f.id)),
    [files, selectedIds],
  );
  // RN Share is single-URL: enable only for one uploaded file.
  const canShare =
    selectedFiles.length === 1 && selectedFiles[0].uploadStatus === 'UPLOADED';

  const showToast = useCallback((title: string, subtitle?: string) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast({ title, subtitle });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const exitSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setPickerVisible(false);
  }, []);

  const enterSelection = useCallback((initialFileId?: string) => {
    setIsSelecting(true);
    setSelectedIds(initialFileId !== undefined ? new Set([initialFileId]) : new Set());
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
      if (startIndex >= 0) {
        openGallery(files, startIndex);
      }
    },
    [files, isSelecting, openGallery],
  );

  const handleToggleSelect = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleLongPressFile = useCallback(
    (file: MediaFile) => enterSelection(file.id),
    [enterSelection],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  }, [filteredFiles]);

  // Optimistically drop ids from whichever query backs this view; returns a
  // rollback that restores the pre-mutation snapshot on failure.
  const optimisticallyRemove = useCallback(
    (ids: readonly string[]): (() => void) => {
      const idSet = new Set(ids);
      if (isUnfiledView) {
        const prev = queryClient.getQueryData<MediaFile[]>(UNFILED_FILES_QUERY_KEY);
        if (prev) {
          queryClient.setQueryData<MediaFile[]>(
            UNFILED_FILES_QUERY_KEY,
            prev.filter((f) => !idSet.has(f.id)),
          );
        }
        return () => {
          if (prev) queryClient.setQueryData(UNFILED_FILES_QUERY_KEY, prev);
        };
      }
      const key = folderDetailsQueryKey(folderId);
      const prev = queryClient.getQueryData<FolderDetails>(key);
      if (prev) {
        queryClient.setQueryData<FolderDetails>(key, {
          ...prev,
          files: prev.files.filter((f) => !idSet.has(f.id)),
        });
      }
      return () => {
        if (prev) queryClient.setQueryData(key, prev);
      };
    },
    [folderId, isUnfiledView],
  );

  // Reconcile server truth after a batch op: skipped files reappear, counts update.
  const reconcile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['folders'] });
    void queryClient.invalidateQueries({ queryKey: ['folder'] });
    void queryClient.invalidateQueries({ queryKey: ['files'] });
    void queryClient.invalidateQueries({ queryKey: ['batchViewUrls'] });
  }, []);

  const handleBatchMove = useCallback(
    (pickedFolderId: string | null) => {
      const ids = [...selectedIds];
      if (ids.length === 0) {
        return;
      }
      const targetFolderId = pickedFolderId ?? BATCH_MOVE_UNFILED;
      const targetName = pickedFolderId
        ? (allFolders ?? []).find((f) => f.id === pickedFolderId)?.name ?? 'folder'
        : 'Unfiled';

      const rollback = optimisticallyRemove(ids);
      exitSelection();

      void requestBatchMove(ids, targetFolderId)
        .then((result) => {
          reconcile();
          const moved = result.succeededIds.length;
          const skipped = result.skippedIds.length;
          if (skipped > 0) {
            showToast(`Moved ${moved} · ${skipped} skipped`);
          } else {
            showToast(`Moved ${moved} to ${targetName}`);
          }
        })
        .catch(() => {
          rollback();
          showToast('Move failed', 'Check your connection and try again');
        });
    },
    [allFolders, exitSelection, optimisticallyRemove, reconcile, selectedIds, showToast],
  );

  const runBatchDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }
    const rollback = optimisticallyRemove(ids);
    exitSelection();

    void requestBatchDelete(ids)
      .then((result) => {
        reconcile();
        const deleted = result.succeededIds.length;
        const skipped = result.skippedIds.length;
        if (skipped > 0) {
          showToast(`Deleted ${deleted} · ${skipped} skipped`);
        } else {
          showToast(`Deleted ${deleted}`);
        }
      })
      .catch(() => {
        rollback();
        showToast('Delete failed', 'Check your connection and try again');
      });
  }, [exitSelection, optimisticallyRemove, reconcile, selectedIds, showToast]);

  const handleDeletePress = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) {
      return;
    }
    const noun = count === 1 ? 'item' : 'items';
    Alert.alert(
      `Delete ${count} ${noun}?`,
      "They'll be removed from the cloud too. They stay in your camera roll.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runBatchDelete },
      ],
    );
  }, [runBatchDelete, selectedIds.size]);

  const handleShare = useCallback(() => {
    if (selectedFiles.length !== 1) {
      return;
    }
    const url = viewUrlByFileId?.[selectedFiles[0].id]?.fullUrl;
    if (!url) {
      showToast("Can't share yet", 'This file is still preparing');
      return;
    }
    void Share.share({ url }).catch(() => {
      // User-cancelled or failed share — nothing to recover.
    });
  }, [selectedFiles, showToast, viewUrlByFileId]);

  const showInitialLoading = isLoading && files.length === 0;
  const showEmpty = !isLoading && !isError && files.length === 0;
  const showError = isError && files.length === 0;

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        tintColor={theme.colors.accent}
        colors={[theme.colors.accent]}
      />
    ),
    [handleRefresh, isRefetching],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to folders"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ChevronLeft size={18} color={theme.colors.accent} strokeWidth={2.4} />
            <Text style={styles.backLabel}>Folders</Text>
          </Pressable>
          <Pressable
            onPress={() => (isSelecting ? exitSelection() : enterSelection())}
            hitSlop={10}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.selectToggle}>{isSelecting ? 'Done' : 'Select'}</Text>
          </Pressable>
        </View>

        <DisplayText size={30} style={styles.title}>
          {folderName}
        </DisplayText>

        <Text style={styles.meta} numberOfLines={1}>
          {counts.total} {counts.total === 1 ? 'item' : 'items'} · {counts.photos} photos,{' '}
          {counts.videos} videos{'  ·  '}
          {counts.notBacked === 0 ? (
            <Text style={styles.metaOk}>✓ All backed up</Text>
          ) : (
            <Text style={styles.metaWarn}>{counts.notBacked} not backed up</Text>
          )}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <FilterChip label={`All ${counts.total}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Photos" active={filter === 'photos'} onPress={() => setFilter('photos')} />
          <FilterChip label="Videos" active={filter === 'videos'} onPress={() => setFilter('videos')} />
          <FilterChip
            label="Not backed up"
            active={filter === 'notBacked'}
            onPress={() => setFilter('notBacked')}
          />
        </ScrollView>
      </View>

      {showInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : null}

      {showError ? (
        <View style={styles.centeredCard}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load files</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </Text>
            <PillButton title="Try again" variant="secondary" height={44} onPress={handleRefresh} />
          </Card>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.centeredCard}>
          <Text style={styles.emptyTitle}>
            {isUnfiledView ? 'No unfiled files' : 'No files in this folder yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {isUnfiledView
              ? 'Files not in any folder will appear here.'
              : 'Captures sent here will appear in this folder.'}
          </Text>
        </View>
      ) : null}

      {!showInitialLoading && !showError && files.length > 0 ? (
        <FolderMediaGrid
          files={filteredFiles}
          viewUrlByFileId={viewUrlByFileId}
          isSelecting={isSelecting}
          selectedIds={selectedIds}
          onPressFile={handlePressFile}
          onToggle={handleToggleSelect}
          onLongPressFile={handleLongPressFile}
          contentPaddingBottom={insets.bottom + BOTTOM_PADDING}
          refreshControl={refreshControl}
        />
      ) : null}

      {isSelecting ? (
        <SelectionTray
          count={selectedIds.size}
          canShare={canShare}
          onSelectAll={handleSelectAll}
          onMove={() => setPickerVisible(true)}
          onShare={handleShare}
          onDelete={handleDeletePress}
        />
      ) : null}

      {toast ? <Toast title={toast.title} subtitle={toast.subtitle} /> : null}

      <FolderPickerSheet
        visible={pickerVisible}
        file={null}
        batchCount={selectedIds.size}
        onClose={() => setPickerVisible(false)}
        onFolderPicked={handleBatchMove}
      />
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={active ? styles.chipTextActive : styles.chipTextInactive}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header (sticky above the grid) --------------------------------------------
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: theme.colors.glass,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
  },
  backLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  selectToggle: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.accent,
  },
  title: {
    marginBottom: 4,
  },
  meta: {
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  metaOk: {
    fontFamily: theme.typography.body[600],
    color: theme.colors.okDeep,
  },
  metaWarn: {
    fontFamily: theme.typography.body[600],
    color: theme.colors.warn,
  },
  chipsRow: {
    gap: 8,
    paddingTop: 12,
    paddingRight: 4,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.line2,
  },
  chipTextActive: {
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.white,
  },
  chipTextInactive: {
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.muted,
  },

  // States --------------------------------------------------------------------
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  centeredCard: {
    paddingHorizontal: 14,
    paddingTop: 24,
    alignItems: 'center',
    gap: 6,
  },
  errorCard: {
    alignSelf: 'stretch',
    padding: 16,
    gap: 10,
  },
  errorTitle: {
    fontFamily: theme.typography.body[700],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  errorBody: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  emptyTitle: {
    fontFamily: theme.typography.body[700],
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyBody: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}));
