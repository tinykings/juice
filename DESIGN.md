---
name: Juice
description: A calm, warm task app for personal use
source-of-truth: src/app/globals.css (tokens on :root / [data-theme])
colors:
  dark:
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
  light:
    background: "#F4F1EA"
    foreground: "#1A1712"
    card: "#FFFCF5"
    task-surface: "#FFFCF5"
    task-surface-hover: "#F8F1E3"
    surface-inset: "#ECE6DA"
    muted: "#7E7669"
    border: "#D6CDBD"
    accent: "#B7791F"
    accent-hover: "#935F18"
    red: "#DC2626"
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
- Every neutral is warm-tinted. Nothing reads grey or blue.
- Hover lives in CSS behind `@media (hover: hover)` so taps never leave a stuck hover state.

## 2. Color

Tokens live in `src/app/globals.css`. Use them; never hard-code `rgba(255,255,255,…)` overlays, since they vanish in light mode.

- **Accent (honey gold):** `--accent`, with `--accent-subtle` / `--accent-surface` / `--accent-border` tints for hover, selection and today. Text on a solid accent uses `--background`.
- **Neutrals:** `--background` (page), `--card` / `--task-surface` (raised), `--surface-inset` (fields, inactive toggles), `--surface-hover`, `--surface-faint` (out-of-month calendar days), `--border`.
- **Semantic:** `--red` for overdue and destructive actions, `--green` for the sync dot, `--event` for subscribed calendar events.
- **Theme:** follows the system until the user picks one; `src/utils/theme.ts` sets it before first paint.

**The Pocket Journal Rule.** The accent is rare. When everything is highlighted, nothing is.

## 3. Typography

One family, Plus Jakarta Sans. Hierarchy comes from size and weight, not font switching.

- **Task title:** 17px / 600. Not heavier: a list of 650+ titles shouts.
- **Note / body:** 15px / 400, muted.
- **Meta (time, recurrence):** 13px / 500, muted, with a 12px icon.
- **Group header:** 13px / 700 muted; "Today" is 15px in foreground. A short muted date sits beside the label ("Today · Tue, Nov 3").

## 4. Layout

- **Phone:** single list column, 10–18px side padding, a translucent blurred footer (search, settings, gold `+`) that extends through the home-indicator inset.
- **Wide (≥1000px):** calendar on the left takes the remaining width; the list is a fixed column (`clamp(420px, 42vw, 560px)`) on the right with a 1px left divider. The footer and undo toast align to that column.
- **Installed PWA:** zoom disabled and scrollbars hidden so it feels native; desktop browsers keep thin scrollbars.

## 5. Components

### Task list
- **Group headers** are plain text, not boxes: Pinned, Overdue (red), Today, Tomorrow, weekday names for the rest of the week, then month names.
- **Task cards:** `--task-surface`, 1px border, `--radius-md`, 13px padding. Title, optional muted note (text after the first period), then a meta row.
- **Checkbox:** 24px outlined circle (`--checkbox-border`); hover tints to accent; completing fills it with the accent (red if overdue) and draws a check, then the card fades and slides left.
- **Times** display as `2 pm` / `9:30 am`, read the same way they sort (bare 1–6 is afternoon, 7–11 morning).
- **Reschedule control:** a borderless chevron. With a mouse it appears only when the task is hovered (always shown on overdue tasks); on touch it's always visible. The menu offers Today, Tomorrow, the next four weekdays, Next week, and Pick a date…, and flips above when there's no room below.
- **Completed** tasks collapse under today; an Undo toast follows each completion.

### Calendar
- Day cells are soft filled tiles with no border; today and the selected day get an accent tint and accent border.
- Task chips are 10px / 600 muted text on an inset fill, up to two lines. Overdue chips are red; recurrence previews are dashed and faded; subscribed events have a blue left stripe.

### Buttons
- `.btn-accent` (Add / Save / `+`), `.icon-btn` (footer icons), `.btn-soft` (secondary), `.menu-option` (menus). Hover states are CSS only.

### Dialogs
- Blurred dark backdrop, card panel at `--radius-md`, `--shadow-lg`.
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
