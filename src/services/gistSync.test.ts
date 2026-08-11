import { describe, expect, it } from 'vitest';
import type { Task } from '@/types/task';
import {
  createSyncDocument,
  mergeSyncDocuments,
  parseSyncDocument,
  syncDocumentContentEquals,
  type TaskTombstone,
} from './gistSync';

const BASE_TIME = '2026-01-01T12:00:00.000Z';
const LATER_TIME = '2026-01-02T12:00:00.000Z';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Original',
    notes: '',
    dueDate: '2026-01-10',
    completed: false,
    completedAt: null,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    deletedAt: null,
    pinned: false,
    isRecurring: false,
    recurrenceType: null,
    tags: [],
    ...overrides,
  };
}

function tombstone(overrides: Partial<TaskTombstone> = {}): TaskTombstone {
  return {
    id: 'task-1',
    deletedAt: LATER_TIME,
    updatedAt: LATER_TIME,
    ...overrides,
  };
}

describe('mergeSyncDocuments', () => {
  it('keeps independent additions from both clients', () => {
    const localTask = task({ id: 'local' });
    const remoteTask = task({ id: 'remote' });

    const result = mergeSyncDocuments(
      createSyncDocument([localTask], [], LATER_TIME),
      createSyncDocument([remoteTask], [], LATER_TIME),
      createSyncDocument([], [], BASE_TIME),
      LATER_TIME
    );

    expect(result.tasks.map((item) => item.id).sort()).toEqual(['local', 'remote']);
    expect(result.conflicts).toHaveLength(0);
  });

  it('preserves both versions when the same task is edited concurrently', () => {
    const baseTask = task();
    const localTask = task({ title: 'Local edit', updatedAt: LATER_TIME });
    const remoteTask = task({ title: 'Remote edit', updatedAt: LATER_TIME });

    const result = mergeSyncDocuments(
      createSyncDocument([localTask]),
      createSyncDocument([remoteTask]),
      createSyncDocument([baseTask]),
      LATER_TIME
    );

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks).toContainEqual(expect.objectContaining({ id: 'task-1', title: 'Remote edit' }));
    expect(result.conflicts).toEqual([
      expect.objectContaining({ title: 'Local edit (conflict copy)', conflictOf: 'task-1' }),
    ]);
  });

  it('keeps a deletion while preserving a concurrent edit as a conflict copy', () => {
    const baseTask = task();
    const editedTask = task({ title: 'Edited remotely', updatedAt: LATER_TIME });

    const result = mergeSyncDocuments(
      createSyncDocument([], [tombstone()]),
      createSyncDocument([editedTask]),
      createSyncDocument([baseTask]),
      LATER_TIME
    );

    expect(result.tombstones).toEqual([tombstone()]);
    expect(result.tasks).toEqual([
      expect.objectContaining({ title: 'Edited remotely (conflict copy)', conflictOf: 'task-1' }),
    ]);
  });
});

describe('sync document serialization', () => {
  it('compares content independently of task and tag order', () => {
    const first = createSyncDocument([
      task({ id: 'b', tags: ['work', 'urgent'] }),
      task({ id: 'a' }),
    ]);
    const second = createSyncDocument([
      task({ id: 'a' }),
      task({ id: 'b', tags: ['urgent', 'work'] }),
    ]);

    expect(syncDocumentContentEquals(first, second)).toBe(true);
  });

  it('loads the legacy task-array format with normalized defaults', () => {
    const legacy = {
      id: 'legacy',
      title: 'Legacy task',
      dueDate: '2026-01-10',
      createdAt: BASE_TIME,
    };

    const document = parseSyncDocument(JSON.stringify([legacy]));

    expect(document.tasks).toEqual([
      expect.objectContaining({
        id: 'legacy',
        notes: '',
        tags: [],
        completed: false,
        pinned: false,
        isRecurring: false,
        recurrenceType: null,
      }),
    ]);
  });

  it('normalizes pinned tasks as undated and non-recurring', () => {
    const document = createSyncDocument([
      task({ pinned: true, dueDate: '2026-01-10', isRecurring: true, recurrenceType: 'daily' }),
    ]);

    expect(document.tasks[0]).toMatchObject({
      pinned: true,
      dueDate: '',
      isRecurring: false,
      recurrenceType: null,
    });
  });

  it.each([
    ['non-object JSON', 'null'],
    ['malformed tasks', JSON.stringify({ version: 1, tasks: [{ title: 'Missing ID' }] })],
    ['malformed tombstones', JSON.stringify({ version: 1, tasks: [], tombstones: [{ id: 'x' }] })],
    ['unsupported version', JSON.stringify({ version: 2, tasks: [] })],
  ])('rejects %s', (_name, content) => {
    expect(() => parseSyncDocument(content)).toThrow();
  });
});
