import React, { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';

type GlassCardProps = {
  children: ReactNode;
  intensity?: number;
  style?: ViewStyle;
};

export function GlassCard({ children, intensity = 72, style }: GlassCardProps) {
  return (
    <View style={[styles.shadowWrapper, style]}>
      <View style={styles.clipContainer}>
        <BlurView intensity={intensity} tint="light" style={styles.blurFill}>
          <LinearGradient
            colors={[colors.glassOverlay, 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientOverlay}
          />
          {/*
            RN doesn't support true inset shadows. This top highlight + soft overlay
            approximates the "inner glow" used by liquid-glass surfaces.
          */}
          <View style={styles.innerHighlight} />
          <View style={styles.content}>{children}</View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    borderRadius: 24,
    shadowColor: colors.primaryNavy,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  clipContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassSurface,
  },
  blurFill: {
    minHeight: 80,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  innerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderTopWidth: Platform.OS === 'ios' ? 1 : 0.5,
    borderTopColor: 'rgba(255,255,255,0.45)',
  },
  content: {
    padding: 20,
  },
});
