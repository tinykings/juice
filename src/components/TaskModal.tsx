'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useTasks } from '@/context/TaskContext';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

function TaskModal({ isOpen, onClose, editTask }: TaskModalProps) {
  const { addTask, updateTask, deleteTask } = useTasks();
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
    
    if (editTask) {
      if (titleRef.current) titleRef.current.value = editTask.title;
      if (notesRef.current) notesRef.current.value = editTask.notes;
      setDueDate(format(new Date(editTask.dueDate), 'yyyy-MM-dd'));
      setIsRecurring(editTask.isRecurring);
      setRecurrenceType(editTask.recurrenceType || 'daily');
    } else {
      if (titleRef.current) titleRef.current.value = '';
      if (notesRef.current) notesRef.current.value = '';
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      setIsRecurring(false);
      setRecurrenceType('daily');
    }
  }, [editTask, isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const title = titleRef.current?.value.trim() || '';
    const notes = notesRef.current?.value.trim() || '';
    
    if (!title) return;

    const taskData = {
      title,
      notes,
      dueDate: new Date(dueDate).toISOString(),
      isRecurring,
      recurrenceType: isRecurring ? recurrenceType : null,
      tags: [],
    };

    if (editTask) {
      updateTask(editTask.id, taskData);
    } else {
      addTask(taskData);
    }

    onClose();
  };

  const handleDelete = () => {
    if (editTask) {
      deleteTask(editTask.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)'
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: '15%',
        maxWidth: 400,
        margin: '0 auto',
        background: 'var(--card)',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        <form onSubmit={handleSubmit}>
          {/* Inputs */}
          <div style={{ padding: 20 }}>
            <input
              ref={titleRef}
              type="text"
              name="title"
              placeholder="New To-Do"
              style={{
                width: '100%',
                fontSize: 18,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--foreground)',
                marginBottom: 8
              }}
            />
            <input
              ref={notesRef}
              type="text"
              name="notes"
              placeholder="Notes"
              style={{
                width: '100%',
                fontSize: 14,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--muted)'
              }}
            />
          </div>

          {/* Options */}
          <div style={{ padding: '0 20px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--background)',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer'
            }}>
              <svg width="16" height="16" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--foreground)',
                  fontSize: 14
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: isRecurring ? 'var(--accent)' : 'var(--background)',
                color: isRecurring ? 'white' : 'var(--muted)',
                borderRadius: 8,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              Repeat
            </button>
          </div>

          {/* Recurrence options */}
          {isRecurring && (
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 6 }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRecurrenceType(type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    background: recurrenceType === type ? 'var(--accent)' : 'var(--background)',
                    color: recurrenceType === type ? 'white' : 'var(--muted)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            background: 'var(--background)',
            borderTop: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  color: 'var(--muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              {editTask && (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    color: 'var(--red)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <button
              type="submit"
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 500,
                color: 'white',
                background: 'var(--accent)',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {editTask ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskModal;
