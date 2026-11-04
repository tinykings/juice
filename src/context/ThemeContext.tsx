'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  DARK_QUERY,
  getTheme,
  parseThemeChoice,
  resolveTheme,
  ThemeChoice,
  ThemeId,
  THEME_STORAGE_KEY as STORAGE_KEY,
} from '@/utils/theme';

interface ThemeContextType {
  /** The theme on screen. */
  theme: ThemeId;
  /** What the user picked, which may be following the system. */
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => (
    typeof window === 'undefined' ? 'system' : parseThemeChoice(localStorage.getItem(STORAGE_KEY))
  ));
  const [isDark, setIsDark] = useState(() => (typeof window === 'undefined' ? false : systemIsDark()));
  const theme = resolveTheme(choice, isDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', getTheme(theme).background);
    });
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => setIsDark(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const setChoice = (next: ThemeChoice) => {
    if (next === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setChoiceState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, choice, setChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
