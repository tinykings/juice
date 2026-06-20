import { Task } from '@/types/task';

const GIST_API_URL = 'https://api.github.com/gists';
const TASKS_FILENAME = 'juice-tasks.json';
const UNKNOWN_TIMESTAMP = '1970-01-01T00:00:00.000Z';

interface GistFile {
  content: string;
}

interface GistResponse {
  id: string;
  files: {
    [filename: string]: GistFile;
  };
}

export interface GistSettings {
  gistId: string;
  githubToken: string;
}

export interface TaskTombstone {
  id: string;
  deletedAt: string;
  updatedAt: string;
}

export interface SyncDocument {
  version: 1;
  updatedAt: string;
  tasks: Task[];
  tombstones: TaskTombstone[];
}

export interface MergeResult {
  tasks: Task[];
  tombstones: TaskTombstone[];
  conflicts: Task[];
}

type TombstoneMap = Record<string, TaskTombstone>;

function normalizeTask(task: Task): Task {
  return {
    ...task,
    notes: task.notes ?? '',
    tags: task.tags ?? [],
    completed: Boolean(task.completed),
    completedAt: task.completedAt ?? null,
    updatedAt: task.updatedAt ?? task.createdAt ?? UNKNOWN_TIMESTAMP,
    deletedAt: task.deletedAt ?? null,
  };
}

function comparableTask(task: Task) {
  const normalized = normalizeTask(task);
  return {
    id: normalized.id,
    title: normalized.title,
    notes: normalized.notes,
    dueDate: normalized.dueDate,
    completed: normalized.completed,
    completedAt: normalized.completedAt,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    deletedAt: normalized.deletedAt,
    conflictOf: normalized.conflictOf ?? null,
    isRecurring: normalized.isRecurring,
    recurrenceType: normalized.recurrenceType,
    tags: [...normalized.tags].sort(),
  };
}

