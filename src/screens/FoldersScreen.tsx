import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  type ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderModal } from '../components/CreateFolderModal';
import { EditFolderModal } from '../components/EditFolderModal';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useDeleteFolder } from '../hooks/useDeleteFolder';
import { useFolders } from '../hooks/useFolders';
import { useUnfiledFiles } from '../hooks/useUnfiledFiles';
import { UNFILED_FILES_FOLDER_PARAM } from '../services/filesService';
import type { FoldersListScreenProps } from '../navigation/foldersTypes';
import type { Folder } from '../services/foldersService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches ActivityScreen / SettingsScreen — clears floating GlassTabBar. */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

const UNFILED_ENTRY_ID = 'unfiled';

type FolderListEntry =
  | { kind: 'unfiled'; id: typeof UNFILED_ENTRY_ID }
  | { kind: 'folder'; id: string; folder: Folder };

type Props = FoldersListScreenProps;

type FolderListRowProps = {
  entry: FolderListEntry;
  fileCount?: number;
  onPress: () => void;
  onManagePress?: () => void;
};

function FolderListRow({
  entry,
  fileCount,
  onPress,
  onManagePress,
}: FolderListRowProps): React.ReactElement {
  const isUnfiled = entry.kind === 'unfiled';
  const name = isUnfiled ? 'Unfiled' : entry.folder.name;
  const iconName = isUnfiled ? 'file-tray-outline' : 'folder';
  const showCount = fileCount !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onManagePress}
      delayLongPress={400}
      style={({ pressed }) => [pressed && styles.rowPressed]}
    >
      <GlassCard intensity={64} style={styles.card}>
        <View style={styles.row}>
          <View
            style={[styles.iconSquare, isUnfiled ? styles.iconSquareAll : styles.iconSquareFolder]}
          >
            <Ionicons
              name={iconName}
              size={22}
              color={isUnfiled ? colors.accentBlue : colors.primaryNavy}
            />
          </View>
          <View style={styles.middle}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name}
            </Text>
            {showCount ? (
              <Text style={styles.rowCount}>
                {fileCount} {fileCount === 1 ? 'file' : 'files'}
              </Text>
            ) : null}
          </View>
          {onManagePress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Folder options"
              hitSlop={10}
              onPress={onManagePress}
              style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.mutedText} />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={colors.tabInactive} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function FoldersScreen({ navigation }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
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

  const listBottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT + spacing.md;
  const unfiledCount = unfiledFiles?.length;

  const listEntries = useMemo<FolderListEntry[]>(() => {
    const entries: FolderListEntry[] = [{ kind: 'unfiled', id: UNFILED_ENTRY_ID }];
    for (const folder of folders ?? []) {
      entries.push({ kind: 'folder', id: folder.id, folder });
    }
    return entries;
  }, [folders]);

  const folderList = folders ?? [];
  const showFoldersSpinner = foldersLoading && folders === undefined;
  const showFoldersError = foldersError && folders === undefined;
  const showEmptyHint = !foldersLoading && !foldersError && folderList.length === 0;

  const handleRefresh = useCallback(() => {
    void refetchFolders();
  }, [refetchFolders]);

  const openUnfiled = useCallback(() => {
    navigation.navigate('FolderDetail', {
      folderId: UNFILED_FILES_FOLDER_PARAM,
      folderName: 'Unfiled',
    });
  }, [navigation]);

  const openFolder = useCallback(
    (folder: Folder) => {
      navigation.navigate('FolderDetail', { folderId: folder.id, folderName: folder.name });
    },
    [navigation],
  );

  const confirmDeleteFolder = useCallback(
    (folder: Folder) => {
      if (folder.fileCount > 0) {
        Alert.alert(
          'Folder not empty',
          `"${folder.name}" has ${folder.fileCount} file${folder.fileCount === 1 ? '' : 's'}. Remove them before deleting this folder.`,
        );
        return;
      }
      Alert.alert(
        'Delete folder',
        `Delete "${folder.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteFolderMutate(folder.id, {
                onError: (error: unknown) => {
                  const message =
                    error instanceof Error ? error.message : 'Could not delete folder.';
                  Alert.alert('Delete failed', message);
                },
              });
            },
          },
        ],
      );
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

  const keyExtractor = useCallback((entry: FolderListEntry): string => entry.id, []);

  const renderItem: ListRenderItem<FolderListEntry> = useCallback(
    ({ item }) => {
      const count = item.kind === 'unfiled' ? unfiledCount : item.folder.fileCount;
      const onPress = item.kind === 'unfiled' ? openUnfiled : () => openFolder(item.folder);
      const onManagePress = item.kind === 'folder' ? () => openFolderMenu(item.folder) : undefined;
      return (
        <FolderListRow
          entry={item}
          fileCount={count}
          onPress={onPress}
          onManagePress={onManagePress}
        />
      );
    },
    [openFolder, openFolderMenu, openUnfiled, unfiledCount],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={foldersRefetching}
        onRefresh={handleRefresh}
        tintColor={colors.accentBlue}
        colors={[colors.accentBlue]}
      />
    ),
    [handleRefresh, foldersRefetching],
  );

  const listFooter = useMemo(() => {
    if (showFoldersSpinner) {
      return (
        <View style={styles.footerSpinner}>
          <ActivityIndicator size="small" color={colors.accentBlue} />
        </View>
      );
    }
    if (showEmptyHint) {
      return (
        <Text style={styles.emptyHint}>Create a folder to organize your media</Text>
      );
    }
    return null;
  }, [showEmptyHint, showFoldersSpinner]);

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Folders</Text>
          <Text style={styles.subtitle}>Organize your captures</Text>
        </View>

        <PrimaryButton
          label="+ New Folder"
          onPress={() => setCreateModalVisible(true)}
          style={styles.newFolderButton}
        />

        {showFoldersError ? (
          <View style={styles.errorCard}>
            <GlassCard>
              <Text style={styles.errorTitle}>Could not load folders</Text>
              <Text style={styles.errorBody}>
                {foldersErrorObj instanceof Error ? foldersErrorObj.message : 'Something went wrong.'}
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

        <FlatList
          data={listEntries}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={listFooter}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      <CreateFolderModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
      <EditFolderModal
        visible={editFolder !== null}
        folder={editFolder}
        onClose={() => setEditFolder(null)}
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
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.primaryNavy,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  newFolderButton: {
    marginBottom: spacing.lg,
  },
  listContent: {
    flexGrow: 1,
  },
  card: {
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowPressed: {
    opacity: 0.9,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconSquareAll: {
    backgroundColor: colors.accentBlueMuted,
  },
  iconSquareFolder: {
    backgroundColor: colors.glassSurface,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryNavy,
  },
  rowCount: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginTop: 2,
  },
  menuButton: {
    marginRight: spacing.xs,
    padding: spacing.xs,
  },
  menuPressed: {
    opacity: 0.7,
  },
  footerSpinner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorCard: {
    marginBottom: spacing.md,
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
});
