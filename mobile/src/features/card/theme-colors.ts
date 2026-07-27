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

export function normalizeThemeColor(value: string) {
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return CARD_THEMES[0];
  return trimmed.toUpperCase();
}

export function themeMatches(left: string, right: string) {
  return normalizeThemeColor(left) === normalizeThemeColor(right);
}
