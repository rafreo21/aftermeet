export const CARD_THEMES = [
  '#9FE870',
  '#FF6B5E',
  '#FF9F43',
  '#FFC107',
  '#14B8A6',
  '#2495E8',
  '#5146E5',
  '#A83DF0',
  '#163300',
  '#AEB8AA',
] as const;

const INK = '#163300';
const WHITE = '#FFFFFF';
const BLACK = '#000000';

function parseHex(hex: string) {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mixHex(hex: string, targetHex: string, weight: number) {
  const from = parseHex(normalizeThemeColor(hex));
  const to = parseHex(normalizeThemeColor(targetHex));
  if (!from || !to) return normalizeThemeColor(hex);
  const mix = clamp(weight, 0, 1);
  const channels = [from.r, from.g, from.b].map((channel, index) => {
    const target = [to.r, to.g, to.b][index]!;
    return Math.round(channel + (target - channel) * mix);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function normalizeThemeColor(value: string) {
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return CARD_THEMES[0];
  return trimmed.toUpperCase();
}

export function themeRelativeLuminance(hex: string) {
  const rgb = parseHex(normalizeThemeColor(hex));
  if (!rgb) return 1;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function isDarkThemeColor(hex: string) {
  return themeRelativeLuminance(hex) < 0.45;
}

export function themeForegroundColor(hex: string) {
  return isDarkThemeColor(hex) ? WHITE : INK;
}

export function themeMutedForegroundColor(hex: string) {
  return isDarkThemeColor(hex) ? 'rgba(255,255,255,0.78)' : '#53634D';
}

export function themeSoftForegroundColor(hex: string) {
  return isDarkThemeColor(hex) ? 'rgba(255,255,255,0.62)' : '#667363';
}

export type ThemeGradientStops = readonly [string, string, string];

export function themeGradientStops(hex: string): ThemeGradientStops {
  const base = normalizeThemeColor(hex);
  const dark = isDarkThemeColor(base);
  const highlight = mixHex(base, WHITE, dark ? 0.14 : 0.24);
  const shadow = mixHex(base, dark ? BLACK : INK, dark ? 0.28 : 0.16);
  return [highlight, base, shadow];
}

export function themeGradientCss(hex: string) {
  const [highlight, base, shadow] = themeGradientStops(hex);
  return `linear-gradient(135deg, ${highlight} 0%, ${base} 48%, ${shadow} 100%)`;
}

export type ThemeSurfaceStyle = {
  backgroundColor: string;
  backgroundGradient: string;
  gradientColors: ThemeGradientStops;
  color: string;
  mutedColor: string;
  softColor: string;
};

export function themeSurfaceStyle(hex: string): ThemeSurfaceStyle {
  const backgroundColor = normalizeThemeColor(hex);
  const gradientColors = themeGradientStops(backgroundColor);
  return {
    backgroundColor,
    backgroundGradient: themeGradientCss(backgroundColor),
    gradientColors,
    color: themeForegroundColor(backgroundColor),
    mutedColor: themeMutedForegroundColor(backgroundColor),
    softColor: themeSoftForegroundColor(backgroundColor),
  };
}

export function themeCoverBadgeStyle(hex: string) {
  const surface = themeSurfaceStyle(hex);
  return {
    backgroundColor: surface.color === WHITE ? 'rgba(255,255,255,0.18)' : INK,
    color: WHITE,
  };
}

export function themeMatches(left: string, right: string) {
  return normalizeThemeColor(left) === normalizeThemeColor(right);
}
