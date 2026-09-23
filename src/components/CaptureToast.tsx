import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

export type CaptureToastType = 'success' | 'error';

type CaptureToastProps = {
  visible: boolean;
  message: string;
  type: CaptureToastType;
  topOffset: number;
};

function CaptureToastBase({ visible, message, type, topOffset }: CaptureToastProps): React.ReactElement | null {
  const theme = useTheme();
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    if (visible) {
      // Quick fade + springy settle for a lightweight "saved" confirmation.
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 7, tension: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 140, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -6, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.98, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, translateY, visible]);

  if (!visible && message.length === 0) {
    return null;
  }

  const iconName: keyof typeof Ionicons.glyphMap =
    type === 'success' ? 'checkmark-circle' : 'close-circle';
  const iconColor = type === 'success' ? theme.colors.ok : theme.colors.danger;

  return (
    <View pointerEvents="none" style={[styles.host, { top: topOffset }]}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <Ionicons name={iconName} size={16} color={iconColor} />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

export const CaptureToast = memo(CaptureToastBase);

const useStyles = createThemedStyles((t) => StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.colors.toastBg,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontFamily: t.typography.body[600],
    fontSize: 14,
    color: t.colors.white,
  },
}));
