import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { createThemedStyles } from '../theme/createThemedStyles';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, style, disabled }: PrimaryButtonProps) {
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
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  button: {
    height: 52,
    borderRadius: t.radius.sm,
    backgroundColor: t.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontFamily: t.typography.body[600],
    fontSize: 16,
    color: t.colors.white,
  },
  labelDisabled: {
    opacity: 0.95,
  },
}));
