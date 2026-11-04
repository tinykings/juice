export type ThemeMode = 'light' | 'dark';

export const THEMES = [
  { id: 'parchment', name: 'Parchment', mode: 'light', background: '#F4F1EA' },
  { id: 'solarized-light', name: 'Solarized Light', mode: 'light', background: '#FDF6E3' },
  { id: 'github-light', name: 'GitHub Light', mode: 'light', background: '#F6F8FA' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', mode: 'light', background: '#EFF1F5' },
  { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', mode: 'light', background: '#FAF4ED' },
  { id: 'material', name: 'Material', mode: 'dark', background: '#263238' },
  { id: 'dracula', name: 'Dracula', mode: 'dark', background: '#282A36' },
  { id: 'tokyo-night', name: 'Tokyo Night', mode: 'dark', background: '#1A1B26' },
  { id: 'gruvbox', name: 'Gruvbox', mode: 'dark', background: '#282828' },
  { id: 'matrix', name: 'Matrix', mode: 'dark', background: '#050A06' },
  { id: 'charcoal', name: 'Charcoal', mode: 'dark', background: '#0f0e0c' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
/** What the user picked: a theme, or 'system' to follow the device's light or dark setting. */
export type ThemeChoice = ThemeId | 'system';

export const THEME_STORAGE_KEY = 'juice-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const DEFAULT_THEMES: Record<ThemeMode, ThemeId> = { light: 'parchment', dark: 'material' };

export function getTheme(id: ThemeId) {
  return THEMES.find(theme => theme.id === id)!;
}

/** Browser chrome color for each system mode, before the app has loaded. */
export const THEME_COLORS: Record<ThemeMode, string> = {
  light: getTheme(DEFAULT_THEMES.light).background,
  dark: getTheme(DEFAULT_THEMES.dark).background,
};

// Saved before there were named themes: an explicit "light" or "dark" pick.
const LEGACY_THEMES: Record<string, ThemeId> = { light: DEFAULT_THEMES.light, dark: DEFAULT_THEMES.dark };

/** The stored value as a choice; anything missing or unknown follows the system. */
export function parseThemeChoice(stored: string | null): ThemeChoice {
  if (!stored) return 'system';
  if (Object.hasOwn(LEGACY_THEMES, stored)) return LEGACY_THEMES[stored];
  return THEMES.some(theme => theme.id === stored) ? (stored as ThemeId) : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemIsDark: boolean): ThemeId {
  if (choice !== 'system') return choice;
  return DEFAULT_THEMES[systemIsDark ? 'dark' : 'light'];
}

/** Runs before first paint (see layout.tsx) so the stored or system theme never flashes. */
export const themeBootScript = `(function(){try{var ids=${JSON.stringify(THEMES.map(theme => theme.id))},legacy=${JSON.stringify(LEGACY_THEMES)},t=localStorage.getItem('${THEME_STORAGE_KEY}');t=legacy[t]||t;if(ids.indexOf(t)<0)t=matchMedia('${DARK_QUERY}').matches?'${DEFAULT_THEMES.dark}':'${DEFAULT_THEMES.light}';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
