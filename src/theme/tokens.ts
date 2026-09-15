// Design tokens as SWITCHABLE PALETTES. `palettes.comfort` (Organic) and
// `palettes.blue` share one `Palette` shape; the active one is chosen at runtime
// by themeStore and read through useTheme() / createThemedStyles().
//
// Legacy note: src/theme/colors.ts / typography.ts / spacing.ts are the old
// static system still imported by files the redesign hasn't converted. They are
// retired file-by-file during the 8.5 audit; this comment goes once they're gone.

import type { TextStyle, ViewStyle } from 'react-native';

import { useThemeStore } from '../store/themeStore';

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'shadowOffset' | 'elevation'
>;

/** The sanctioned display sizes. Anything outside this set is a design bug. */
export const DISPLAY_SIZES = [34, 30, 26, 22] as const;
export type DisplaySize = (typeof DISPLAY_SIZES)[number];

/** Figtree weights that are actually loaded. */
export type BodyWeight = 400 | 500 | 600 | 700 | 800;

type PaletteColors = {
  canvas: string;
  bg: string;
  card: string;
  card2: string;
  white: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  /** Accent at 20% — a tinted border on `accentSoft` surfaces. */
  accentLine: string;
  /** Coloured drop-shadow under the camera FAB. */
  accentShadow: string;
  ok: string;
  okSoft: string;
  okDeep: string;
  warn: string;
  warnSoft: string;
  danger: string;
  /** Danger at 25% — hairline border for the "needs attention" card. */
  dangerLine: string;
  line: string;
  line2: string;
  /** Translucent card fill for floating surfaces. */
  glass: string;
  /** Opaque-enough dark fill for the capture toast pill. */
  toastBg: string;
  /* Dark-context tokens below are SHARED across themes — the camera and viewer
     are deliberately identical in Comfort and Blue. */
  darkBg: string;
  darkSurface: string;
  darkGlass: string;
  lineOnDark: string;
  faintOnDark: string;
  strongOnDark: string;
};

export type Palette = {
  colors: PaletteColors;
  radius: { sheet: number; lg: number; md: number; sm: number; pill: number };
  shadows: Record<'sm' | 'lg', ShadowStyle>;
  typography: { display: string; body: Record<BodyWeight, string>; mono: string };
  /** Full heading style for a sanctioned size — encapsulates the theme's display font. */
  displayStyle: (size: DisplaySize) => TextStyle;
};

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

/** Body + mono fonts are the same in both themes; only the display font differs. */
const bodyFonts: Record<BodyWeight, string> = {
  400: 'Figtree_400Regular',
  500: 'Figtree_500Medium',
  600: 'Figtree_600SemiBold',
  700: 'Figtree_700Bold',
  800: 'Figtree_800ExtraBold',
};
const MONO = 'IBMPlexMono_400Regular';

/** Camera/viewer dark chrome — identical across themes by design. */
const sharedDark = {
  white: '#ffffff',
  darkBg: '#141312',
  darkSurface: '#1b1917',
  darkGlass: 'rgba(20,19,18,0.5)',
  lineOnDark: 'rgba(255,255,255,0.2)',
  faintOnDark: 'rgba(255,255,255,0.55)',
  strongOnDark: 'rgba(255,255,255,0.9)',
} as const;

const DISPLAY_LINE_HEIGHT_RATIO = 1.12;

/** Builds a palette's displayStyle: leading is always 1.12×; family + tracking vary. */
function makeDisplayStyle(
  family: string,
  trackingRatio: number,
  color: string,
): (size: DisplaySize) => TextStyle {
  return (size) => ({
    fontFamily: family,
    fontSize: size,
    lineHeight: Math.round(size * DISPLAY_LINE_HEIGHT_RATIO),
    letterSpacing: size * trackingRatio,
    color,
  });
}

/* -------------------------------------------------------------------------- */
/* Comfort (Organic) — the original values, verbatim                           */
/* -------------------------------------------------------------------------- */

