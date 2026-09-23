import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

/** `md` for standard cards and rows, `lg` for large feature cards. */
export type CardRadius = 'md' | 'lg';

type CardProps = {
  children: React.ReactNode;
  /** Defaults to `md`. */
  radius?: CardRadius;
  /** Adds the `sm` elevation token. Off by default — flat cards are the norm. */
  shadow?: boolean;
  /**
   * Layout passthrough (margin, flex, padding). Card is a surface only and
   * deliberately bakes in no padding, so content spacing stays with the screen
   * that knows what it's laying out.
   */
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  radius = 'md',
  shadow = false,
  style,
}: CardProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.base,
        { borderRadius: theme.radius[radius] },
        // iOS draws this outside the bounds — an ancestor with overflow:'hidden'
        // will clip it away.
        shadow && theme.shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    base: {
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.line,
    },
  }),
);
