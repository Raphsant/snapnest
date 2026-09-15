import React, { useEffect, useRef } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Building2, Camera, Clock, Folder, SlidersHorizontal } from 'lucide-react-native';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';
import { useUploadQueueStore } from '../store/uploadQueueStore';
import type { IconComponent } from './ui/types';

const BAR_HEIGHT = 64;
const H_MARGIN = 14;
/** Gap from the safe-area edge, not the physical edge (added to insets.bottom). */
const BOTTOM_MARGIN = 26;

const CENTER_SLOT_WIDTH = 78;
const FAB_SIZE = 60;
/** Lifts the FAB above the bar's top rim. */
const FAB_LIFT = 16;
/** Headroom above the bar so the lifted FAB stays inside the touch-testable area. */
const FAB_OVERHANG = FAB_LIFT + 8;

const TAB_ICON_SIZE = 22;
const TAB_ICON_STROKE = 2.5;
const FAB_ICON_SIZE = 26;

/**
 * Lucide glyph per route. Keyed by the navigator's route names (Activity renders
 * as "Uploads"). Camera is intentionally absent — it is the center FAB, not a
 * labelled tab.
 */
const TAB_ICONS: Record<string, IconComponent> = {
  Folders: Folder,
  Activity: Clock,
  Agency: Building2,
  Settings: SlidersHorizontal,
};

/** Fixed left-to-right slot order; the empty string marks the center FAB slot. */
const SLOT_ORDER = ['Folders', 'Activity', '', 'Agency', 'Settings'] as const;

/**
 * Narrow boolean selector: true when the queue holds anything not yet uploaded
 * (queued, uploading, or failed). Returning a boolean means the bar only
 * re-renders when the flag flips, not on every progress tick. Defined here rather
 * than in the store — the store is out of scope for this phase.
 */
const selectHasPending = (state: { items: { status: string }[] }): boolean =>
  state.items.some((item) => item.status !== 'uploaded');

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const hasPending = useUploadQueueStore(selectHasPending);

  const tabScales = useRef<Record<string, Animated.Value>>({});
  // Pulse and press are separate values multiplied into one transform, so the
  // continuous pulse loop and a momentary press bounce never fight over the FAB.
  const fabPulse = useRef(new Animated.Value(1)).current;
  const fabPress = useRef(new Animated.Value(1)).current;

  state.routes.forEach((route) => {
    if (!tabScales.current[route.key]) {
      tabScales.current[route.key] = new Animated.Value(1);
    }
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      fabPulse.stopAnimation();
      fabPulse.setValue(1);
    };
  }, [fabPulse]);

  const bounce = (value: Animated.Value, friction: number): void => {
    Animated.sequence([
      Animated.spring(value, { toValue: 0.92, useNativeDriver: true, friction }),
      Animated.spring(value, { toValue: 1, useNativeDriver: true, friction }),
    ]).start();
  };

  /** Shared tabPress flow: emit, respect defaultPrevented, skip if already focused. */
  const activateRoute = (routeKey: string, routeName: string): void => {
    const routeIndex = state.routes.findIndex((r) => r.key === routeKey);
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!event.defaultPrevented && state.index !== routeIndex) {
      navigation.navigate(routeName);
    }
  };

  const renderTab = (routeName: string): React.ReactElement => {
    const route = state.routes.find((r) => r.name === routeName);
    // Preserve the grid if a route is absent (e.g. Agency dropped for some user).
    if (!route) {
      return <View key={routeName} style={styles.slot} />;
    }

    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const { options } = descriptors[route.key];
    const label = String(options.tabBarLabel ?? options.title ?? route.name);
    const Icon = TAB_ICONS[routeName];
    const tint = isFocused ? theme.colors.accent : theme.colors.faint;
    const scale = tabScales.current[route.key];

    // The pending dot rides the Uploads tab and doubles as a VoiceOver hint.
    const showDot = routeName === 'Activity' && hasPending;
    const a11yLabel = showDot ? `${label}, uploads pending` : label;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={a11yLabel}
        onPress={() => {
          bounce(scale, 6);
          activateRoute(route.key, route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.slot}
      >
        <Animated.View style={[styles.tabInner, scale ? { transform: [{ scale }] } : null]}>
          <View>
            {Icon ? <Icon size={TAB_ICON_SIZE} color={tint} strokeWidth={TAB_ICON_STROKE} /> : null}
            {showDot ? <View style={styles.dot} /> : null}
          </View>
          <Text style={[styles.tabLabel, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  const renderFab = (): React.ReactElement => {
    const route = state.routes.find((r) => r.name === 'Camera');
    const isFocused = route ? state.index === state.routes.indexOf(route) : false;

    return (
      <View key="__fab" style={styles.centerSlot}>
        <Animated.View
          style={{ transform: [{ scale: Animated.multiply(fabPulse, fabPress) }] }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Camera"
            accessibilityState={{ selected: isFocused }}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            onPress={() => {
              bounce(fabPress, 5);
              if (route) {
                activateRoute(route.key, 'Camera');
              }
            }}
            style={styles.fab}
          >
            <Camera size={FAB_ICON_SIZE} color={theme.colors.white} strokeWidth={TAB_ICON_STROKE} />
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outer,
        { bottom: insets.bottom + BOTTOM_MARGIN, left: H_MARGIN, right: H_MARGIN },
      ]}
    >
      <View style={styles.bar}>
        {SLOT_ORDER.map((name) => (name === '' ? renderFab() : renderTab(name)))}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  outer: {
    position: 'absolute',
    height: BAR_HEIGHT + FAB_OVERHANG,
    justifyContent: 'flex-end',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.line,
    ...t.shadows.lg,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSlot: {
    width: CENTER_SLOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontFamily: t.typography.body[600],
    fontSize: 10,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.accent,
    borderWidth: 1.5,
    borderColor: t.colors.card,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    marginTop: -FAB_LIFT,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
    borderWidth: 3,
    borderColor: t.colors.card,
    shadowColor: t.colors.accentShadow,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
}));
