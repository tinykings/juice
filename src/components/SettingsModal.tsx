'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { loadTasksFromGist, createNewGist } from '@/services/gistSync';
import { requestBadgePermission, isBadgeSupported } from '@/hooks/useAppBadge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { gistSettings, updateGistSettings, isGistConfigured, badgeEnabled, setBadgeEnabled } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const { loadFromGist, tasks } = useTasks();
  
  const [gistId, setGistId] = useState(gistSettings.gistId);
  const [token, setToken] = useState(gistSettings.githubToken);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync local state with persisted settings when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setGistId(gistSettings.gistId);
      setToken(gistSettings.githubToken);
    }
  }, [isOpen, gistSettings.gistId, gistSettings.githubToken]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateGistSettings({ gistId, githubToken: token });
    setMessage({ type: 'success', text: 'Settings saved!' });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleLoadFromGist = async () => {
    if (!gistId || !token) {
      setMessage({ type: 'error', text: 'Please enter both Gist ID and GitHub token' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const loadedTasks = await loadTasksFromGist({ gistId, githubToken: token });
      loadFromGist(loadedTasks);
      updateGistSettings({ gistId, githubToken: token });
      setMessage({ type: 'success', text: `Loaded ${loadedTasks.length} tasks from Gist!` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load from Gist' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGist = async () => {
    if (!token) {
      setMessage({ type: 'error', text: 'Please enter a GitHub token first' });
      return;
    }

    setIsCreating(true);
    setMessage(null);

    try {
      const newGistId = await createNewGist(tasks, token);
      setGistId(newGistId);
      updateGistSettings({ gistId: newGistId, githubToken: token });
      setMessage({ type: 'success', text: 'Created new Gist! ID has been filled in.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create Gist' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          background: 'var(--background)',
          borderRadius: 0,
          width: '100%',
          maxWidth: 400,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '12px 12px 0 rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 8,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              borderRadius: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--foreground)';
              e.currentTarget.style.color = 'var(--background)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {/* Theme */}
          <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
              Theme
            </h3>
            <button
              onClick={toggleTheme}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 0,
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.2s'
              }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
              GitHub Gist Sync
            </h3>
            <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Sync your tasks across devices using a GitHub Gist as storage. 
              You need a GitHub personal access token with <code style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '4px 6px', fontSize: 14 }}>gist</code> scope.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            {/* Gist ID */}
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="username" style={{ display: 'block', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
                Gist ID
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={gistId}
                onChange={(e) => setGistId(e.target.value)}
                placeholder="abc123def456..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  transition: 'box-shadow 0.2s'
                }}
                onFocus={(e) => e.target.style.boxShadow = '4px 4px 0 var(--accent)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
            </div>

            {/* GitHub Token */}
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
                GitHub Token
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  transition: 'box-shadow 0.2s'
                }}
                onFocus={(e) => e.target.style.boxShadow = '4px 4px 0 var(--accent)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
            </div>

            {/* Message */}
            {message && (
              <div style={{
                padding: '14px 16px',
                borderRadius: 0,
                marginBottom: 20,
                fontSize: 15,
                background: message.type === 'success' ? 'var(--green)' : 'var(--red)',
                color: 'var(--background)',
                fontWeight: 500
              }}>
                {message.text}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="submit"
                style={{
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 0,
                  background: 'var(--accent)',
                  color: 'var(--background)',
                  cursor: 'pointer',
                  minHeight: 48,
                  transition: 'transform 0.1s'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
              >
                Save Settings
              </button>

              <button
                type="button"
                onClick={handleLoadFromGist}
                disabled={isLoading || !gistId || !token}
                style={{
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  cursor: isLoading || !gistId || !token ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !gistId || !token ? 0.5 : 1,
                  minHeight: 48,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && gistId && token) {
                    e.currentTarget.style.background = 'var(--card)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--background)';
                }}
              >
                {isLoading ? 'Loading...' : 'Load Tasks from Gist'}
              </button>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                margin: '8px 0',
                color: 'var(--muted)',
                fontSize: 12,
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <button
                type="button"
                onClick={handleCreateGist}
                disabled={isCreating || !token}
                style={{
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  cursor: isCreating || !token ? 'not-allowed' : 'pointer',
                  opacity: isCreating || !token ? 0.5 : 1,
                  minHeight: 48
                }}
                onMouseEnter={(e) => {
                  if (!isCreating && token) {
                    e.currentTarget.style.background = 'var(--card)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--background)';
                }}
              >
                {isCreating ? 'Creating...' : 'Create New Gist'}
              </button>
            </div>
          </form>

          {/* Sync Status */}
          <div style={{ 
            marginTop: 24, 
            padding: '16px', 
            background: 'var(--card)', 
            border: '1px solid var(--border)',
            borderRadius: 0,
            fontSize: 15,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isGistConfigured ? 'var(--green)' : 'var(--muted)',
              }} />
              <span style={{ color: 'var(--foreground)', fontSize: 16 }}>
                {isGistConfigured ? 'Auto-sync enabled' : 'Auto-sync disabled'}
              </span>
            </div>
            {isGistConfigured && (
              <p style={{ margin: '10px 0 0', color: 'var(--muted)', fontSize: 14 }}>
                Tasks will automatically sync to your Gist when changed.
              </p>
            )}
          </div>

          {/* Badge Section */}
          {isBadgeSupported() && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
                App Badge
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Show a count of today&apos;s tasks on the app icon. Requires notification permission on iOS.
              </p>
              <button
                onClick={async () => {
                  if (badgeEnabled) {
                    setBadgeEnabled(false);
                  } else {
                    const granted = await requestBadgePermission();
                    if (granted) {
                      setBadgeEnabled(true);
                    } else {
                      setMessage({ type: 'error', text: 'Notification permission is required for app badges on iOS.' });
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 500,
                  border: badgeEnabled ? 'none' : '1px solid var(--border)',
                  borderRadius: 0,
                  background: badgeEnabled ? 'var(--accent)' : 'var(--background)',
                  color: badgeEnabled ? 'var(--background)' : 'var(--foreground)',
                  cursor: 'pointer',
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.2s'
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {badgeEnabled ? 'Badge Enabled' : 'Enable App Badge'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

