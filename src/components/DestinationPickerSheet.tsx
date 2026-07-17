import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
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

import { useFolders } from '../hooks/useFolders';
import type { Folder } from '../services/foldersService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Fallback label before the on-demand system folder exists in the list. */
const DEFAULT_LABEL_FALLBACK = 'Unfiled';

type DestinationPickerSheetProps = {
  visible: boolean;
  /** `null` = the system/Unfiled default. */
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
};

/**
 * The first row always represents the system default (folderId omitted on
 * upload); it carries the isSystem folder's name once that folder exists.
 */
type DestinationRow =
  | { kind: 'default' }
  | { kind: 'folder'; folder: Folder };

export function DestinationPickerSheet({
  visible,
  selectedFolderId,
  onSelect,
  onClose,
}: DestinationPickerSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const foldersQuery = useFolders();

  const folders = foldersQuery.data ?? [];
  const systemFolder = useMemo(
    (): Folder | undefined => folders.find((folder) => folder.isSystem),
    [folders],
  );
  const defaultLabel = systemFolder?.name ?? DEFAULT_LABEL_FALLBACK;

  const rows = useMemo((): DestinationRow[] => {
    // System default pinned first; the isSystem folder itself is excluded from
    // the rest so it never appears twice. Remaining folders keep backend order.
    const list: DestinationRow[] = [{ kind: 'default' }];
    for (const folder of folders) {
      if (folder.isSystem) {
        continue;
      }
      list.push({ kind: 'folder', folder });
    }
    return list;
  }, [folders]);

  const handleSelect = useCallback(
    (folderId: string | null) => {
      onSelect(folderId);
      onClose();
    },
    [onClose, onSelect],
  );

  const renderRow = useCallback(
    ({ item }: { item: DestinationRow }) => {
      const isDefault = item.kind === 'default';
      const targetFolderId = isDefault ? null : item.folder.id;
      const isCurrent = isDefault
        ? selectedFolderId === null
        : selectedFolderId === item.folder.id;
      const label = isDefault ? defaultLabel : item.folder.name;
      const countLabel = isDefault ? undefined : `${item.folder.fileCount} files`;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: isCurrent }}
          onPress={() => handleSelect(targetFolderId)}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
            isCurrent && styles.rowCurrent,
          ]}
        >
          <Ionicons
            name={isDefault ? 'albums-outline' : 'folder-outline'}
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
          {isCurrent ? (
            <Ionicons name="checkmark" size={22} color={colors.accentBlue} />
          ) : (
            <View style={styles.rowSpacer} />
          )}
        </Pressable>
      );
    },
    [defaultLabel, handleSelect, selectedFolderId],
  );

  const keyExtractor = useCallback((item: DestinationRow): string => {
    return item.kind === 'default' ? '__default__' : item.folder.id;
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>Save captures to</Text>

          {foldersQuery.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.accentBlue} />
            </View>
          ) : null}

          {foldersQuery.isError ? (
            <Text style={styles.errorText}>Could not load folders.</Text>
          ) : null}

          {/* Gate only on loading: the "Unfiled" default row needs no network,
              so it (and any cached folders) must stay selectable during an error. */}
          {!foldersQuery.isLoading ? (
            <FlatList
              data={rows}
              keyExtractor={keyExtractor}
              renderItem={renderRow}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelPressed]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
