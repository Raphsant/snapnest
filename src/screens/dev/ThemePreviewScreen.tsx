import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { DisplayText } from '../../components/ui/DisplayText';
import { IconTile } from '../../components/ui/IconTile';
import { PillButton } from '../../components/ui/PillButton';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Toast } from '../../components/ui/Toast';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { DISPLAY_SIZES, useTheme } from '../../theme/tokens';
import type { BodyWeight } from '../../theme/tokens';

/**
 * Development-only harness for the Organic theme. NOT wired into navigation —
 * point a route at it by hand to check it, e.g. inside RootNavigator:
 *
 *   <Stack.Screen name="ThemePreview" component={ThemePreviewScreen} />
 *
 * Icons are absent throughout: react-native-svg is installed but not in the
 * current dev client binary, so IconTile renders as bare tinted squares until
 * that rebuild lands. Everything else here is final.
 */

const BODY_WEIGHTS: BodyWeight[] = [400, 500, 600, 700, 800];

const WEIGHT_LABELS: Record<BodyWeight, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
};

const TOAST_DURATION = 2600;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
      {children}
    </View>
  );
}

export function ThemePreviewScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // Toast has no timer of its own by design; this is the caller-side
  // auto-dismiss it expects.
  useEffect(() => {
    if (!toastVisible) {
      return;
    }
    const timer = setTimeout(() => setToastVisible(false), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 200 },
        ]}
      >
        <DisplayText size={34}>Organic theme</DisplayText>

        <Section title="Display — Caprasimo">
          {DISPLAY_SIZES.map((size) => (
            <View key={size} style={styles.displayRow}>
              <DisplayText size={size}>Nest the moment {size}</DisplayText>
            </View>
          ))}
        </Section>

        <Section title="Body — Figtree">
          {BODY_WEIGHTS.map((weight) => (
            <Text
              key={weight}
              style={[styles.bodySample, { fontFamily: theme.typography.body[weight] }]}
            >
              {weight} {WEIGHT_LABELS[weight]} — Sphinx of black quartz, judge my vow
            </Text>
          ))}
        </Section>

        <Section title="Palette">
          <View style={styles.swatchGrid}>
            {Object.entries(theme.colors).map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.swatchChip, { backgroundColor: value }]} />
                <Text style={styles.swatchName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Cards">
          <Card style={styles.cardBody}>
            <Text style={styles.cardText}>radius md · line border · no shadow</Text>
          </Card>
          <Card radius="lg" shadow style={[styles.cardBody, styles.cardSpaced]}>
            <Text style={styles.cardText}>radius lg · shadow sm</Text>
          </Card>
        </Section>

        <Section title="Pill buttons">
          <View style={styles.stack}>
            <PillButton title="Primary" onPress={() => {}} />
            <PillButton title="Secondary" variant="secondary" onPress={() => {}} />
            <PillButton title="Ghost" variant="ghost" onPress={() => {}} />
            <PillButton title="Delete folder" variant="danger-ghost" onPress={() => {}} />
            <PillButton title="Disabled" disabled onPress={() => {}} />
            <PillButton title="Compact (height 44)" height={44} variant="secondary" onPress={() => {}} />
          </View>
        </Section>

        <Section title="Icon tiles">
          <View style={styles.tileRow}>
            <IconTile tone="accent" />
            <IconTile tone="ok" />
            <IconTile tone="warn" />
            <IconTile tone="neutral" />
            <IconTile tone="accent" size={42} />
          </View>
          <Text style={styles.caption}>
            accent · ok · warn · neutral · accent@42 — glyphs land after the dev client rebuild
          </Text>
        </Section>

        <Section title="Overlays">
          <View style={styles.stack}>
            <PillButton title="Open bottom sheet" onPress={() => setSheetOpen(true)} />
            <PillButton title="Show toast" variant="secondary" onPress={() => setToastVisible(true)} />
          </View>
        </Section>
      </ScrollView>

      {toastVisible ? <Toast title="Upload complete" subtitle="3 items added to Rooftop" /> : null}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetBody}>
          <DisplayText size={22}>Move to folder</DisplayText>
          <Text style={styles.cardText}>
            Scrim is darkBg at 45%. Handle is 38×5 in line2. Tap the scrim to dismiss.
          </Text>
          <PillButton title="Done" onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 34,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  displayRow: {
    marginBottom: 8,
  },
  bodySample: {
    fontSize: 15,
    marginBottom: 8,
    color: theme.colors.text,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 74,
  },
  swatchChip: {
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  swatchName: {
    marginTop: 5,
    fontSize: 10,
    fontFamily: theme.typography.body[500],
    color: theme.colors.muted,
  },
  cardBody: {
    padding: 16,
  },
  cardSpaced: {
    marginTop: 12,
  },
  cardText: {
    fontSize: 14,
    fontFamily: theme.typography.body[400],
    color: theme.colors.muted,
  },
  stack: {
    gap: 10,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  caption: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: theme.typography.body[400],
    color: theme.colors.faint,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
}));
