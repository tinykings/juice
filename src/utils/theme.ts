export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'juice-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';
export const THEME_COLORS: Record<Theme, string> = { dark: '#0f0e0c', light: '#F4F1EA' };

/** Runs before first paint (see layout.tsx) so the stored or system theme never flashes. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('${DARK_QUERY}').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
