export type ThemeMode = 'light' | 'dark';
/** What the user picked: light, dark, or 'system' to follow the device. */
export type ThemeChoice = ThemeMode | 'system';

export const THEME_STORAGE_KEY = 'juice-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Browser chrome color for each mode, before the app has loaded. */
export const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#F7F6F2',
  dark: '#0C0C0C',
};

const LEGACY_LIGHT = new Set([
  'light',
  'parchment',
  'solarized-light',
  'github-light',
  'catppuccin-latte',
  'rose-pine-dawn',
]);

const LEGACY_DARK = new Set([
  'dark',
  'material',
  'dracula',
  'tokyo-night',
  'gruvbox',
  'matrix',
  'charcoal',
]);

/** The stored value as a choice; anything missing or unknown follows the system. */
export function parseThemeChoice(stored: string | null): ThemeChoice {
  if (!stored) return 'system';
  if (stored === 'system') return 'system';
  if (LEGACY_LIGHT.has(stored)) return 'light';
  if (LEGACY_DARK.has(stored)) return 'dark';
  return 'system';
}

export function resolveTheme(choice: ThemeChoice, systemIsDark: boolean): ThemeMode {
  if (choice !== 'system') return choice;
  return systemIsDark ? 'dark' : 'light';
}

/** Runs before first paint (see layout.tsx) so the stored or system theme never flashes. */
export const themeBootScript = `(function(){try{var light=${JSON.stringify([...LEGACY_LIGHT])},dark=${JSON.stringify([...LEGACY_DARK])},t=localStorage.getItem('${THEME_STORAGE_KEY}');if(light.indexOf(t)>=0)t='light';else if(dark.indexOf(t)>=0)t='dark';else t=matchMedia('${DARK_QUERY}').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;
