import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createThemedStyles } from '../theme/createThemedStyles';

/**
 * Rule-of-thirds framing guide: two vertical + two horizontal hairlines at the
 * 1/3 and 2/3 marks. Pure UI — absolute-fill, never intercepts touches.
 */
export function RuleOfThirdsGrid(): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.vLine, { left: '33.333%' }]} />
      <View style={[styles.vLine, { left: '66.666%' }]} />
      <View style={[styles.hLine, { top: '33.333%' }]} />
      <View style={[styles.hLine, { top: '66.666%' }]} />
    </View>
  );
}

/**
 * Full-screen self-timer countdown: a dimming scrim under a large display
 * numeral. Pure UI — the parent owns the countdown state/cancellation.
 *
 * The scrim is its own layer at reduced opacity so the number above it stays
 * fully opaque; putting the opacity on the container would fade the digit too.
 */
export function TimerCountdown({ seconds }: { seconds: number }): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.countdownRoot} pointerEvents="none">
      <View style={styles.countdownScrim} />
      <Text style={styles.countdownText}>{seconds}</Text>
    </View>
  );
}

/** Grid hairlines: white at 30% (a framing guide over the dark preview). */
const GRID_LINE_OPACITY = 0.3;
/** Scrim: darkBg at 35%. */
const COUNTDOWN_SCRIM_OPACITY = 0.35;

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    vLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.white,
      opacity: GRID_LINE_OPACITY,
    },
    hLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.white,
      opacity: GRID_LINE_OPACITY,
    },
    countdownRoot: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countdownScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.darkBg,
      opacity: COUNTDOWN_SCRIM_OPACITY,
    },
    countdownText: {
      fontFamily: t.typography.display,
      fontSize: 96,
      color: t.colors.white,
      fontVariant: ['tabular-nums'],
    },
  }),
);
