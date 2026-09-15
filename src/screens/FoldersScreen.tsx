import React, { useCallback, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  Plus,
  Search,
  UploadCloud,
} from 'lucide-react-native';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { CreateFolderModal } from '../components/CreateFolderModal';
import { EditFolderModal } from '../components/EditFolderModal';
import { SyncStatusCard } from '../components/SyncStatusCard';
import { Card } from '../components/ui/Card';
import { DisplayText } from '../components/ui/DisplayText';
import { IconTile } from '../components/ui/IconTile';
import { PillButton } from '../components/ui/PillButton';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useDeleteFolder } from '../hooks/useDeleteFolder';
import { useFolders } from '../hooks/useFolders';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useUnfiledFiles } from '../hooks/useUnfiledFiles';
import { UNFILED_FILES_FOLDER_PARAM } from '../services/filesService';
import type { FoldersListScreenProps } from '../navigation/foldersTypes';
import type { MainTabParamList } from '../navigation/mainTabTypes';
import type { Folder } from '../services/foldersService';
import { useAuthStore } from '../store/authStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

/** Content scrolls under the floating tab bar; clear it. */
const BOTTOM_PADDING = 150;

type Props = FoldersListScreenProps;

export function FoldersScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  // FoldersStack's hand-rolled `navigation` only knows FolderDetail; the tab
  // navigator (Camera / Uploads) is the nearest real navigator above it.
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const greeting = firstName?.trim() ? firstName.trim() : null;

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const { mutate: deleteFolderMutate, isPending: isDeletingFolder } = useDeleteFolder();

  const {
    data: folders,
    isLoading: foldersLoading,
    isError: foldersError,
    error: foldersErrorObj,
    refetch: refetchFolders,
    isRefetching: foldersRefetching,
  } = useFolders();

  const { data: unfiledFiles } = useUnfiledFiles();
  const queueItems = useUploadQueueStore((s) => s.items);

  // Folder rows show per-folder file counts, which go stale as soon as a capture
  // lands anywhere. Refetch when the Folders tab regains focus so returning from
  // the camera shows the new counts without a pull-to-refresh.
  useRefreshOnFocus(refetchFolders);

  // The backend files unfiled uploads into a real per-user system folder
  // (isSystem). Represent it as the single pinned "Unfiled" entry and keep it out
  // of the editable rows so it can't be duplicated, renamed, or deleted.
  const systemFolder = useMemo(
    () => (folders ?? []).find((folder) => folder.isSystem),
    [folders],
  );
  const unfiledCount = systemFolder ? systemFolder.fileCount : unfiledFiles?.length ?? 0;

  // Non-system folders, most-recently-updated first. Sorting by `updatedAt`
  // (ISO strings sort lexically = chronologically) backs the "Recently used" label.
  const folderList = useMemo(
    () =>
      (folders ?? [])
        .filter((folder) => !folder.isSystem)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [folders],
  );

  // Folder ids with something still in the upload queue → the row's mini status
  // shows "uploading" instead of the all-clear check.
  const foldersWithPending = useMemo(() => {
    const set = new Set<string>();
    for (const item of queueItems) {
      if (item.status !== 'uploaded' && item.folderId) {
        set.add(item.folderId);
      }
    }
    return set;
  }, [queueItems]);

  const showFoldersSpinner = foldersLoading && folders === undefined;
  const showFoldersError = foldersError && folders === undefined;
  const isEmpty =
    !foldersLoading && !foldersError && folderList.length === 0 && unfiledCount === 0;

  const handleRefresh = useCallback(() => {
    void refetchFolders();
  }, [refetchFolders]);

  const openUnfiled = useCallback(() => {
    // Open the real system folder (where unfiled uploads now live); fall back to
    // the legacy null-folder view only until that folder exists on the backend.
    navigation.navigate('FolderDetail', {
      folderId: systemFolder ? systemFolder.id : UNFILED_FILES_FOLDER_PARAM,
      folderName: systemFolder ? systemFolder.name : 'Unfiled',
    });
  }, [navigation, systemFolder]);

  const openFolder = useCallback(
    (folder: Folder) => {
      navigation.navigate('FolderDetail', { folderId: folder.id, folderName: folder.name });
    },
    [navigation],
  );

  const goToCamera = useCallback(() => {
    tabNavigation.navigate('Camera');
  }, [tabNavigation]);

  const confirmDeleteFolder = useCallback(
    (folder: Folder) => {
      if (folder.fileCount > 0) {
        Alert.alert(
          'Folder not empty',
          `"${folder.name}" has ${folder.fileCount} file${folder.fileCount === 1 ? '' : 's'}. Remove them before deleting this folder.`,
        );
        return;
      }
      Alert.alert('Delete folder', `Delete "${folder.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteFolderMutate(folder.id, {
              onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : 'Could not delete folder.';
                Alert.alert('Delete failed', message);
              },
            });
          },
        },
      ]);
    },
    [deleteFolderMutate],
  );

  const openFolderMenu = useCallback(
    (folder: Folder) => {
      const rename = (): void => setEditFolder(folder);
      const remove = (): void => confirmDeleteFolder(folder);

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Rename', 'Delete', 'Cancel'],
            cancelButtonIndex: 2,
            destructiveButtonIndex: 1,
            title: folder.name,
            disabledButtonIndices: isDeletingFolder ? [0, 1] : undefined,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              rename();
            } else if (buttonIndex === 1) {
              remove();
            }
          },
        );
        return;
      }

      Alert.alert(folder.name, undefined, [
        { text: 'Rename', onPress: rename },
        { text: 'Delete', style: 'destructive', onPress: remove },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [confirmDeleteFolder, isDeletingFolder],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={foldersRefetching}
        onRefresh={handleRefresh}
        tintColor={theme.colors.accent}
        colors={[theme.colors.accent]}
      />
    ),
    [handleRefresh, foldersRefetching],
  );

  const renderHeader = (): React.ReactElement => (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {greeting ? <Text style={styles.greeting}>Hi {greeting}</Text> : null}
        <DisplayText size={34}>Folders</DisplayText>
      </View>
      <View style={styles.headerButtons}>
        <Pressable
          onPress={() => {
            // TODO(Phase 10): open notifications. Intentionally inert for now;
            // the unread dot is likewise withheld until then.
          }}
          style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Bell size={18} color={theme.colors.text} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => setCreateModalVisible(true)}
          style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="New folder"
        >
          <Plus size={20} color={theme.colors.text} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );

  const renderFolderRow = (folder: Folder): React.ReactElement => {
    const hasPending = foldersWithPending.has(folder.id);
    const count = folder.fileCount;
    return (
      <Pressable
        key={folder.id}
        onPress={() => openFolder(folder)}
        onLongPress={() => openFolderMenu(folder)}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={folder.name}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card shadow style={styles.folderCard}>
          <View style={styles.row}>
            {/* Fallback tinted tile. Real overlapping thumbnails need GET /folders
                to return recent thumb URLs — a backend change for a later phase. */}
            <IconTile icon={FolderIcon} tone="accent" size={44} />
            <View style={styles.rowMiddle}>
              <Text style={styles.rowName} numberOfLines={1}>
                {folder.name}
              </Text>
              <View style={styles.rowStatusLine}>
                {hasPending ? (
                  <UploadCloud size={13} color={theme.colors.accentDeep} strokeWidth={2.2} />
                ) : (
                  <Check size={13} color={theme.colors.okDeep} strokeWidth={2.6} />
                )}
                <Text style={styles.rowSub} numberOfLines={1}>
                  {count} {count === 1 ? 'file' : 'files'} · {formatRelativeTime(folder.updatedAt)}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={theme.colors.faint} strokeWidth={2} />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_PADDING }]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyArt}>
              <View style={styles.folderGlyph}>
                <View style={styles.folderTab} />
                <View style={styles.folderBody} />
              </View>
            </View>
            <DisplayText size={26}>No folders yet</DisplayText>
            <Text style={styles.emptyCopy}>
              Folders are how your editors find things. Make one per shoot, client or
              campaign — captures get named after it automatically.
            </Text>
            <View style={styles.emptyButtons}>
              <PillButton title="Create your first folder" onPress={() => setCreateModalVisible(true)} />
              <PillButton title="Or just start shooting" variant="ghost" onPress={goToCamera} />
            </View>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() => {
                // TODO(Phase 9): search. Visual-only pill for now.
              }}
              style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
              accessibilityRole="search"
              accessibilityLabel="Search captures and folders"
            >
              <Search size={18} color={theme.colors.faint} strokeWidth={2} />
              <Text style={styles.searchPlaceholder}>Search captures and folders</Text>
            </Pressable>

            <SyncStatusCard />

            {showFoldersError ? (
              <Card style={styles.errorCard}>
                <Text style={styles.errorTitle}>Could not load folders</Text>
                <Text style={styles.errorBody}>
                  {foldersErrorObj instanceof Error ? foldersErrorObj.message : 'Something went wrong.'}
                </Text>
                <PillButton title="Try again" variant="secondary" height={44} onPress={handleRefresh} />
              </Card>
            ) : (
              <>
                <SectionLabel style={styles.sectionLabel}>Pinned</SectionLabel>
                <Pressable
                  onPress={openUnfiled}
                  accessibilityRole="button"
                  accessibilityLabel="Unfiled"
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Card style={styles.folderCard}>
                    <View style={styles.row}>
                      <IconTile icon={Inbox} tone="accent" size={44} />
                      <View style={styles.rowMiddle}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          Unfiled
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {unfiledCount} {unfiledCount === 1 ? 'file' : 'files'} · file them any time
                        </Text>
                      </View>
                      <ChevronRight size={20} color={theme.colors.faint} strokeWidth={2} />
                    </View>
                  </Card>
                </Pressable>

                <View style={styles.sectionHeader}>
                  <SectionLabel>Your folders</SectionLabel>
                  <Text style={styles.recentlyUsed}>Recently used</Text>
                </View>

                {showFoldersSpinner ? (
                  <View style={styles.spinnerBox}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  </View>
                ) : folderList.length === 0 ? (
                  <Text style={styles.inlineHint}>No folders yet — tap + to create one.</Text>
                ) : (
                  folderList.map(renderFolderRow)
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <CreateFolderModal visible={createModalVisible} onClose={() => setCreateModalVisible(false)} />
      <EditFolderModal
        visible={editFolder !== null}
        folder={editFolder}
        onClose={() => setEditFolder(null)}
      />
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.85,
  },

  // Header --------------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: theme.typography.body[500],
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },

  // Search --------------------------------------------------------------------
  searchBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.line,
    marginBottom: 16,
  },
  searchPlaceholder: {
    fontFamily: theme.typography.body[400],
    fontSize: 14,
    color: theme.colors.faint,
  },

  // Sections ------------------------------------------------------------------
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  recentlyUsed: {
    fontFamily: theme.typography.body[500],
    fontSize: 11.5,
    color: theme.colors.faint,
  },

  // Rows ----------------------------------------------------------------------
  folderCard: {
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  rowStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  rowSub: {
    flexShrink: 1,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },

  // Loading / error / hint ----------------------------------------------------
  spinnerBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  inlineHint: {
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.faint,
    paddingVertical: 8,
  },
  errorCard: {
    padding: 16,
    marginTop: 16,
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

  // Empty state ---------------------------------------------------------------
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 14,
  },
  emptyArt: {
    width: 150,
    height: 150,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  folderGlyph: {
    width: 78,
    height: 60,
  },
  folderTab: {
    position: 'absolute',
    top: 0,
    left: 10,
    width: 34,
    height: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  folderBody: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.accentDeep,
  },
  emptyCopy: {
    fontFamily: theme.typography.body[400],
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emptyButtons: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 6,
  },
}));
