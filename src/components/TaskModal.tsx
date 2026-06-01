'use client';

import { useCallback, useEffect, useRef, useState, useMemo, memo } from 'react';
import { format, startOfDay, parse } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useTasks } from '@/context/TaskContext';
import CalendarPicker from './CalendarPicker';
import { findDateWord, removeDateWord, DateWordMatch } from '@/utils/dateWords';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 420,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)',
        animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
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
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const hasFocusedRef = useRef(false);

  const initialDueDate = editTask
    ? (editTask.dueDate
        ? `${new Date(editTask.dueDate).getUTCFullYear()}-${String(new Date(editTask.dueDate).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(editTask.dueDate).getUTCDate()).padStart(2, '0')}`
        : '')
    : (initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [titleValue, setTitleValue] = useState(editTask?.title || '');

  const dateWordMatch = useMemo<DateWordMatch | null>(
    () => findDateWord(titleValue),
    [titleValue]
  );

  const highlights = useMemo(() => {
    const items: Array<{ start: number; end: number; color: string }> = [];

    if (dateWordMatch) {
      items.push({
        start: dateWordMatch.index,
        end: dateWordMatch.index + dateWordMatch.word.length,
        color: 'var(--accent)',
      });
    }

    const timeResult = titleValue.match(/@(\d+(?::\d{2})?(?:pm|am)?)/i);
    if (timeResult?.index !== undefined) {
      items.push({
        start: timeResult.index,
        end: timeResult.index + timeResult[0].length,
        color: 'var(--purple)',
      });
    }

    items.sort((a, b) => a.start - b.start);
    return items;
  }, [titleValue, dateWordMatch]);

  const [showHelp, setShowHelp] = useState(false);
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
    const currentTitle = titleValue;
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
  }, [dueDate, isRecurring, recurrenceType, titleValue]);

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
    
    let title = titleValue.trim();
    const notes = notesRef.current?.value.trim() || '';
    
    if (!title) return;

    let effectiveDueDate = dueDate;

    const match = findDateWord(title);
    if (match) {
      if (match.date) {
        effectiveDueDate = format(match.date, 'yyyy-MM-dd');
      } else {
        effectiveDueDate = '';
      }
      title = removeDateWord(title, match);
    }

    if (effectiveDueDate) {
      const parsedDate = parse(effectiveDueDate, 'yyyy-MM-dd', new Date());
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
    } else {
      const taskData = {
        title,
        notes,
        dueDate: '',
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        tags: [],
      };

      if (editTask) {
        updateTask(editTask.id, taskData);
      } else {
        addTask(taskData);
      }
    }

    onClose();
    if (onSave) onSave();
  }, [addTask, dueDate, editTask, isRecurring, onClose, onSave, recurrenceType, updateTask, titleValue]);

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

  useEffect(() => {
    const textarea = titleRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      {/* Inputs */}
      <div style={{ padding: 24 }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <textarea
            ref={titleRef}
            name="title"
            placeholder="New To-Do"
            aria-label="Task title"
            rows={1}
            value={titleValue}
            autoFocus={!editTask}
            onChange={(e) => {
              setTitleValue(e.target.value);
              checkForChanges();
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!editTask || hasChanges) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            style={{
              width: '100%',
              fontSize: 22,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid transparent',
              outline: 'none',
              color: 'var(--foreground)',
              caretColor: 'var(--foreground)',
              padding: '4px 0',
              lineHeight: 1.4,
              fontFamily: 'var(--font-body)',
              transition: 'border-color 0.2s',
              resize: 'none',
              overflow: 'hidden',
            }}
            onFocus={(e) => e.target.style.borderBottomColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
          />
          <div aria-hidden="true" style={{
            position: 'absolute',
            inset: 0,
            padding: '4px 0',
            pointerEvents: 'none',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.4,
            fontFamily: 'var(--font-body)',
            color: 'transparent',
            whiteSpace: 'pre-wrap',
          }}>
            {titleValue ? (() => {
              if (highlights.length === 0) {
                return <span style={{ color: 'transparent' }}>{titleValue}</span>;
              }

              const segs: React.ReactNode[] = [];
              let pos = 0;
              for (const h of highlights) {
                if (h.start > pos) {
                  segs.push(<span key={`t${pos}`} style={{ color: 'transparent' }}>{titleValue.slice(pos, h.start)}</span>);
                }
                segs.push(
                  <span key={`h${h.start}`} style={{ color: h.color, fontWeight: 600 }}>
                    {titleValue.slice(h.start, h.end)}
                  </span>
                );
                pos = h.end;
              }
              if (pos < titleValue.length) {
                segs.push(<span key={`t${pos}`} style={{ color: 'transparent' }}>{titleValue.slice(pos)}</span>);
              }
              return segs;
            })() : (
              <span style={{ color: 'var(--muted)' }}>New To-Do</span>
            )}
          </div>
        </div>
        
        <textarea
          ref={notesRef}
          name="notes"
          placeholder="Notes"
          defaultValue={editTask?.notes || ''}
          onChange={() => checkForChanges()}
          rows={3}
          style={{
            width: '100%',
            fontSize: 17,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--muted)',
            padding: '4px 0',
            lineHeight: 1.5,
            resize: 'vertical',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
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
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
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

      {/* Quick-add help */}
      {showHelp && (
        <div style={{
          padding: '16px 24px',
          background: 'var(--muted-light)',
          borderTop: '1px solid var(--border)',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--foreground)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick-add syntax</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>today</span> — due today</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>tomorrow</span> — due tomorrow</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>next week</span> — next Monday</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>next month</span> — 1st of next month</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>mon</span>, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>tue</span>, … — next occurrence</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>jan 15</span>, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>15 jan</span> — specific date</div>
            <div><span style={{ color: 'var(--accent)', fontWeight: 600 }}>someday</span>, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>future</span> — no due date</div>
            <div style={{ marginTop: 4 }}><span style={{ color: 'var(--purple)', fontWeight: 600 }}>@9am</span>, <span style={{ color: 'var(--purple)', fontWeight: 600 }}>@530</span>, <span style={{ color: 'var(--purple)', fontWeight: 600 }}>@2:30pm</span> — set time</div>
          </div>
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
            onClick={() => setShowHelp(!showHelp)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = showHelp ? 'var(--accent)' : 'var(--muted)';
            }}
            style={{
              width: 48,
              height: 48,
              fontSize: 18,
              fontWeight: 700,
              color: showHelp ? 'var(--accent)' : 'var(--muted)',
              background: 'none',
              border: showHelp ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              borderRadius: 0,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
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
