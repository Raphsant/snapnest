import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Announced by screen readers as the thing being toggled. */
  accessibilityLabel?: string;
};

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const THUMB = 24;
const INSET = (TRACK_HEIGHT - THUMB) / 2;
/** Thumb travel: track minus thumb minus the inset on both ends. */
const TRAVEL = TRACK_WIDTH - THUMB - INSET * 2;

/**
 * Pill switch — deliberately not RN's `Switch`, whose platform chrome can't take
 * the token palette. On = accent track, thumb right; off = card2 track, thumb left.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: ToggleProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        { backgroundColor: value ? theme.colors.accent : theme.colors.card2 },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.thumb, { transform: [{ translateX: value ? TRAVEL : 0 }] }]} />
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    track: {
      width: TRACK_WIDTH,
      height: TRACK_HEIGHT,
      borderRadius: t.radius.pill,
      padding: INSET,
      justifyContent: 'center',
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.card,
      ...t.shadows.sm,
    },
    disabled: {
      opacity: 0.5,
    },
  }),
);
