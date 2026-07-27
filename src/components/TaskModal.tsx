'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useTasks } from '@/context/TaskContext';
import CalendarPicker from './CalendarPicker';
import ConfirmCompleteDialog from './ConfirmCompleteDialog';
import { findDateWord, removeDateWord, DateWordMatch } from '@/utils/dateWords';
import { normalizeTaskDate } from '@/utils/taskDate';

export function TaskForm({ editTask, onClose, onSave, initialDate, inline = false, isClosing = false, captureUrlMode = false }: { editTask?: Task | null, onClose: () => void, onSave?: () => void, initialDate?: string | null, inline?: boolean, isClosing?: boolean, captureUrlMode?: boolean }) {
  const { addTask, addTaskFromCaptureUrl, updateTask, deleteTask } = useTasks();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const hasFocusedRef = useRef(false);

  const initialDueDate = editTask
    ? normalizeTaskDate(editTask.dueDate)
    : (initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  
  const [dueDate, setDueDate] = useState(initialDueDate);
  const initialTitle = editTask?.notes
    ? `${editTask.title}${editTask.title.trim().endsWith('.') ? '' : '.'} ${editTask.notes}`
    : editTask?.title || '';
  const [titleValue, setTitleValue] = useState(initialTitle);

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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [originalData] = useState(() => ({
    title: initialTitle,
    dueDate: initialDueDate,
    isRecurring: editTask?.isRecurring || false,
    recurrenceType: editTask?.recurrenceType || 'daily'
  }));

  const [isRecurring, setIsRecurring] = useState(() => editTask?.isRecurring ?? false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(() => editTask?.recurrenceType || 'daily');

  const hasChanges = useMemo(() => (
    titleValue !== originalData.title ||
    dueDate !== originalData.dueDate ||
    isRecurring !== originalData.isRecurring ||
    (isRecurring && recurrenceType !== originalData.recurrenceType)
  ), [dueDate, isRecurring, originalData, recurrenceType, titleValue]);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    let title = titleValue.trim();
    
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
      const taskData = {
        title,
        notes: '',
        dueDate: normalizeTaskDate(effectiveDueDate),
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        tags: [],
      };

      if (editTask) {
        updateTask(editTask.id, taskData);
      } else if (captureUrlMode) {
        await addTaskFromCaptureUrl(taskData);
      } else {
        addTask(taskData);
      }
    } else {
      const taskData = {
        title,
        notes: '',
        dueDate: '',
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        tags: [],
      };

      if (editTask) {
        updateTask(editTask.id, taskData);
      } else if (captureUrlMode) {
        await addTaskFromCaptureUrl(taskData);
      } else {
        addTask(taskData);
      }
    }

    onClose();
    if (onSave) onSave();
  }, [addTask, addTaskFromCaptureUrl, captureUrlMode, dueDate, editTask, isRecurring, onClose, onSave, recurrenceType, updateTask, titleValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && editTask && hasChanges) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    if (!inline) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!inline) {
        document.body.style.overflow = '';
      }
    };
  }, [editTask, handleSubmit, hasChanges, inline, onClose]);

  const handleDelete = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    if (editTask) {
      deleteTask(editTask.id);
      onClose();
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
    <form
      onSubmit={handleSubmit}
      data-task-inline-form={inline ? 'true' : undefined}
      style={inline ? {
        width: '100%',
        alignSelf: 'stretch',
        background: 'var(--task-surface)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 0 0 1px rgba(215, 169, 58, 0.06)',
        overflow: 'hidden',
        transformOrigin: 'top',
        animation: isClosing
          ? 'inlineTaskClose 180ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : 'inlineTaskOpen 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
      } : undefined}
    >
      {/* Inputs */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
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
                fontSize: 19,
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.035)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                color: 'var(--foreground)',
                caretColor: 'var(--foreground)',
                padding: '10px 12px',
                lineHeight: 1.4,
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                resize: 'none',
                overflow: 'hidden',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-border)';
                e.target.style.background = 'rgba(255, 255, 255, 0.045)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.background = 'rgba(255, 255, 255, 0.035)';
              }}
            />
            <div aria-hidden="true" style={{
              position: 'absolute',
              inset: 0,
              padding: '10px 12px',
              pointerEvents: 'none',
              fontSize: 19,
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
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <CalendarPicker value={dueDate} onChange={setDueDate} />

        <button
          type="button"
          onClick={() => {
            const nextIsRecurring = !isRecurring;
            setIsRecurring(nextIsRecurring);
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
            padding: '0 14px',
            background: isRecurring ? 'var(--accent-surface)' : 'rgba(255, 255, 255, 0.035)',
            color: isRecurring ? 'var(--accent)' : 'var(--muted)',
            border: isRecurring ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            cursor: 'pointer',
            height: 42,
            fontWeight: 500,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s'
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
          padding: '0 16px 14px', 
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
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: recurrenceType === type ? 'var(--foreground)' : 'var(--background)',
                color: recurrenceType === type ? 'var(--background)' : 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                height: 40,
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
          padding: '14px 16px',
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
            <div><span style={{ color: 'var(--muted)', fontWeight: 600 }}>.</span> text after a period becomes a note</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
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
              width: 42,
              height: 42,
              fontSize: 14,
              fontWeight: 700,
              color: showHelp ? 'var(--accent)' : 'var(--muted)',
              background: showHelp ? 'var(--accent-surface)' : 'rgba(255, 255, 255, 0.035)',
              border: showHelp ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
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
              aria-expanded={isConfirmingDelete}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              style={{
                padding: '0 16px',
                fontSize: 14,
                color: 'var(--red)',
                background: 'rgba(255, 107, 107, 0.06)',
                border: '1px solid rgba(255, 107, 107, 0.2)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                height: 42,
                fontWeight: 500,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              Delete
            </button>
          )}
        </div>
        {editTask ? (
          <button
            type="button"
            onClick={handleSubmit}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-surface)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            style={{
              padding: '0 20px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--background)',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              height: 42,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            Save
          </button>
        ) : (
          <button
            type="submit"
            style={{
              padding: '0 20px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--background)',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              height: 42,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
          >
            Add
          </button>
        )}
      </div>
      {editTask && isConfirmingDelete && (
        <ConfirmCompleteDialog
          task={editTask}
          title="Are you sure?"
          message="This task will be deleted."
          confirmLabel="Delete"
          confirmTone="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </form>
  );
}
