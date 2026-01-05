# Procreate Clone: Parallel Development Tasks (`todo.md`)

This task list is designed for 5 independent AI sub-agents working in parallel. No agent blocks another.

---

## 🟢 Agent 1: Engine Specialist (Valkyrie)
**Goal:** Implement the raw rendering and tile management system.
- [ ] **Task 1.1**: Create `TileManager` to handle sparse allocation and GPU texture caching of canvas segments.
- [ ] **Task 1.2**: Implement the `GPUCompositor` shader for real-time layer blending (Normal, Multiply, Screen).
- [ ] **Task 1.3**: Build the 16-bit Linear Light pipeline for color accuracy.
- [ ] **Task 1.4**: Implement "Reference Layer" logic in the compositor.

## 🔵 Agent 2: Interaction Specialist (Sensory)
**Goal:** Handle input, gestures, and stroke prediction.
- [ ] **Task 2.1**: Implement high-rate input polling (up to 240Hz) with multi-touch FSM (Finite State Machine).
- [ ] **Task 2.2**: Build the 2-finger Undo / 3-finger Redo gesture listeners.
- [ ] **Task 2.3**: Create the `QuickShapeDetector` (recognizing lines, circles, and polygons from raw paths).
- [ ] **Task 2.4**: Implement "Stroke Prediction" to mask perceived latency.

## 🔴 Agent 3: Brush Architect (Alchemy)
**Goal:** Develop the procedural brush engine and shaders.
- [ ] **Task 3.1**: Create the `BrushShader` implementing the Shape + Grain procedural model.
- [ ] **Task 3.2**: Implement `Stabilization` logic (Cubic Bezier path interpolation).
- [ ] **Task 3.3**: Develop the "Brush Studio" preview engine (rendering a stroke on a small canvas).
- [ ] **Task 3.4**: Implement "Dual Brush" blending logic (combining two brush textures).

## 🟡 Agent 4: UI/UX Designer (Luma)
**Goal:** Build the minimal, "canvas-first" interface according to `style.md`.
- [ ] **Task 4.1**: Build the floating vertical sliders for Brush Size and Opacity with thumb-driven hit targets.
- [ ] **Task 4.2**: Implement the high-contrast minimalist Top Bar (9-icon limit).
- [ ] **Task 4.3**: Create the pop-over system for Color Wheel and Layer Stack (ensuring they don't resize the canvas).
- [ ] **Task 4.4**: Implement the "Reference Window" (secondary small canvas viewer).

## 🟣 Agent 5: State & Sync (Chronos)
**Goal:** Manage history, serialization, and time-lapse.
- [ ] **Task 5.1**: Implement the `ActionHistory` system (storing high-level stroke events instead of pixel diffs).
- [ ] **Task 5.2**: Build the `BackgroundSerializer` for checkpoint snapshots.
- [ ] **Task 5.3**: Create the `TimeLapseEncoder` that records strokes into a video-friendly format.
- [ ] **Task 5.4**: Implement "Auto-Save" to IndexedDB for crash recovery.

---

## 🛠 Orchestration Instructions
Use the `antigravity-subagents` command to spin up these agents.
Example:
```bash
npx subagent --task "Task 1.1: Create TileManager" --agent-name "Valkyrie"
```
*Note: Ensure all agents share the same type definitions for `StrokeAction` and `TileData` to maintain integration.*
