'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addWeeks, addMonths, addYears, format, startOfDay, subDays } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSettings } from '@/context/SettingsContext';
import { saveTasksToGist, loadTasksFromGist } from '@/services/gistSync';

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  getTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];
  getCompletedTasks: () => Task[];
  loadFromGist: (tasks: Task[]) => void;
  isLoaded: boolean;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

function getNextRecurrenceDate(currentDate: string, recurrenceType: RecurrenceType): string {
  const date = new Date(currentDate);
  switch (recurrenceType) {
    case 'daily':
      return addDays(date, 1).toISOString();
    case 'weekly':
      return addWeeks(date, 1).toISOString();
    case 'monthly':
      return addMonths(date, 1).toISOString();
    case 'yearly':
      return addYears(date, 1).toISOString();
    default:
      return currentDate;
  }
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('juice-tasks', []);
  const [isLoaded, setIsLoaded] = useState(false);
  const { gistSettings, isGistConfigured } = useSettings();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedRef = useRef<string>('');
  const hasLoadedFromGistRef = useRef(false);
  const isLoadingFromGistRef = useRef(false);
  const isSyncingToGistRef = useRef(false);
  const syncFromGistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to load from Gist (debounced to prevent overwriting new tasks)
  const syncFromGist = useCallback(async () => {
    if (!isGistConfigured || isSyncingToGistRef.current || isLoadingFromGistRef.current) return;
    
    // Debounce to prevent too frequent calls
    if (syncFromGistTimeoutRef.current) {
      clearTimeout(syncFromGistTimeoutRef.current);
    }
    
    syncFromGistTimeoutRef.current = setTimeout(async () => {
      // Double-check we're not syncing to Gist before proceeding
      if (isSyncingToGistRef.current) {
        return;
      }
      
      isLoadingFromGistRef.current = true;
      
      try {
        const gistTasks = await loadTasksFromGist(gistSettings);
        const gistTasksJson = JSON.stringify(gistTasks);
        
        // Only update if Gist has different data than what we last synced
        if (gistTasksJson !== lastSyncedRef.current) {
          // Clean up tasks older than 30 days before setting
          const thirtyDaysAgo = subDays(new Date(), 30);
          const cleanedTasks = gistTasks.filter((task) => {
            if (!task.completed || !task.completedAt) return true;
            return new Date(task.completedAt) > thirtyDaysAgo;
          });
          
          // Merge with current local tasks to preserve any unsynced local changes
          setTasks((currentLocalTasks) => {
            // Check again if we're syncing to Gist (race condition protection)
            if (isSyncingToGistRef.current) {
              // Don't overwrite if we're in the middle of syncing to Gist
              return currentLocalTasks;
            }
            
            const currentTasksJson = JSON.stringify(currentLocalTasks);
            
            // If local tasks match what we last synced, use Gist as source of truth
            if (currentTasksJson === lastSyncedRef.current) {
              lastSyncedRef.current = JSON.stringify(cleanedTasks);
              return cleanedTasks;
            }
            
            // Otherwise, merge: Gist tasks + local tasks that aren't in Gist
            // Prioritize local tasks that are newer (created more recently)
            const gistTaskIds = new Set(cleanedTasks.map(t => t.id));
            const mergedTasks = [...cleanedTasks];
            for (const localTask of currentLocalTasks) {
              if (gistTaskIds.has(localTask.id)) {
                // Task exists in both - check if local is newer
                const gistTask = cleanedTasks.find(t => t.id === localTask.id);
                if (gistTask && new Date(localTask.createdAt) > new Date(gistTask.createdAt)) {
                  // Local task is newer, replace the Gist version
                  const index = mergedTasks.findIndex(t => t.id === localTask.id);
                  if (index !== -1) {
                    mergedTasks[index] = localTask;
                  }
                }
              } else {
                // New local task not in Gist - add it
                mergedTasks.push(localTask);
              }
            }
            
            // Don't update lastSyncedRef yet since we have unsynced local changes
            return mergedTasks;
          });
          
          console.log('Synced tasks from Gist');
        }
      } catch (error) {
        console.error('Failed to sync from Gist:', error);
      } finally {
        isLoadingFromGistRef.current = false;
      }
    }, 2000); // 2 second debounce to allow local changes to sync first
  }, [isGistConfigured, gistSettings, setTasks]);

  // Load from Gist on mount if configured - always check on page load/refresh
  useEffect(() => {
    // Prevent multiple simultaneous loads
    if (isLoadingFromGistRef.current) return;
    
    const loadFromGistOnMount = async () => {
      if (!isGistConfigured) {
        // If Gist not configured, just use local storage
        setIsLoaded(true);
        hasLoadedFromGistRef.current = true; // Allow local saves to work
        return;
      }
      
      isLoadingFromGistRef.current = true;
      
      try {
        const gistTasks = await loadTasksFromGist(gistSettings);
        
        // Clean up tasks older than 30 days
        const thirtyDaysAgo = subDays(new Date(), 30);
        const cleanedTasks = gistTasks.filter((task) => {
          if (!task.completed || !task.completedAt) return true;
          return new Date(task.completedAt) > thirtyDaysAgo;
        });
        
        const gistTasksJson = JSON.stringify(cleanedTasks);
        
        // Use Gist as source of truth on load, but merge with any local tasks that were added before Gist loaded
        setTasks((currentLocalTasks) => {
          // Check if we're syncing to Gist (race condition protection)
          if (isSyncingToGistRef.current) {
            // Don't overwrite if we're in the middle of syncing to Gist
            return currentLocalTasks;
          }
          
          const currentTasksJson = JSON.stringify(currentLocalTasks);
          
          // If local tasks match what we last synced, use Gist as source of truth (refresh scenario)
          if (currentTasksJson === lastSyncedRef.current || lastSyncedRef.current === '') {
            lastSyncedRef.current = gistTasksJson;
            return cleanedTasks;
          }
          
          // Otherwise, merge: Gist tasks + local tasks that aren't in Gist (preserve unsynced local tasks)
          // Prioritize local tasks that are newer (created more recently)
          const gistTaskIds = new Set(cleanedTasks.map(t => t.id));
          const mergedTasks = [...cleanedTasks];
          
          for (const localTask of currentLocalTasks) {
            if (gistTaskIds.has(localTask.id)) {
              // Task exists in both - check if local is newer
              const gistTask = cleanedTasks.find(t => t.id === localTask.id);
              if (gistTask && new Date(localTask.createdAt) > new Date(gistTask.createdAt)) {
                // Local task is newer, replace the Gist version
                const index = mergedTasks.findIndex(t => t.id === localTask.id);
                if (index !== -1) {
                  mergedTasks[index] = localTask;
                }
              }
            } else {
              // New local task not in Gist - add it
              mergedTasks.push(localTask);
            }
          }
          
          // Don't update lastSyncedRef yet since we have unsynced local changes
          return mergedTasks;
        });
        
        console.log('Loaded tasks from Gist on mount');
        hasLoadedFromGistRef.current = true;
      } catch (error) {
        console.error('Failed to load from Gist on mount:', error);
        // Continue with local storage if Gist load fails, but still mark as loaded
        hasLoadedFromGistRef.current = true;
      } finally {
        isLoadingFromGistRef.current = false;
        setIsLoaded(true);
      }
    };

    loadFromGistOnMount();
  }, [isGistConfigured, gistSettings, setTasks]);

  // Removed automatic sync from Gist on focus/visibility - only sync on initial load and when manually triggered

  // Auto-sync to gist when tasks change (but not on initial load from Gist)
  useEffect(() => {
    if (!isLoaded || !isGistConfigured || !hasLoadedFromGistRef.current) return;
    
    const tasksJson = JSON.stringify(tasks);
    // Skip if nothing changed
    if (tasksJson === lastSyncedRef.current) return;
    
    // Skip if we're currently loading from Gist (to avoid race conditions)
    if (isLoadingFromGistRef.current) return;
    
    // Debounce the sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(async () => {
      // Double-check we're not loading from Gist before syncing
      if (isLoadingFromGistRef.current) {
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        if (isLoadingFromGistRef.current) {
          // Still loading, skip this sync - it will retry on next change
          return;
        }
      }
      
      isSyncingToGistRef.current = true;
      try {
        await saveTasksToGist(tasks, gistSettings);
        lastSyncedRef.current = tasksJson;
        console.log('Tasks synced to Gist');
      } catch (error) {
        console.error('Failed to sync to Gist:', error);
      } finally {
        isSyncingToGistRef.current = false;
      }
    }, 1000); // 1 second debounce
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [tasks, isLoaded, isGistConfigured, gistSettings]);

  const loadFromGist = useCallback((loadedTasks: Task[]) => {
    lastSyncedRef.current = JSON.stringify(loadedTasks);
    setTasks(loadedTasks);
  }, [setTasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null,
    };
    setTasks((prev) => [...prev, newTask]);
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [setTasks]);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const taskIndex = prev.findIndex((t) => t.id === id);
      if (taskIndex === -1) return prev;

      const task = prev[taskIndex];
      const updatedTasks = [...prev];
      
      // Mark current task as completed
      updatedTasks[taskIndex] = {
        ...task,
        completed: true,
        completedAt: new Date().toISOString(),
      };

      // If recurring, create a new task with next due date
      if (task.isRecurring && task.recurrenceType) {
        const newTask: Task = {
          id: uuidv4(),
          title: task.title,
          notes: task.notes,
          dueDate: getNextRecurrenceDate(task.dueDate, task.recurrenceType),
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          isRecurring: true,
          recurrenceType: task.recurrenceType,
          tags: task.tags,
        };
        updatedTasks.push(newTask);
      }

      return updatedTasks;
    });
  }, [setTasks]);

  const uncompleteTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, completed: false, completedAt: null }
          : task
      )
    );
  }, [setTasks]);

  const getTodayTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      const taskDate = format(new Date(task.dueDate), 'yyyy-MM-dd');
      return taskDate <= todayStr && !task.completed;
    });
  }, [tasks]);

  const getUpcomingTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      const taskDate = format(new Date(task.dueDate), 'yyyy-MM-dd');
      return taskDate > todayStr && !task.completed;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks]);

  // Get all completed tasks from the last 30 days
  const getCompletedTasks = useCallback(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    return tasks
      .filter((task) => task.completed && task.completedAt && new Date(task.completedAt) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }, [tasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        addTask,
        updateTask,
        deleteTask,
        completeTask,
        uncompleteTask,
        getTodayTasks,
        getUpcomingTasks,
        getCompletedTasks,
        loadFromGist,
        isLoaded,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
