'use client';

import { Task } from '@/types/task';
import { getTaskDisplayTitle } from '@/utils/taskTitle';

export default function UndoToast({ task, left, onUndo }: { task: Task; left: string; onUndo: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left,
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        zIndex: 30,
        width: 'min(420px, calc(100% - 32px))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 10px 10px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      <span style={{
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        color: 'var(--foreground)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        Completed <strong style={{ fontWeight: 650 }}>{getTaskDisplayTitle(task)}</strong>
      </span>
      <button
        type="button"
        className="btn-soft"
        onClick={onUndo}
        style={{ flexShrink: 0, height: 36, padding: '0 14px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
      >
        Undo
      </button>
    </div>
  );
}
