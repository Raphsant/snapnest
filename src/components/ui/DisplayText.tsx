import React from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '../../theme/tokens';
import type { DisplaySize } from '../../theme/tokens';

type DisplayTextProps = {
  children: React.ReactNode;
  /**
   * Required rather than defaulted: there is no neutral heading size, and
   * `DisplaySize` limits this to the four sanctioned steps at compile time.
   */
  size: DisplaySize;
  /**
   * Applied after the display style, so a caller can override `color` for dark
   * surfaces without reaching for a second component.
   */
  style?: StyleProp<TextStyle>;
};

/**
 * Heading text. The display style (family, size, leading, tracking) comes from
 * the ACTIVE palette's `displayStyle` — Caprasimo in Comfort, Figtree ExtraBold
 * in Blue — so callers stay theme-agnostic.
 */
export function DisplayText({ children, size, style }: DisplayTextProps): React.ReactElement {
  const { displayStyle } = useTheme();
  return (
    <Text style={[displayStyle(size), style]} accessibilityRole="header">
      {children}
    </Text>
  );
}
