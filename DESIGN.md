---
name: Juice
description: A beautiful, calm task management app for personal use
colors:
  background: "#F8F6F3"
  foreground: "#1A1A18"
  card: "#FFFFFF"
  muted: "#8A8A85"
  muted-light: "#E5E3DF"
  border: "#E5E3DF"
  accent-coral-ember: "#E84545"
  accent-light: "#FDEaea"
  accent-subtle: "#FCE8E8"
  highlight: "#FCE8E8"
  yellow: "#F5B041"
  red-twilight: "#E84545"
  green-foliage: "#2ECC71"
  purple-heather: "#9B59B6"
  surface-raised: "#FFFFFF"
  surface-inset: "#F2F0ED"
  calendar-month-start: "#ECE7DF"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.05em"
  caption:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0px"
  soft: "8px"
  modal: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-coral-ember}"
    textColor: "{colors.card}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
    border: "1px solid {colors.border}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
    border: "1px solid {colors.border}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "0"
---

# Design System: The Pocket Journal

## 1. Overview

**Creative North Star: "The Pocket Journal"**

Juice looks and feels like a pocket journal you reach for every morning — compact, warm, satisfying to open. The interface is intentionally square (border-radius: 0 almost everywhere), flat by default, and built on a foundation of warm off-white neutrals with a single coral-ember accent that commands attention by being rare.

This system explicitly rejects everything that makes task management feel like enterprise software: no kanban boards, no Gantt charts, no dense data tables, no status pipelines. It also rejects the "cool dark mode" reflex — the dark variant is a warm charcoal, not a blue-black void, and the accent shifts to moss green rather than neon.

The density is loose. Surfaces breathe. The primary action (adding a task) is always one tap away. The app should get quieter the more you use it.

**Key Characteristics:**
- Flat surfaces with minimal shadows; depth is conveyed through tonal layering (surface-raised vs surface-inset)
- Square edges by default; rounded corners are rare and meaningful (modals, calendar cells, quick-add)
- Single accent used sparingly (≤10% of any screen) — its rarity is the point
- Warm neutrals with a subtle card tone, never pure #fff or #000
- Hover and focus states use the accent-subtle tint as a soft glow, not a border or shadow
- The signature interaction is a micro "push down" on primary buttons (2px translate on mousedown), making taps feel tactile

## 2. Colors

The palette is restrained — warm tinted neutrals carry the surface, and a single coral-ember accent provides emphasis. Dark mode shifts the neutral base to warm charcoal and the accent to moss green, preserving warmth across both themes.

