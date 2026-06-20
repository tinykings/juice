'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMonths, addWeeks, addYears, format, startOfDay } from 'date-fns';
import { Task, RecurrenceType } from '@/types/task';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSettings } from '@/context/SettingsContext';
import {
  createSyncDocument,
  loadSyncDocumentFromGist,
  mergeSyncDocuments,
  saveSyncDocumentToGist,
  syncDocumentContentKey,
  syncDocumentContentEquals,
  SyncDocument,
  TaskTombstone,
} from '@/services/gistSync';

const DEV = process.env.NODE_ENV !== 'production';
const LAST_SYNC_DOCUMENT_KEY = 'juice-last-sync-document';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict';
type TombstoneMap = Record<string, TaskTombstone>;

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'conflictOf' | 'completed' | 'completedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  getTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];
  getCompletedTasks: () => Task[];
  loadFromGist: (tasks: Task[]) => void;
  syncFromGist: () => Promise<void>;
  isLoaded: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
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
    if (task.deletedAt) return false;
    if (!task.completed || !task.completedAt) return true;
    return new Date(task.completedAt) >= today;
  });
}

function normalizeTask(task: Task, fallbackTime = new Date().toISOString()): Task {
  return {
    ...task,
    notes: task.notes ?? '',
    tags: task.tags ?? [],
    completedAt: task.completedAt ?? null,
    updatedAt: task.updatedAt ?? task.createdAt ?? fallbackTime,
    deletedAt: task.deletedAt ?? null,
  };
}

function tombstonesFromMap(map: TombstoneMap): TaskTombstone[] {
  return Object.values(map);
}

function mapFromTombstones(tombstones: TaskTombstone[]): TombstoneMap {
  return Object.fromEntries(tombstones.map((tombstone) => [tombstone.id, tombstone]));
}

function loadLastSyncDocument(): SyncDocument | null {
  if (typeof window === 'undefined') return null;

  try {
    const item = window.localStorage.getItem(LAST_SYNC_DOCUMENT_KEY);
    return item ? (JSON.parse(item) as SyncDocument) : null;
  } catch (error) {
    console.error('Error reading last sync document:', error);
    return null;
  }
}

