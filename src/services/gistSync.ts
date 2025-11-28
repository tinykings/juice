import { Task } from '@/types/task';

const GIST_API_URL = 'https://api.github.com/gists';

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

export async function loadTasksFromGist(settings: GistSettings): Promise<Task[]> {
  if (!settings.gistId || !settings.githubToken) {
    throw new Error('Gist ID and GitHub token are required');
  }

  const response = await fetch(`${GIST_API_URL}/${settings.gistId}`, {
    headers: {
      'Authorization': `Bearer ${settings.githubToken}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load gist: ${response.status} ${response.statusText}`);
  }

  const gist: GistResponse = await response.json();
  const tasksFile = gist.files['juice-tasks.json'];

  if (!tasksFile) {
    // No tasks file yet, return empty array
    return [];
  }

  try {
    return JSON.parse(tasksFile.content) as Task[];
  } catch {
    throw new Error('Failed to parse tasks from gist');
  }
}

export async function saveTasksToGist(tasks: Task[], settings: GistSettings): Promise<void> {
  if (!settings.gistId || !settings.githubToken) {
    // Silently skip if not configured
    return;
  }

  const response = await fetch(`${GIST_API_URL}/${settings.gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${settings.githubToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        'juice-tasks.json': {
          content: JSON.stringify(tasks, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save to gist: ${response.status} ${response.statusText}`);
  }
}

export async function createNewGist(tasks: Task[], githubToken: string): Promise<string> {
  if (!githubToken) {
    throw new Error('GitHub token is required');
  }

  const response = await fetch(GIST_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Juice Task Manager Data',
      public: false,
      files: {
        'juice-tasks.json': {
          content: JSON.stringify(tasks, null, 2),
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