### Primary
- **Coral Ember** (#E84545 / oklch(55% 0.2 25)): The single accent. Used for the add-task button, today's calendar cell border, focus indicators, and recurring-task labels. Never used as a background for large surfaces. Approximately 5-10% of any given screen.
- **Moss Glow** (#A3E635 / oklch(75% 0.25 120)): Dark mode accent. Same role as Coral Ember but shifts hue to keep warmth in a dark context — lime-green reads as "living" rather than "alert."

### Neutral
- **Warm Parchment** (#F8F6F3): Page background. Barely-there warmth, reads as off-white. Named after the surface it most resembles.
- **Dark Flannel** (#1C1C1C): Dark mode background. Warm dark grey, never pure charcoal or black.
- **Fresh Card** (#FFFFFF / #252525): Card / raised surface. Pure white in light mode, warm dark grey in dark mode.
- **Inset Field** (#F2F0ED / #2A2A2A): Inset surfaces (calendar cells, hover states). Slightly darker than the page, conveying a pressed-in quality.
- **Fog Grey** (#8A8A85): Muted text and secondary labels. Same warmth as the page background but much lower lightness.
- **Cloud Border** (#E5E3DF / #333333): Borders and dividers. Gentle delineation, never harsh lines.

### Semantic
- **Red Twilight** (#E84545 / #EF4444): Overdue tasks and destructive actions.
- **Green Foliage** (#2ECC71 / #10B981): Success states, sync-indicator dot.
- **Yellow Honey** (#F5B041 / #FBBF24): Optional priority/category marker.
- **Purple Heather** (#9B59B6 / #A855F7): Optional category marker.

### Named Rules
**The Pocket Journal Rule.** The accent color is used on no more than 10% of any given screen. Its rarity gives it weight. When everything is highlighted, nothing is.

**The Warm Rules.** Every neutral is tinted toward the warm side of the hue wheel. Even "white" has a hint of cream. If a surface looks grey or blue, it's wrong.

## 3. Typography

**Display Font:** Plus Jakarta Sans (variable, system-ui fallback)
**Body Font:** Same as display (single-family system)
**Label/Mono Font:** Same family

Plus Jakarta Sans is a warm humanist sans — rounded terminals, open apertures, generous x-height. It pairs well with the square UI edges by providing softness where the layout doesn't.

### Hierarchy
- **Display** (weight 600, 22px, line-height 1.4): Modal titles, settings headers. The largest text in the system; used sparingly.
- **Title** (weight 500, 17px, line-height 1.4): Section headers, task item titles with notes. Comfortably readable at small sizes.
- **Body** (weight 400, 16px, line-height 1.5): Task descriptions, settings body copy, input values. Caps at 65-75ch max line length where it runs prose.
- **Caption** (weight 400, 14px, line-height 1.4): Notes preview, supplementary text.
- **Label** (weight 600, 12px, line-height 1.3, letter-spacing 0.05em, uppercase): Calendar weekday headers, small meta labels. Only used where space is tight and information density is low.

### Named Rules
**The Single Family Rule.** One typeface for everything. Hierarchy is achieved through weight and size contrast, not font switching. This keeps the interface calm — no competing voices.

## 4. Elevation

The system is **flat by default**. Depth is conveyed through tonal layering (darker inset surfaces) rather than shadows. Shadows appear only on interactive or stateful elements — they signal "this can be acted upon," not "this is higher in the stack."

The Settings modal and reschedule menu are rare exceptions — they use the heaviest shadow to express "this is a temporary overlay."

### Shadow Vocabulary
- **Shadow-sm** (`0 1px 2px rgba(0, 0, 0, 0.04)` / `0 1px 3px rgba(0, 0, 0, 0.25)`): Reserved for subtle card separation in dense contexts. Almost invisible.
- **Shadow-md** (`0 4px 12px rgba(0, 0, 0, 0.08)` / `0 4px 12px rgba(0, 0, 0, 0.3)`): Used on the FAB and toggle buttons in the footer — the main call-to-action surfaces.
- **Shadow-lg** (`0 8px 24px rgba(0, 0, 0, 0.12)` / `0 8px 24px rgba(0, 0, 0, 0.35)`): Modal and overlay depth. Only for temporary surfaces above the page.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadows on cards, list items, or containers in their default state. Shadows only appear as a response to state (hover, interactivity, or overlay).

## 5. Components

### Buttons
- **Shape:** Square (0px radius). The square edge is a deliberate system signal — nothing is rounded "because it looks modern."
- **Primary (Add / Save / Confirm):** Solid accent background (Coral Ember / Moss Glow), white text, square edges. On mousedown, pushes 2px down and right — a tactile micro-interaction that makes the tap feel physical.
- **Secondary (Cancel / Dismiss):** Transparent background, 1px border (Cloud Border), foreground text. Hover tints the background to accent-subtle and shifts the border to accent.
- **Ghost (Settings icon, Search icon in footer):** No background. Border only. Hover fills with accent-subtle and shifts icon color to accent.

### Inputs / Fields
- **Shape:** Square (0px radius). Consistently 48px minimum height for touch targets.
- **Default:** Card background, 1px Cloud Border stroke, foreground text.
- **Focus:** A 4px offset box-shadow in the accent color (`4px 4px 0 var(--accent)`) replaces the border shift — creates a "pinned corner" effect that's distinctive and warm.
- **Placeholder:** Fog Grey, no italics (italics signal "empty field" too aggressively).
- **Error / Disabled:** Disabled uses muted-light background + muted text; error uses Red Twilight border.

### Cards / Containers
- **Corner Style:** Square (0px). Not rounded. Cards in Juice are just bordered containers — no elevation, no border-radius, no pretense.
- **Background:** Fresh Card (white / warm dark grey).
- **Shadow Strategy:** None at rest. Shadows appear only for interactive or overlay state.
- **Border:** 1px Cloud Border, full perimeter.
- **Internal Padding:** 24px (the system's dominant spacing unit).

### Task Items
- **Shape:** Full-width rows with no container. Each task is a bottom-bordered strip (1px Cloud Border) with 16px vertical padding.
- **Hover:** Background tints to Inset Field — a subtle change that doesn't fight for attention.
- **Animation:** On completion, the row fades and slides left 8px (opacity 0.25s, transform 0.25s) — a satisfying "crossing off" effect.
- **Checkbox:** 24px square, 2px border. Border shifts from Cloud Border to accent on hover. On completion, fills with accent and shows a white checkmark.

### Chips / Tags
- **Recurrence badge:** Inline text in accent color with a small icon. No background container — just the text and icon floating beside the task title.
- **Time badge:** Same pattern as recurrence. No container, just text + icon.

### Calendar
- **Cells:** Grid layout, 150px min-height. Background uses Inset Field for visible-month days, transparent for non-visible. Month-start cells get a distinct background (Calendar Month Start).
- **Today:** Accent-subtle background + 1px Coral Ember border. The most visually emphasized cell.
- **Hover:** Accent-subtle tint — same treatment as buttons and task items.
- **Events:** Tiny labels (10px, weight 600) in accent color with a 1px event-border stroke. Compact enough to stack.

### Quick Add Bar
- **Shape:** 12px border-radius — one of the few rounded elements. Its roundness signals "this is the primary input."
- **Style:** Card background, Cloud Border stroke at rest. On focus, border shifts to accent and a soft box-shadow appears.
- **Icon:** Plus icon in the leading position, colored muted-light at rest, accent on focus.

### Modals
- **Backdrop:** Semi-transparent black overlay (rgba 0.5) with 8px blur. Creates visual separation without removing context.
- **Container:** 16px border-radius — the other rounded element. Max-width 420px. Card background. Shadow-lg overlay.
- **Footer:** Separated by a full-width border. Background matches the page (not the card) — creates a subtle "pulled from the page" feel.

### Navigation
- **Bottom bar (mobile):** Fixed-position toolbar with four actions (toggle view, search, settings, add). Square buttons, 60px for primary actions (toggle, add), 48px for secondary (search, settings). Flat at rest, md-shadow on primary buttons.

## 6. Do's and Don'ts

### Do:
- **Do** use Coral Ember (light) or Moss Glow (dark) as the sole accent, and keep it to ≤10% of any screen.
- **Do** keep surfaces flat at rest. No card shadows, no raised containers in their default state.
- **Do** use warm-tinted neutrals — even "white" should have a hint of cream (#F8F6F3 page, #F2F0ED inset).
- **Do** prefer square edges (0px radius) for buttons, inputs, and containers. Reserve rounding for the Quick Add bar (12px) and modals (16px).
- **Do** use the 4px offset box-shadow (`4px 4px 0 var(--accent)`) as the focus indicator for inputs — it's distinctive and warm.
- **Do** apply hover states as accent-subtle background tints with accent-colored icon/border shifts. Never underline, never bold-on-hover.
- **Do** use the 2px micro-push on primary buttons (mousedown translate 2px 2px) — it makes taps feel physical.

### Don't:
- **Don't** use #fff or #000. Every neutral must be tinted warm.
- **Don't** add shadows to cards, list items, or static containers. Flat by default.
- **Don't** use border-left or border-right greater than 1px as a decorative accent stripe. That's a pattern that says "AI generated."
- **Don't** use gradient text (`background-clip: text`). Single solid colors only.
- **Don't** use glassmorphism as a default — blurs and glass cards have no place in a pocket journal.
- **Don't** use em dashes. Use commas, colons, or periods instead.
- **Don't** follow the hero-metric template (big number, small label, supporting stats). This is a task app, not a dashboard.
- **Don't** create identical card grids — same-sized cards with icon + heading + text repeated endlessly.
- **Don't** open a modal as the first response to an action. Exhaust inline / progressive alternatives first.
- **Don't** use flat typography scales — ensure at least 1.25x ratio between hierarchy steps.
- **Don't** animate CSS layout properties (width, height, top, padding, margin). Use opacity, transform, and color only.
- **Don't** use bounce or elastic easings. Apply exponential ease-out curves (ease-out-quart or steeper).
- **Don't** reproduce the dense, utilitarian aesthetic of TickTick, Todoist, or any enterprise task manager. No kanban boards, Gantt charts, or status pipelines.
- **Don't** use blue-black or navy for dark mode. The dark background is warm charcoal (#1C1C1C), not a cool color.
