'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, addDays, isSameDay, isAfter, endOfDay, startOfDay } from 'date-fns';
import { useTasks } from '@/context/TaskContext';
import { Task } from '@/types/task';
import TaskModal from '@/components/TaskModal';
import TaskItem from '@/components/TaskItem';

export default function UpcomingPage() {
  const { getUpcomingTasks, completeTask, deleteTask, isLoaded } = useTasks();
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
        // Sort alphabetically by title
        const sortedDayTasks = [...dayTasks].sort((a, b) => 
          a.title.localeCompare(b.title)
        );
        groups.push({
          label: format(date, 'EEEE (M/d)'),
          tasks: sortedDayTasks,
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
      // Sort by due date
      const sortedMonthTasks = [...monthTasks].sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      groups.push({ label: month, tasks: sortedMonthTasks });
    });

    return groups;
  }, [tasks, today]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', transition: 'background 0.2s' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', textDecoration: 'none' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>Upcoming</h1>
          </div>
        </div>
      </header>

      <main style={{ padding: '24px 20px 96px' }}>
        {isLoaded && (
          <div>
            {groupedTasks.map((group, index) => (
              <section 
                key={group.label} 
                style={{ 
                  marginBottom: 32,
                  animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  opacity: 0,
                  transform: 'translateY(10px)',
                  animationDelay: `${index * 100}ms`
                }}
              >
                <h2 style={{ 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: 'var(--muted)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  marginBottom: 12,
                  fontFamily: 'var(--font-display)'
                }}>
                  {group.label}
                </h2>
                <div style={{ borderTop: '2px solid var(--border)' }}>
                  {group.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={() => completeTask(task.id)}
                      onEdit={() => { setEditingTask(task); setIsModalOpen(true); }}
                      onDelete={() => deleteTask(task.id)}
                      showDate={true}
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

      <TaskModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} editTask={editingTask} />
    </div>
  );
}