'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Task } from '@/types/task';
import { getTaskTitleParts } from '@/utils/taskTitle';

export default function CompletedTaskItem({ task, onUncomplete }: { task: Task; onUncomplete: () => void }) {
  const [isUncompleting, setIsUncompleting] = useState(false);

  const handleUncomplete = () => {
    setIsUncompleting(true);
    setTimeout(onUncomplete, 300);
  };
  const titleParts = getTaskTitleParts(task);

  return (
    <div
      className="task-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr)',
        alignItems: 'flex-start',
        columnGap: 12,
        padding: '11px 12px 11px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        opacity: isUncompleting ? 0.3 : 0.58,
        transform: isUncompleting ? 'translateX(6px)' : 'translateX(0)',
        transition: 'opacity 0.18s ease, background 0.15s ease, border-color 0.15s ease, transform 0.18s ease, box-shadow 0.15s ease',
      }}
    >
      <button
        className="task-checkbox"
        onClick={handleUncomplete}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 0,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 4,
          transition: 'all 0.2s',
        }}
        aria-label="Mark task incomplete"
      >
        <div className="task-checkbox-circle" style={{
          width: 24,
          height: 24,
          marginTop: 1,
          background: 'var(--surface-inset)',
          border: '1.5px solid var(--checkbox-border)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        }}>
          {!isUncompleting && (
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--text-task-title)',
          fontWeight: 600,
          lineHeight: 1.35,
          textDecoration: isUncompleting ? 'none' : 'line-through',
          color: isUncompleting ? 'var(--foreground)' : 'var(--muted)',
          transition: 'all 0.2s'
        }}>
          {titleParts.title}
        </p>
        {titleParts.note && (
          <p style={{ margin: '3px 0 0', fontSize: 'var(--text-body)', color: 'var(--muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {titleParts.note}
          </p>
        )}
        {task.completedAt && (
          <p style={{ margin: '7px 0 0', fontSize: 'var(--text-meta)', fontWeight: 600, color: 'var(--muted)' }}>
            {format(new Date(task.completedAt), 'MMM d, h:mm a')}
          </p>
        )}
      </div>
    </div>
  );
}
