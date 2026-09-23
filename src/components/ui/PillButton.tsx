import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme, type Palette } from '../../theme/tokens';
import type { IconComponent } from './types';

export type PillButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-ghost';

type PillButtonProps = {
  title: string;
  onPress: () => void;
  /** Defaults to `primary`. */
  variant?: PillButtonVariant;
  /** Overrides the 52pt default for compact rows. */
  height?: number;
  icon?: IconComponent;
  disabled?: boolean;
};

const DEFAULT_HEIGHT = 52;
const LABEL_SIZE = 15.5;
const ICON_SIZE = 18;
const ICON_STROKE = 2;
const GAP = 8;
const PADDING_X = 22;

const DISABLED_OPACITY = 0.4;
const PRESSED_OPACITY = 0.82;

type VariantStyle = {
  background: string;
  foreground: string;
  /** Omitted = no border drawn. */
  border?: string;
};

/**
 * `foreground` drives both the label and the icon tint, so an icon can never
 * drift from its label. Built from the active palette each render.
 */
function buildVariants(t: Palette): Record<PillButtonVariant, VariantStyle> {
  return {
    primary: { background: t.colors.accent, foreground: t.colors.white },
    secondary: { background: 'transparent', foreground: t.colors.text, border: t.colors.line2 },
    ghost: { background: 'transparent', foreground: t.colors.accent },
    'danger-ghost': { background: 'transparent', foreground: t.colors.danger },
  };
}

export function PillButton({
  title,
  onPress,
  variant = 'primary',
  height = DEFAULT_HEIGHT,
  icon: Icon,
  disabled = false,
}: PillButtonProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const palette = buildVariants(theme)[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: palette.background,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border,
          opacity: disabled ? DISABLED_OPACITY : pressed ? PRESSED_OPACITY : 1,
        },
      ]}
    >
      {Icon ? <Icon size={ICON_SIZE} color={palette.foreground} strokeWidth={ICON_STROKE} /> : null}
      <Text style={[styles.label, { color: palette.foreground }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: GAP,
      paddingHorizontal: PADDING_X,
      borderRadius: t.radius.pill,
    },
    label: {
      fontFamily: t.typography.body[700],
      fontSize: LABEL_SIZE,
    },
  }),
);
