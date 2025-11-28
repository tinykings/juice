'use client';

import { useState, useMemo } from 'react';
import { format, addDays, isSameDay, isAfter, endOfDay, startOfDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useTheme } from '@/context/ThemeContext';
import { Task } from '@/types/task';
import TaskModal from '@/components/TaskModal';

export default function UpcomingPage() {
  const { getUpcomingTasks, completeTask, isLoaded } = useTasks();
  const { theme, toggleTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const tasks = getUpcomingTasks();
  const today = startOfDay(new Date());

  const groupedTasks = useMemo(() => {
    const groups: { label: string; tasks: Task[] }[] = [];
    const weekEnd = endOfDay(addDays(today, 7));

    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dayTasks = tasks.filter((task) => isSameDay(new Date(task.dueDate), date));
      if (dayTasks.length > 0) {
        groups.push({
          label: i === 1 ? 'Tomorrow' : format(date, 'EEEE'),
          tasks: dayTasks,
        });
      }
    }

    const futureTasks = tasks.filter((task) => isAfter(new Date(task.dueDate), weekEnd));
    const monthGroups: { [key: string]: Task[] } = {};
    
    futureTasks.forEach((task) => {
      const monthKey = format(new Date(task.dueDate), 'MMMM yyyy');
      if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
      monthGroups[monthKey].push(task);
    });

    Object.entries(monthGroups).forEach(([month, monthTasks]) => {
      groups.push({ label: month, tasks: monthTasks });
    });

    return groups;
  }, [tasks, today]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', textDecoration: 'none' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Upcoming</h1>
          </div>
          <button onClick={toggleTheme} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {theme === 'dark' ? (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
            ) : (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
          </button>
        </div>
      </header>

      <main style={{ padding: '0 20px 96px' }}>
        {isLoaded && (
          <div>
            {groupedTasks.map((group) => (
              <section key={group.label} style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  {group.label}
                </h2>
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => completeTask(task.id)}
                      onEdit={() => { setEditingTask(task); setIsModalOpen(true); }}
                    />
                  ))}
                </div>
              </section>
            ))}
            
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ color: 'var(--muted)' }}>No upcoming tasks</p>
              </div>
            )}
          </div>
        )}
      </main>

      <button onClick={() => setIsModalOpen(true)} style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: 'none', cursor: 'pointer', zIndex: 20 }}>
        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      <TaskModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} editTask={editingTask} />
    </div>
  );
}

function TaskRow({ task, onComplete, onEdit }: { task: Task; onComplete: () => void; onEdit: () => void }) {
  const [isCompleting, setIsCompleting] = useState(false);
  const taskDate = new Date(task.dueDate);

  return (
    <div onClick={onEdit} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', opacity: isCompleting ? 0.3 : 1, cursor: 'pointer' }}>
      <button onClick={(e) => { e.stopPropagation(); setIsCompleting(true); setTimeout(onComplete, 300); }} style={{ flexShrink: 0, marginTop: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: isCompleting ? 'none' : '2px solid var(--muted-light)', background: isCompleting ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isCompleting && <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" /></svg>}
        </div>
      </button>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 16, textDecoration: isCompleting ? 'line-through' : 'none', color: isCompleting ? 'var(--muted)' : 'var(--foreground)' }}>{task.title}</p>
        {task.notes && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>{task.notes}</p>}
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{format(taskDate, 'MMM d')}</span>
    </div>
  );
}
