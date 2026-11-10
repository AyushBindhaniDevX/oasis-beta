/**
 * Notion Design System — Mobile-First Tokens & Theme System.
 * 
 * PRIMARY SOURCE OF TRUTH: Attached Notion Design Analysis (.md)
 * 
 * Notion Visual Language:
 * - Brand Navy Hero Band (#0a1530)
 * - Signature Notion Purple Primary CTA (#5645d4), pressed (#4534b3)
 * - Rich Pastel Feature Card Tints (Peach, Rose, Mint, Lavender, Sky, Yellow, Yellow-Bold, Cream, Gray)
 * - Sober-editorial geometry: 8px (rounded.md) rectangular buttons & inputs (NOT pills)
 * - 12px (rounded.lg) cards & mockup elevation
 * - 9999px (rounded.full) pill tabs and status badges only
 * - Humanist-geometric typography: 600 headlines, 500 button/emphasis, 400 body
 */

import '@/global.css';
import { Platform } from 'react-native';

/** Canonical Notion Brand Colors */
export const NotionColors = {
  primary: '#5645d4',
  primaryPressed: '#4534b3',
  primaryDeep: '#3a2a99',
  onPrimary: '#ffffff',
  brandNavy: '#0a1530',
  brandNavyDeep: '#070f24',
  brandNavyMid: '#1a2a52',
  linkBlue: '#0075de',
  linkBluePressed: '#005bab',
  brandOrange: '#dd5b00',
  brandOrangeDeep: '#793400',
  brandPink: '#ff64c8',
  brandPinkDeep: '#a02e6d',
  brandPurple: '#7b3ff2',
  brandPurple300: '#d6b6f6',
  brandPurple800: '#391c57',
  brandTeal: '#2a9d99',
  brandGreen: '#1aae39',
  brandYellow: '#f5d75e',
  brandBrown: '#523410',

  // Pastel Card Tints
  cardTintPeach: '#ffe8d4',
  cardTintRose: '#fde0ec',
  cardTintMint: '#d9f3e1',
  cardTintLavender: '#e6e0f5',
  cardTintSky: '#dcecfa',
  cardTintYellow: '#fef7d6',
  cardTintYellowBold: '#f9e79f',
  cardTintCream: '#f8f5e8',
  cardTintGray: '#f0eeec',

  // Surfaces
  canvas: '#ffffff',
  surface: '#f6f5f4',
  surfaceSoft: '#fafaf9',

  // Hairlines & Dividers
  hairline: '#e5e3df',
  hairlineSoft: '#ede9e4',
  hairlineStrong: '#c8c4be',

  // Text Ramp
  inkDeep: '#000000',
  ink: '#1a1a1a',
  charcoal: '#37352f',
  slate: '#5d5b54',
  steel: '#787671',
  stone: '#a4a097',
  muted: '#bbb8b1',
  onDark: '#ffffff',
  onDarkMuted: '#a4a097',

  // Semantic
  semanticSuccess: '#1aae39',
  semanticWarning: '#dd5b00',
  semanticError: '#e03131',
} as const;

