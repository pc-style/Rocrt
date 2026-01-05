# Procreate UI Style Guide (Descriptive)

This document describes the Procreate UI as a system of intentional constraints rather than a collection of screens. The UI is designed to disappear during use, prioritizing canvas presence, motor memory, and uninterrupted flow.

---

## Core Philosophy

**Canvas-first, controls-second.**  
The UI exists only to serve drawing. Every visible control must justify its presence by reducing friction, not adding capability.

**Gesture over chrome.**  
Interactions are spatial and muscle-memory-driven, not menu-driven.

**Progressive disclosure.**  
Power is hidden until needed. Beginners see little. Experts access everything.

---

## Visual Structure

### Canvas

- Always dominant.
- Full-bleed, edge-to-edge.
- No permanent panels or docks.
- Canvas is the background; UI floats above it.

### UI Elements

- Minimal icon count (≈ 9 primary icons).
- Icons are flat, monochrome, high-contrast.
- No labels by default.
- Icons never resize or reflow dynamically.

**Rule:** If an element is visible, it must be actionable immediately.

---

## Top Bar (Primary Controls)

Position: **Top edge, centered horizontally**

Contains:
- Brush
- Smudge
- Erase
- Layers
- Color

Characteristics:
- Fixed order.
- Large hit targets.
- No nested dropdowns.
- Tap opens modal panels, not sidebars.

---

## Secondary Controls

### Sliders (Brush Size / Opacity)

- Vertical sliders on screen edges.
- Always reachable by thumb.
- Visible only when needed.
- Direct manipulation, no numeric input required.

**Behavior:**
- Immediate feedback.
- No confirmation step.
- Continuous, not stepped.

---

## Panels & Modals

### Panels

- Slide over canvas, never shrink it.
- Dismissible by tap outside or gesture.
- Remember last state (sticky context).

### Modals

- Full focus when open.
- No background interaction.
- Minimal internal navigation depth (max 2 levels).

---

## Gestures (Primary UX Layer)

Gestures are not shortcuts. They *are* the UI.

Examples:
- Two-finger tap: Undo
- Three-finger tap: Redo
- Pinch: Zoom / rotate
- QuickShape: Hold stroke to refine

**Rules:**
- Gestures are global, not tool-specific.
- Gestures never conflict.
- Gesture latency must be imperceptible.

---

## Discoverability Strategy

- No onboarding overlays explaining everything.
- Discovery through:
  - Accidental success (e.g. hold-to-shape).
  - Community learning.
  - Optional handbook, not in-app nags.

**Tradeoff accepted:** Some features remain invisible unless learned intentionally.

---

## Feedback & State

### Visual Feedback

- Subtle, non-distracting.
- No animations longer than 150ms.
- No loading spinners during drawing.

### State Persistence

- UI remembers:
  - Last brush
  - Last panel state
  - Last gesture configuration
- Undo stack is continuous and global.

---

## Consistency Rules

- Same gesture = same result everywhere.
- Same icon = same behavior everywhere.
- No mode switching without visual confirmation.

**No hidden modes.**
If the app is in a special state, it must be visible.

---

## Performance as UI

- Zero perceived latency is mandatory.
- Any dropped frame is a UX failure.
- Rendering, input, and UI updates are tightly coupled.

**Design assumption:**  
If performance drops, simplify the UI before adding indicators.

---

## Anti-Patterns (Explicitly Avoided)

- Toolbars that resize the canvas.
- Floating windows that overlap input paths.
- Text-heavy menus.
- Mode toggles without visual grounding.
- Configuration-first workflows.

---

## Summary Rule

> If the user is thinking about the UI, the UI has failed.

The Procreate interface is successful not because it is simple, but because it is *predictable, invisible, and physically learnable*.