import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { createThemedStyles } from '../theme/createThemedStyles';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export function SecondaryButton({ label, onPress, style, disabled }: SecondaryButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, disabled && styles.labelMuted]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  button: {
    height: 52,
    borderRadius: t.radius.sm,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontFamily: t.typography.body[600],
    fontSize: 16,
    color: t.colors.text,
  },
  labelMuted: {
    opacity: 0.92,
  },
}));
