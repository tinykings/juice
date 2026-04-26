'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addWeeks, addMonths, addYears, format, startOfDay } from 'date-fns';
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
  clearCompletedTasks: () => void;
  getTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];
  getCompletedTasks: () => Task[];
  loadFromGist: (tasks: Task[]) => void;
  syncFromGist: () => Promise<void>;
  isLoaded: boolean;
  isSyncing: boolean;
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

function cleanupCompletedTasksFromPreviousDays(taskList: Task[]): Task[] {
  const today = startOfDay(new Date());
  return taskList.filter((task) => {
    if (!task.completed || !task.completedAt) return true;
    return new Date(task.completedAt) >= today;
  });
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('juice-tasks', []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { gistSettings, isGistConfigured } = useSettings();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedRef = useRef<string>('');
  const hasLoadedFromGistRef = useRef(false);
  const isLoadingFromGistRef = useRef(false);
  const isSyncingToGistRef = useRef(false);
  const syncFromGistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousGistIdRef = useRef<string>('');
  const hasRunMountEffectRef = useRef(false);

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
          // Remove completed tasks from prior days before setting
          const cleanedTasks = cleanupCompletedTasksFromPreviousDays(gistTasks);
          
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

  // Load from Gist on mount if configured - only on initial mount or when Gist ID actually changes
  useEffect(() => {
    // Prevent multiple simultaneous loads
    if (isLoadingFromGistRef.current) return;
    
    // Get current Gist ID for comparison
    const currentGistId = gistSettings.gistId || '';
    
    // Only run if:
    // 1. This is the first time (hasRunMountEffectRef is false), OR
    // 2. The Gist ID actually changed (not just object reference)
    const shouldRun = !hasRunMountEffectRef.current || 
                     (previousGistIdRef.current !== currentGistId && currentGistId !== '');
    
    if (!shouldRun) {
      // If Gist not configured and we haven't loaded yet, mark as loaded
      if (!isGistConfigured && !hasLoadedFromGistRef.current) {
        setIsLoaded(true);
        hasLoadedFromGistRef.current = true;
      }
      return;
    }
    
    const loadFromGistOnMount = async () => {
      if (!isGistConfigured) {
        // If Gist not configured, just use local storage
        setIsLoaded(true);
        setIsSyncing(false);
        hasLoadedFromGistRef.current = true; // Allow local saves to work
        previousGistIdRef.current = '';
        hasRunMountEffectRef.current = true;
        return;
      }

      setIsSyncing(true);
      setIsLoaded(true); // Allow UI to render while Gist syncs in background
      
      // Check if this is a Gist ID change (settings update) vs initial mount
      const isGistIdChange = previousGistIdRef.current !== '' && 
                             previousGistIdRef.current !== currentGistId;
      
      // Update the previous Gist ID and mark that we've run
      previousGistIdRef.current = currentGistId;
      hasRunMountEffectRef.current = true;
      
      isLoadingFromGistRef.current = true;
      
      try {
        const gistTasks = await loadTasksFromGist(gistSettings);
        
        // Remove completed tasks from prior days
        const cleanedTasks = cleanupCompletedTasksFromPreviousDays(gistTasks);
        
        const gistTasksJson = JSON.stringify(cleanedTasks);
        
        // Use Gist as source of truth on load, but merge with any local tasks that were added before Gist loaded
        setTasks((currentLocalTasks) => {
          // Check if we're syncing to Gist (race condition protection)
          if (isSyncingToGistRef.current) {
            // Don't overwrite if we're in the middle of syncing to Gist
            return currentLocalTasks;
          }
          
          // On page refresh/load, always use Gist as source of truth to respect deletions from other devices
          // Only preserve local tasks that were created very recently (within last 5 seconds)
          // to handle the edge case where a task was just added before refresh
          // Exception: If this is a Gist ID change, we merge instead (handled below)
          if (!isGistIdChange) {
            const fiveSecondsAgo = new Date(Date.now() - 5000);
            const recentLocalTasks = currentLocalTasks.filter(task => {
              const createdAt = new Date(task.createdAt);
              return createdAt > fiveSecondsAgo;
            });
            
            // Use Gist as source of truth, but add any very recent local tasks
            const gistTaskIds = new Set(cleanedTasks.map(t => t.id));
            const finalTasks = [...cleanedTasks];
            
            for (const recentTask of recentLocalTasks) {
              if (!gistTaskIds.has(recentTask.id)) {
                // Very recent local task not in Gist - preserve it
                finalTasks.push(recentTask);
              }
            }
            
            console.log('Page refresh: using Gist as source of truth', cleanedTasks.length, 'tasks from Gist,', recentLocalTasks.length, 'recent local tasks preserved');
            lastSyncedRef.current = JSON.stringify(finalTasks);
            return finalTasks;
          }
          
          // If settings changed (Gist ID change), merge to preserve local tasks
          if (isGistIdChange) {
            console.log('Gist ID changed: merging to preserve local tasks', currentLocalTasks.length, 'local tasks');
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
            
            console.log('Merged tasks:', mergedTasks.length, 'total (', cleanedTasks.length, 'from Gist,', mergedTasks.length - cleanedTasks.length, 'local)');
            return mergedTasks;
          }
          
          // Fallback: shouldn't reach here, but use Gist as source of truth
          console.log('Fallback: using Gist as source of truth', cleanedTasks.length, 'tasks');
          lastSyncedRef.current = gistTasksJson;
          return cleanedTasks;
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
        setIsSyncing(false);
      }
    };

    loadFromGistOnMount();
  }, [isGistConfigured, gistSettings, setTasks]);


  // Auto-sync to gist when tasks change (but not on initial load from Gist)
  useEffect(() => {
    if (!isLoaded || !isGistConfigured || !hasLoadedFromGistRef.current) {
      console.log('Auto-sync skipped:', { isLoaded, isGistConfigured, hasLoadedFromGist: hasLoadedFromGistRef.current });
      return;
    }
    
    // Remove completed tasks from prior days before syncing
    const cleanedTasks = cleanupCompletedTasksFromPreviousDays(tasks);
    
    const tasksJson = JSON.stringify(cleanedTasks);
    // Skip if nothing changed
    if (tasksJson === lastSyncedRef.current) {
      console.log('Auto-sync skipped: no changes');
      return;
    }
    
    // Skip if we're currently loading from Gist (to avoid race conditions)
    if (isLoadingFromGistRef.current) {
      console.log('Auto-sync skipped: loading from Gist');
      return;
    }
    
    console.log('Auto-sync triggered:', cleanedTasks.length, 'tasks (after cleanup), syncing in 1 second...');
    
    // Debounce the sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Capture the cleaned tasks for the sync
    const tasksToSync = cleanedTasks;
    const tasksJsonToSync = tasksJson;
    
    syncTimeoutRef.current = setTimeout(async () => {
      // Double-check we're not loading from Gist before syncing
      if (isLoadingFromGistRef.current) {
        console.log('Auto-sync: waiting for Gist load to complete...');
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        if (isLoadingFromGistRef.current) {
          // Still loading, skip this sync - it will retry on next change
          console.log('Auto-sync: still loading, skipping');
          return;
        }
      }
      
      isSyncingToGistRef.current = true;
      try {
        console.log('Syncing', tasksToSync.length, 'tasks to Gist...');
        await saveTasksToGist(tasksToSync, gistSettings);
        lastSyncedRef.current = tasksJsonToSync;
        console.log('Tasks synced to Gist successfully');
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
    const cleanedTasks = cleanupCompletedTasksFromPreviousDays(loadedTasks);
    lastSyncedRef.current = JSON.stringify(cleanedTasks);
    setTasks(cleanedTasks);
  }, [setTasks]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null,
    };
    console.log('Adding new task:', newTask);
    
    setTasks((prev) => {
      // Clean up completed tasks from prior days when adding a new task
      const cleaned = cleanupCompletedTasksFromPreviousDays(prev);
      
      if (cleaned.length < prev.length) {
        console.log(`Cleaned up ${prev.length - cleaned.length} old completed tasks from prior days`);
      }
      
      const updated = [...cleaned, newTask];
      console.log('Tasks after adding:', updated.length, 'tasks');
      return updated;
    });
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    console.log('Deleting task:', id);
    setTasks((prev) => {
      const updated = prev.filter((task) => task.id !== id);
      console.log('Tasks after delete:', updated.length, 'tasks (was', prev.length, ')');
      return updated;
    });
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

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) => prev.filter((task) => !task.completed));
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

  // Get all completed tasks from today
  const getCompletedTasks = useCallback(() => {
    const today = startOfDay(new Date());
    return tasks
      .filter((task) => task.completed && task.completedAt && new Date(task.completedAt) >= today)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }, [tasks]);

  // Sync from Gist when app comes into focus and clean up completed tasks once the day changes
  useEffect(() => {
    const cleanupNow = () => {
      setTasks((currentTasks) => cleanupCompletedTasksFromPreviousDays(currentTasks));
      localStorage.setItem('juice-last-completed-cleanup', new Date().toISOString());
    };

    const scheduleMidnightCleanup = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = nextMidnight.getTime() - now.getTime();

      return window.setTimeout(() => {
        cleanupNow();
        timerRef.current = scheduleMidnightCleanup();
      }, delay);
    };

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        // Sync from Gist to get latest updates
        if (isGistConfigured) {
          syncFromGist();
        }

        // Clean up completed tasks from prior days
        const lastCleanup = localStorage.getItem('juice-last-completed-cleanup');
        const now = new Date();
        const today = startOfDay(now);

        const shouldCleanup = !lastCleanup || startOfDay(new Date(lastCleanup)) < today;
        
        if (shouldCleanup) {
          cleanupNow();
        }
      }
    };

    const timerRef = { current: 0 as number | ReturnType<typeof window.setTimeout> };
    timerRef.current = scheduleMidnightCleanup();

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isGistConfigured, syncFromGist, setTasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        addTask,
        updateTask,
        deleteTask,
        completeTask,
        uncompleteTask,
        clearCompletedTasks,
        getTodayTasks,
        getUpcomingTasks,
        getCompletedTasks,
        loadFromGist,
        syncFromGist,
        isLoaded,
        isSyncing,
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
