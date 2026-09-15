import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

type PillInputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Caption above the field. */
  label?: string;
  /** When true, masks input and renders a Show/Hide toggle (state managed here). */
  secureTextEntry?: boolean;
  /** Tints the border danger without owning the error message (caller renders that). */
  invalid?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Extra text styling, e.g. centered/letter-spaced one-time codes. */
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * The pill text field for the whole app — auth today, search/forms later.
 * Deliberately generic: it takes any TextInputProps and adds only a label, a
 * focus/invalid border, and (for secure fields) a Show/Hide toggle.
 */
export function PillInput({
  label,
  secureTextEntry = false,
  invalid = false,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...rest
}: PillInputProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  // Derive the handler param type from the prop so it tracks the RN version.
  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  const borderColor = invalid
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : theme.colors.line2;

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, { borderColor }]}>
        <TextInput
          {...rest}
          secureTextEntry={secureTextEntry && !reveal}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={theme.colors.faint}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[styles.input, secureTextEntry && styles.inputSecure, inputStyle]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            hitSlop={12}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.toggleText}>{reveal ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  label: {
    marginBottom: 7,
    marginLeft: 4,
    fontFamily: theme.typography.body[600],
    fontSize: 12.5,
    color: theme.colors.muted,
  },
  field: {
    height: 52,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
  },
  input: {
    height: '100%',
    paddingHorizontal: 18,
    fontFamily: theme.typography.body[400],
    fontSize: 15.5,
    color: theme.colors.text,
  },
  inputSecure: {
    paddingRight: 64,
  },
  toggle: {
    position: 'absolute',
    right: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontFamily: theme.typography.body[600],
    fontSize: 13.5,
    color: theme.colors.accent,
  },
}));
