import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Rule-of-thirds framing guide: two vertical + two horizontal hairlines at the
 * 1/3 and 2/3 marks. Pure UI — absolute-fill, never intercepts touches.
 */
export function RuleOfThirdsGrid(): React.ReactElement {
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
 * Full-screen self-timer countdown. Shows the remaining seconds as a large
 * centered numeral. Pure UI — the parent owns the countdown state/cancellation.
 */
export function TimerCountdown({ seconds }: { seconds: number }): React.ReactElement {
  return (
    <View style={styles.countdownRoot} pointerEvents="none">
      <Text style={styles.countdownText}>{seconds}</Text>
    </View>
  );
}

const HAIRLINE = StyleSheet.hairlineWidth;
const GRID_COLOR = 'rgba(255,255,255,0.3)';

const styles = StyleSheet.create({
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HAIRLINE,
    backgroundColor: GRID_COLOR,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HAIRLINE,
    backgroundColor: GRID_COLOR,
  },
  countdownRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 120,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});
