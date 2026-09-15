import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThemedStyles } from '../../theme/createThemedStyles';

type BottomSheetProps = {
  visible: boolean;
  /** Fired by the scrim and by the Android back button. */
  onClose: () => void;
  children: React.ReactNode;
};

const HANDLE_WIDTH = 38;
const HANDLE_HEIGHT = 5;

/** Spec: scrim is `rgba(20,19,18,0.45)` — the `darkBg` token at 45%. */
const SCRIM_ALPHA = 0.45;

const OPEN_DURATION = 280;
const CLOSE_DURATION = 200;

/**
 * Travel distance for the slide. Measuring the sheet with onLayout would give a
 * tighter distance, but layout resolves after the open animation has already
 * started, so the first open would jump when the measurement landed. A fixed
 * offscreen distance is deterministic instead. Read once at module scope, which
 * is safe because the app is portrait-locked.
 */
const TRAVEL = Dimensions.get('window').height;

/**
 * Bottom sheet built on RN's Modal + core Animated. This repo has no sheet
 * library and no reanimated, and the existing sheets (DestinationPickerSheet,
 * FolderPickerSheet) are plain Modals — so this stays dependency-free and
 * matches what's already here.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  // `visible` drives the animation; `mounted` keeps the Modal in the tree until
  // the close animation has actually finished playing.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Guard against unmounting a sheet that was re-opened mid-close.
      if (finished) {
        setMounted(false);
      }
    });
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRAVEL, 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      // Animation is ours; Modal's own would fight it.
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        {/*
          Nested opacity multiplies, so the scrim lands at SCRIM_ALPHA * progress
          and reaches exactly the specified 45% when fully open — no rgba string
          needed for a colour the palette already has as `darkBg`.
        */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.scrim]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    scrim: {
      backgroundColor: t.colors.darkBg,
      opacity: SCRIM_ALPHA,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 10,
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
    },
    handle: {
      width: HANDLE_WIDTH,
      height: HANDLE_HEIGHT,
      marginBottom: 12,
      alignSelf: 'center',
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.line2,
    },
  }),
);
