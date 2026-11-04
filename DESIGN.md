---
name: Juice
description: A calm, warm task app for personal use
source-of-truth: src/app/globals.css (tokens on :root / [data-theme])
colors:
  charcoal:
    background: "#0f0e0c"
    foreground: "#F3F0EA"
    card: "#191713"
    task-surface: "#1f1c18"
    task-surface-hover: "#24211d"
    surface-inset: "rgba(255, 255, 255, 0.035)"
    muted: "#a8a29a"
    border: "rgba(255, 255, 255, 0.08)"
    accent: "#d7a93a"
    accent-hover: "#e6bd59"
    red: "#ff6b6b"
    event: "#7fa7d9"
  parchment:
    background: "#F4F1EA"
    foreground: "#1A1712"
    card: "#FFFCF5"
    task-surface: "#FFFCF5"
    task-surface-hover: "#F8F1E3"
    surface-inset: "#ECE6DA"
    muted: "#6B6357"
    border: "#D6CDBD"
    accent: "#8F5C12"
    accent-hover: "#754A0C"
    red: "#C81E1E"
typography:
  family: "Plus Jakarta Sans, system-ui, sans-serif"
  task-title: { size: 17px, weight: 600, lineHeight: 1.35 }
  body: { size: 15px, weight: 400, lineHeight: 1.45 }
  meta: { size: 13px, weight: 500 }
  group-header: { size: 13px, weight: 700, today: 15px }
rounded:
  xs: 8px
  sm: 10px
  md: 14px
  checkbox: 50%
---

# Design System: The Pocket Journal

## 1. Overview

Juice should feel like a pocket journal you reach for every morning: compact, warm, and quiet. A warm charcoal (dark) or parchment (light) base carries the screen, and a single honey-gold accent marks the few things that matter: the add button, today, and focus.

It rejects the enterprise task-manager look: no kanban boards, no dense tables, no status pipelines. The app should get quieter the more you use it.

**Key characteristics**
- Soft rounded corners throughout (10–14px); circles only for checkboxes.
- Depth comes from tonal layering (page → card → inset), not shadows.
- One accent, used on well under 10% of any screen.
- Parchment and Charcoal keep every neutral warm-tinted. Other themes bring their own palettes but keep the same rules for hierarchy and the single accent.
- Hover lives in CSS behind `@media (hover: hover)` so taps never leave a stuck hover state.

## 2. Color

Tokens live in `src/app/globals.css`. Use them; never hard-code `rgba(255,255,255,…)` overlays, since they vanish in light mode.

- **Accent (honey gold in Parchment and Charcoal):** `--accent`, with `--accent-subtle` / `--accent-surface` / `--accent-border` tints for hover, selection and today. Text on a solid accent uses `--background`.
- **Neutrals:** `--background` (page), `--card` / `--task-surface` (raised), `--surface-inset` (fields, inactive toggles), `--surface-hover`, `--surface-faint` (out-of-month calendar days), `--border`.
- **Semantic:** `--red` for overdue and destructive actions, `--green` for the sync dot, `--event` for subscribed calendar events and `@time` highlights.
- **Contrast:** `--muted`, `--accent`, `--red` and `--event` meet 4.5:1 for small text on every light surface, including `--surface-inset`; check new pairs in both themes.
- **Themes:** picked from the Theme button in Settings. System is the default: Parchment in light mode, Material in dark. Also available: Solarized Light, GitHub Light, Catppuccin Latte and Rosé Pine Dawn; Dracula, Tokyo Night, Gruvbox, Matrix and Charcoal (the original dark palette). `src/utils/theme.ts` lists them and sets the theme before first paint.
- **Adding a theme:** add it to `THEMES` and give it a block in `globals.css` with its colors. `theme.test.ts` fails if it has no block or any text pair falls under 4.5:1.

**The Pocket Journal Rule.** The accent is rare. When everything is highlighted, nothing is.

## 3. Typography

One family, Plus Jakarta Sans. Hierarchy comes from size and weight, not font switching.

- **Task title:** 17px / 600. Not heavier: a list of 650+ titles shouts.
- **Note / body:** 15px / 400, muted.
- **Meta (time, recurrence):** 13px / 500, muted, with a 12px icon.
- **Group header:** 13px / 700 muted; "Today" is 15px in foreground. A short muted date sits beside the label ("Today · Tue, Nov 3").

## 4. Layout