/** Light and Dark Theme Palette definitions */
export const Colors = {
  light: {
    // Text
    text: NotionColors.ink,               // #1a1a1a — primary text
    textSecondary: NotionColors.slate,     // #5d5b54 — secondary text
    textTertiary: NotionColors.steel,      // #787671 — tertiary / muted labels
    textMuted: NotionColors.muted,         // #bbb8b1 — disabled / placeholder
    textStone: NotionColors.stone,         // #a4a097
    textCharcoal: NotionColors.charcoal,   // #37352f
    textInkDeep: NotionColors.inkDeep,     // #000000

    // Surfaces
    background: NotionColors.canvas,       // #ffffff — page canvas
    backgroundElement: NotionColors.surface,// #f6f5f4 — section / search surface
    backgroundSelected: NotionColors.cardTintLavender, // #e6e0f5 — active lavender
    surface: '#ffffff',                    // #ffffff — primary card surface
    surfaceMuted: NotionColors.surface,    // #f6f5f4 — card inset rows
    surfaceSoft: NotionColors.surfaceSoft, // #fafaf9

    // Lines & Borders
    border: NotionColors.hairline,         // #e5e3df — 1px hairlines
    borderStrong: NotionColors.hairlineStrong, // #c8c4be — input border
    borderSoft: NotionColors.hairlineSoft, // #ede9e4

    // Primary Brand CTA (Notion Signature Purple)
    primary: NotionColors.primary,         // #5645d4
    primaryForeground: NotionColors.onPrimary, // #ffffff
    primaryDark: NotionColors.primaryPressed,  // #4534b3
    primaryDeep: NotionColors.primaryDeep,     // #3a2a99
    primaryLight: NotionColors.cardTintLavender, // #e6e0f5 — lavender tint
    accent: NotionColors.brandPurple,      // #7b3ff2
    accentLight: NotionColors.cardTintLavender,

    // Link
    link: NotionColors.linkBlue,           // #0075de
    linkPressed: NotionColors.linkBluePressed, // #005bab

    // Semantic
    success: NotionColors.semanticSuccess, // #1aae39
    successLight: NotionColors.cardTintMint, // #d9f3e1
    warning: NotionColors.semanticWarning, // #dd5b00
    warningLight: NotionColors.cardTintPeach, // #ffe8d4
    danger: NotionColors.semanticError,   // #e03131
    dangerLight: NotionColors.cardTintRose, // #fde0ec
    info: NotionColors.linkBlue,          // #0075de
    infoLight: NotionColors.cardTintSky,   // #dcecfa

    // Utility & Overlays
    overlay: 'rgba(10, 21, 48, 0.65)',
    onPrimaryMuted: 'rgba(255, 255, 255, 0.75)',

    // Hero Band (Deep Navy)
    heroBg: NotionColors.brandNavy,        // #0a1530
    heroGradientStart: NotionColors.brandNavy,     // #0a1530
    heroGradientEnd: NotionColors.brandNavyDeep,   // #070f24
    heroNavyMid: NotionColors.brandNavyMid,        // #1a2a52

    // Pastel Feature Card Tints
    tintPeach: NotionColors.cardTintPeach,
    tintRose: NotionColors.cardTintRose,
    tintMint: NotionColors.cardTintMint,
    tintLavender: NotionColors.cardTintLavender,
    tintSky: NotionColors.cardTintSky,
    tintYellow: NotionColors.cardTintYellow,
    tintYellowBold: NotionColors.cardTintYellowBold,
    tintCream: NotionColors.cardTintCream,
    tintGray: NotionColors.cardTintGray,

    // Brand Spectrum
    brandOrange: NotionColors.brandOrange,
    brandOrangeDeep: NotionColors.brandOrangeDeep,
    brandPink: NotionColors.brandPink,
    brandPinkDeep: NotionColors.brandPinkDeep,
    brandPurple: NotionColors.brandPurple,
    brandPurple300: NotionColors.brandPurple300,
    brandPurple800: NotionColors.brandPurple800,
    brandTeal: NotionColors.brandTeal,
    brandGreen: NotionColors.brandGreen,
    brandYellow: NotionColors.brandYellow,
    brandBrown: NotionColors.brandBrown,
  },
  dark: {
    // Scaffold mirroring light with clean dark-mode equivalents
    text: '#ffffff',
    textSecondary: '#a4a097',
    textTertiary: '#787671',
    textMuted: '#5d5b54',
    textStone: '#a4a097',
    textCharcoal: '#f6f5f4',
    textInkDeep: '#ffffff',

    background: '#0a1530',
    backgroundElement: '#1a2a52',
    backgroundSelected: '#391c57',
    surface: '#0f1f44',
    surfaceMuted: '#14254f',
    surfaceSoft: '#0a1530',

    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.22)',
    borderSoft: 'rgba(255,255,255,0.08)',

    primary: NotionColors.primary,
    primaryForeground: '#ffffff',
    primaryDark: NotionColors.primaryPressed,
    primaryDeep: NotionColors.primaryDeep,
    primaryLight: 'rgba(86, 69, 212, 0.25)',
    accent: NotionColors.brandPurple,
    accentLight: 'rgba(123, 63, 242, 0.25)',

    link: '#38bdf8',
    linkPressed: '#0284c7',

    success: NotionColors.semanticSuccess,
    successLight: 'rgba(26, 174, 57, 0.2)',
    warning: NotionColors.semanticWarning,
    warningLight: 'rgba(221, 91, 0, 0.2)',
    danger: NotionColors.semanticError,
    dangerLight: 'rgba(224, 49, 49, 0.2)',
    info: '#38bdf8',
    infoLight: 'rgba(56, 189, 248, 0.2)',

    overlay: 'rgba(0, 0, 0, 0.75)',
    onPrimaryMuted: 'rgba(255, 255, 255, 0.7)',

    heroBg: NotionColors.brandNavyDeep,
    heroGradientStart: NotionColors.brandNavyDeep,
    heroGradientEnd: '#040814',
    heroNavyMid: NotionColors.brandNavy,

    tintPeach: '#2c1a12',
    tintRose: '#2c1220',
    tintMint: '#10281b',
    tintLavender: '#1f1638',
    tintSky: '#122538',
    tintYellow: '#2b260f',
    tintYellowBold: '#3a3212',
    tintCream: '#201e17',
    tintGray: '#1b1b1b',

    brandOrange: NotionColors.brandOrange,
    brandOrangeDeep: NotionColors.brandOrangeDeep,
    brandPink: NotionColors.brandPink,
    brandPinkDeep: NotionColors.brandPinkDeep,
    brandPurple: NotionColors.brandPurple,
    brandPurple300: NotionColors.brandPurple300,
    brandPurple800: NotionColors.brandPurple800,
    brandTeal: NotionColors.brandTeal,
    brandGreen: NotionColors.brandGreen,
    brandYellow: NotionColors.brandYellow,
    brandBrown: NotionColors.brandBrown,
  },
};

