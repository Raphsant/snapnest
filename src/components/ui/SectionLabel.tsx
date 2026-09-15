import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';

type SectionLabelProps = {
  /** Typed as `string` because the uppercase transform only makes sense on text. */
  children: string;
  /** Layout passthrough — these almost always need a margin under them. */
  style?: StyleProp<TextStyle>;
};

const SIZE = 11;

/**
 * Spec calls for `0.09em`. React Native takes absolute points, so the ratio is
 * resolved against the size here (0.99) rather than written as a magic number —
 * change SIZE and the tracking follows.
 */
const TRACKING_RATIO = 0.09;

/**
 * The small uppercase caption that heads a group of rows. Rendered as an
 * accessibility header so VoiceOver users can navigate section to section.
 */
export function SectionLabel({ children, style }: SectionLabelProps): React.ReactElement {
  const styles = useStyles();
  return (
    <Text style={[styles.label, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    label: {
      fontFamily: t.typography.body[700],
      fontSize: SIZE,
      letterSpacing: SIZE * TRACKING_RATIO,
      textTransform: 'uppercase',
      color: t.colors.faint,
    },
  }),
);
