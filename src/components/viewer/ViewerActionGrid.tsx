import React from 'react';
import { FolderInput, Send, Share2, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CREAM_10, DANGER_ON_DARK, DISABLED_OPACITY } from './viewerChrome';
import type { IconComponent } from '../ui/types';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

/** Gap below the tiles, on top of the home-indicator inset (design: 40px). */
const BOTTOM_GAP = 10;

type ViewerActionGridProps = {
  /** RN Share takes a single URL — false until this file is uploaded and signed. */
  canShare: boolean;
  /** A move or delete is in flight; every tile goes quiet until it settles. */
  busy?: boolean;
  bottomInset: number;
  onShare: () => void;
  onMove: () => void;
  onDelete: () => void;
};

export function ViewerActionGrid({
  canShare,
  busy = false,
  bottomInset,
  onShare,
  onMove,
  onDelete,
}: ViewerActionGridProps): React.ReactElement {
  const styles = useStyles();

  return (
    <View style={[styles.grid, { paddingBottom: bottomInset + BOTTOM_GAP }]}>
      <ActionTile icon={Share2} label="Share" onPress={onShare} disabled={!canShare || busy} />
      <ActionTile icon={FolderInput} label="Move" onPress={onMove} disabled={busy} />
      {/* TODO(stretch): submit-to-agency. Rendered disabled until it exists. */}
      <ActionTile icon={Send} label="Submit" onPress={NOOP} disabled />
      <ActionTile icon={Trash2} label="Delete" onPress={onDelete} disabled={busy} danger />
    </View>
  );
}

const NOOP = (): void => {};

type ActionTileProps = {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function ActionTile({
  icon: Icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: ActionTileProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const tint = danger ? DANGER_ON_DARK : theme.colors.cream;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        disabled && styles.tileDisabled,
        pressed && !disabled && styles.tilePressed,
      ]}
    >
      <Icon size={19} color={tint} strokeWidth={2.5} />
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    // Literal, not `radius.md`: that token differs per palette and this chrome
    // is the same in both themes.
    borderRadius: 16,
    backgroundColor: CREAM_10,
  },
  tileDisabled: {
    opacity: DISABLED_OPACITY,
  },
  tilePressed: {
    opacity: 0.8,
  },
  label: {
    fontFamily: t.typography.body[600],
    fontSize: 11,
  },
}));
