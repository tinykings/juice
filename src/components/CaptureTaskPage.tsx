'use client';

import { useState } from 'react';
import { TaskForm } from '@/components/TaskModal';
import SettingsModal from '@/components/SettingsModal';

/** The `?newtask` page: a bare add form for shortcuts and widgets. */
export default function CaptureTaskPage() {
  const [hasAdded, setHasAdded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '24px 14px',
    }}>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {hasAdded ? (
          <div style={{ color: 'var(--foreground)', fontSize: 18, fontWeight: 700, padding: '14px 2px' }}>
            task added
          </div>
        ) : (
          <>
            <TaskForm inline onClose={() => {}} onSave={() => setHasAdded(true)} captureUrlMode />
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="hover-link"
              style={{
                alignSelf: 'flex-start',
                color: 'var(--muted)',
                background: 'transparent',
                border: 'none',
                padding: '4px 2px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Settings
            </button>
          </>
        )}
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