export type ThemeColor = keyof typeof Colors.light;
export type ThemeColors = typeof Colors.light;

/**
 * Brand Gradients for linear gradient backgrounds
 */
export const Gradients = {
  // Signature deep navy hero band (#0a1530 → #070f24)
  hero: [NotionColors.brandNavy, NotionColors.brandNavyDeep] as const,
  heroSoft: [NotionColors.brandNavy, NotionColors.brandNavyMid] as const,
  // Signature Notion purple primary
  accent: [NotionColors.primary, NotionColors.primaryPressed] as const,
  navy: [NotionColors.brandNavy, NotionColors.brandNavyDeep] as const,
  mobileHero: [NotionColors.brandNavy, NotionColors.brandNavyDeep] as const,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Notion Sans, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    rounded: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});

/**
 * Notion Typography scale.
 * 600 headlines, 500 button/emphasis, 400 body.
 */
export const Typography = {
  heroDisplay: { fontSize: 36, fontWeight: '600' as const, letterSpacing: -1, lineHeight: 42 },
  displayLg: { fontSize: 32, fontWeight: '600' as const, letterSpacing: -0.8, lineHeight: 38 },
  heading1: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.5, lineHeight: 34 },
  heading2: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.5, lineHeight: 30 },
  heading3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 26 },
  heading4: { fontSize: 18, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 24 },
  heading5: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 22 },
  subtitle: { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 24 },
  bodyMd: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 22 },
  bodyMdMedium: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 19 },
  bodySmMedium: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 16 },
  captionBold: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 16 },
  micro: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 14 },
  microUppercase: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, lineHeight: 14 },
  buttonMd: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 18 },

  // Backward compatibility keys
  display: { fontSize: 32, fontWeight: '600' as const, letterSpacing: -0.5, lineHeight: 38 },
  h1: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.4, lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.3, lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 26 },
  title: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 22 },
  callout: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 0, lineHeight: 20 },
  overline: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, lineHeight: 14 },
} as const;

/** Notion Spacing Scale */
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  sectionSm: 48,
  section: 64,
  sectionLg: 96,
  hero: 120,

  // Backwards compat aliases
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  screenPadding: 16,
} as const;

/**
 * Notion Border Radius Scale.
 * Notice: 8px (md) for buttons/inputs (rectangles, NOT pills); 12px (lg) for cards; 9999px (full) for badges/tabs.
 */
export const BorderRadius = {
  xs: 4,       // Tag chips
  sm: 6,       // Type badges, ghost buttons
  md: 8,       // Rectangular buttons, inputs, search-pill
  lg: 12,      // Cards, pricing tiers, agent tiles, mockup
  xl: 16,      // Larger feature panels
  xxl: 20,     // Featured product showcases
  xxxl: 24,    // Larger feature cards
  '2xl': 20,
  full: 9999,  // Status badges, pill tabs only (NOT buttons)
} as const;

/** Notion Elevation & Depth system */
export const Shadows = Platform.select({
  ios: {
    sm: { shadowColor: '#0f0f0f', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
    md: { shadowColor: '#0f0f0f', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    lg: { shadowColor: '#0f0f0f', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.20, shadowRadius: 48 },
    modal: { shadowColor: '#0f0f0f', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 48 },
  },
  android: {
    sm: { elevation: 1 },
    md: { elevation: 3 },
    lg: { elevation: 8 },
    modal: { elevation: 12 },
  },
  web: {
    sm: { boxShadow: 'rgba(15, 15, 15, 0.04) 0px 1px 2px 0px' } as any,
    md: { boxShadow: 'rgba(15, 15, 15, 0.08) 0px 4px 12px 0px' } as any,
    lg: { boxShadow: 'rgba(15, 15, 15, 0.20) 0px 24px 48px -8px' } as any,
    modal: { boxShadow: 'rgba(15, 15, 15, 0.16) 0px 16px 48px -8px' } as any,
  },
  default: {
    sm: {},
    md: {},
    lg: {},
    modal: {},
  },
});

/** Notion Purple brand shadow for primary CTAs */
export const BrandShadow = Platform.select({
  ios: { shadowColor: NotionColors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14 },
  android: { elevation: 6 },
  web: { boxShadow: '0 8px 18px -4px rgba(86, 69, 212, 0.35)' } as any,
  default: {},
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1280;
