'use client';

import { useCallback } from 'react';

export default function SearchHeader({
  query,
  onQueryChange,
  onClose,
  rightEdge,
  reserveSpaceOnRight,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  /** CSS `right` value: on wide screens the bar stays over the list, leaving the calendar's controls in view. */
  rightEdge: string | number;
  reserveSpaceOnRight: boolean;
}) {
  // Callback ref focuses search immediately while preserving mobile keyboard user gesture.
  const inputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: rightEdge,
      zIndex: 20,
      background: 'color-mix(in srgb, var(--background) 92%, transparent)',
      padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px',
      paddingRight: reserveSpaceOnRight ? 72 : 16,
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          aria-label="Search tasks"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          style={{
            width: '100%',
            padding: '10px 12px 10px 40px',
            fontSize: 16,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--foreground)',
            height: 44,
          }}
        />
        <svg
          width="18"
          height="18"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <button
        className="btn-soft"
        onClick={onClose}
        style={{ fontSize: 15, fontWeight: 600, borderRadius: 'var(--radius-md)', padding: '0 16px', height: 44 }}
      >
        Cancel
      </button>
    </div>
  );
}
