'use client';

import { useState } from 'react';
import { startOfDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';

export default function QuickAdd() {
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      e.preventDefault();
      
      const today = startOfDay(new Date());
      
      addTask({
        title: title.trim(),
        notes: '',
        dueDate: today.toISOString(),
        isRecurring: false,
        recurrenceType: null,
        tags: []
      });
      
      setTitle('');
    }
  };

  return (
    <div style={{ padding: '0 24px 20px' }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--card)',
        border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        transition: 'all 0.2s',
        boxShadow: isFocused ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
      }}>
        <div style={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isFocused ? 'var(--accent)' : 'var(--muted-light)'
        }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Add a task for today..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            height: 44,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 16,
            color: 'var(--foreground)',
            paddingRight: 16
          }}
        />
      </div>
    </div>
  );
}
