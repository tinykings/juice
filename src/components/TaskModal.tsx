'use client';

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { format, startOfDay, parse } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useTasks } from '@/context/TaskContext';
import CalendarPicker from './CalendarPicker';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  editTask?: Task | null;
  initialDate?: string | null;
}

const TaskModal = memo(function TaskModal({ isOpen, onClose, onSave, editTask, initialDate }: TaskModalProps) {
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
          backdropFilter: 'blur(8px)'
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        maxWidth: 420,
        margin: '0 auto',
        background: 'var(--card)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'auto',
        border: '1px solid var(--border)',
      }}>
        <TaskForm 
          key={editTask ? editTask.id : 'new'} 
          editTask={editTask} 
          onClose={onClose}
          onSave={onSave}
          initialDate={initialDate}
        />
      </div>
    </div>
  );
});

function TaskForm({ editTask, onClose, onSave, initialDate }: { editTask?: Task | null, onClose: () => void, onSave?: () => void, initialDate?: string | null }) {
  const { addTask, updateTask, deleteTask, completeTask } = useTasks();
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const hasFocusedRef = useRef(false);
  const initialDueDate = editTask
    ? `${new Date(editTask.dueDate).getUTCFullYear()}-${String(new Date(editTask.dueDate).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(editTask.dueDate).getUTCDate()).padStart(2, '0')}`
    : (initialDate || format(new Date(), 'yyyy-MM-dd'));
  
  const [dueDate, setDueDate] = useState(initialDueDate);

  const [hasChanges, setHasChanges] = useState(false);
  const originalData = useRef({
    title: editTask?.title || '',
    notes: editTask?.notes || '',
    dueDate: initialDueDate,
    isRecurring: editTask?.isRecurring || false,
    recurrenceType: editTask?.recurrenceType || 'daily'
  });

  const [isRecurring, setIsRecurring] = useState(() => editTask?.isRecurring ?? false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(() => editTask?.recurrenceType || 'daily');

  const checkForChanges = useCallback((overrides?: {
    dueDate?: string;
    isRecurring?: boolean;
    recurrenceType?: RecurrenceType;
  }) => {
    const currentTitle = titleRef.current?.value || '';
    const currentNotes = notesRef.current?.value || '';
    const nextDueDate = overrides?.dueDate ?? dueDate;
    const nextIsRecurring = overrides?.isRecurring ?? isRecurring;
    const nextRecurrenceType = overrides?.recurrenceType ?? recurrenceType;
    const changed = 
      currentTitle !== originalData.current.title ||
      currentNotes !== originalData.current.notes ||
      nextDueDate !== originalData.current.dueDate ||
      nextIsRecurring !== originalData.current.isRecurring ||
      (nextIsRecurring && nextRecurrenceType !== originalData.current.recurrenceType);
    
    setHasChanges(changed);
  }, [dueDate, isRecurring, recurrenceType]);

  const focusTitle = useCallback(() => {
    const input = titleRef.current;
    const active = document.activeElement;
    if (input && active !== input && active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
      input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      input.focus();
    }
  }, []);

  useEffect(() => {
    if (!editTask && !hasFocusedRef.current) {
      hasFocusedRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(focusTitle, 400);
        });
      });
    }
  }, [editTask, focusTitle]);

  useEffect(() => {
    if (editTask) {
      hasFocusedRef.current = false;
    }
  }, [editTask]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
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
    if (onSave) onSave();
  }, [addTask, dueDate, editTask, isRecurring, onClose, onSave, recurrenceType, updateTask]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && editTask && hasChanges) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [editTask, handleSubmit, hasChanges, onClose]);

  const handleDelete = () => {
    if (editTask) {
      deleteTask(editTask.id);
      onClose();
    }
  };

  const handleComplete = () => {
    if (editTask) {
      completeTask(editTask.id);
      onClose();
      if (onSave) onSave();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Inputs */}
      <div style={{ padding: 24 }}>
        <input
          ref={titleRef}
          type="text"
          name="title"
          placeholder="New To-Do"
          defaultValue={editTask?.title || ''}
          autoFocus={!editTask}
          onChange={checkForChanges}
          style={{
            width: '100%',
            fontSize: 22,
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid transparent',
            outline: 'none',
            color: 'var(--foreground)',
            marginBottom: 12,
            padding: '4px 0',
            lineHeight: 1.4,
            fontFamily: 'var(--font-body)',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderBottomColor = 'var(--accent)'}
          onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
        />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Add time with @ (e.g., @9am, @530, @2:30pm)
        </p>
        <input
          ref={notesRef}
          type="text"
          name="notes"
          placeholder="Notes"
          defaultValue={editTask?.notes || ''}
          onChange={checkForChanges}
          style={{
            width: '100%',
            fontSize: 17,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--muted)',
            padding: '4px 0',
            lineHeight: 1.4
          }}
        />
      </div>

      {/* Options */}
      <div style={{ padding: '0 24px 24px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <CalendarPicker value={dueDate} onChange={(val) => { setDueDate(val); checkForChanges({ dueDate: val }); }} />

        <button
          type="button"
          onClick={() => {
            const nextIsRecurring = !isRecurring;
            setIsRecurring(nextIsRecurring);
            checkForChanges({ isRecurring: nextIsRecurring });
          }}
          onMouseEnter={(e) => {
            if (!isRecurring) {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecurring) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--muted)';
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: isRecurring ? 'var(--accent)' : 'var(--background)',
            color: isRecurring ? 'var(--background)' : 'var(--muted)',
            border: isRecurring ? 'none' : '1px solid var(--border)',
            borderRadius: 0,
            fontSize: 16,
            cursor: 'pointer',
            minHeight: 48,
            fontWeight: 500,
            transition: 'all 0.2s'
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
              onClick={() => {
                setRecurrenceType(type);
                checkForChanges({ recurrenceType: type });
              }}
              onMouseEnter={(e) => {
                if (recurrenceType !== type) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (recurrenceType !== type) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--muted)';
                }
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                fontSize: 15,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: recurrenceType === type ? 'var(--foreground)' : 'var(--background)',
                color: recurrenceType === type ? 'var(--background)' : 'var(--muted)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                minHeight: 44,
                transition: 'all 0.2s'
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
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--foreground)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
            style={{
              padding: '12px 20px',
              fontSize: 16,
              color: 'var(--muted)',
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              minHeight: 48,
              borderRadius: 0,
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
          {editTask && (
            <button
              type="button"
              onClick={handleDelete}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              style={{
                padding: '12px 20px',
                fontSize: 16,
                color: 'var(--red)',
                background: 'none',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                minHeight: 48,
                borderRadius: 0,
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              Delete
            </button>
          )}
        </div>
        {editTask ? (
          <button
            type="button"
            onClick={hasChanges ? handleSubmit : handleComplete}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--accent)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 0,
              cursor: 'pointer',
              minHeight: 48,
              transition: 'all 0.2s'
            }}
          >
            {hasChanges ? 'Save' : 'Complete'}
          </button>
        ) : (
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--background)',
              background: 'var(--accent)',
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              minHeight: 48,
              transition: 'transform 0.1s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
          >
            Add
          </button>
        )}
      </div>
    </form>
  );
}

export default TaskModal;
