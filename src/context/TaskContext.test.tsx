// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/context/SettingsContext';
import { TaskProvider, useTasks } from '@/context/TaskContext';
import { GistNetworkError } from '@/services/gistSync';
import { Task } from '@/types/task';

const GIST_URL = 'https://api.github.com/gists/gist-1';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    notes: '',
    dueDate: '2099-01-01',
    completed: false,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    pinned: false,
    isRecurring: false,
    recurrenceType: null,
    tags: [],
    ...overrides,
  };
}

const NEW_TASK = { title: 'Captured', notes: '', dueDate: '2099-02-02', pinned: false, isRecurring: false, recurrenceType: null, tags: [] };

/** A stand-in for the Gist API that stores what is saved to it. */
function fakeGist(initialTasks: Task[]) {
  let content = JSON.stringify({ version: 1, updatedAt: '2026-01-01T00:00:00.000Z', tasks: initialTasks, tombstones: [] });
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      content = JSON.parse(init.body as string).files['juice-tasks.json'].content;
      return new Response('{}', { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'gist-1', files: { 'juice-tasks.json': { content } } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, savedTasks: () => (JSON.parse(content).tasks as Task[]).map((item) => item.id) };
}

function storeLocal(tasks: Task[], gistConfigured = true) {
  localStorage.setItem('juice-tasks', JSON.stringify(tasks));
  if (gistConfigured) {
    localStorage.setItem('juice-gist-settings', JSON.stringify({ gistId: 'gist-1', githubToken: 'token' }));
  }
}

function renderTasks() {
  const current: { value: ReturnType<typeof useTasks> | null } = { value: null };
  function Probe() {
    const value = useTasks();
    // Tests read the latest context value after each act().
    current.value = value;
    return null;
  }
  render(<SettingsProvider><TaskProvider><Probe /></TaskProvider></SettingsProvider>);
  return () => current.value!;
}

function setCaptureUrl(enabled: boolean) {
  window.history.replaceState(null, '', enabled ? '/?newtask' : '/');
}

beforeEach(() => {
  localStorage.clear();
  setCaptureUrl(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('quick capture', () => {
  it('keeps local tasks that have not synced yet', async () => {
    const gist = fakeGist([task('remote')]);
    storeLocal([task('remote'), task('unsynced')]);
    setCaptureUrl(true);
    const tasks = renderTasks();

    await act(async () => { await tasks().addTaskFromCaptureUrl(NEW_TASK); });

    expect(tasks().tasks.map((item) => item.title).sort()).toEqual(['Captured', 'remote', 'unsynced']);
    expect(gist.savedTasks()).toContain('unsynced');
  });

  it('keeps the task on this device when offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    storeLocal([task('existing')]);
    setCaptureUrl(true);
    const tasks = renderTasks();

    await act(async () => { await tasks().addTaskFromCaptureUrl(NEW_TASK); });

    expect(tasks().tasks.map((item) => item.title)).toEqual(['existing', 'Captured']);
    expect(tasks().syncError).toBe(new GistNetworkError().message);
  });

  it('reports other failures without keeping a copy, so retrying cannot duplicate it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    storeLocal([task('existing')]);
    setCaptureUrl(true);
    const tasks = renderTasks();

    let failure: unknown;
    await act(async () => {
      await tasks().addTaskFromCaptureUrl(NEW_TASK).catch((error) => { failure = error; });
    });

    expect(failure).toBeInstanceOf(Error);
    expect(tasks().tasks.map((item) => item.title)).toEqual(['existing']);
  });
});

describe('sync', () => {
  it('reads the Gist fresh rather than from the browser cache', async () => {
    const gist = fakeGist([]);
    storeLocal([]);
    renderTasks();

    await waitFor(() => expect(gist.fetchMock).toHaveBeenCalled());
    const [url, init] = gist.fetchMock.mock.calls[0];
    expect(url).toBe(GIST_URL);
    expect(init?.cache).toBe('no-cache');
  });

  it('syncs again when the connection returns', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', offline);
    storeLocal([task('local')]);
    const tasks = renderTasks();
    await waitFor(() => expect(tasks().syncStatus).toBe('error'));

    const gist = fakeGist([]);
    await act(async () => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(gist.savedTasks()).toEqual(['local']));
    expect(tasks().syncStatus).toBe('idle');
  });
});

describe('tasks', () => {
  it('carries notes and the anchor day to the next occurrence', async () => {
    storeLocal([task('rent', { dueDate: '2099-01-31', isRecurring: true, recurrenceType: 'monthly', notes: 'Portal' })], false);
    const tasks = renderTasks();

    act(() => tasks().completeTask('rent'));

    const next = tasks().tasks.find((item) => !item.completed)!;
    expect(next).toMatchObject({ dueDate: '2099-02-28', recurrenceDay: 31, notes: 'Portal' });
  });

  it('forgets the anchor day when a task is moved', async () => {
    storeLocal([task('rent', { dueDate: '2099-02-28', isRecurring: true, recurrenceType: 'monthly', recurrenceDay: 31 })], false);
    const tasks = renderTasks();

    act(() => tasks().updateTask('rent', { dueDate: '2099-03-15' }));

    expect(tasks().tasks[0].recurrenceDay).toBeUndefined();
  });

  it('keeps a conflict copy as the real task', async () => {
    storeLocal([
      task('original'),
      task('copy', { title: 'Plan trip (conflict copy)', conflictOf: 'original' }),
    ], false);
    const tasks = renderTasks();

    act(() => tasks().keepConflictCopy('copy'));

    expect(tasks().tasks).toHaveLength(1);
    expect(tasks().tasks[0]).toMatchObject({ id: 'copy', title: 'Plan trip' });
    expect(tasks().tasks[0].conflictOf).toBeUndefined();
  });
});
