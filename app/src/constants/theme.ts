/**
 * Cadence design tokens.
 *
 * Audience: adults 50-85 who may be worried about memory. The palette is a deep ink/teal
 * primary on a warm off-white, with sage / amber / soft terracotta tier colors. Nothing is
 * alarm red, and every tier is also carried by an icon and a label so color is never the
 * only signal. Contrast pairs below are at or above WCAG AA for their intended type size.
 */

import { Platform } from 'react-native';

import type { Tier } from '@/types';

export type Scheme = 'light' | 'dark';

export interface TierColors {
  /** Card / badge fill. */
  fill: string;
  /** Border for the fill. */
  border: string;
  /** Text and icon color drawn on `fill`. */
  ink: string;
}

export interface Palette {
  /** Page background. */
  background: string;
  /** Raised card background. */
  surface: string;
  /** Recessed / secondary fill inside a card. */
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  /** Primary brand color, used for fills and emphasis. */
  primary: string;
  /** Text / icon color on a `primary` fill. */
  onPrimary: string;
  /** Tinted primary fill for secondary buttons and chips. */
  primarySoft: string;
  /** Text color on `primarySoft`. */
  onPrimarySoft: string;
  /** Focus / selection outline. */
  focus: string;
  /** Destructive action (delete data). Warm, never alarm red. */
  destructive: string;
  /** Recording indicator. */
  recording: string;
  tiers: Record<Tier, TierColors>;
  /** Neutral informational banner. */
  info: TierColors;
  /** Cautionary banner (demo model, limits). */
  caution: TierColors;
  /** Chart ink. */
  chartLine: string;
  chartBaseline: string;
  chartGrid: string;
}

export const Colors: Record<Scheme, Palette> = {
  light: {
    background: '#FBF7F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F3EDE5',
    border: '#E2D9CC',
    borderStrong: '#C9BCA9',
    text: '#14262B',
    textSecondary: '#4C5F63',
    primary: '#0E5A63',
    onPrimary: '#FFFFFF',
    primarySoft: '#DCEAEB',
    onPrimarySoft: '#0B474E',
    focus: '#0E5A63',
    destructive: '#8C3A24',
    recording: '#9A4A34',
    tiers: {
      typical: { fill: '#E3EDE2', border: '#BFD4BC', ink: '#2F5B3F' },
      watch: { fill: '#F8ECD5', border: '#E3CB9A', ink: '#7A4E0B' },
      doctor: { fill: '#F7E4DC', border: '#E4BDAD', ink: '#8C3A24' },
    },
    info: { fill: '#E7EEF0', border: '#C7D7DB', ink: '#1E4650' },
    caution: { fill: '#F8ECD5', border: '#E3CB9A', ink: '#7A4E0B' },
    chartLine: '#0E5A63',
    chartBaseline: '#2F5B3F',
    chartGrid: '#E2D9CC',
  },
  dark: {
    background: '#0F1617',
    surface: '#182122',
    surfaceAlt: '#212D2E',
    border: '#2E3C3D',
    borderStrong: '#465857',
    text: '#F3EEE7',
    textSecondary: '#B3C1C1',
    primary: '#7AD3D8',
    onPrimary: '#05272B',
    primarySoft: '#1E3336',
    onPrimarySoft: '#B7E6E9',
    focus: '#7AD3D8',
    destructive: '#F0A48C',
    recording: '#F0A48C',
    tiers: {
      typical: { fill: '#1C2A21', border: '#33503C', ink: '#A9D5AF' },
      watch: { fill: '#2C2416', border: '#524223', ink: '#EFC585' },
      doctor: { fill: '#2F1F19', border: '#573A2E', ink: '#F0A992' },
    },
    info: { fill: '#1B2729', border: '#31444A', ink: '#B9D6DC' },
    caution: { fill: '#2C2416', border: '#524223', ink: '#EFC585' },
    chartLine: '#7AD3D8',
    chartBaseline: '#A9D5AF',
    chartGrid: '#2E3C3D',
  },
};

/** 4 pt scale. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Type scale. Body is never below 17 and titles are never below 28, per the brief.
 * Line heights are generous for older eyes; everything scales with the system font size.
 */
export const Type = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  body: { fontSize: 18, lineHeight: 27, fontWeight: '400' },
  bodyStrong: { fontSize: 18, lineHeight: 27, fontWeight: '600' },
  label: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  mono: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
} as const;

/**
 * Soft lift for cards. The border still carries the edge (white on the warm page is nearly
 * invisible to low vision); the shadow only separates layers. Android draws `elevation`.
 */
export const Elevation = {
  card: {
    shadowColor: '#3B2F1E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 1,
  },
} as const;

/** Minimum interactive height. The brief asks for 56 pt. */
export const MinTouch = 56;
/** Comfortable reading measure on a phone or tablet. */
export const MaxContentWidth = 560;
/** Extra bottom padding so content clears the native tab bar. */
export const TabBarInset = Platform.select({ ios: 56, android: 72 }) ?? 56;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

/** Cap runaway text scaling in compact chrome (badges, chart labels) without blocking it. */
export const MaxFontScale = {
  tight: 1.6,
  loose: 2.2,
} as const;

export const Brand = {
  name: 'Cadence',
  tagline: 'Your voice, your baseline.',
} as const;
