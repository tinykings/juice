# Juice - Task Management App

<div align="center">
  <img src="./public/icon-192.png" alt="Juice Logo" width="128" height="128">
  
  A task management app inspired by [Things](https://culturedcode.com/things/), built with Next.js and optimized for PWA deployment on GitHub Pages.
</div>

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-enabled-4285F4?style=flat-square&logo=pwa)

## Features

- **📱 Progressive Web App (PWA)** - Install on your device and use offline
- **🌓 Dark Mode** - Beautiful Nord/Dracula-inspired dark theme
- **☁️ Cross-Device Sync** - Sync tasks across devices using GitHub Gist
- **📅 Smart Task Organization**:
  - **Overdue** - Tasks past their due date (highlighted in red)
  - **Today** - Tasks due today
  - **Upcoming** - Tasks organized by day (next 7 days) and month (beyond)
  - **Completed** - Track your accomplishments (last 30 days)
- **🔄 Recurring Tasks** - Set tasks to repeat daily, weekly, monthly, or yearly
- **🎯 Drag & Drop** - Easily reschedule tasks by dragging them to different dates
- **⌨️ Keyboard Shortcuts** - Press `N` to quickly add a new task
- **💾 Local Storage** - Your tasks persist in your browser
- **📱 Mobile-Optimized** - Large touch targets and text optimized for mobile PWA usage

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Build for Production

```bash
# Build static export for GitHub Pages
npm run build
```

The static files will be generated in the `out/` directory.

## Deploy to GitHub Pages

Juice is configured for easy deployment to GitHub Pages. See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Quick Start

1. **Update Repository Name** in `next.config.ts`:
   ```typescript
   basePath: process.env.NODE_ENV === 'production' ? '/your-repo-name' : '',
   ```

2. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/your-repo-name.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to repository **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - The site will automatically deploy on every push to `main`

Your site will be available at:
```
https://your-username.github.io/your-repo-name/
```

## Usage

### Creating Tasks

1. Click the floating add button (bottom right) or press `N`
2. Enter the task title and optional notes
3. Set a due date (defaults to today)
4. Toggle "Recurring Task" to make it repeat
5. Choose the recurrence frequency (daily, weekly, monthly, yearly)

### Cross-Device Sync

1. Go to **Settings** (gear icon in header)
2. Enter your **GitHub Token** (with `gist` scope)
3. Enter or create a **Gist ID**
4. Tasks will automatically sync across all your devices

To create a GitHub token:
- Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
- Generate a new token with the `gist` scope

### Recurring Tasks

When you complete a recurring task, a new instance is automatically created with the next due date based on your chosen frequency.

### Drag & Drop

Drag tasks between date sections to quickly reschedule them. Tasks can be dropped on:
- Overdue section
- Today section
- Any of the next 7 days

### Navigation

- **Overdue** - Tasks past their due date (shown at the top in red)
- **Today** - Tasks due today
- **Upcoming** - Future tasks organized by day/month
- **Completed** - Your completed tasks history (last 30 days)

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router (static export)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Storage**: Browser Local Storage + GitHub Gist sync
- **PWA**: Service Worker for offline support

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Main task view (Today/Overdue/Upcoming)
│   ├── upcoming/page.tsx  # Upcoming tasks view
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Global styles & theme variables
├── components/            # React components
│   ├── TaskModal.tsx      # Task creation/edit modal
│   └── SettingsModal.tsx  # Settings & Gist sync configuration
├── context/               # React contexts
│   ├── TaskContext.tsx    # Task state management & Gist sync
│   ├── ThemeContext.tsx   # Dark/light theme management
│   └── SettingsContext.tsx # Settings persistence
├── hooks/                 # Custom hooks
│   ├── useLocalStorage.ts # Local storage hook
│   └── useServiceWorker.ts # PWA service worker
├── services/              # External services
│   └── gistSync.ts        # GitHub Gist sync logic
└── types/                 # TypeScript types
    └── task.ts            # Task type definitions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (static export)
- `npm run start` - Start production server (for testing)
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and prepare for GitHub Pages deployment

## License

MIT