function comparableTombstone(tombstone: TaskTombstone) {
  return {
    id: tombstone.id,
    deletedAt: tombstone.deletedAt,
    updatedAt: tombstone.updatedAt,
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map(normalizeTask).filter((task) => !task.deletedAt);
}

function normalizeTombstones(tombstones: TaskTombstone[] = []): TaskTombstone[] {
  const byId: TombstoneMap = {};

  for (const tombstone of tombstones) {
    const existing = byId[tombstone.id];
    if (!existing || new Date(tombstone.updatedAt) > new Date(existing.updatedAt)) {
      byId[tombstone.id] = tombstone;
    }
  }

  return Object.values(byId);
}

function parseSyncDocument(content: string): SyncDocument {
  const parsed = JSON.parse(content) as SyncDocument | Task[];

  if (Array.isArray(parsed)) {
    return createSyncDocument(parsed, []);
  }

  return createSyncDocument(parsed.tasks ?? [], parsed.tombstones ?? [], parsed.updatedAt);
}

export function createSyncDocument(
  tasks: Task[],
  tombstones: TaskTombstone[] = [],
  updatedAt = new Date().toISOString()
): SyncDocument {
  return {
    version: 1,
    updatedAt,
    tasks: normalizeTasks(tasks),
    tombstones: normalizeTombstones(tombstones),
  };
}

function comparableSyncContent(document: SyncDocument): string {
  return JSON.stringify({
    tasks: document.tasks
      .map(comparableTask)
      .sort((a, b) => a.id.localeCompare(b.id)),
    tombstones: normalizeTombstones(document.tombstones)
      .map(comparableTombstone)
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function syncDocumentContentEquals(a: SyncDocument, b: SyncDocument): boolean {
  return comparableSyncContent(a) === comparableSyncContent(b);
}

function taskChangedSinceBase(task: Task | undefined, baseTask: Task | undefined): boolean {
  if (!task) return false;
  if (!baseTask) return true;
  return JSON.stringify(comparableTask(task)) !== JSON.stringify(comparableTask(baseTask));
}

function tombstoneChangedSinceBase(
  tombstone: TaskTombstone | undefined,
  baseTombstone: TaskTombstone | undefined
): boolean {
  if (!tombstone) return false;
  if (!baseTombstone) return true;
  return new Date(tombstone.updatedAt) > new Date(baseTombstone.updatedAt);
}

function newestTombstone(...items: Array<TaskTombstone | undefined>): TaskTombstone | undefined {
  return items.reduce<TaskTombstone | undefined>((newest, item) => {
    if (!item) return newest;
    if (!newest || new Date(item.updatedAt) > new Date(newest.updatedAt)) return item;
    return newest;
  }, undefined);
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeConflictCopy(task: Task, originalId: string, now: string): Task {
  return {
    ...task,
    id: createId(),
    title: `${task.title} (conflict copy)`,
    conflictOf: originalId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function chooseWithoutBase(localTask: Task, remoteTask: Task): Task {
  if (JSON.stringify(comparableTask(localTask)) === JSON.stringify(comparableTask(remoteTask))) {
    return remoteTask;
  }

  const localUpdatedAt = localTask.updatedAt ?? localTask.createdAt;
  const remoteUpdatedAt = remoteTask.updatedAt ?? remoteTask.createdAt;
  return new Date(localUpdatedAt) > new Date(remoteUpdatedAt) ? localTask : remoteTask;
}

export function mergeSyncDocuments(
  local: SyncDocument,
  remote: SyncDocument,
  base: SyncDocument | null,
  now = new Date().toISOString()
): MergeResult {
  const baseTasks = new Map((base?.tasks ?? []).map((task) => [task.id, normalizeTask(task)]));
  const localTasks = new Map(local.tasks.map((task) => [task.id, normalizeTask(task)]));
  const remoteTasks = new Map(remote.tasks.map((task) => [task.id, normalizeTask(task)]));
  const baseTombstones = new Map((base?.tombstones ?? []).map((item) => [item.id, item]));
  const localTombstones = new Map(local.tombstones.map((item) => [item.id, item]));
  const remoteTombstones = new Map(remote.tombstones.map((item) => [item.id, item]));
  const ids = new Set([
    ...baseTasks.keys(),
    ...localTasks.keys(),
    ...remoteTasks.keys(),
    ...baseTombstones.keys(),
    ...localTombstones.keys(),
    ...remoteTombstones.keys(),
  ]);
  const mergedTasks: Task[] = [];
  const conflicts: Task[] = [];
  const mergedTombstones: TaskTombstone[] = [];

  for (const id of ids) {
    const baseTask = baseTasks.get(id);
    const localTask = localTasks.get(id);
    const remoteTask = remoteTasks.get(id);
    const tombstone = newestTombstone(localTombstones.get(id), remoteTombstones.get(id));
    const localChanged = taskChangedSinceBase(localTask, baseTask);
    const remoteChanged = taskChangedSinceBase(remoteTask, baseTask);
    const localDeleted = tombstoneChangedSinceBase(localTombstones.get(id), baseTombstones.get(id));
    const remoteDeleted = tombstoneChangedSinceBase(remoteTombstones.get(id), baseTombstones.get(id));

    if (tombstone) {
      const taskUpdatedAt = newestDate(localTask?.updatedAt, remoteTask?.updatedAt);
      if (!taskUpdatedAt || new Date(tombstone.updatedAt) >= new Date(taskUpdatedAt)) {
        if (localDeleted && remoteTask && remoteChanged) {
          mergedTombstones.push(tombstone);
          conflicts.push(makeConflictCopy(remoteTask, id, now));
          continue;
        }

        if (remoteDeleted && localTask && localChanged) {
          mergedTombstones.push(tombstone);
          conflicts.push(makeConflictCopy(localTask, id, now));
          continue;
        }

        mergedTombstones.push(tombstone);
        continue;
      }
    }

    if (localDeleted || remoteDeleted) {
      const deleteMarker = newestTombstone(localTombstones.get(id), remoteTombstones.get(id));
      if (deleteMarker && !localChanged && !remoteChanged) {
        mergedTombstones.push(deleteMarker);
        continue;
      }
    }

    if (!base && localTask && remoteTask) {
      mergedTasks.push(chooseWithoutBase(localTask, remoteTask));
      continue;
    }

    if (localTask && remoteTask && localChanged && remoteChanged) {
      if (JSON.stringify(comparableTask(localTask)) === JSON.stringify(comparableTask(remoteTask))) {
        mergedTasks.push(localTask);
      } else {
        mergedTasks.push(remoteTask);
        conflicts.push(makeConflictCopy(localTask, id, now));
      }
      continue;
    }

    if (localChanged && localTask) {
      mergedTasks.push(localTask);
      continue;
    }

    if (remoteChanged && remoteTask) {
      mergedTasks.push(remoteTask);
      continue;
    }

    if (remoteTask) {
      mergedTasks.push(remoteTask);
      continue;
    }

    if (localTask) {
      mergedTasks.push(localTask);
    }
  }

  return {
    tasks: normalizeTasks([...mergedTasks, ...conflicts]),
    tombstones: normalizeTombstones(mergedTombstones),
    conflicts,
  };
}

function newestDate(...dates: Array<string | undefined | null>): string | undefined {
  return dates.reduce<string | undefined>((newest, date) => {
    if (!date) return newest;
    if (!newest || new Date(date) > new Date(newest)) return date;
    return newest;
  }, undefined);
}

async function fetchGist(settings: GistSettings): Promise<GistResponse> {
  if (!settings.gistId || !settings.githubToken) {
    throw new Error('Gist ID and GitHub token are required');
  }

  const response = await fetch(`${GIST_API_URL}/${settings.gistId}`, {
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load gist: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadSyncDocumentFromGist(settings: GistSettings): Promise<SyncDocument> {
  const gist = await fetchGist(settings);
  const tasksFile = gist.files[TASKS_FILENAME];

  if (!tasksFile) {
    return createSyncDocument([]);
  }

  try {
    return parseSyncDocument(tasksFile.content);
  } catch {
    throw new Error('Failed to parse tasks from gist');
  }
}

export async function loadTasksFromGist(settings: GistSettings): Promise<Task[]> {
  const document = await loadSyncDocumentFromGist(settings);
  return document.tasks;
}

export async function saveSyncDocumentToGist(document: SyncDocument, settings: GistSettings): Promise<void> {
  if (!settings.gistId || !settings.githubToken) {
    return;
  }

  const response = await fetch(`${GIST_API_URL}/${settings.gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [TASKS_FILENAME]: {
          content: JSON.stringify(createSyncDocument(document.tasks, document.tombstones), null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save to gist: ${response.status} ${response.statusText}`);
  }
}

export async function saveTasksToGist(tasks: Task[], settings: GistSettings): Promise<void> {
  await saveSyncDocumentToGist(createSyncDocument(tasks), settings);
}

export async function createNewGist(tasks: Task[], githubToken: string): Promise<string> {
  if (!githubToken) {
    throw new Error('GitHub token is required');
  }

  const response = await fetch(GIST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Juice Task Manager Data',
      public: false,
      files: {
        [TASKS_FILENAME]: {
          content: JSON.stringify(createSyncDocument(tasks), null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create gist: ${response.status} ${response.statusText}`);
  }

  const gist: GistResponse = await response.json();
  return gist.id;
}
