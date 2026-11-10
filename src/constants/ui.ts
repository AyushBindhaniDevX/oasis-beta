import { Platform } from 'react-native';

export const T = {
    primary: '#5645d4',
    primaryPressed: '#4534b3',
    onPrimary: '#ffffff',
    navy: '#0a1530',
    linkBlue: '#0075de',
    ink: '#1a1a1a',
    charcoal: '#37352f',
    steel: '#787671',
    muted: '#bbb8b1',
    canvas: '#ffffff',
    surface: '#f6f5f4',
    surfaceSoft: '#fcf9f7',
    hairline: '#e5e3df',
    hairlineSoft: '#ede9e4',
    hairlineStrong: '#c8c4be',
    tintPeach: '#ffe8d4',
    tintRose: '#fde0ec',
    tintMint: '#d9f3e1',
    tintLavender: '#e6e0f5',
    tintSky: '#dcecfa',
    tintYellow: '#fef7d6',
    brandGreen: '#1aae39',
    brandOrange: '#dd5b00',
    brandOrangeDeep: '#793400',
    brandPurple800: '#391c57',
    brandTeal: '#2a9d99',
    semanticError: '#e03131',
    semanticWarning: '#dfb720',
    semanticSuccess: '#1aae39',
} as const;

export const FONT = Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '"Inter", -apple-system, system-ui, "Segoe UI", Helvetica, sans-serif',
}) as string;

export const R = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, full: 9999 } as const;
export const S = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const LAYOUT = {
    mobilePad: 16,
    desktopPad: 32,
    maxWidth: 1200,
    mobileBottom: 100,
};