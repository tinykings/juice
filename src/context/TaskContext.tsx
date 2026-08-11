'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfDay } from 'date-fns';
import { Task } from '@/types/task';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSettings } from '@/context/SettingsContext';
import {
  createSyncDocument,
  GistChangedDuringSyncError,
  loadSyncSnapshotFromGist,
  mergeSyncDocuments,
  saveSyncDocumentToGist,
  syncDocumentContentKey,
  syncDocumentContentEquals,
  SyncDocument,
  TaskTombstone,
} from '@/services/gistSync';
import { normalizeTaskDate } from '@/utils/taskDate';
import { getNextRecurrenceDate } from '@/utils/taskRecurrence';

const DEV = process.env.NODE_ENV !== 'production';
const LAST_SYNC_DOCUMENT_KEY = 'juice-last-sync-document';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict';
type TombstoneMap = Record<string, TaskTombstone>;
type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'conflictOf' | 'completed' | 'completedAt'>;

interface TaskContextType {
  tasks: Task[];
  addTask: (task: TaskInput) => void;
  addTaskFromCaptureUrl: (task: TaskInput) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  getTodayTasks: () => Task[];
  getUpcomingTasks: () => Task[];
  getCompletedTasks: () => Task[];
  syncFromGist: () => Promise<void>;
  isLoaded: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

function cleanupCompletedTasksFromPreviousDays(taskList: Task[]): Task[] {
  const today = startOfDay(new Date());
  return taskList.filter((task) => {
    if (task.deletedAt) return false;
    if (!task.completed || !task.completedAt) return true;
    return new Date(task.completedAt) >= today;
  });
}

function createDocumentWithCompletedCleanup(
  taskList: Task[],
  tombstones: TaskTombstone[] = [],
  updatedAt = new Date().toISOString()
): SyncDocument {
  const today = startOfDay(new Date());
  const cleanupAt = new Date().toISOString();
  const tombstonesById = new Map(tombstones.map((tombstone) => [tombstone.id, tombstone]));

  for (const task of taskList) {
    if (!task.completed || !task.completedAt || new Date(task.completedAt) >= today) continue;

    const existing = tombstonesById.get(task.id);
    if (!existing || new Date(existing.updatedAt) < new Date(cleanupAt)) {
      tombstonesById.set(task.id, {
        id: task.id,
        deletedAt: cleanupAt,
        updatedAt: cleanupAt,
      });
    }
  }

  return createSyncDocument(
    cleanupCompletedTasksFromPreviousDays(taskList),
    Array.from(tombstonesById.values()),
    updatedAt
  );
}

function normalizeTask(task: Task, fallbackTime = new Date().toISOString()): Task {
  const pinned = Boolean(task.pinned);
  return {
    ...task,
    notes: task.notes ?? '',
    tags: task.tags ?? [],
    pinned,
    dueDate: pinned ? '' : normalizeTaskDate(task.dueDate),
    completedAt: task.completedAt ?? null,
    updatedAt: task.updatedAt ?? task.createdAt ?? fallbackTime,
    deletedAt: task.deletedAt ?? null,
    isRecurring: pinned ? false : Boolean(task.isRecurring),
    recurrenceType: pinned ? null : (task.recurrenceType ?? null),
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

function isCaptureUrl() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return Array.from(params.keys()).some((key) => key.toLowerCase() === 'newtask');
}

function createTaskFromInput(taskData: TaskInput): Task {
  const now = new Date().toISOString();
  return {
    ...taskData,
    dueDate: normalizeTaskDate(taskData.dueDate),
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    completed: false,
    completedAt: null,
    deletedAt: null,
  };
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
  const hasPendingLocalSyncRef = useRef(false);
  const localChangeVersionRef = useRef(0);
  const isCaptureUrlRef = useRef(isCaptureUrl());
  const tasksRef = useRef(tasks);
  const tombstonesRef = useRef(tombstones);
  const syncContentionRetriesRef = useRef(0);
  const syncFailureRetriesRef = useRef(0);
  const syncRetryTimeoutRef = useRef<number | null>(null);
  const hasMigratedTaskDatesRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    tombstonesRef.current = tombstones;
  }, [tombstones]);

