import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export type TransitionKind = 'push' | 'pop' | 'fade';

type Spec = { duration: number; translateX: number; translateY: number };

/**
 * Timing per kind. Opacity is always 0→1; the offset axis differs:
 * push drills in from the right, pop settles from the left, fade lifts up.
 * Exported so sheets/toasts can borrow the same feel if needed.
 */
export const TIMING: Record<TransitionKind, Spec> = {
  push: { duration: 220, translateX: 24, translateY: 0 },
  pop: { duration: 200, translateX: -16, translateY: 0 },
  fade: { duration: 180, translateX: 0, translateY: 6 },
};

const EASING = Easing.out(Easing.cubic);

/**
 * Cached "reduce motion" flag. Reads the current value once and subscribes to
 * changes, so toggling iOS Reduce Motion takes effect without a relaunch.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

type ScreenTransitionProps = {
  /** Change this to trigger the incoming animation. */
  transitionKey: string;
  kind: TransitionKind;
  /** Animate the first mount too. Tab fades want this; routers don't (their
   *  first screen is revealed by the tab fade, not a second animation). */
  animateOnMount?: boolean;
  children: React.ReactNode;
};

/**
 * Animates the CURRENT subtree in whenever `transitionKey` changes. Single-tree
 * by design — no outgoing snapshot, so screens are never double-mounted. Native
 * driver throughout (opacity + transform only); children mount immediately and
 * stay interactive, so the animation never gates data or touches.
 */
export function ScreenTransition({
  transitionKey,
  kind,
  animateOnMount = false,
  children,
}: ScreenTransitionProps): React.ReactElement {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    const isFirst = prevKey.current === null;
    const changed = prevKey.current !== transitionKey;
    prevKey.current = transitionKey;

    if (reduced) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    if (isFirst && !animateOnMount) {
      progress.setValue(1);
      return;
    }
    if (!isFirst && !changed) {
      return;
    }
    // Hard reset first, so a key change mid-flight can't leave a stuck offset.
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: TIMING[kind].duration,
      easing: EASING,
      useNativeDriver: true,
    }).start();
  }, [transitionKey, reduced, kind, animateOnMount, progress]);

  if (reduced) {
    return <Animated.View style={styles.fill}>{children}</Animated.View>;
  }

  const spec = TIMING[kind];
  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity: progress,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [spec.translateX, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [spec.translateY, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A key that bumps each time this screen GAINS focus (after the first mount,
 * which the wrapper animates via animateOnMount). Drives the tab fade.
 */
function useTabFocusKey(): number {
  const isFocused = useIsFocused();
  const [n, setN] = useState(0);
  const ready = useRef(false);
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    if (isFocused) {
      setN((value) => value + 1);
    }
  }, [isFocused]);
  return n;
}

/** Fade-lift for a tab's content: animates on mount and on every re-focus. */
export function TabScreenFade({ children }: { children: React.ReactNode }): React.ReactElement {
  const key = useTabFocusKey();
  return (
    <ScreenTransition transitionKey={String(key)} kind="fade" animateOnMount>
      {children}
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
