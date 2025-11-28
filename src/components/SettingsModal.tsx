'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTasks } from '@/context/TaskContext';
import { loadTasksFromGist, createNewGist } from '@/services/gistSync';

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
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--muted)' }}>
              GitHub Gist Sync
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Sync your tasks across devices using a GitHub Gist as storage. 
              You need a GitHub personal access token with <code style={{ background: 'var(--border)', padding: '2px 4px', borderRadius: 4 }}>gist</code> scope.
            </p>
          </div>

          {/* GitHub Token */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              GitHub Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--background)',
                color: 'var(--foreground)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Gist ID */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              Gist ID
            </label>
            <input
              type="text"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="abc123def456..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--background)',
                color: 'var(--foreground)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
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
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
                borderRadius: 8,
                background: 'var(--accent)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Save Settings
            </button>

            <button
              onClick={handleLoadFromGist}
              disabled={isLoading || !gistId || !token}
              style={{
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: isLoading || !gistId || !token ? 'not-allowed' : 'pointer',
                opacity: isLoading || !gistId || !token ? 0.5 : 1,
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
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: isCreating || !token ? 'not-allowed' : 'pointer',
                opacity: isCreating || !token ? 0.5 : 1,
              }}
            >
              {isCreating ? 'Creating...' : 'Create New Gist'}
            </button>
          </div>

          {/* Sync Status */}
          <div style={{ 
            marginTop: 20, 
            padding: '12px', 
            background: 'var(--accent-light)', 
            borderRadius: 8,
            fontSize: 13,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isGistConfigured ? 'var(--green)' : 'var(--muted)',
              }} />
              <span style={{ color: 'var(--foreground)' }}>
                {isGistConfigured ? 'Auto-sync enabled' : 'Auto-sync disabled'}
              </span>
            </div>
            {isGistConfigured && (
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                Tasks will automatically sync to your Gist when changed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

