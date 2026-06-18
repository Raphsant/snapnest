import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateFolderModal } from './CreateFolderModal';
import { PrimaryButton } from './PrimaryButton';
import { useFolders } from '../hooks/useFolders';
import { useMoveFile } from '../hooks/useMoveFile';
import type { Folder } from '../services/foldersService';
import type { MediaFile } from '../services/filesService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const UNFILED_ID = '__unfiled__';

type FolderPickerSheetProps = {
  visible: boolean;
  file: MediaFile | null;
  onClose: () => void;
  /** Single-file move (viewer). */
  onMoved?: (file: MediaFile) => void;
  /** Batch move: parent runs batch ops; no per-file mutation in the sheet. */
  onFolderPicked?: (folderId: string | null) => void;
  batchCount?: number;
};

function getMutationErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((part): part is string => typeof part === 'string').join(', ');
      }
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not move file. Please try again.';
}

type PickerRow =
  | { kind: 'unfiled'; id: typeof UNFILED_ID }
  | { kind: 'folder'; folder: Folder };

export function FolderPickerSheet({
  visible,
  file,
  onClose,
  onMoved,
  onFolderPicked,
  batchCount,
}: FolderPickerSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const foldersQuery = useFolders();
  const { mutate, isPending, reset, variables } = useMoveFile();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const isBatchMode = onFolderPicked !== undefined;
  const modalVisible = visible && (file !== null || isBatchMode);

  const userFolders = foldersQuery.data ?? [];
  const hasUserFolders = userFolders.length > 0;

  const rows = useMemo((): PickerRow[] => {
    const list: PickerRow[] = [{ kind: 'unfiled', id: UNFILED_ID }];
    for (const folder of userFolders) {
      list.push({ kind: 'folder', folder });
    }
    return list;
  }, [userFolders]);

  useEffect(() => {
    if (!visible) {
      setErrorMessage(null);
      setCreateModalVisible(false);
      reset();
    }
  }, [reset, visible]);

  const handleClose = useCallback(() => {
    if (isPending) {
      return;
    }
    setErrorMessage(null);
    reset();
    onClose();
  }, [isPending, onClose, reset]);

  const handleSelect = useCallback(
    (folderId: string | null) => {
      if (isPending) {
        return;
      }
      setErrorMessage(null);

      if (onFolderPicked !== undefined) {
        onFolderPicked(folderId);
        onClose();
        return;
      }

      if (file === null || onMoved === undefined) {
        return;
      }

      mutate(
        {
          fileId: file.id,
          folderId,
        },
        {
          onSuccess: (updated) => {
            onMoved(updated);
            setErrorMessage(null);
            reset();
            onClose();
          },
          onError: (error: unknown) => {
            setErrorMessage(getMutationErrorMessage(error));
          },
        },
      );
    },
    [file, isPending, mutate, onClose, onFolderPicked, onMoved, reset],
  );

  const renderRow = useCallback(
    ({ item }: { item: PickerRow }) => {
      const isUnfiled = item.kind === 'unfiled';
      const targetFolderId = isUnfiled ? null : item.folder.id;
      const isCurrent =
        !isBatchMode &&
        file !== null &&
        ((isUnfiled && file.folderId === null) ||
          (!isUnfiled && file.folderId === item.folder.id));
      const isLoadingThis =
        !isBatchMode &&
        file !== null &&
        isPending &&
        variables?.folderId === targetFolderId &&
        variables?.fileId === file.id;
      const label = isUnfiled ? 'Unfiled (no folder)' : item.folder.name;
      const countLabel = isUnfiled ? undefined : `${item.folder.fileCount} files`;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={isPending}
          onPress={() => handleSelect(targetFolderId)}
          style={({ pressed }) => [
            styles.row,
            pressed && !isPending && styles.rowPressed,
            isCurrent && styles.rowCurrent,
          ]}
        >
          <Ionicons
            name={isUnfiled ? 'albums-outline' : 'folder-outline'}
            size={22}
            color={isCurrent ? colors.accentBlue : colors.primaryNavy}
          />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, isCurrent && styles.rowTitleCurrent]} numberOfLines={1}>
              {label}
            </Text>
            {countLabel !== undefined ? (
              <Text style={styles.rowSubtitle}>{countLabel}</Text>
            ) : null}
          </View>
          {isLoadingThis ? (
            <ActivityIndicator size="small" color={colors.accentBlue} />
          ) : isCurrent ? (
            <Ionicons name="checkmark" size={22} color={colors.accentBlue} />
          ) : (
            <View style={styles.rowSpacer} />
          )}
        </Pressable>
      );
    },
    [file, handleSelect, isBatchMode, isPending, variables],
  );

  const keyExtractor = useCallback((item: PickerRow): string => {
    return item.kind === 'unfiled' ? UNFILED_ID : item.folder.id;
  }, []);

  const listFooter = useMemo(() => {
    if (foldersQuery.isLoading || foldersQuery.isError || hasUserFolders) {
      return null;
    }
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>You don&apos;t have any folders yet.</Text>
        <PrimaryButton
          label="Create folder"
          onPress={() => setCreateModalVisible(true)}
          disabled={isPending}
          style={styles.createButton}
        />
      </View>
    );
  }, [foldersQuery.isError, foldersQuery.isLoading, hasUserFolders, isPending]);

  return (
    <>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.grabber} />
            <Text style={styles.title}>Move to folder</Text>
            {isBatchMode && batchCount !== undefined ? (
              <Text style={styles.subtitle}>
                {batchCount} {batchCount === 1 ? 'item' : 'items'}
              </Text>
            ) : null}
            {!isBatchMode && file !== null ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {file.fileName}
              </Text>
            ) : null}

            {foldersQuery.isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.accentBlue} />
              </View>
            ) : null}

            {foldersQuery.isError ? (
              <Text style={styles.errorText}>Could not load folders.</Text>
            ) : null}

            {!foldersQuery.isLoading && !foldersQuery.isError && modalVisible ? (
              <FlatList
                data={rows}
                keyExtractor={keyExtractor}
                renderItem={renderRow}
                ListFooterComponent={listFooter}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
              />
            ) : null}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={handleClose}
              disabled={isPending}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateFolderModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.card,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.primaryNavy,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: colors.accentBlueMuted,
  },
  rowCurrent: {
    backgroundColor: colors.accentBlueMuted,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.body,
    color: colors.primaryNavy,
    fontWeight: '600',
  },
  rowTitleCurrent: {
    color: colors.accentBlue,
  },
  rowSubtitle: {
    ...typography.bodySmall,
    color: colors.mutedText,
    marginTop: 2,
  },
  rowSpacer: {
    width: 22,
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
  },
  createButton: {
    alignSelf: 'stretch',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelPressed: {
    opacity: 0.75,
  },
  cancelLabel: {
    ...typography.body,
    color: colors.mutedText,
    fontWeight: '600',
  },
});
