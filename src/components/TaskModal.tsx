'use client';

import { useEffect, useRef, useState } from 'react';
import { format, startOfDay, parse } from 'date-fns';
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
    if (isOpen && !editTask) {
      // For mobile PWA, we need more time for the modal to render and be visible
      // Use multiple animation frames to ensure the DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (titleRef.current) {
              // Ensure the input is visible
              titleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              // Focus the input
              titleRef.current.focus();
              // For mobile, sometimes we need to set selection to ensure keyboard appears
              if (titleRef.current.setSelectionRange) {
                titleRef.current.setSelectionRange(0, 0);
              }
            }
          }, 400); // Increased delay for mobile PWA to ensure modal is fully rendered
        });
      });
    }
    
    if (editTask) {
      if (titleRef.current) titleRef.current.value = editTask.title;
      if (notesRef.current) notesRef.current.value = editTask.notes;
      // Extract date in UTC to avoid timezone shifts when displaying
      const date = new Date(editTask.dueDate);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      setDueDate(`${year}-${month}-${day}`);
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

    // Parse the date string (YYYY-MM-DD) as a local date at midnight
    // This ensures the selected date is preserved regardless of timezone
    const parsedDate = parse(dueDate, 'yyyy-MM-dd', new Date());
    const dateAtMidnight = startOfDay(parsedDate);

    const taskData = {
      title,
      notes,
      dueDate: dateAtMidnight.toISOString(),
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
        left: 20,
        right: 20,
        top: '10%',
        maxWidth: 500,
        margin: '0 auto',
        background: 'var(--card)',
        borderRadius: 20,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        <form onSubmit={handleSubmit}>
          {/* Inputs */}
          <div style={{ padding: 24 }}>
            <input
              ref={titleRef}
              type="text"
              name="title"
              placeholder="New To-Do"
              autoFocus={!editTask}
              style={{
                width: '100%',
                fontSize: 22,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--foreground)',
                marginBottom: 12,
                padding: '4px 0'
              }}
            />
            <input
              ref={notesRef}
              type="text"
              name="notes"
              placeholder="Notes"
              style={{
                width: '100%',
                fontSize: 17,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--muted)',
                padding: '4px 0'
              }}
            />
          </div>

          {/* Options */}
          <div style={{ padding: '0 24px 24px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--background)',
              borderRadius: 12,
              fontSize: 16,
              cursor: 'pointer',
              minHeight: 48
            }}>
              <svg width="20" height="20" fill="none" stroke="var(--red)" strokeWidth="2" viewBox="0 0 24 24">
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
                  fontSize: 16
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                background: isRecurring ? 'var(--accent)' : 'var(--background)',
                color: isRecurring ? 'white' : 'var(--muted)',
                borderRadius: 12,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                minHeight: 48
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              Repeat
            </button>
          </div>

          {/* Recurrence options */}
          {isRecurring && (
            <div style={{ 
              padding: '0 24px 24px', 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: 10
            }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRecurrenceType(type)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 20,
                    fontSize: 15,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    background: recurrenceType === type ? 'var(--accent)' : 'var(--background)',
                    color: recurrenceType === type ? 'white' : 'var(--muted)',
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: 44
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
            padding: '16px 24px',
            background: 'var(--background)',
            borderTop: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '12px 20px',
                  fontSize: 16,
                  color: 'var(--muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: 48
                }}
              >
                Cancel
              </button>
              {editTask && (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    padding: '12px 20px',
                    fontSize: 16,
                    color: 'var(--red)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: 48
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 500,
                color: 'white',
                background: 'var(--accent)',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                minHeight: 48
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
