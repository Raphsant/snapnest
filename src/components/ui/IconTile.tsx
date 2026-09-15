import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { createThemedStyles } from '../../theme/createThemedStyles';
import { useTheme, type Palette } from '../../theme/tokens';
import type { IconComponent } from './types';

/**
 * Semantic tint, not a colour. Each tone pairs a `*Soft` background with the
 * matching deep foreground so contrast holds without the call site picking two
 * tokens that have to agree.
 *
 * No `danger` tone: the palette has `danger` but no `dangerSoft` to sit it on.
 */
export type IconTileTone = 'accent' | 'ok' | 'warn' | 'neutral';

/** The two sanctioned footprints. 44 for rows, 42 where space is tighter. */
export type IconTileSize = 44 | 42;

type IconTileProps = {
  /**
   * Optional so a tile can render as a plain tinted square while
   * react-native-svg is still absent from the dev client.
   */
  icon?: IconComponent;
  /** Defaults to `accent`. */
  tone?: IconTileTone;
  /** Defaults to 44. */
  size?: IconTileSize;
  style?: StyleProp<ViewStyle>;
};

type TonePalette = { background: string; foreground: string };

function buildTones(t: Palette): Record<IconTileTone, TonePalette> {
  return {
    accent: { background: t.colors.accentSoft, foreground: t.colors.accentDeep },
    ok: { background: t.colors.okSoft, foreground: t.colors.okDeep },
    // No `warnDeep` in the palette, so `warn` doubles as the foreground.
    warn: { background: t.colors.warnSoft, foreground: t.colors.warn },
    neutral: { background: t.colors.card2, foreground: t.colors.muted },
  };
}

const ICON_RATIO = 0.48;
const ICON_STROKE = 2;

/**
 * The rounded leading square used for folder and status rows. Marked
 * non-accessible: it always sits beside a label that carries the meaning, so
 * exposing it would make VoiceOver announce every row twice.
 */
export function IconTile({
  icon: Icon,
  tone = 'accent',
  size = 44,
  style,
}: IconTileProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const palette = buildTones(theme)[tone];

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: palette.background },
        style,
      ]}
    >
      {Icon ? (
        <Icon
          size={Math.round(size * ICON_RATIO)}
          color={palette.foreground}
          strokeWidth={ICON_STROKE}
        />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((t) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.sm,
    },
  }),
);
