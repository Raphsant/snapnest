import React, { useCallback, useMemo } from 'react';
import { Check, Folder as FolderIcon, Inbox } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFolders } from '../hooks/useFolders';
import type { Folder } from '../services/foldersService';
import { BottomSheet } from './ui/BottomSheet';
import { DisplayText } from './ui/DisplayText';
import { IconTile } from './ui/IconTile';
import { PillButton } from './ui/PillButton';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

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

/**
 * Optimistic preview of the auto-name the next capture will get. `fileCount + 1`
 * is a client-side ESTIMATE only — the backend owns the real sequence and can
 * diverge (concurrent uploads, deletes, gaps). Deliberately no API call for the
 * true next number; this is a hint, not a promise.
 */
function nextNamePreview(label: string, fileCount: number): string {
  return `Next name · ${label} ${String(fileCount + 1).padStart(2, '0')}`;
}

export function DestinationPickerSheet({
  visible,
  selectedFolderId,
  onSelect,
  onClose,
}: DestinationPickerSheetProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
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
      const fileCount = isDefault ? systemFolder?.fileCount ?? 0 : item.folder.fileCount;

      // Selected rows preview the next auto-name; unselected rows show a plain
      // hint ("Decide later" for the catch-all, a file count for real folders).
      const subtitle = isCurrent
        ? nextNamePreview(label, fileCount)
        : isDefault
          ? 'Decide later'
          : `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;

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
          <IconTile
            icon={isDefault ? Inbox : FolderIcon}
            tone={isDefault ? 'neutral' : 'accent'}
            size={42}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          {isCurrent ? (
            <View style={styles.check}>
              <Check size={14} color={theme.colors.white} strokeWidth={3} />
            </View>
          ) : (
            <View style={styles.checkSpacer} />
          )}
        </Pressable>
      );
    },
    [defaultLabel, handleSelect, selectedFolderId, systemFolder?.fileCount, theme, styles],
  );

  const keyExtractor = useCallback((item: DestinationRow): string => {
    return item.kind === 'default' ? '__default__' : item.folder.id;
  }, []);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <DisplayText size={22}>Send captures to</DisplayText>
        <Text style={styles.subtitle}>
          Everything you shoot next lands here and gets an auto name.
        </Text>

        {foldersQuery.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : null}

        {foldersQuery.isError ? (
          <Text style={styles.errorText}>Could not load folders.</Text>
        ) : null}

        {/* Gate only on loading: the "Unfiled" default row needs no network, so
            it (and any cached folders) must stay selectable during an error. */}
        {!foldersQuery.isLoading ? (
          <FlatList
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        ) : null}

        <PillButton title="Done" variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontFamily: theme.typography.body[400],
    fontSize: 13.5,
    color: theme.colors.muted,
  },
  list: {
    maxHeight: 340,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
  },
  rowPressed: {
    backgroundColor: theme.colors.card2,
  },
  rowCurrent: {
    backgroundColor: theme.colors.accentSoft,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: theme.typography.body[600],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSpacer: {
    width: 24,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    marginVertical: 8,
    fontFamily: theme.typography.body[500],
    fontSize: 13,
    color: theme.colors.danger,
  },
}));
