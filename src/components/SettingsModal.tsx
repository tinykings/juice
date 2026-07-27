'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { useTasks } from '@/context/TaskContext';
import { loadTasksFromGist } from '@/services/gistSync';
import { requestBadgePermission, isBadgeSupported } from '@/hooks/useAppBadge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { gistSettings, updateGistSettings, isGistConfigured, badgeEnabled, setBadgeEnabled } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const { loadFromGist, syncStatus, syncError, lastSyncedAt } = useTasks();
  
  const [gistId, setGistId] = useState(gistSettings.gistId);
  const [token, setToken] = useState(gistSettings.githubToken);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync local state with persisted settings when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setGistId(gistSettings.gistId);
      setToken(gistSettings.githubToken);
      setIsConfirmingReset(false);
    }
  }, [isOpen, gistSettings.gistId, gistSettings.githubToken]);

  const syncLabel = !isGistConfigured
    ? 'Auto-sync disabled'
    : syncStatus === 'syncing'
      ? 'Syncing...'
      : syncStatus === 'error'
        ? 'Sync error'
        : syncStatus === 'conflict'
          ? 'Conflict preserved'
          : 'Auto-sync enabled';
  const syncDotColor = !isGistConfigured
    ? 'var(--muted)'
    : syncStatus === 'error'
      ? 'var(--red)'
      : syncStatus === 'conflict'
        ? 'var(--accent)'
        : 'var(--green)';
  const syncDescription = syncError
    ?? (syncStatus === 'conflict'
      ? 'Two devices edited the same task, so Juice kept both versions.'
      : lastSyncedAt
        ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
        : 'Tasks will automatically sync to your Gist when changed.');

  if (!isOpen) return null;

  const handleResetApp = () => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true);
      return;
    }

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('juice-')) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    window.location.reload();
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

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 14, 12, 0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          background: 'var(--card)',
          width: '100%',
          maxWidth: 460,
          maxHeight: 'calc(100dvh - 32px)',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          animation: 'scaleIn 140ms ease-out both',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
            fontFamily: 'var(--font-body)',
            color: 'var(--foreground)',
            lineHeight: 1.25,
          }}>Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 0,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--foreground)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 18 }}>
          {/* Theme & Badge buttons row */}
          <div style={{ display: 'grid', gridTemplateColumns: isBadgeSupported() ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 16 }}>
            <button
              onClick={toggleTheme}
              style={{
                flex: 1,
                padding: '0 14px',
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.035)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                e.currentTarget.style.color = 'var(--foreground)';
              }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            {isBadgeSupported() && (
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
                    flex: 1,
                    padding: '0 14px',
                    fontSize: 14,
                    fontWeight: 600,
                    border: '1px solid',
                    borderRadius: 'var(--radius-sm)',
                    borderColor: badgeEnabled ? 'var(--accent-border)' : 'var(--border)',
                    background: badgeEnabled ? 'var(--accent-surface)' : 'rgba(255, 255, 255, 0.035)',
                    color: badgeEnabled ? 'var(--background)' : 'var(--foreground)',
                    cursor: 'pointer',
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!badgeEnabled) {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!badgeEnabled) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                      e.currentTarget.style.color = 'var(--foreground)';
                    }
                  }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Notify
              </button>
            )}
          </div>

          <div style={{
            background: 'var(--task-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            marginBottom: 14,
          }}>
            <h3 style={{
              fontSize: 17,
              fontWeight: 700,
              margin: '0 0 8px',
              color: 'var(--foreground)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.3,
            }}>
              GitHub Gist Sync
            </h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Sync your tasks across devices using a GitHub Gist as storage. 
              You need a GitHub personal access token with <code style={{
                background: 'var(--surface-inset)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                padding: '2px 6px',
                fontSize: 13,
                color: 'var(--foreground)'
              }}>gist</code> scope.
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLoadFromGist(); }}>
            {/* Gist ID */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="username" style={{
                display: 'block',
                fontSize: 'var(--text-meta)',
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
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
                  padding: '0 12px',
                  fontSize: 15,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.035)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  height: 42,
                  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-border)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.045)';
                  e.target.style.boxShadow = '0 0 0 3px var(--accent-subtle)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.035)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* GitHub Token */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: 'var(--text-meta)',
                fontWeight: 700,
                color: 'var(--muted)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
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
                  padding: '0 12px',
                  fontSize: 15,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.035)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  height: 42,
                  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-border)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.045)';
                  e.target.style.boxShadow = '0 0 0 3px var(--accent-subtle)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.035)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Message */}
            {message && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
                fontSize: 14,
                background: message.type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 107, 107, 0.08)',
                border: `1px solid ${message.type === 'success' ? 'rgba(46, 204, 113, 0.28)' : 'rgba(255, 107, 107, 0.22)'}`,
                color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
                fontWeight: 600,
                lineHeight: 1.4,
              }}>
                {message.text}
              </div>
            )}

            {/* Buttons */}
            <button
              type="submit"
              disabled={isLoading || !gistId || !token}
              style={{
                width: '100%',
                padding: '0 16px',
                fontSize: 14,
                fontWeight: 700,
                border: '1px solid',
                borderColor: isLoading || !gistId || !token ? 'var(--border)' : 'var(--accent)',
                borderRadius: 'var(--radius-sm)',
                background: isLoading || !gistId || !token ? 'var(--muted-light)' : 'var(--accent)',
                color: isLoading || !gistId || !token ? 'var(--muted)' : 'var(--background)',
                cursor: isLoading || !gistId || !token ? 'not-allowed' : 'pointer',
                height: 42,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isLoading && gistId && token) {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && gistId && token) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }
              }}
            >
              {isLoading ? 'Loading...' : 'Load Tasks from Gist'}
            </button>
          </form>

          {/* Sync Status */}
          <div style={{ 
            marginTop: 14, 
            padding: '14px', 
            background: 'var(--task-surface)', 
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: syncDotColor,
              }} />
              <span style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 650 }}>
                {syncLabel}
              </span>
            </div>
            {isGistConfigured && (
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 14, lineHeight: 1.45 }}>
                {syncDescription}
              </p>
            )}
          </div>

          <div style={{
            marginTop: 14,
            padding: 14,
            background: 'rgba(255, 107, 107, 0.05)',
            border: '1px solid rgba(255, 107, 107, 0.18)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 700 }}>
              Reset App
            </div>
            <p style={{ margin: '6px 0 12px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
              Clears all local tasks, settings, sync history, Gist ID, and GitHub token. This does not delete the Gist itself.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleResetApp}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--red)',
                  borderRadius: 'var(--radius-sm)',
                  background: isConfirmingReset ? 'var(--red)' : 'transparent',
                  color: isConfirmingReset ? 'var(--background)' : 'var(--red)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {isConfirmingReset ? 'Confirm Reset' : 'Reset App'}
              </button>
              {isConfirmingReset && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(false)}
                  style={{
                    height: 40,
                    padding: '0 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 650,
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
