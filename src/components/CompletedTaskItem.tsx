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
      padding: '16px 0',
      borderBottom: '1px solid var(--border)',
      opacity: isUncompleting ? 0.3 : 1,
      transition: 'opacity 0.15s',
    }}>
      <button
        onClick={handleUncomplete}
        onMouseEnter={() => setIsCheckboxHovered(true)}
        onMouseLeave={() => setIsCheckboxHovered(false)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 0,
          background: isUncompleting ? 'transparent' : (isCheckboxHovered ? 'var(--muted)' : 'var(--muted-light)'),
          border: isUncompleting ? '2.5px solid var(--muted-light)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 4,
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s',
          minWidth: 28,
          minHeight: 28
        }}
      >
        {!isUncompleting && (
          <svg width="16" height="16" fill="none" stroke="var(--foreground)" strokeWidth="3" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
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
