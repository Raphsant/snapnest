import React from 'react';
import { FolderInput, Send, Share2, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton } from './ui/PillButton';
import type { IconComponent } from './ui/types';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const TRAY_RADIUS = 26;
/**
 * The floating tab bar (rendered by the navigator, above this screen) can't be
 * covered from here, so the tray floats ABOVE it rather than replacing it —
 * this clears the bar's height. Hiding the bar in select mode would need a
 * shared UI flag + a GlassTabBar change, both out of this phase's scope.
 */
const TAB_BAR_CLEARANCE = 100;

type SelectionTrayProps = {
  count: number;
  /** Share is single-URL only (RN Share) — enabled just for one uploaded file. */
  canShare: boolean;
  busy?: boolean;
  onSelectAll: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export function SelectionTray({
  count,
  canShare,
  busy = false,
  onSelectAll,
  onMove,
  onShare,
  onDelete,
}: SelectionTrayProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const hasSelection = count > 0;

  return (
    <View style={[styles.tray, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <View style={styles.header}>
        <Text style={styles.count}>{hasSelection ? `${count} selected` : 'Select items'}</Text>
        <PillButton title="Select all" variant="ghost" height={34} onPress={onSelectAll} />
      </View>

      <View style={styles.actions}>
        <TrayButton icon={FolderInput} label="Move" onPress={onMove} disabled={!hasSelection || busy} />
        <TrayButton icon={Share2} label="Share" onPress={onShare} disabled={!canShare || busy} />
        {/* TODO(Phase 8): submit-to-agency. Rendered disabled until then. */}
        <TrayButton icon={Send} label="Submit" onPress={NOOP} disabled />
        <TrayButton icon={Trash2} label="Delete" onPress={onDelete} disabled={!hasSelection || busy} danger />
      </View>
    </View>
  );
}

const NOOP = (): void => {};

type TrayButtonProps = {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function TrayButton({ icon: Icon, label, onPress, disabled = false, danger = false }: TrayButtonProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const tint = danger ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Icon size={20} color={tint} strokeWidth={2.1} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  tray: {
    position: 'absolute',
    left: 14,
    right: 14,
    padding: 14,
    borderRadius: TRAY_RADIUS,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.line,
    gap: 12,
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontFamily: theme.typography.body[700],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionLabel: {
    fontFamily: theme.typography.body[600],
    fontSize: 11,
  },
}));
