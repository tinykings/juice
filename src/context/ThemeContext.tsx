'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  DARK_QUERY,
  parseThemeChoice,
  resolveTheme,
  ThemeChoice,
  ThemeMode,
  THEME_COLORS,
  THEME_STORAGE_KEY as STORAGE_KEY,
} from '@/utils/theme';

interface ThemeContextType {
  /** The mode on screen. */
  theme: ThemeMode;
  /** What the user picked, which may be following the system. */
  choice: ThemeChoice;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[mode]);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(() => (
    typeof window === 'undefined' ? 'system' : parseThemeChoice(localStorage.getItem(STORAGE_KEY))
  ));
  const [isDark, setIsDark] = useState(() => (typeof window === 'undefined' ? false : systemIsDark()));
  const theme = resolveTheme(choice, isDark);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => setIsDark(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    setChoice(mode);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, choice, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
