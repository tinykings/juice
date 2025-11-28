'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { GistSettings } from '@/services/gistSync';

interface SettingsContextType {
  gistSettings: GistSettings;
  updateGistSettings: (settings: Partial<GistSettings>) => void;
  isGistConfigured: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_GIST_SETTINGS: GistSettings = {
  gistId: '',
  githubToken: '',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [gistSettings, setGistSettings] = useLocalStorage<GistSettings>(
    'juice-gist-settings',
    DEFAULT_GIST_SETTINGS
  );

  const updateGistSettings = useCallback((updates: Partial<GistSettings>) => {
    setGistSettings((prev) => ({ ...prev, ...updates }));
  }, [setGistSettings]);

  const isGistConfigured = Boolean(gistSettings.gistId && gistSettings.githubToken);

  return (
    <SettingsContext.Provider
      value={{
        gistSettings,
        updateGistSettings,
        isGistConfigured,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

