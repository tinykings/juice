'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Task } from '@/types/task';

export default function CompletedTaskItem({ task, onUncomplete }: { task: Task; onUncomplete: () => void }) {
  const [isUncompleting, setIsUncompleting] = useState(false);
  const [isCheckboxHovered, setIsCheckboxHovered] = useState(false);

  const handleUncomplete = () => {
    setIsUncompleting(true);
    setTimeout(onUncomplete, 300);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      padding: '16px',
      borderBottom: '2px solid var(--border)',
      opacity: isUncompleting ? 0.3 : 1,
      transition: 'opacity 0.15s',
    }}>
      <button
        onClick={handleUncomplete}
        onMouseEnter={() => setIsCheckboxHovered(true)}
        onMouseLeave={() => setIsCheckboxHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 4,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 8,
          transition: 'all 0.2s',
        }}
      >
        <div style={{
          width: 28,
          height: 28,
          background: isCheckboxHovered ? 'var(--muted)' : 'var(--muted-light)',
          border: '2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}>
          {!isUncompleting && (
            <svg width="16" height="16" fill="none" stroke="var(--foreground)" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </div>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 18,
          lineHeight: 1.4,
          textDecoration: isUncompleting ? 'none' : 'line-through',
          color: isUncompleting ? 'var(--foreground)' : 'var(--muted)',
          transition: 'all 0.2s'
        }}>
          {task.title}
        </p>
        {task.completedAt && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            {format(new Date(task.completedAt), 'MMM d, h:mm a')}
          </p>
        )}
      </div>
    </div>
  );
}
