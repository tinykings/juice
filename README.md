<p align="center">
<img src="public/juice.png" alt="Juice Logo" width="200" />
</p>

<h3 align="center">A minimal task manager — installable as a PWA, hosted on GitHub Pages.</h3>
<h4 align="center">https://tinykings.github.io/juice/</h4>

---

Tasks are stored in your browser's local storage. Connect a GitHub Gist for optional sync across devices.

## Features

- **Task scheduling** — assign due dates and group tasks by overdue, today, this week, and beyond
- **Recurring tasks** — daily, weekly, monthly, or yearly recurrence
- **Calendar view** — month grid showing tasks by date
- **Search** — filter tasks by title or notes
- **Completed tasks** — view completions from today
- **GitHub Gist sync** — two-way sync across devices using a private Gist
- **Dark / light theme** — follows system preference, manually overridable
- **PWA** — installable on mobile and desktop, works offline
- **App badge** — shows pending task count on the app icon

## Tech Stack

- [Next.js](https://nextjs.org/) (static export) + React + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [date-fns](https://date-fns.org/) for date handling
- GitHub Pages + GitHub Actions for deployment

## Data & Sync

By default, tasks are saved to `localStorage` in your browser. To sync between devices, open **Settings** and select **Connect GitHub**. Juice finds an existing `juice-tasks.json` Gist or creates one automatically. Manual Gist ID/token setup remains under advanced settings.

OAuth uses shared Cloudflare broker in [`auth-worker/`](auth-worker/README.md). Set `NEXT_PUBLIC_GIST_AUTH_URL` locally or repository variable `GIST_AUTH_URL` for GitHub Pages builds.

GitHub secret Gists are unlisted rather than access-controlled private data. GitHub's `gist` OAuth scope permits access to all Gists on account.

App syncs automatically 1 second after changes and whenever tab regains focus. Sync pulls the latest Gist data before saving, preserves deletes across devices, and keeps both versions when two devices edit the same task before syncing.

Completed tasks from previous days are deleted automatically once a new day starts.

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static export → /out
```

## Deployment

The app deploys automatically to GitHub Pages on push to `main` via GitHub Actions. It is configured for the repository URL at `https://tinykings.github.io/juice/`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New task |
| `Escape` | Close modal |