const comfortColors: PaletteColors = {
  canvas: '#e2d8c6',
  bg: '#f5ead8',
  card: '#fdfaf4',
  card2: '#eee7db',
  text: '#201e1d',
  muted: '#645c50',
  faint: '#a19786',
  accent: '#c67139',
  accentSoft: '#ffe1d0',
  accentDeep: '#8c491a',
  accentLine: 'rgba(198,113,57,0.2)',
  accentShadow: '#8c491a',
  ok: '#7a8a5e',
  okSoft: '#e1eecc',
  okDeep: '#56633f',
  warn: '#c08a2e',
  warnSoft: '#f7e6c4',
  danger: '#b23a2d',
  dangerLine: 'rgba(178,58,45,0.25)',
  line: 'rgba(32,30,29,0.10)',
  line2: 'rgba(32,30,29,0.16)',
  glass: 'rgba(253,250,244,0.88)',
  toastBg: 'rgba(32,30,29,0.92)',
  ...sharedDark,
};

const comfort: Palette = {
  colors: comfortColors,
  radius: { sheet: 30, lg: 28, md: 18, sm: 14, pill: 999 },
  shadows: {
    sm: { shadowColor: '#2e2b25', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
    lg: { shadowColor: '#2e2b25', shadowOpacity: 0.2, shadowRadius: 36, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  },
  typography: { display: 'Caprasimo_400Regular', body: bodyFonts, mono: MONO },
  displayStyle: makeDisplayStyle('Caprasimo_400Regular', -0.01, comfortColors.text),
};

/* -------------------------------------------------------------------------- */
/* Blue — from the design's [data-theme="blue"] block. No Caprasimo.           */
/* -------------------------------------------------------------------------- */

const blueColors: PaletteColors = {
  canvas: '#dfe6f0',
  bg: '#f7f9fc',
  card: '#ffffff',
  card2: '#eaf1fa',
  text: '#102a43',
  muted: '#486581',
  faint: '#829ab1',
  accent: '#2f80ed',
  accentSoft: '#e2ecfb',
  accentDeep: '#1e60c9',
  accentLine: 'rgba(47,128,237,0.2)',
  accentShadow: '#1e60c9',
  ok: '#27ae60',
  okSoft: '#dcf3e6',
  okDeep: '#1e7a45',
  warn: '#c9971f',
  warnSoft: '#fbf0cf',
  danger: '#eb5757',
  dangerLine: 'rgba(235,87,87,0.25)',
  line: '#d9e2ec',
  line2: '#c3cfdb',
  glass: 'rgba(255,255,255,0.9)',
  toastBg: 'rgba(16,42,67,0.92)',
  ...sharedDark,
};

const blue: Palette = {
  colors: blueColors,
  radius: { sheet: 30, lg: 22, md: 16, sm: 14, pill: 999 },
  shadows: {
    sm: { shadowColor: '#102a43', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    lg: { shadowColor: '#102a43', shadowOpacity: 0.14, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  },
  // Blue has no Caprasimo — headings are Figtree ExtraBold with tighter tracking.
  typography: { display: 'Figtree_800ExtraBold', body: bodyFonts, mono: MONO },
  displayStyle: makeDisplayStyle('Figtree_800ExtraBold', -0.03, blueColors.text),
};

export const palettes = { comfort, blue } as const;

/* -------------------------------------------------------------------------- */
/* Runtime access                                                              */
/* -------------------------------------------------------------------------- */

/** The active palette. Re-renders consumers when the theme switches. */
export function useTheme(): Palette {
  const name = useThemeStore((s) => s.theme);
  return palettes[name];
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type Theme = Palette;
export type ThemeColors = Palette['colors'];
export type ColorToken = keyof ThemeColors;
export type RadiusToken = keyof Palette['radius'];
export type ShadowToken = keyof Palette['shadows'];
