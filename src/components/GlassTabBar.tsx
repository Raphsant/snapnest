import React, { useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const BAR_HEIGHT = 72;
const H_MARGIN = 16;
const BOTTOM_MARGIN = 24;
const FAB_SIZE = 56;
/** Keep the camera action centered on the same vertical baseline as side icons */
const FAB_BOTTOM_OFFSET = (BAR_HEIGHT - FAB_SIZE) / 2;

const SIDE_ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Folders: { active: 'folder', inactive: 'folder-outline' },
  Activity: { active: 'time', inactive: 'time-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

type AnimatedMap = Record<string, Animated.Value>;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const animatedValues = useRef<AnimatedMap>({});
  const fabScale = useRef(new Animated.Value(1)).current;

  const bottomOffset = insets.bottom + BOTTOM_MARGIN;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Subtle "alive" pulse to emphasize the primary camera action.
        Animated.timing(fabScale, { toValue: 1.04, duration: 1250, useNativeDriver: true }),
        Animated.timing(fabScale, { toValue: 1, duration: 1250, useNativeDriver: true }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      fabScale.stopAnimation();
      fabScale.setValue(1);
    };
  }, [fabScale]);

  state.routes.forEach((route) => {
    if (!animatedValues.current[route.key]) {
      animatedValues.current[route.key] = new Animated.Value(1);
    }
  });

  const { leftRoutes, rightRoutes } = useMemo(() => {
    const folders = state.routes.find((r) => r.name === 'Folders');
    const activity = state.routes.find((r) => r.name === 'Activity');
    const settings = state.routes.find((r) => r.name === 'Settings');
    return {
      // 2 tabs on the left, 1 tab on the right. The Camera FAB occupies the visual
      // center via the fixed-width centerSpacer below.
      leftRoutes: [folders, activity].filter(Boolean) as typeof state.routes,
      rightRoutes: [settings].filter(Boolean) as typeof state.routes,
    };
  }, [state.routes]);

  const pressTab = (routeKey: string, routeName: string, indexInState: number): void => {
    const scale = animatedValues.current[routeKey];
    if (scale) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, friction: 6 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start();
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      const isFocused = state.index === indexInState;
      if (!isFocused) {
        navigation.navigate(routeName);
      }
    }
  };

  const onFabPress = (): void => {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, friction: 5 }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();

    const cameraIndex = state.routes.findIndex((r) => r.name === 'Camera');
    if (cameraIndex < 0) {
      return;
    }
    const route = state.routes[cameraIndex];
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented && state.index !== cameraIndex) {
      navigation.navigate('Camera');
    }
  };

  const renderSideTab = (route: (typeof state.routes)[0]): React.ReactElement => {
    const indexInState = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === indexInState;
    const { options } = descriptors[route.key];
    const label = String(options.tabBarLabel ?? options.title ?? route.name);
    const icons = SIDE_ICONS[route.name];
    const iconName = isFocused ? icons.active : icons.inactive;
    const tintColor = isFocused ? colors.accentBlue : colors.tabInactive;
    const animatedScale = animatedValues.current[route.key];

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={() => pressTab(route.key, route.name, indexInState)}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.sideTab}
      >
        <Animated.View style={[styles.tabInner, animatedScale ? { transform: [{ scale: animatedScale }] } : null]}>
          <Ionicons name={iconName} size={22} color={tintColor} />
          <Text style={[styles.tabLabel, { color: tintColor }]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  const fabFocused = state.routes[state.index]?.name === 'Camera';

  return (
    <View
      style={[
        styles.outer,
        {
          bottom: bottomOffset,
          left: H_MARGIN,
          right: H_MARGIN,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.barStack} pointerEvents="box-none">
        <View style={styles.barClip}>
          <BlurView intensity={76} tint="light" style={styles.blur}>
            {/* Translucent wash so the bar reads on top of the dark camera preview */}
            <View style={styles.lightWash} />
            <View style={styles.row}>
              <View style={styles.sideCluster}>{leftRoutes.map((route) => renderSideTab(route))}</View>
              <View style={styles.centerSpacer} />
              {/* Right cluster left-aligns its lone tab so it mirrors Activity's */}
              {/* position around the FAB, instead of drifting to its own center. */}
              <View style={[styles.sideCluster, styles.sideClusterRight]}>
                {rightRoutes.map((route) => renderSideTab(route))}
              </View>
            </View>
          </BlurView>
        </View>

        <Animated.View
          style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={fabFocused ? { selected: true } : {}}
            hitSlop={12}
            onPress={onFabPress}
            style={({ pressed }) => [styles.fabPressable, pressed && { opacity: 0.94 }]}
          >
            <LinearGradient
              colors={[colors.accentBlue, colors.accentBlueDark]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.fabGradient}
            >
              <Ionicons name="camera" size={26} color={colors.card} />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    height: BAR_HEIGHT + 32,
    overflow: 'visible',
  },
  barStack: {
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  barClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassSurface,
    shadowColor: colors.primaryNavy,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  blur: {
    flex: 1,
    justifyContent: 'center',
  },
  lightWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.tabBarLightOverlay,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    minHeight: BAR_HEIGHT - 8,
  },
  sideCluster: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sideClusterRight: {
    justifyContent: 'flex-start',
  },
  centerSpacer: {
    width: FAB_SIZE + 8,
  },
  sideTab: {
    flex: 1,
    maxWidth: '50%',
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabLabel: {
    ...typography.bodySmall,
    fontWeight: Platform.OS === 'ios' ? '600' : '500',
    maxWidth: 72,
    textAlign: 'center',
  },
  fabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: FAB_BOTTOM_OFFSET,
    zIndex: 10,
  },
  fabPressable: {
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  fabGradient: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