- **Phone and tablet (<1000px):** one column, 10–18px side padding, a translucent blurred footer (search, settings, list/calendar switch, gold `+`) that extends through the home-indicator inset. A phone held sideways gets a full-screen month.
- **Wide (≥1000px):** the list is a fixed column (`clamp(420px, 42vw, 560px)`) on the left with a 1px right divider; the calendar takes the remaining width on the right. The footer and undo toast align to that column.
- **Installed PWA:** zoom disabled and scrollbars hidden so it feels native; desktop browsers keep thin scrollbars.

## 5. Components

### Task list
- **Group headers** are plain text, not boxes: Overdue (red), Today, Tomorrow, weekday names for the rest of the week, then month names. Tapping a day header opens the add form for that day (a small `+` marks it). Rows sort the same way everywhere: timed tasks by time, then alphabetically; Overdue and month groups sort by date first. With two or more overdue tasks, Overdue offers "Move all to today".
- **No pinning.** Every new task gets a date. Undated tasks (older pinned ones, or any made in the iOS app) wait under Overdue, after the ones that were due, until they get a date or are done. The `pinned` field stays in the sync format for the iOS app.
- **Task cards:** `--task-surface`, 1px border, `--radius-md`, 11px padding, 8px apart. Title, optional muted note (text after the first period), then a meta row. Overdue and month-group cards show their date in the meta row, because their header doesn't (`Oct 28`, `Wed, Nov 18`, `No date`).
- **Checkbox:** 24px outlined circle (`--checkbox-border`); hover tints to accent; completing fills it with the accent (red if overdue) and draws a check, then the card fades and slides left.
- **Times** display as `2 pm` / `9:30 am`, read the same way they sort (bare 1–6 is afternoon, 7–11 morning).
- **Reschedule control:** a borderless chevron floated beside the title's first line, so longer titles keep the card's full width. With a mouse it appears only when the task is hovered (always shown on overdue tasks); on touch it's always visible. The menu offers Today, Tomorrow, the next four weekdays, Next week, and Pick a date…, and flips above when there's no room below.
- **Completed** tasks collapse under today; an Undo toast follows each completion.

### Calendar
- A sticky bar names the month in view, with previous/next and, away from the current month, Today. Weekday names sit in the bar on desktop.
- It shows the current month and at least three more with no gaps, past months with open tasks, and any month navigated to; opening scrolls past older months to the current one. Search filters it along with the list.
- Day cells are soft filled tiles with no border; today and the selected day get an accent tint and accent border. Today's number is solid accent, and chips on a tinted day use `--task-surface` so they stay visible.
- Desktop weeks are 150px tall when they hold real tasks, 64px when upcoming and empty (recurrence previews alone don't count), and 28px when past and empty.
- Task chips are 11px / 600 muted text on an inset fill, up to two lines, led by the time on desktop (10px with no time on narrow screens). Overdue chips are red; recurrence previews are dashed and faded; subscribed events have a blue left stripe.

### Buttons
- `.btn-accent` (Add / Save / `+`), `.icon-btn` (footer icons), `.btn-soft` (secondary), `.menu-option` (menus). Hover states are CSS only.
- Elements styled inline get hover from helper classes (`.hover-surface`, `.hover-accent-outline`, `.hover-fill-accent`, `.hover-link`, …). Add `data-active` to skip hover on a selected toggle. Never set hover styles from `onMouseEnter`.
- Small controls (checkbox, chevron, header `+`, Move all to today) keep their look and get a larger hit area from an `::after`.
- Only a confirmed destructive action is solid red; Reset App stays quiet until it asks for confirmation.

### Dialogs
- Blurred dark backdrop, card panel at `--radius-md`, `--shadow-lg`. Centered with a mouse on wide screens; the add dialog sits at the top on small screens so the keyboard doesn't cover it.
- Focus moves into the dialog (Cancel for destructive actions), Tab stays inside, Escape closes, and focus returns on close.

## 6. Do's and Don'ts

**Do**
- Use tokens for every color; check both themes.
- Keep surfaces flat at rest; shadows only for overlays.
- Put hover in CSS under `(hover: hover)`.
- Animate opacity, transform and color only, with ease-out curves.

**Don't**
- Hard-code white or black overlays.
- Box group headers or stack borders inside borders.
- Use gradient text, glassmorphism cards, or decorative thick border stripes.
- Reach for a modal first; prefer inline editing.
- Use em dashes in UI copy.
