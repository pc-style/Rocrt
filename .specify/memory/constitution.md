# Procreate Clone Constitution

<!--
Sync Impact Report (Version 1.0.0):
- Version change: initial → 1.0.0
- Principles established:
  I. Performance-First Architecture
  II. Canvas-First UI
  III. Gesture-Native Interactions
  IV. GPU-Optimized Rendering
  V. Predictable & Testable State
- Templates requiring updates:
  ✅ plan-template.md (reviewed - Constitution Check section aligns)
  ✅ spec-template.md (reviewed - user scenarios align with principle II & III)
  ✅ tasks-template.md (reviewed - task organization supports all principles)
- Follow-up TODOs: None (all critical fields defined)
-->

## Core Principles

### I. Performance-First Architecture

**Zero perceived latency is mandatory.** Every architectural decision must prioritize rendering speed, input responsiveness, and GPU efficiency over feature completeness.

**Rules:**
- Input sampling MUST run at 120Hz minimum (240Hz target)
- Brush stroke latency MUST be imperceptible (<16ms frame time at 60fps, <8ms at 120fps)
- Tile-based rendering MUST be used to minimize GPU memory transfers
- CPU-to-GPU data transfer MUST be minimized through sparse texture management
- Any dropped frame is a UX failure requiring immediate investigation

**Rationale:** The "Procreate Feel" depends entirely on performance. Features that cannot meet these performance standards must be redesigned or rejected.

### II. Canvas-First UI

**The canvas is always dominant.** UI elements exist only to serve drawing and must justify their presence by reducing friction.

**Rules:**
- Canvas MUST occupy full viewport (edge-to-edge, no permanent panels)
- UI elements MUST float above canvas, never resize it
- Maximum 9 primary icons visible at any time
- No labels by default (icons must be self-evident)
- Progressive disclosure: power features hidden until needed
- All UI interactions MUST be dismissible with a single tap/gesture

**Rationale:** Following Procreate's philosophy: "If the user is thinking about the UI, the UI has failed." The interface should be invisible and physically learnable.

### III. Gesture-Native Interactions

**Gestures are not shortcuts—they ARE the primary interface.** All core workflows must be gesture-driven.

**Rules:**
- Core actions (undo/redo/clear/zoom/rotate) MUST be accessible via gestures
- Gestures MUST be global, not tool-specific
- Gesture detection latency MUST be imperceptible
- Gestures MUST never conflict with drawing interactions
- Multi-touch MUST use FSM (Finite State Machine) to distinguish DRAWING_STATE from GESTURE_STATE
- Accidental discovery is acceptable; explicit tutorials are not required

**Rationale:** Motor memory and spatial learning create a more fluent experience than menu navigation. Users should develop physical muscle memory for common actions.

### IV. GPU-Optimized Rendering

**All rendering must leverage GPU compute.** The Valkyrie rendering engine principles are non-negotiable.

**Rules:**
- Tile-based rasterization (256×256 or 512×512 tiles) MUST be implemented
- Only modified tiles MUST be updated and re-uploaded to GPU
- 16-bit linear blending MUST be used to prevent color banding
- Brush blending MUST occur in linear light space
- GPU compositor MUST handle layer blend modes (Multiply, Screen, Overlay, etc.)
- Procedural shaders MUST calculate brush dynamics (Shape × Grain × Dynamics)
- WebGL or WebGPU MUST be used (platform-dependent)

**Rationale:** CPU-based rendering cannot achieve the required performance. GPU optimization is the only path to 120Hz responsiveness and large canvas support.

### V. Predictable & Testable State

**State management must be action-oriented and deterministic.** The Chronos state layer principles ensure reliable undo/redo and time-lapse recording.

**Rules:**
- History MUST store high-level actions (StrokeAction objects), not pixel diffs
- Each action MUST contain: brush settings, path data, affected tile IDs
- Checkpoint snapshots MUST occur every 50 actions for fast recovery
- Serialization MUST happen in background workers (no main-thread blocking)
- Auto-save MUST use IndexedDB for web, platform-native storage otherwise
- State mutations MUST be isolated and testable
- Time-lapse recording MUST capture every stroke deterministically

**Rationale:** Undo/redo reliability is critical to artist confidence. Action-based history enables infinite undo, time-lapse export, and crash recovery without massive memory overhead.

## Architecture Layers

### Layer Responsibilities

This project is organized into five architectural layers. All code, features, and modifications MUST respect layer boundaries.

**Valkyrie (Rendering Pipeline)**
- Tile-based GPU rasterization
- Sparse texture atlas management
- 16-bit linear color blending
- Layer compositor with blend modes

**Sensory (Input & Gestures)**
- High-rate input sampling (120Hz+)
- Finite State Machine for touch disambiguation
- Predictive stroke algorithms (1-2 frame lookahead)
- Bezier curve smoothing for stabilization

