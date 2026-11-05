'use client';

import Image from 'next/image';

export interface SyncNotice {
  label: string;
  tone: 'error' | 'conflict';
}

const iconButtonStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 'var(--radius-md)' };

export default function AppFooter({
  rightEdge,
  isFixed,
  isSyncing,
  syncNotice,
  calendarToggle,
  onSearch,
  onSettings,
  onAdd,
}: {
  /** CSS `right` value: on wide screens the footer stays under the list. */
  rightEdge: string | number;
  isFixed: boolean;
  isSyncing: boolean;
  /** Shown when sync needs attention; tapping it opens Settings. */
  syncNotice: SyncNotice | null;
  /** List/calendar switch, for narrow non-touch windows. Phones rotate to reach the calendar. */
  calendarToggle: { showingCalendar: boolean; onToggle: () => void } | null;
  onSearch: () => void;
  onSettings: () => void;
  onAdd: () => void;
}) {
  return (
    <footer
      style={{
        background: 'color-mix(in srgb, var(--background) 45%, transparent)',
        // Hug the 44px buttons: 4px above, 16px below + 1px top border, then
        // extend through the home-indicator inset so no blank band shows below.
        height: 'calc(65px + env(safe-area-inset-bottom, 0px))',
        minHeight: 'calc(65px + env(safe-area-inset-bottom, 0px))',
        maxHeight: 'calc(65px + env(safe-area-inset-bottom, 0px))',
        padding: '4px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        userSelect: 'none',
        // Overlay the scroll area so content blurs through as it scrolls.
        position: isFixed ? 'fixed' : 'absolute',
        left: 0,
        right: rightEdge,
        bottom: 0,
        zIndex: 25,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button title="Search tasks" className="icon-btn" onClick={onSearch} style={iconButtonStyle} aria-label="Search">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <button title="Settings" className="icon-btn" onClick={onSettings} style={iconButtonStyle} aria-label="Settings">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {calendarToggle && (
          <button
            title={calendarToggle.showingCalendar ? 'Show list' : 'Show calendar'}
            className="icon-btn"
            onClick={calendarToggle.onToggle}
            style={iconButtonStyle}
            aria-label={calendarToggle.showingCalendar ? 'Show list' : 'Show calendar'}
          >
            {calendarToggle.showingCalendar ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            )}
          </button>
        )}

        {syncNotice && (
          <button type="button" className="sync-notice" data-tone={syncNotice.tone} onClick={onSettings}>
            <span className="sync-notice-dot" aria-hidden="true" />
            {syncNotice.label}
          </button>
        )}
      </div>

      <div>
        <button
          title={isSyncing ? 'Syncing tasks — click to add' : 'New (n)'}
          onClick={onAdd}
          aria-label={isSyncing ? 'Syncing tasks; add task' : 'Add task'}
          className="add-task-btn"
        >
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/add-task.png`}
            alt=""
            width={44}
            height={44}
            style={{ display: 'block', opacity: isSyncing ? 0.35 : 1 }}
          />
          {isSyncing && (
            <svg className="sync-spinner" width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', inset: 0, margin: 'auto', color: 'var(--foreground)' }}>
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="36 16" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}
