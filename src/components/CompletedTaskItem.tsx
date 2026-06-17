'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Task } from '@/types/task';
import { splitTaskTitle } from '@/utils/taskTitle';

export default function CompletedTaskItem({ task, onUncomplete }: { task: Task; onUncomplete: () => void }) {
  const [isUncompleting, setIsUncompleting] = useState(false);
  const [isCheckboxHovered, setIsCheckboxHovered] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleUncomplete = () => {
    setIsUncompleting(true);
    setTimeout(onUncomplete, 300);
  };
  const titleParts = splitTaskTitle(task.title);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 14px 14px 12px',
        background: isHovered ? 'var(--task-surface-hover)' : 'var(--task-surface)',
        border: `1px solid ${isHovered ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        opacity: isUncompleting ? 0.3 : 0.78,
        transform: isUncompleting ? 'translateX(6px)' : 'translateX(0)',
        transition: 'opacity 0.18s ease, background 0.15s ease, border-color 0.15s ease, transform 0.18s ease, box-shadow 0.15s ease',
        boxShadow: isHovered ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <button
        onClick={handleUncomplete}
        onMouseEnter={() => setIsCheckboxHovered(true)}
        onMouseLeave={() => setIsCheckboxHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 6,
          transition: 'all 0.2s',
        }}
        aria-label="Mark task incomplete"
      >
        <div style={{
          width: 30,
          height: 30,
          background: isCheckboxHovered ? 'var(--accent-surface)' : 'var(--surface-inset)',
          border: `1px solid ${isCheckboxHovered ? 'var(--accent-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
          boxShadow: isCheckboxHovered ? '0 0 0 3px var(--accent-subtle)' : 'none',
        }}>
          {!isUncompleting && (
            <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
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
          <p style={{ margin: '5px 0 0', fontSize: 'var(--text-body)', color: 'var(--muted)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
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
