import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type GridSelectionToolbarProps = {
  selectedCount: number;
  totalSelectable: number;
  isBusy: boolean;
  onCancel: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMove: () => void;
  onDelete: () => void;
};

export function GridSelectionToolbar({
  selectedCount,
  totalSelectable,
  isBusy,
  onCancel,
  onSelectAll,
  onDeselectAll,
  onMove,
  onDelete,
}: GridSelectionToolbarProps): React.ReactElement {
  const allSelected = totalSelectable > 0 && selectedCount === totalSelectable;

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
        onPress={onCancel}
        disabled={isBusy}
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>

      <View style={styles.center}>
        {isBusy ? (
          <ActivityIndicator size="small" color={colors.accentBlue} />
        ) : (
          <Text style={styles.countLabel}>{selectedCount} selected</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={allSelected ? 'Deselect all' : 'Select all'}
        onPress={allSelected ? onDeselectAll : onSelectAll}
        disabled={isBusy || totalSelectable === 0}
        hitSlop={8}
        style={({ pressed }) => [styles.selectAllButton, pressed && styles.pressed]}
      >
        <Text style={styles.selectAllLabel}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Move selected"
          onPress={onMove}
          disabled={isBusy || selectedCount === 0}
          style={({ pressed }) => [
            styles.actionButton,
            styles.moveButton,
            pressed && !isBusy && styles.pressed,
            (isBusy || selectedCount === 0) && styles.actionDisabled,
          ]}
        >
          <Text style={styles.moveLabel}>Move</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete selected"
          onPress={onDelete}
          disabled={isBusy || selectedCount === 0}
          style={({ pressed }) => [
            styles.actionButton,
            styles.deleteButton,
            pressed && !isBusy && styles.pressed,
            (isBusy || selectedCount === 0) && styles.actionDisabled,
          ]}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
  },
  iconButton: {
    paddingVertical: spacing.xs,
  },
  cancelLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: {
    ...typography.bodySmall,
    color: colors.primaryNavy,
    fontWeight: '600',
  },
  selectAllButton: {
    paddingVertical: spacing.xs,
  },
  selectAllLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  moveButton: {
    backgroundColor: colors.accentBlueMuted,
  },
  deleteButton: {
    backgroundColor: 'rgba(235, 87, 87, 0.15)',
  },
  moveLabel: {
    ...typography.bodySmall,
    color: colors.accentBlue,
    fontWeight: '700',
  },
  deleteLabel: {
    ...typography.bodySmall,
    color: colors.error,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  actionDisabled: {
    opacity: 0.45,
  },
});
