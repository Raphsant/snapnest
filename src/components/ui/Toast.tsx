import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';

type ToastProps = {
  title: string;
  subtitle?: string;
};

/** Distance from the bottom edge — clears the tab bar. */
const BOTTOM_OFFSET = 104;

const CIRCLE_SIZE = 24;
const TITLE_SIZE = 13.5;
const SUBTITLE_SIZE = 11.5;

const SUBTITLE_ALPHA = 0.6;

/**
 * Transient confirmation pill. Purely presentational — it has no timer and no
 * visibility prop; the caller mounts it, then unmounts it when its own
 * auto-dismiss elapses.
 */
export function Toast({ title, subtitle }: ToastProps): React.ReactElement {
  const styles = useStyles();
  return (
    // box-none so the toast never swallows taps meant for the screen under it.
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {/*
          The dark fill is its own layer (the `toastBg` token, already carrying
          its own alpha) so the content above stays at full opacity — a plain
          `opacity` on the pill would dim the label too.
        */}
        <View style={styles.fill} />

        <View style={styles.badge}>
          {/*
            Checkmark drawn from two borders on a rotated box. Deliberately not a
            lucide icon: react-native-svg was absent from the dev client when this
            shipped. The nudge re-centres the tick inside the circle after rotation.
          */}
          <View style={styles.check} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: BOTTOM_OFFSET,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: '100%',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: t.radius.pill,
      // Clips the fill layer to the pill's rounded ends.
      overflow: 'hidden',
    },
    fill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.toastBg,
    },
    badge: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.ok,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      width: 6,
      height: 11,
      marginTop: -2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderColor: t.colors.card,
      transform: [{ rotate: '45deg' }],
    },
    copy: {
      flexShrink: 1,
    },
    title: {
      fontFamily: t.typography.body[600],
      fontSize: TITLE_SIZE,
      color: t.colors.card,
    },
    subtitle: {
      fontFamily: t.typography.body[500],
      fontSize: SUBTITLE_SIZE,
      color: t.colors.card,
      opacity: SUBTITLE_ALPHA,
    },
  }),
);
