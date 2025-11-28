'use client';

import { useMemo } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { useTheme } from '@/context/ThemeContext';
import { Task } from '@/types/task';

export default function CompletedPage() {
  const { getCompletedTasks, deleteTask, isLoaded } = useTasks();
  const { theme, toggleTheme } = useTheme();
  const tasks = getCompletedTasks();

  const groupedTasks = useMemo(() => {
    const groups: { label: string; tasks: Task[] }[] = [];
    
    const todayTasks = tasks.filter((t) => isToday(new Date(t.completedAt!)));
    const yesterdayTasks = tasks.filter((t) => isYesterday(new Date(t.completedAt!)));
    const thisWeekTasks = tasks.filter((t) => {
      const date = new Date(t.completedAt!);
      return isThisWeek(date) && !isToday(date) && !isYesterday(date);
    });
    const thisMonthTasks = tasks.filter((t) => {
      const date = new Date(t.completedAt!);
      return isThisMonth(date) && !isThisWeek(date);
    });
    const olderTasks = tasks.filter((t) => !isThisMonth(new Date(t.completedAt!)));

    if (todayTasks.length) groups.push({ label: 'Today', tasks: todayTasks });
    if (yesterdayTasks.length) groups.push({ label: 'Yesterday', tasks: yesterdayTasks });
    if (thisWeekTasks.length) groups.push({ label: 'This Week', tasks: thisWeekTasks });
    if (thisMonthTasks.length) groups.push({ label: 'This Month', tasks: thisMonthTasks });
    if (olderTasks.length) groups.push({ label: 'Older', tasks: olderTasks });

    return groups;
  }, [tasks]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)', padding: '16px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', textDecoration: 'none' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div style={{ width: 48, height: 4, background: 'var(--muted-light)', borderRadius: 2 }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 24 }}>
          <svg width="28" height="28" fill="none" stroke="var(--green)" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Logbook</h1>
        </div>

        {isLoaded && (
          <div>
            {groupedTasks.map((group) => (
              <section key={group.label} style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  {group.label}
                </h2>
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {group.tasks.map((task) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <svg width="12" height="12" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" /></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 16, color: 'var(--muted)', textDecoration: 'line-through' }}>{task.title}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{format(new Date(task.completedAt!), 'MMM d, h:mm a')}</p>
                      </div>
                      <button onClick={() => deleteTask(task.id)} style={{ padding: 4, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ color: 'var(--muted)' }}>No completed tasks yet</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
