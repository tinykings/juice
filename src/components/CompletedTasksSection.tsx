'use client';

import { useState } from 'react';
import { Task } from '@/types/task';
import CompletedTaskItem from '@/components/CompletedTaskItem';

export default function CompletedTasksSection({ tasks, onUncomplete }: { tasks: Task[]; onUncomplete: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        type="button"
        onClick={() => setIsExpanded(expanded => !expanded)}
        aria-expanded={isExpanded}
        aria-controls="completed-tasks"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          color: 'var(--muted)',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.01em',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <svg
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span>Completed</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600 }}>{tasks.length}</span>
      </button>
      {isExpanded && (
        <div id="completed-tasks" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => (
            <CompletedTaskItem key={task.id} task={task} onUncomplete={() => onUncomplete(task.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
