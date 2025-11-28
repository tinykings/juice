# Juice - Task Management App

A beautiful task management app inspired by [Things](https://culturedcode.com/things/), built with Next.js and designed for deployment on Vercel.

![Juice App](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)

## Features

- **Today View** - See all tasks due today (newly created tasks default here)
- **Upcoming View** - Tasks organized by:
  - Individual days for the next 7 days
  - Grouped by month for tasks further out
- **Completed View** - Track your accomplishments
- **Recurring Tasks** - Set tasks to repeat daily, weekly, monthly, or yearly
- **Beautiful UI** - Warm, paper-inspired design with smooth animations
- **Keyboard Shortcuts** - Press `N` to quickly add a new task
- **Local Storage** - Your tasks persist in your browser

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
npm run build
npm start
```

## Deploy to Vercel

The easiest way to deploy is to use the [Vercel Platform](https://vercel.com/new):

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import the project in Vercel
3. Vercel will automatically detect Next.js and configure the build settings
4. Click Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/juice)

## Usage

### Creating Tasks

1. Click the "Add Task" button or press `N`
2. Enter the task title and optional notes
3. Set a due date (defaults to today)
4. Toggle "Recurring Task" to make it repeat
5. Choose the recurrence frequency (daily, weekly, monthly, yearly)

### Recurring Tasks

When you complete a recurring task, a new instance is automatically created with the next due date based on your chosen frequency.

### Navigation

- **Today** - Tasks due today or overdue
- **Upcoming** - Future tasks organized by day/month
- **Completed** - Your completed tasks history

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Storage**: Browser Local Storage

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Today view
│   ├── upcoming/page.tsx  # Upcoming view
│   ├── completed/page.tsx # Completed view
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── TaskItem.tsx      # Individual task display
│   ├── TaskModal.tsx     # Task creation/edit modal
│   └── AddTaskButton.tsx # Add task button
├── context/              # React contexts
│   └── TaskContext.tsx   # Task state management
├── hooks/                # Custom hooks
│   └── useLocalStorage.ts
└── types/                # TypeScript types
    └── task.ts
```

## License

MIT