  const updateTasksState = useCallback((updater: (current: Task[]) => Task[]) => {
    const next = updater(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, [setTasks]);

  const updateTombstonesState = useCallback((updater: (current: TombstoneMap) => TombstoneMap) => {
    const next = updater(tombstonesRef.current);
    tombstonesRef.current = next;
    setTombstones(next);
  }, [setTombstones]);

  const buildLocalDocument = useCallback((taskList = tasksRef.current, tombstoneMap = tombstonesRef.current) => {
    return createDocumentWithCompletedCleanup(
      taskList.map((task) => normalizeTask(task)),
      tombstonesFromMap(tombstoneMap)
    );
  }, []);

  const markLocalChange = useCallback(() => {
    hasPendingLocalSyncRef.current = true;
    localChangeVersionRef.current += 1;
  }, []);

  useEffect(() => {
    if (hasMigratedTaskDatesRef.current) return;
    hasMigratedTaskDatesRef.current = true;

    const currentTasks = tasksRef.current;
    const migratedTasks = currentTasks.map((task) => normalizeTask(task));
    if (migratedTasks.some((task, index) => (
      task.dueDate !== currentTasks[index].dueDate ||
      task.pinned !== currentTasks[index].pinned ||
      task.isRecurring !== currentTasks[index].isRecurring ||
      task.recurrenceType !== currentTasks[index].recurrenceType
    ))) {
      markLocalChange();
      updateTasksState(() => migratedTasks);
    }
  }, [markLocalChange, updateTasksState]);

  const replaceLocalDocument = useCallback((document: SyncDocument) => {
    isApplyingSyncRef.current = true;

    const cleanedDocument = createDocumentWithCompletedCleanup(
      document.tasks,
      document.tombstones,
      document.updatedAt
    );
    const currentDocument = createSyncDocument(tasksRef.current, tombstonesFromMap(tombstonesRef.current), cleanedDocument.updatedAt);
    if (!syncDocumentContentEquals(currentDocument, cleanedDocument)) {
      const nextTasks = cleanedDocument.tasks.map((task) => normalizeTask(task));
      const nextTombstones = mapFromTombstones(cleanedDocument.tombstones);
      // Keep the refs current immediately so a queued sync does not have to wait
      // for React's effects before taking its next local snapshot.
      tasksRef.current = nextTasks;
      tombstonesRef.current = nextTombstones;
      setTasks(nextTasks);
      setTombstones(nextTombstones);
    }

    window.setTimeout(() => {
      isApplyingSyncRef.current = false;
    }, 0);
  }, [setTasks, setTombstones]);

  const recordSyncedDocument = useCallback((document: SyncDocument) => {
    const cleanedDocument = createDocumentWithCompletedCleanup(
      document.tasks,
      document.tombstones,
      document.updatedAt
    );
    baseSyncDocumentRef.current = cleanedDocument;
    lastSyncedContentKeyRef.current = syncDocumentContentKey(cleanedDocument);
    saveLastSyncDocument(cleanedDocument);
    setLastSyncedAt(cleanedDocument.updatedAt);
  }, []);

  const applySyncedDocument = useCallback((document: SyncDocument) => {
    replaceLocalDocument(document);
    recordSyncedDocument(document);
  }, [recordSyncedDocument, replaceLocalDocument]);

  const performSync = useCallback(async () => {
    if (!isGistConfigured || isSyncingRef.current) return;

    let shouldRunAgain = false;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const remoteSnapshot = await loadSyncSnapshotFromGist(gistSettings);
      const loadedRemoteDocument = remoteSnapshot.document;
      const remoteDocument = createDocumentWithCompletedCleanup(
        loadedRemoteDocument.tasks,
        loadedRemoteDocument.tombstones,
        loadedRemoteDocument.updatedAt
      );
      const localDocument = buildLocalDocument();
      const localChangeVersion = localChangeVersionRef.current;
      const baseDocument = baseSyncDocumentRef.current ?? loadLastSyncDocument();
      const merged = mergeSyncDocuments(localDocument, remoteDocument, baseDocument);
      const mergedDocument = createSyncDocument(merged.tasks, merged.tombstones, remoteDocument.updatedAt);
      const shouldSave = !syncDocumentContentEquals(mergedDocument, remoteDocument);
      const syncedDocument = shouldSave
        ? createSyncDocument(merged.tasks, merged.tombstones)
        : remoteDocument;

      if (shouldSave) {
        await saveSyncDocumentToGist(syncedDocument, gistSettings, remoteSnapshot.etag);
        // GitHub exposes weak ETags for Gists, which cannot be used with
        // If-Match. Verify the write in that case and re-merge if another
        // client changed the Gist before our verification read.
        if (!remoteSnapshot.etag) {
          const verification = await loadSyncSnapshotFromGist(gistSettings);
          if (!syncDocumentContentEquals(verification.document, syncedDocument)) {
            throw new GistChangedDuringSyncError();
          }
        }
      }

      let conflictCount = merged.conflicts.length;
      if (localChangeVersionRef.current === localChangeVersion) {
        applySyncedDocument(syncedDocument);
        hasPendingLocalSyncRef.current = false;
      } else {
        // A local edit landed while the request was in flight. Rebase that edit
        // onto the result we just saved instead of replacing it with the older
        // snapshot, then queue another sync to persist it.
        const latestLocalDocument = buildLocalDocument();
        const rebased = mergeSyncDocuments(latestLocalDocument, syncedDocument, localDocument);
        const rebasedDocument = createSyncDocument(
          rebased.tasks,
          rebased.tombstones,
          syncedDocument.updatedAt
        );
        replaceLocalDocument(rebasedDocument);
        recordSyncedDocument(syncedDocument);
        hasPendingLocalSyncRef.current = true;
        shouldRunAgain = true;
        conflictCount += rebased.conflicts.length;
      }

      syncContentionRetriesRef.current = 0;
      syncFailureRetriesRef.current = 0;
      if (syncRetryTimeoutRef.current) {
        window.clearTimeout(syncRetryTimeoutRef.current);
        syncRetryTimeoutRef.current = null;
      }
      setSyncStatus(conflictCount > 0 ? 'conflict' : 'idle');
      if (DEV && conflictCount > 0) {
        console.log('Sync preserved conflicts:', conflictCount);
      }
    } catch (error) {
      if (error instanceof GistChangedDuringSyncError && syncContentionRetriesRef.current < 3) {
        syncContentionRetriesRef.current += 1;
        shouldRunAgain = true;
      } else {
        syncContentionRetriesRef.current = 0;
        const message = error instanceof Error ? error.message : 'Failed to sync tasks';
        console.error('Failed to sync tasks:', error);
        setSyncStatus('error');
        setSyncError(message);

        if (syncFailureRetriesRef.current < 5) {
          const delay = Math.min(30_000, 2 ** syncFailureRetriesRef.current * 2_000);
          syncFailureRetriesRef.current += 1;
          if (syncRetryTimeoutRef.current) {
            window.clearTimeout(syncRetryTimeoutRef.current);
          }
          syncRetryTimeoutRef.current = window.setTimeout(() => {
            syncRetryTimeoutRef.current = null;
            void performSyncRef.current();
          }, delay);
        }
      }
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      if (shouldRunAgain) {
        window.setTimeout(() => {
          void performSyncRef.current();
        }, 50);
      }
    }
  }, [applySyncedDocument, buildLocalDocument, gistSettings, isGistConfigured, recordSyncedDocument, replaceLocalDocument]);

  const syncFromGist = useCallback(async () => {
    syncFailureRetriesRef.current = 0;
    if (syncRetryTimeoutRef.current) {
      window.clearTimeout(syncRetryTimeoutRef.current);
      syncRetryTimeoutRef.current = null;
    }
    await performSync();
  }, [performSync]);

  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  useEffect(() => () => {
    if (syncRetryTimeoutRef.current) {
      window.clearTimeout(syncRetryTimeoutRef.current);
    }
  }, []);

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
    if (isCaptureUrlRef.current) return;

    // Always merge on startup. A previous sync may have failed before a reload,
    // leaving local changes that are newer than the last successful sync base.
    void performSyncRef.current();
  }, [isGistConfigured, gistSettings.gistId, gistSettings.githubToken]);

  useEffect(() => {
    if (!isLoaded || !isGistConfigured || isApplyingSyncRef.current) return;
    if (isCaptureUrlRef.current) return;

    if (!hasPendingLocalSyncRef.current) return;

    const localDocument = createSyncDocument(tasks, tombstonesFromMap(tombstones));
    if (syncDocumentContentKey(localDocument) === lastSyncedContentKeyRef.current) {
      hasPendingLocalSyncRef.current = false;
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

  const addTask = useCallback((taskData: TaskInput) => {
    markLocalChange();
    const newTask = createTaskFromInput(taskData);

    updateTasksState((prev) => [...prev, newTask]);
  }, [markLocalChange, updateTasksState]);

  const addTaskFromCaptureUrl = useCallback(async (taskData: TaskInput) => {
    const newTask = createTaskFromInput(taskData);

    if (!isGistConfigured) {
      updateTasksState((prev) => [...prev, newTask]);
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      let savedDocument: SyncDocument | null = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const remoteSnapshot = await loadSyncSnapshotFromGist(gistSettings);
        const loadedRemoteDocument = remoteSnapshot.document;
        const remoteDocument = createDocumentWithCompletedCleanup(
          loadedRemoteDocument.tasks,
          loadedRemoteDocument.tombstones,
          loadedRemoteDocument.updatedAt
        );
        const nextDocument = createSyncDocument(
          [...remoteDocument.tasks.map((task) => normalizeTask(task)), newTask],
          remoteDocument.tombstones
        );

        try {
          await saveSyncDocumentToGist(nextDocument, gistSettings, remoteSnapshot.etag);
          if (!remoteSnapshot.etag) {
            const verification = await loadSyncSnapshotFromGist(gistSettings);
            if (!syncDocumentContentEquals(verification.document, nextDocument)) {
              throw new GistChangedDuringSyncError();
            }
          }
          savedDocument = nextDocument;
          break;
        } catch (error) {
          if (!(error instanceof GistChangedDuringSyncError) || attempt === 3) throw error;
        }
      }

      if (!savedDocument) throw new Error('Failed to save task after repeated sync conflicts');
      applySyncedDocument(savedDocument);
      hasPendingLocalSyncRef.current = false;
      setSyncStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save task';
      console.error('Failed to save capture task:', error);
      setSyncStatus('error');
      setSyncError(message);
      throw error;
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [applySyncedDocument, gistSettings, isGistConfigured, updateTasksState]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    markLocalChange();
    const now = new Date().toISOString();
    updateTasksState((prev) =>
      prev.map((task) => (
        task.id === id
          ? normalizeTask({ ...task, ...updates, updatedAt: now })
          : task
      ))
    );
  }, [markLocalChange, updateTasksState]);

  const deleteTask = useCallback((id: string) => {
    markLocalChange();
    const now = new Date().toISOString();
    updateTombstonesState((prev) => ({
      ...prev,
      [id]: { id, deletedAt: now, updatedAt: now },
    }));
    updateTasksState((prev) => prev.filter((task) => task.id !== id));
  }, [markLocalChange, updateTasksState, updateTombstonesState]);

  const completeTask = useCallback((id: string) => {
    markLocalChange();
    const now = new Date().toISOString();
    updateTasksState((prev) => {
      const taskIndex = prev.findIndex((task) => task.id === id);
      if (taskIndex === -1) return prev;

      const task = prev[taskIndex];
      if (task.completed) return prev;

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
          pinned: false,
          isRecurring: true,
          recurrenceType: task.recurrenceType,
          tags: task.tags,
        });
      }

      return updatedTasks;
    });
  }, [markLocalChange, updateTasksState]);

  const uncompleteTask = useCallback((id: string) => {
    markLocalChange();
    const now = new Date().toISOString();
    updateTasksState((prev) =>
      prev.map((task) =>
        task.id === id
          ? normalizeTask({ ...task, completed: false, completedAt: null, updatedAt: now })
          : task
      )
    );
  }, [markLocalChange, updateTasksState]);

  const getTodayTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      if (task.deletedAt || !task.dueDate) return false;
      return normalizeTaskDate(task.dueDate) <= todayStr && !task.completed;
    });
  }, [tasks]);

  const getUpcomingTasks = useCallback(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    return tasks.filter((task) => {
      if (task.deletedAt || !task.dueDate) return false;
      return normalizeTaskDate(task.dueDate) > todayStr && !task.completed;
    }).sort((a, b) => normalizeTaskDate(a.dueDate).localeCompare(normalizeTaskDate(b.dueDate)));
  }, [tasks]);

  const getCompletedTasks = useCallback(() => {
    const today = startOfDay(new Date());
    return tasks
      .filter((task) => !task.deletedAt && task.completed && task.completedAt && new Date(task.completedAt) >= today)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  }, [tasks]);

  useEffect(() => {
    const cleanupNow = () => {
      const currentTasks = tasksRef.current;
      const cleanedDocument = createDocumentWithCompletedCleanup(
        currentTasks,
        tombstonesFromMap(tombstonesRef.current)
      );

      if (cleanedDocument.tasks.length !== currentTasks.length) {
        markLocalChange();
        updateTasksState(() => cleanedDocument.tasks);
        updateTombstonesState(() => mapFromTombstones(cleanedDocument.tombstones));
      }
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

      if (isGistConfigured && !isCaptureUrlRef.current) {
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
    cleanupNow();
    timerRef.current = scheduleMidnightCleanup();

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isGistConfigured, markLocalChange, syncFromGist, updateTasksState, updateTombstonesState]);

  return (
    <TaskContext.Provider
      value={{
        tasks: tasks.filter((task) => !task.deletedAt),
        addTask,
        addTaskFromCaptureUrl,
        updateTask,
        deleteTask,
        completeTask,
        uncompleteTask,
        getTodayTasks,
        getUpcomingTasks,
        getCompletedTasks,
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
