import React from 'react';
import { Check } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '../components/ui/DisplayText';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

const BOTTOM_PADDING = 150;

const FEATURES: readonly string[] = [
  'Unlimited intake folders',
  'Editors pull originals straight from the dashboard',
  'Reshoot requests land as notifications',
  'Shared storage across your team',
];

/**
 * Shown in the Agency tab when /me returns no memberships. Informational only:
 * no pricing (billing is stretch) and no join/invite buttons (invites are
 * backend-driven — the tab appears when an agency adds your email).
 */
export function AgencyUpsellScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <DisplayText size={30}>Hand the editing to someone else</DisplayText>
        <Text style={styles.intro}>
          Bring an editing agency into SnapNest and hand off the busywork. They pull your
          originals, cut, and deliver — you just keep shooting.
        </Text>

        <View style={styles.featureShadow}>
          <View style={styles.featureCard}>
            <View style={styles.decoCircle} />
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.check}>
                  <Check size={13} color={theme.colors.okDeep} strokeWidth={3} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Already working with an agency?</Text>
          <Text style={styles.inviteSub}>
            Ask them for an invite — the tab appears the moment they add your email.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  intro: {
    marginTop: 10,
    marginBottom: 28,
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  // Shadow layer (no overflow) wrapping the clipped surface, so the decorative
  // circle can be clipped without killing the card shadow on iOS.
  featureShadow: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
  },
  featureCard: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 20,
    gap: 16,
  },
  decoCircle: {
    position: 'absolute',
    top: -36,
    right: -36,
    width: 120,
    height: 120,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontFamily: theme.typography.body[500],
    fontSize: 14.5,
    color: theme.colors.text,
  },
  inviteCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.line2,
  },
  inviteTitle: {
    fontFamily: theme.typography.body[600],
    fontSize: 14,
    color: theme.colors.text,
  },
  inviteSub: {
    marginTop: 4,
    fontFamily: theme.typography.body[400],
    fontSize: 12.5,
    lineHeight: 18,
    color: theme.colors.muted,
  },
}));
