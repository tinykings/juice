'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { loadTasksFromGist, createNewGist } from '@/services/gistSync';

async function clearCacheAndReload() {
  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
  }
  
  // Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  
  // Force reload without cache
  window.location.reload();
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { gistSettings, updateGistSettings, isGistConfigured } = useSettings();
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
        background: 'rgba(0, 0, 0, 0.5)',
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
          borderRadius: 16,
          width: '100%',
          maxWidth: 400,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 8,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
              GitHub Gist Sync
            </h3>
            <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Sync your tasks across devices using a GitHub Gist as storage. 
              You need a GitHub personal access token with <code style={{ background: 'var(--border)', padding: '4px 6px', borderRadius: 6, fontSize: 14 }}>gist</code> scope.
            </p>
          </div>

          {/* GitHub Token */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
              GitHub Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 16,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--background)',
                color: 'var(--foreground)',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: 48
              }}
            />
          </div>

          {/* Gist ID */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
              Gist ID
            </label>
            <input
              type="text"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="abc123def456..."
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 16,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--background)',
                color: 'var(--foreground)',
                outline: 'none',
                boxSizing: 'border-box',
                minHeight: 48
              }}
            />
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '14px 16px',
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 15,
              background: message.type === 'success' ? 'var(--green)' : 'var(--red)',
              color: 'white',
            }}>
              {message.text}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleSave}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: 'none',
                borderRadius: 12,
                background: 'var(--accent)',
                color: 'white',
                cursor: 'pointer',
                minHeight: 48
              }}
            >
              Save Settings
            </button>

            <button
              onClick={handleLoadFromGist}
              disabled={isLoading || !gistId || !token}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: isLoading || !gistId || !token ? 'not-allowed' : 'pointer',
                opacity: isLoading || !gistId || !token ? 0.5 : 1,
                minHeight: 48
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
              onClick={handleCreateGist}
              disabled={isCreating || !token}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: isCreating || !token ? 'not-allowed' : 'pointer',
                opacity: isCreating || !token ? 0.5 : 1,
                minHeight: 48
              }}
            >
              {isCreating ? 'Creating...' : 'Create New Gist'}
            </button>
          </div>

          {/* Sync Status */}
          <div style={{ 
            marginTop: 24, 
            padding: '16px', 
            background: 'var(--accent-light)', 
            borderRadius: 12,
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

          {/* Update App Section */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
              App Updates
            </h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Clear cached files and reload to get the latest version of the app.
            </p>
            <button
              onClick={clearCacheAndReload}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              Update App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

