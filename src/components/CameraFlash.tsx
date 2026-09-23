import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { createThemedStyles } from '../theme/createThemedStyles';

type CameraFlashProps = {
  visible: boolean;
  onComplete?: () => void;
};

function CameraFlashBase({ visible, onComplete }: CameraFlashProps): React.ReactElement | null {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }

    // 100ms in + 150ms out keeps the flash snappy without feeling harsh.
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }, [onComplete, opacity, visible]);

  if (!visible) {
    return null;
  }

  return <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]} />;
}

export const CameraFlash = memo(CameraFlashBase);

const useStyles = createThemedStyles((t) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Pure white in both themes — a flash, not a card surface.
    backgroundColor: t.colors.white,
    zIndex: 999,
  },
}));
