import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type CaptureToastType = 'success' | 'error';

type CaptureToastProps = {
  visible: boolean;
  message: string;
  type: CaptureToastType;
  topOffset: number;
};

function CaptureToastBase({ visible, message, type, topOffset }: CaptureToastProps): React.ReactElement | null {
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
  const iconColor = type === 'success' ? colors.success : colors.error;

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

const styles = StyleSheet.create({
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
    gap: spacing.sm,
    backgroundColor: 'rgba(16,42,67,0.76)',
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    ...typography.bodySmall,
    color: colors.card,
    fontWeight: '600',
  },
});
