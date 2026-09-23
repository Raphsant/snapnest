import React, { useCallback, useRef, useState } from 'react';
import { Building2, Camera } from 'lucide-react-native';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '../components/ui/DisplayText';
import { PillButton } from '../components/ui/PillButton';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/tokens';

type OnboardingScreenProps = {
  /** Called on Skip and on finishing the last slide. RootNavigator marks seen. */
  onComplete: () => void;
};

type Slide = {
  key: string;
  title: string;
  body: string;
  art: React.ReactNode;
};

/* -- Illustrations, composed from primitives (approximate the design) ------- */

function CaptureArt(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.artCircle, { backgroundColor: theme.colors.accentSoft }]}>
      <View style={styles.phone}>
        <View style={styles.phoneScreen} />
        <View style={styles.shutter} />
      </View>
    </View>
  );
}

function NamingArt(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.artCircle, { backgroundColor: theme.colors.okSoft }]}>
      <View style={styles.namePill}>
        <Text style={styles.namePillText}>Evento Miami 03</Text>
      </View>
      <View style={styles.filePill}>
        <Text style={styles.filePillText}>IMG_4821.mov</Text>
      </View>
    </View>
  );
}

function SyncArt(): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.artCircle, { backgroundColor: theme.colors.accentSoft }]}>
      <View style={styles.syncRow}>
        <View style={styles.syncTile}>
          <Camera size={26} color={theme.colors.accentDeep} strokeWidth={2.2} />
        </View>
        <View style={styles.connector} />
        <View style={styles.syncTile}>
          <Building2 size={26} color={theme.colors.accentDeep} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

// NOTE: body copy approximates the design strings (isOnboard ~991–1015), which
// I couldn't read verbatim — swap in the exact lines if they differ.
const SLIDES: Slide[] = [
  {
    key: 'capture',
    title: 'Shoot. It backs itself up.',
    body: 'Capture photos and video right here. Every one uploads to the cloud on its own — no exports, no cables, nothing left on the phone.',
    art: <CaptureArt />,
  },
  {
    key: 'naming',
    title: 'Names your editor can read',
    body: 'Each capture is auto-named after its folder, so your team finds the right shot in seconds instead of scrolling past IMG_4821.',
    art: <NamingArt />,
  },
  {
    key: 'sync',
    title: 'Your editors get it instantly',
    body: 'The moment a capture lands, your editors can see it. You shoot here, they work there — in sync, in real time.',
    art: <SyncArt />,
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(next);
    },
    [width],
  );

  const onCtaPress = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }, [index, isLast, onComplete, width]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onComplete} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View style={styles.art}>{slide.art}</View>
            <DisplayText size={30} style={styles.title}>{slide.title}</DisplayText>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
        <PillButton title={isLast ? 'Get started' : 'Continue'} height={54} onPress={onCtaPress} />
      </View>
    </View>
  );
}

const ART_SIZE = 220;

const useStyles = createThemedStyles((theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  topBar: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  skip: {
    fontFamily: theme.typography.body[600],
    fontSize: 15,
    color: theme.colors.muted,
  },
  pager: {
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  art: {
    marginBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: theme.typography.body[400],
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dotActive: {
    width: 24,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  dotInactive: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.line2,
  },

  // Illustrations
  artCircle: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 104,
    height: 156,
    borderRadius: 22,
    backgroundColor: theme.colors.darkBg,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
  },
  phoneScreen: {
    ...StyleSheet.absoluteFillObject,
    margin: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    opacity: 0.85,
  },
  shutter: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: 4,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.darkBg,
  },
  namePill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
    marginBottom: 14,
  },
  namePillText: {
    fontFamily: theme.typography.body[700],
    fontSize: 15,
    color: theme.colors.text,
  },
  filePill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card2,
  },
  filePillText: {
    fontFamily: theme.typography.mono,
    fontSize: 12.5,
    color: theme.colors.faint,
    textDecorationLine: 'line-through',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncTile: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  connector: {
    width: 34,
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
}));
