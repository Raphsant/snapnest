import React, { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '../components/GlassCard';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/** Matches other tab screens — clears the floating GlassTabBar. */
const TAB_BAR_BOTTOM_OFFSET = 24;
const TAB_BAR_OUTER_HEIGHT = 72 + 32;

const FEATURE_BULLETS: readonly string[] = [
  'Feature bullet placeholder one',
  'Feature bullet placeholder two',
  'Feature bullet placeholder three',
  'Feature bullet placeholder four',
];

/**
 * Shown in the Agency tab when /me returns no memberships.
 * All copy is intentionally placeholder — no marketing text or real prices yet.
 */
export function AgencyUpsellScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();

  const handleCtaPress = useCallback((): void => {
    // Inert by design — purchase / join flow not implemented yet.
  }, []);

  const bottomPad = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_OUTER_HEIGHT;

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundGradientBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.content, { paddingBottom: bottomPad }]}>
          <View style={styles.intro}>
            <Text style={styles.headline}>Headline placeholder</Text>
            <Text style={styles.bodyCopy}>
              Body copy placeholder — agency features unlock when you join an agency.
            </Text>
          </View>

          <GlassCard style={styles.pricingCard}>
            <Text style={styles.planName}>Plan name placeholder</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>$—</Text>
              <Text style={styles.priceUnit}>/mo</Text>
            </View>

            <View style={styles.bulletList}>
              {FEATURE_BULLETS.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="CTA placeholder"
              onPress={handleCtaPress}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaLabel}>CTA placeholder</Text>
            </Pressable>
          </GlassCard>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  intro: {
    marginBottom: spacing.xl,
  },
  headline: {
    ...typography.h1,
    color: colors.primaryNavy,
    textAlign: 'center',
  },
  bodyCopy: {
    ...typography.body,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pricingCard: {
    marginHorizontal: 0,
  },
  planName: {
    ...typography.h2,
    color: colors.primaryNavy,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  price: {
    ...typography.h1,
    color: colors.accentBlue,
  },
  priceUnit: {
    ...typography.body,
    color: colors.mutedText,
    marginLeft: spacing.xs,
  },
  bulletList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulletText: {
    ...typography.body,
    color: colors.primaryNavy,
    flex: 1,
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    ...typography.button,
    color: colors.card,
  },
});
