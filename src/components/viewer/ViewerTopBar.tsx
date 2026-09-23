import React from 'react';
import { ChevronLeft, MoreVertical } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CREAM_12, CREAM_50 } from './viewerChrome';
import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme } from '../../theme/tokens';

/** Gap between the safe area and the bar's content (design: 56px total top). */
const TOP_GAP = 8;

type ViewerTopBarProps = {
  /** `displayName` when the backend sent one, else the raw file name. */
  title: string;
  /** "24 July · 12:04" for photos, "Video · 1:04 · 18.8 MB" for videos. */
  subtitle: string;
  topInset: number;
  onBack: () => void;
  onMore: () => void;
};

export function ViewerTopBar({
  title,
  subtitle,
  topInset,
  onBack,
  onMore,
}: ViewerTopBarProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.bar, { paddingTop: topInset + TOP_GAP }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close viewer"
        hitSlop={10}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <ChevronLeft size={20} color={theme.colors.cream} strokeWidth={3} />
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="File details"
        hitSlop={10}
        onPress={onMore}
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
      >
        <MoreVertical size={18} color={theme.colors.cream} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((t) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  back: {
    height: 38,
    paddingLeft: 2,
    paddingRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: t.typography.body[600],
    fontSize: 14,
    color: t.colors.cream,
  },
  subtitle: {
    fontFamily: t.typography.body[400],
    fontSize: 11,
    color: CREAM_50,
    marginTop: 1,
  },
  more: {
    width: 38,
    height: 38,
    borderRadius: t.radius.pill,
    backgroundColor: CREAM_12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
}));
