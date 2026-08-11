import { Task } from '@/types/task';
import { normalizeTaskDate } from '@/utils/taskDate';

const GIST_API_URL = 'https://api.github.com/gists';
const TASKS_FILENAME = 'juice-tasks.json';
const UNKNOWN_TIMESTAMP = '1970-01-01T00:00:00.000Z';

interface GistFile {
  content: string;
}

interface GistResponse {
  id: string;
  description?: string;
  files: {
    [filename: string]: GistFile;
  };
}

export interface SyncSnapshot {
  document: SyncDocument;
  etag: string | null;
}

export class GistChangedDuringSyncError extends Error {
  constructor() {
    super('The Gist changed during sync');
    this.name = 'GistChangedDuringSyncError';
  }
}

export interface GistSettings {
  gistId: string;
  githubToken: string;
  githubLogin?: string;
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
  const pinned = Boolean(task.pinned);
  return {
    ...task,
    notes: task.notes ?? '',
    tags: task.tags ?? [],
    pinned,
    dueDate: pinned ? '' : normalizeTaskDate(task.dueDate),
    completed: Boolean(task.completed),
    completedAt: task.completedAt ?? null,
    updatedAt: task.updatedAt ?? task.createdAt ?? UNKNOWN_TIMESTAMP,
    deletedAt: task.deletedAt ?? null,
    isRecurring: pinned ? false : Boolean(task.isRecurring),
    recurrenceType: pinned ? null : (task.recurrenceType ?? null),
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
    pinned: normalized.pinned,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;

  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.dueDate === 'string'
    && typeof value.createdAt === 'string'
    && (value.notes === undefined || typeof value.notes === 'string')
    && (value.completed === undefined || typeof value.completed === 'boolean')
    && (value.completedAt === undefined || value.completedAt === null || typeof value.completedAt === 'string')
    && (value.updatedAt === undefined || typeof value.updatedAt === 'string')
    && (value.deletedAt === undefined || value.deletedAt === null || typeof value.deletedAt === 'string')
    && (value.conflictOf === undefined || typeof value.conflictOf === 'string')
    && (value.tags === undefined || (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string')))
    && (value.pinned === undefined || typeof value.pinned === 'boolean')
    && (value.isRecurring === undefined || typeof value.isRecurring === 'boolean')
    && (value.recurrenceType === undefined || value.recurrenceType === null
      || ['daily', 'weekly', 'monthly', 'yearly'].includes(String(value.recurrenceType)));
}

function isTombstone(value: unknown): value is TaskTombstone {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.deletedAt === 'string'
    && typeof value.updatedAt === 'string';
}

function assertArrayItems<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
  label: string
): asserts value is T[] {
  if (!Array.isArray(value) || !value.every(predicate)) {
    throw new Error(`Invalid ${label} in Gist sync document`);
  }
}

export function parseSyncDocument(content: string): SyncDocument {
  const parsed: unknown = JSON.parse(content);

  if (Array.isArray(parsed)) {
    assertArrayItems(parsed, isTask, 'tasks');
    return createSyncDocument(parsed, []);
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid Gist sync document');
  }
  if (parsed.version !== undefined && parsed.version !== 1) {
    throw new Error(`Unsupported Gist sync document version: ${String(parsed.version)}`);
  }

  const tasks = parsed.tasks ?? [];
  const tombstones = parsed.tombstones ?? [];
  assertArrayItems(tasks, isTask, 'tasks');
  assertArrayItems(tombstones, isTombstone, 'tombstones');
  if (parsed.updatedAt !== undefined && typeof parsed.updatedAt !== 'string') {
    throw new Error('Invalid updatedAt in Gist sync document');
  }

  return createSyncDocument(tasks, tombstones, parsed.updatedAt);
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

export function syncDocumentContentKey(document: SyncDocument): string {
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
  return syncDocumentContentKey(a) === syncDocumentContentKey(b);
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
      // Do not use wall-clock ordering when a delete races an edit. Device
      // clocks can differ substantially, so preserve the edit as a conflict
      // copy and keep the deletion rather than risking silent data loss.
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

      const taskUpdatedAt = newestDate(localTask?.updatedAt, remoteTask?.updatedAt);
      if (!taskUpdatedAt || new Date(tombstone.updatedAt) >= new Date(taskUpdatedAt)) {
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
      if (JSON.stringify(comparableTask(localTask)) === JSON.stringify(comparableTask(remoteTask))) {
        mergedTasks.push(remoteTask);
      } else {
        // Without a common ancestor, timestamps from different devices are
        // not trustworthy enough to discard either version.
        mergedTasks.push(remoteTask);
        conflicts.push(makeConflictCopy(localTask, id, now));
      }
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

async function fetchGist(settings: GistSettings): Promise<{ gist: GistResponse; etag: string | null }> {
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

  const responseEtag = response.headers.get('etag');
  return {
    gist: await response.json(),
    // GitHub currently returns weak ETags for Gists. Weak validators are not
    // valid with If-Match and cause PATCH requests to fail with HTTP 400.
    etag: responseEtag && !responseEtag.startsWith('W/') ? responseEtag : null,
  };
}

export async function loadSyncSnapshotFromGist(settings: GistSettings): Promise<SyncSnapshot> {
  const { gist, etag } = await fetchGist(settings);
  const tasksFile = gist.files[TASKS_FILENAME];

  if (!tasksFile) {
    return { document: createSyncDocument([]), etag };
  }

  try {
    return { document: parseSyncDocument(tasksFile.content), etag };
  } catch {
    throw new Error('Failed to parse tasks from gist');
  }
}

export async function loadSyncDocumentFromGist(settings: GistSettings): Promise<SyncDocument> {
  return (await loadSyncSnapshotFromGist(settings)).document;
}

export async function loadTasksFromGist(settings: GistSettings): Promise<Task[]> {
  const document = await loadSyncDocumentFromGist(settings);
  return document.tasks;
}

export async function saveSyncDocumentToGist(
  document: SyncDocument,
  settings: GistSettings,
  expectedEtag?: string | null
): Promise<void> {
  if (!settings.gistId || !settings.githubToken) {
    return;
  }

  const response = await fetch(`${GIST_API_URL}/${settings.gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(expectedEtag ? { 'If-Match': expectedEtag } : {}),
    },
    body: JSON.stringify({
      files: {
        [TASKS_FILENAME]: {
          content: JSON.stringify(createSyncDocument(document.tasks, document.tombstones, document.updatedAt), null, 2),
        },
      },
    }),
  });

  if (response.status === 409 || response.status === 412) {
    throw new GistChangedDuringSyncError();
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to save to gist: ${response.status} ${response.statusText}${details ? ` — ${details}` : ''}`);
  }
}

export async function saveTasksToGist(tasks: Task[], settings: GistSettings): Promise<void> {
  await saveSyncDocumentToGist(createSyncDocument(tasks), settings);
}

export async function findJuiceGist(githubToken: string): Promise<string | null> {
  if (!githubToken) throw new Error('GitHub token is required');

  // Gists are returned newest-first. Follow pagination so older Juice installs
  // remain discoverable on a new device.
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${GIST_API_URL}?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to find Juice gist: ${response.status} ${response.statusText}`);
    }

    const gists = await response.json() as GistResponse[];
    const match = gists.find((gist) => Boolean(gist.files[TASKS_FILENAME]));
    if (match) return match.id;
    if (gists.length < 100) return null;
  }

  return null;
}

export async function findOrCreateJuiceGist(tasks: Task[], githubToken: string): Promise<string> {
  return (await findJuiceGist(githubToken)) ?? createNewGist(tasks, githubToken);
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
