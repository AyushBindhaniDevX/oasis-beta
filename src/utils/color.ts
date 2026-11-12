/**
 * Dynamic Brand Color Palette Engine
 * Generates harmonious tints, shades, borders, and gradients from an organization's primary color.
 */

export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex || typeof hex !== 'string') return `rgba(86, 69, 212, ${alpha})`;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return `rgba(86, 69, 212, ${alpha})`;
  }
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function adjustBrightness(hex: string, percent: number): string {
  if (!hex || typeof hex !== 'string') return '#5645d4';
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return '#5645d4';

  const num = parseInt(clean, 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export interface BrandColorPalette {
  primary: string;             // Base brand primary (e.g. #0D9488, #5645d4, #7C3AED)
  primaryHover: string;        // Slightly darker shade for pressed/hover states
  primaryDeep: string;         // Deeper contrast tone for text on tinted backgrounds
  primaryLight: string;        // 9% opacity tint for hero KPI card / banner surface
  primarySurface: string;      // 16% opacity tint for icon boxes & pill chips
  primaryBorder: string;       // 24% opacity tint for crisp borders
  primaryStrongBorder: string; // 40% opacity border
  primaryWave: string;         // Slightly brighter tone for SVG sparkline waves
  textOnPrimary: string;       // #FFFFFF
  canvasTint: string;          // 2.5% ultra-subtle canvas background wash
}

export function getBrandPalette(baseHex?: string | null): BrandColorPalette {
  const primary = baseHex && /^#([0-9A-F]{3}){1,2}$/i.test(baseHex) ? baseHex : '#5645d4';
  return {
    primary,
    primaryHover: adjustBrightness(primary, -12),
    primaryDeep: adjustBrightness(primary, -32),
    primaryLight: hexToRgba(primary, 0.09),
    primarySurface: hexToRgba(primary, 0.16),
    primaryBorder: hexToRgba(primary, 0.24),
    primaryStrongBorder: hexToRgba(primary, 0.40),
    primaryWave: adjustBrightness(primary, 14),
    textOnPrimary: '#FFFFFF',
    canvasTint: hexToRgba(primary, 0.025),
  };
}