function saveLastSyncDocument(document: SyncDocument) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_SYNC_DOCUMENT_KEY, JSON.stringify(document));
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('juice-tasks', []);
  const [tombstones, setTombstones] = useLocalStorage<TombstoneMap>('juice-task-tombstones', {});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const { gistSettings, isGistConfigured } = useSettings();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baseSyncDocumentRef = useRef<SyncDocument | null>(null);
  const isSyncingRef = useRef(false);
  const isApplyingSyncRef = useRef(false);
  const performSyncRef = useRef<() => Promise<void>>(async () => {});
  const lastSyncedContentKeyRef = useRef<string | null>(null);
  const tasksRef = useRef(tasks);
  const tombstonesRef = useRef(tombstones);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    tombstonesRef.current = tombstones;
  }, [tombstones]);

  const buildLocalDocument = useCallback((taskList = tasks, tombstoneMap = tombstones) => {
    return createSyncDocument(
      cleanupCompletedTasksFromPreviousDays(taskList).map((task) => normalizeTask(task)),
      tombstonesFromMap(tombstoneMap)
    );
  }, [tasks, tombstones]);

  const applySyncedDocument = useCallback((document: SyncDocument) => {
    isApplyingSyncRef.current = true;

    const currentDocument = createSyncDocument(tasksRef.current, tombstonesFromMap(tombstonesRef.current), document.updatedAt);
    if (!syncDocumentContentEquals(currentDocument, document)) {
      setTasks(cleanupCompletedTasksFromPreviousDays(document.tasks).map((task) => normalizeTask(task)));
      setTombstones(mapFromTombstones(document.tombstones));
    }

    baseSyncDocumentRef.current = document;
    lastSyncedContentKeyRef.current = syncDocumentContentKey(document);
    saveLastSyncDocument(document);
    setLastSyncedAt(document.updatedAt);
    window.setTimeout(() => {
      isApplyingSyncRef.current = false;
    }, 0);
  }, [setTasks, setTombstones]);

  const performSync = useCallback(async () => {
    if (!isGistConfigured || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const remoteDocument = await loadSyncDocumentFromGist(gistSettings);
      const localDocument = buildLocalDocument();
      const baseDocument = baseSyncDocumentRef.current ?? loadLastSyncDocument();
      const merged = mergeSyncDocuments(localDocument, remoteDocument, baseDocument);
      const mergedDocument = createSyncDocument(merged.tasks, merged.tombstones, remoteDocument.updatedAt);
      const shouldSave = !syncDocumentContentEquals(mergedDocument, remoteDocument);
      const syncedDocument = shouldSave
        ? createSyncDocument(merged.tasks, merged.tombstones)
        : remoteDocument;

      if (shouldSave) {
        await saveSyncDocumentToGist(syncedDocument, gistSettings);
      }

      applySyncedDocument(syncedDocument);
      setSyncStatus(merged.conflicts.length > 0 ? 'conflict' : 'idle');
      if (DEV && merged.conflicts.length > 0) {
        console.log('Sync preserved conflicts:', merged.conflicts.length);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync tasks';
      console.error('Failed to sync tasks:', error);
      setSyncStatus('error');
      setSyncError(message);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [applySyncedDocument, buildLocalDocument, gistSettings, isGistConfigured]);

  const syncFromGist = useCallback(async () => {
    await performSync();
  }, [performSync]);

  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  useEffect(() => {
    const lastSyncDocument = loadLastSyncDocument();
    baseSyncDocumentRef.current = lastSyncDocument;
    lastSyncedContentKeyRef.current = lastSyncDocument
      ? syncDocumentContentKey(lastSyncDocument)
      : null;

    if (!isGistConfigured) {
      setIsLoaded(true);
      return;
    }

    setIsLoaded(true);
    void performSyncRef.current();
  }, [isGistConfigured, gistSettings.gistId, gistSettings.githubToken]);

  useEffect(() => {
    if (!isLoaded || !isGistConfigured || isApplyingSyncRef.current) return;

    const localDocument = createSyncDocument(tasks, tombstonesFromMap(tombstones));
    if (syncDocumentContentKey(localDocument) === lastSyncedContentKeyRef.current) {
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      void performSync();
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [tasks, tombstones, isLoaded, isGistConfigured, performSync]);

  const loadFromGist = useCallback((loadedTasks: Task[]) => {
    const document = createSyncDocument(cleanupCompletedTasksFromPreviousDays(loadedTasks));
    applySyncedDocument(document);
  }, [applySyncedDocument]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'conflictOf' | 'completed' | 'completedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      completed: false,
      completedAt: null,
      deletedAt: null,
    };

    setTasks((prev) => [...cleanupCompletedTasksFromPreviousDays(prev), newTask]);
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) => (
        task.id === id
          ? normalizeTask({ ...task, ...updates, updatedAt: now })
          : task
      ))
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTombstones((prev) => ({
      ...prev,
      [id]: { id, deletedAt: now, updatedAt: now },
    }));
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, [setTasks, setTombstones]);

  const completeTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTasks((prev) => {
      const taskIndex = prev.findIndex((task) => task.id === id);
      if (taskIndex === -1) return prev;

      const task = prev[taskIndex];
      const updatedTasks = [...prev];

      updatedTasks[taskIndex] = normalizeTask({
        ...task,
        completed: true,
        completedAt: now,
        updatedAt: now,
      });

      if (task.isRecurring && task.recurrenceType) {
        updatedTasks.push({
          id: uuidv4(),
          title: task.title,
          notes: '',
          dueDate: getNextRecurrenceDate(task.dueDate, task.recurrenceType),
          completed: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          isRecurring: true,
          recurrenceType: task.recurrenceType,
          tags: task.tags,
        });
      }

      return updatedTasks;
    });
  }, [setTasks]);

  const uncompleteTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? normalizeTask({ ...task, completed: false, completedAt: null, updatedAt: now })
          : task
      )
    );
  }, [setTasks]);

  const getTodayTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      if (task.deletedAt || !task.dueDate) return false;
      const taskDate = format(new Date(task.dueDate), 'yyyy-MM-dd');
      return taskDate <= todayStr && !task.completed;
    });
  }, [tasks]);

  const getUpcomingTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      if (task.deletedAt || !task.dueDate) return false;
      const taskDate = format(new Date(task.dueDate), 'yyyy-MM-dd');
      return taskDate > todayStr && !task.completed;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks]);

  const getCompletedTasks = useCallback(() => {
    const today = startOfDay(new Date());
    return tasks
      .filter((task) => !task.deletedAt && task.completed && task.completedAt && new Date(task.completedAt) >= today)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }, [tasks]);

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
      if (document.visibilityState !== 'visible') return;

      if (isGistConfigured) {
        void syncFromGist();
      }

      const lastCleanup = localStorage.getItem('juice-last-completed-cleanup');
      const now = new Date();
      const today = startOfDay(now);
      const shouldCleanup = !lastCleanup || startOfDay(new Date(lastCleanup)) < today;

      if (shouldCleanup) {
        cleanupNow();
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
        tasks: tasks.filter((task) => !task.deletedAt),
        addTask,
        updateTask,
        deleteTask,
        completeTask,
        uncompleteTask,
        getTodayTasks,
        getUpcomingTasks,
        getCompletedTasks,
        loadFromGist,
        syncFromGist,
        isLoaded,
        isSyncing,
        syncStatus,
        syncError,
        lastSyncedAt,
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