**Alchemy (Brush Logic)**
- Procedural stamp plotting (Shape × Grain model)
- Brush dynamics computation
- Offscreen preview rendering engine

**Chronos (State & Persistence)**
- Action-led history (StrokeAction recording)
- Checkpoint snapshots (every 50 actions)
- Background serialization workers
- Time-lapse recording
- Auto-save to IndexedDB/native storage

**Luma (UI Overlay)**
- Minimalist "canvas-first" rendering
- Floating sliders (size/opacity)
- Top-bar modal popovers
- Gesture-driven panel interactions
- Spatial hit-testing for touch targets

**Cross-layer Rules:**
- Luma MUST NOT directly manipulate Valkyrie state
- Sensory MUST route user intent to Alchemy or Chronos
- Chronos MUST observe Valkyrie changes, not control them
- All inter-layer communication MUST use defined contracts/events

## Design Standards

### Visual & Interaction Constraints

Following `style.md` principles:

**Visual Rules:**
- Flat, monochrome, high-contrast icons only
- No animations longer than 150ms
- No loading spinners during drawing
- Feedback MUST be subtle and non-distracting

**Interaction Rules:**
- Same gesture = same result everywhere (global consistency)
- Same icon = same behavior everywhere
- No hidden modes (special states MUST be visually indicated)
- No toolbars that resize the canvas
- No floating windows overlapping input paths
- No text-heavy menus
- Direct manipulation over configuration dialogs

### Anti-Patterns (Explicitly Prohibited)

- CPU-based rendering pipelines
- Synchronous main-thread serialization
- UI panels that shrink the canvas
- Mode toggles without visual confirmation
- Configuration-first workflows
- Pixel-diff based undo systems
- Nested dropdown menus (max 2 levels in modals)

## Development Workflow

### Technology Preferences

- **Package Manager (JS/TS):** `bun` (install, test, build, run)
- **Package Manager (Python):** `uv` over pip
- **Documentation Lookup:** Context7 MCP as source of truth for library docs

### Code Quality Standards

- Clarity and readability over cleverness
- Minimal comments (only where logic isn't self-evident)
- Natural, plain language in comments (no AI-generated style)
- Project-specific conventions MUST be followed consistently
- No unnecessary boilerplate or verbose docstrings

### Testing Requirements

**When tests are requested:**
- Write tests FIRST, ensure they FAIL before implementation (TDD)
- Contract tests for API boundaries
- Integration tests for cross-layer workflows
- Unit tests for isolated logic (optional, not mandatory)

**Testing is OPTIONAL by default.** Only include tests when:
1. Explicitly requested in feature specification
2. Required by Constitution Check for critical paths
3. Validating cross-layer contracts

### Graphite CLI Workflow

Use Graphite CLI (`gt`) for branch management:

- `gt create` BEFORE starting work on each logical increment
- `gt submit` to create VRs/PRs (use `--stack` for multi-branch stacks)
- `gt modify` to update existing branches
- `gt sync` frequently to restack dependent branches
- Use `gt` instead of raw git for stack-aware operations

### CodeRabbit CLI Integration

Run CodeRabbit CLI before commits and VR submissions:

- Run `coderabbit` on uncommitted changes to catch issues early
- Use `--plain` for machine-friendly output
- Use `--base main` for trunk comparison
- Fix reported issues before `gt submit`

### Commit Standards

- Commit after each logical task or task group
- Follow conventional commits format when applicable
- Multi-file changes that alter behavior MUST include architecture notes in PR description explaining layer interactions

## Governance

### Amendment Procedure

1. Propose amendment with rationale and impact analysis
2. Identify affected templates (plan, spec, tasks, commands)
3. Update constitution with version bump (see versioning rules below)
4. Propagate changes to dependent templates
5. Document sync impact in HTML comment at top of constitution
6. Commit with message: `docs: amend constitution to vX.Y.Z (brief change summary)`

### Versioning Policy

Constitution follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward-incompatible changes (principle removals, redefinitions)
- **MINOR**: New principles, new sections, material expansions
- **PATCH**: Clarifications, wording fixes, non-semantic refinements

### Complexity Justification

Any violation of constitution principles MUST be justified in `plan.md` Complexity Tracking table:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Example: CPU fallback renderer | Legacy device support | GPU-only approach excludes 15% users |

### Compliance Review

- All PRs MUST verify compliance with constitution principles
- Constitution Check in `plan.md` MUST pass before Phase 0 research
- Re-check after Phase 1 design to validate approach
- Unjustified complexity MUST be refactored or rejected

### Runtime Guidance

For agent-specific or runtime development guidance not covered here:
- Consult `CLAUDE.md` (project-level instructions)
- Consult `~/.claude/CLAUDE.md` (global user preferences)
- Consult architecture.md, style.md, features.md for domain context

**Version**: 1.0.0 | **Ratified**: 2026-01-05 | **Last Amended**: 2026-01-05
