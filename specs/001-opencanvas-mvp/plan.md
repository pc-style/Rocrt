# Implementation Plan: OpenCanvas MVP

**Branch**: `001-opencanvas-mvp` | **Date**: 2026-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-opencanvas-mvp/spec.md`

## Summary

Build a minimal viable Procreate-like drawing application with lag-free canvas rendering, pressure-sensitive brushes, layers, and undo/redo. The implementation follows the five-layer architecture (Valkyrie, Sensory, Alchemy, Chronos, Luma) with GPU-accelerated tile-based rendering, action-led history, and gesture-first interactions.

**Development Strategy**: Bottom-up approach starting with Valkyrie (rendering foundation), then Sensory (input handling), Alchemy (brush logic), followed by Luma (UI controls) and Chronos (state/history) integration throughout.

## Technical Context

**Language/Version**: TypeScript 5.x with ES2020+ target
**Primary Dependencies**: NEEDS CLARIFICATION (WebGL 2.0 or WebGPU wrapper library - need to research best options for tile-based rendering)
**Storage**: IndexedDB for canvas state persistence (future auto-save)
**Testing**: Vitest for unit tests, Playwright for integration tests (if testing required)
**Target Platform**: Modern web browsers (Chrome 90+, Safari 14+), optimized for tablet devices
**Project Type**: Single-page web application with modular architecture
**Performance Goals**: 60fps minimum (120fps target) during active drawing, <16ms frame time, <8ms input-to-render latency
**Constraints**: <100ms undo/redo operations, <100ms layer visibility toggles, support 4096x4096 canvas, minimum 5 layers, 100+ undo steps
**Scale/Scope**: Single-user offline application, ~10-15 core modules across 5 architectural layers, targeting professional digital art workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Performance-First Architecture

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Input sampling 120Hz minimum | ✅ PASS | Sensory layer will use PointerEvent with high-frequency polling |
| Brush stroke latency <16ms | ✅ PASS | GPU-based rendering in Valkyrie ensures sub-frame latency |
| Tile-based rendering required | ✅ PASS | Core Valkyrie architecture uses 256×256 or 512×512 tiles |
| Minimize CPU-to-GPU transfers | ✅ PASS | Sparse texture updates (dirty tiles only) |
| Zero dropped frames | ✅ PASS | RequestAnimationFrame scheduling with frame budget monitoring |

**Status**: ✅ PASS - All performance requirements aligned with constitution

### Principle II: Canvas-First UI

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Canvas occupies full viewport | ✅ PASS | Luma layer renders floating UI elements only |
| UI elements float above canvas | ✅ PASS | No canvas resizing, overlay pattern |
| Max 9 primary icons | ✅ PASS | MVP has minimal toolset (brush, layers, undo/redo, color) |
| No labels by default | ✅ PASS | Icon-only interface |
| Progressive disclosure | ✅ PASS | Layer panel and brush settings appear on demand |
| Dismissible with single tap/gesture | ✅ PASS | Tap outside modal closes UI |

**Status**: ✅ PASS - Minimal UI design aligned with canvas-first philosophy

### Principle III: Gesture-Native Interactions

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Core actions accessible via gestures | ✅ PASS | Two-finger tap for undo, three-finger tap for redo, pinch-zoom, pan, rotate |
| Gestures are global, not tool-specific | ✅ PASS | Sensory layer handles gestures uniformly |
| Imperceptible gesture detection latency | ✅ PASS | FSM-based disambiguation in Sensory layer |
| No gesture/drawing conflicts | ✅ PASS | FSM distinguishes DRAWING_STATE from GESTURE_STATE |
| Multi-touch uses FSM | ✅ PASS | Core requirement of Sensory architecture |

**Status**: ✅ PASS - FSM-based gesture handling meets requirements

### Principle IV: GPU-Optimized Rendering

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Tile-based rasterization (256×256 or 512×512) | ✅ PASS | Valkyrie core design |
| Only modified tiles updated | ✅ PASS | Dirty tile tracking system |
| 16-bit linear blending | ✅ PASS | Shader implementation for professional color accuracy |
| Brush blending in linear light space | ✅ PASS | Alchemy shaders operate in linear space |
| GPU compositor for blend modes | ✅ PASS | Normal, Multiply, Screen modes in shaders |
| Procedural brush dynamics | ✅ PASS | Alchemy calculates Shape × Grain × Dynamics |
| WebGL or WebGPU required | ⚠️ NEEDS RESEARCH | Need to evaluate WebGL 2.0 vs WebGPU adoption/support |

**Status**: ⚠️ CONDITIONAL PASS - Pending WebGL/WebGPU decision (Phase 0 research)

### Principle V: Predictable & Testable State

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Action-oriented history (not pixel diffs) | ✅ PASS | Chronos stores StrokeAction objects |
| Each action contains: brush, path, tiles | ✅ PASS | Full action reconstruction data |
| Checkpoint snapshots every 50 actions | ✅ PASS | Chronos checkpoint strategy |
| Background worker serialization | ✅ PASS | Web Worker for IndexedDB writes |
| Auto-save to IndexedDB | ✅ PASS (future) | Infrastructure in MVP, feature post-MVP |
| Isolated, testable state mutations | ✅ PASS | Chronos provides action replay capability |
| Deterministic time-lapse recording | ✅ PASS (future) | Action log enables reconstruction |

**Status**: ✅ PASS - Action-led architecture fully aligned

### Layer Boundary Compliance

| Requirement | Plan Compliance | Notes |
|-------------|-----------------|-------|
| Luma MUST NOT directly manipulate Valkyrie | ✅ PASS | Luma dispatches actions to Chronos |
| Sensory routes intent to Alchemy/Chronos | ✅ PASS | Input FSM emits high-level events |
| Chronos observes Valkyrie, doesn't control | ✅ PASS | Event-driven pattern |
| Inter-layer communication uses contracts | ✅ PASS | TypeScript interfaces define boundaries |

**Status**: ✅ PASS - Clear layer separation enforced

### Overall Constitution Status

**Initial Check**: ✅ PASS with 1 research item
- ⚠️ Need to decide WebGL 2.0 vs WebGPU (impacts Valkyrie implementation)

**Re-check Trigger**: After Phase 1 design completes

---

## Post-Design Constitution Re-Check

**Date**: 2026-01-05
**Status**: ✅ PASS - All research items resolved, design is constitution-compliant

### Resolved Items

1. **WebGL 2.0 vs WebGPU Decision**: ✅ RESOLVED
   - **Decision**: WebGL 2.0 (from research.md)
   - **Rationale**: Universal browser support in target browsers, proven stability
   - **Constitution Impact**: Meets Principle IV (GPU-Optimized Rendering) requirements
   - **Future Path**: WebGPU migration post-MVP when Safari support stabilizes

### Design Validation

**Principle I - Performance-First Architecture**: ✅ PASS
- Input sampling: Sensory uses PointerEvent with 120Hz polling ✓
- Frame budget: Valkyrie maintains <16ms frame time via RAF scheduling ✓
- Tile rendering: 256×256 tiles with dirty tracking ✓
- GPU transfers: Sparse texture updates (dirty tiles only) ✓

**Principle II - Canvas-First UI**: ✅ PASS
- Luma uses Preact (3KB) for minimal UI footprint ✓
- Floating toolbar with max 9 icons ✓
- No canvas resizing (overlay pattern) ✓

**Principle III - Gesture-Native Interactions**: ✅ PASS
- Sensory FSM handles gesture disambiguation ✓
- Two-finger tap (undo), three-finger tap (redo), pinch/pan/rotate ✓
- No gesture/drawing conflicts (FSM state separation) ✓

**Principle IV - GPU-Optimized Rendering**: ✅ PASS
- WebGL 2.0 selected (meets all rendering requirements) ✓
- 16-bit linear blending in shaders ✓
- Tile-based rasterization (256×256) ✓
- Procedural brush dynamics in Alchemy ✓

**Principle V - Predictable & Testable State**: ✅ PASS
- Chronos stores StrokeAction objects (not pixel diffs) ✓
- Checkpoint every 50 actions ✓
- Background worker serialization (idb library) ✓
- IndexedDB for persistence ✓

**Layer Boundary Compliance**: ✅ PASS
- TypeScript contracts define all layer interfaces ✓
- Event-driven communication via core/events.ts ✓
- No direct cross-layer dependencies ✓

### Technology Stack Validation

All technology decisions from research.md align with constitution:

| Technology | Purpose | Constitution Alignment |
|------------|---------|------------------------|
| TypeScript 5.x | Type safety, contracts | ✅ Supports testable state (Principle V) |
| WebGL 2.0 | GPU rendering | ✅ Meets Principle IV requirements |
| Preact | Minimal UI | ✅ Canvas-first (3KB vs React 45KB) |
| Vite | Fast builds, HMR | ✅ Developer experience, aligns with bun preference |
| idb | IndexedDB wrapper | ✅ Background serialization (1.5KB) |
| Native PointerEvent | Input sampling | ✅ Maximum responsiveness (Principle I) |

**Final Status**: ✅ All constitution principles satisfied, no violations, ready for implementation

## Project Structure

### Documentation (this feature)

```text
specs/001-opencanvas-mvp/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── valkyrie.ts      # Rendering layer interface
│   ├── sensory.ts       # Input layer interface
│   ├── alchemy.ts       # Brush layer interface
│   ├── chronos.ts       # State layer interface
│   ├── luma.ts          # UI layer interface
│   └── types.ts         # Shared type definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── valkyrie/            # Rendering Engine
│   ├── tile-manager.ts      # Tile allocation and dirty tracking
│   ├── texture-atlas.ts     # Sparse GPU texture management
│   ├── compositor.ts        # Layer composition with blend modes
│   ├── shaders/
│   │   ├── brush-blend.glsl    # 16-bit linear blending shader
│   │   ├── layer-composite.glsl # Blend mode shaders (Normal/Multiply/Screen)
│   │   └── tile-render.glsl    # Tile rasterization shader
│   └── index.ts             # Valkyrie public API
│
├── sensory/             # Input & Gesture System
│   ├── input-sampler.ts     # High-frequency PointerEvent capture (120Hz+)
│   ├── gesture-fsm.ts       # Finite State Machine (DRAWING_STATE vs GESTURE_STATE)
│   ├── palm-rejection.ts    # Touch filtering algorithm
│   ├── stroke-predictor.ts  # 1-2 frame lookahead for latency compensation
│   ├── bezier-smoother.ts   # Stroke stabilization
│   └── index.ts             # Sensory public API
│
├── alchemy/             # Brush Logic & Physics
│   ├── brush-engine.ts      # Round brush procedural renderer
│   ├── pressure-curves.ts   # Size/opacity response to pressure input
│   ├── stamp-plotter.ts     # Spacing calculation for continuous strokes
│   ├── dynamics.ts          # Shape × Grain × Dynamics computation
│   └── index.ts             # Alchemy public API
│
├── chronos/             # State & History Management
│   ├── action-log.ts        # StrokeAction recording
│   ├── history-stack.ts     # Undo/redo with 100+ step support
│   ├── checkpoint.ts        # Snapshot every 50 actions
│   ├── serializer.ts        # Background worker for IndexedDB
│   ├── auto-save.ts         # (Future) Periodic persistence
│   └── index.ts             # Chronos public API
│
├── luma/                # UI Overlay
│   ├── canvas-overlay.tsx   # Main canvas container (React)
│   ├── toolbar.tsx          # Top floating toolbar
│   ├── layer-panel.tsx      # Layer stack UI
│   ├── brush-slider.tsx     # Size/opacity controls
│   ├── color-picker.tsx     # Basic color selection
│   └── index.tsx            # Luma public API
│
├── core/                # Shared Infrastructure
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── events.ts            # Event bus for layer communication
│   ├── config.ts            # App configuration (tile size, performance budgets)
│   └── performance-monitor.ts # Frame timing and diagnostics
│
└── main.ts              # Application entry point

tests/
├── contract/            # Layer boundary tests
│   ├── valkyrie.test.ts
│   ├── sensory.test.ts
│   ├── alchemy.test.ts
│   ├── chronos.test.ts
│   └── luma.test.ts
├── integration/         # Cross-layer workflow tests
│   ├── drawing-workflow.test.ts
│   ├── layer-workflow.test.ts
│   └── undo-redo.test.ts
└── unit/                # Isolated component tests (as needed)
```

**Structure Decision**: Single-page web application with five architectural layers as separate top-level modules. Each layer has a defined public API (index.ts exports) and internal implementation details. Contracts are defined in TypeScript interfaces to enforce layer boundaries. React is used only in Luma layer for UI rendering; all other layers are vanilla TypeScript.

## Complexity Tracking

**No Constitution violations** - All architectural decisions align with established principles. The five-layer architecture, GPU rendering, action-led history, and gesture-first UI all conform to constitution requirements.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |

## Phase 0: Research & Technology Decisions

**Status**: Pending
**Output**: `research.md`

### Research Tasks

1. **WebGL 2.0 vs WebGPU Decision** (CRITICAL)
   - **Question**: Which GPU API should Valkyrie use?
   - **Criteria**: Browser support (Chrome 90+, Safari 14+), tile-based rendering patterns, 16-bit texture support, shader complexity
   - **Output**: Technology choice with rationale

2. **Tile Rendering Library Evaluation**
   - **Question**: Use raw WebGL/WebGPU or leverage existing library (e.g., PixiJS, Babylon.js, custom wrapper)?
   - **Criteria**: Tile management features, performance overhead, learning curve, bundle size
   - **Output**: Library choice or "vanilla WebGL/WebGPU" decision

3. **React vs Vanilla JS for Luma Layer**
   - **Question**: Is React overkill for minimal UI, or does it provide necessary state management?
   - **Criteria**: Re-render performance, bundle size, team familiarity, UI complexity
   - **Output**: UI framework choice

4. **PointerEvent Polyfill Requirements**
   - **Question**: Do we need polyfills for older browsers, or can we rely on native PointerEvent API?
   - **Criteria**: Target browser support matrix, polyfill overhead
   - **Output**: Polyfill strategy or native-only decision

5. **IndexedDB Wrapper Library**
   - **Question**: Use raw IndexedDB API or leverage Dexie.js/idb for Chronos serialization?
   - **Criteria**: API ergonomics, transaction handling, performance
   - **Output**: Storage library choice

6. **TypeScript Build Tooling**
   - **Question**: Vite, esbuild, webpack, or bun's bundler for build pipeline?
   - **Criteria**: Build speed, tree-shaking, HMR support, TypeScript integration
   - **Output**: Build tool choice

7. **Color Space Handling**
   - **Question**: How to ensure 16-bit linear blending works correctly across browsers?
   - **Criteria**: sRGB to linear conversion, gamma correction in shaders, browser inconsistencies
   - **Output**: Color pipeline implementation strategy

8. **Pressure Sensitivity Calibration**
   - **Question**: How to normalize pressure values across Wacom/Apple Pencil/other devices?
   - **Criteria**: Device-specific quirks, calibration UI requirements, fallback for non-pressure devices
   - **Output**: Pressure curve normalization approach

### Research Methodology

For each research task:
1. Consult Context7 for library documentation
2. Review existing Procreate-clone projects on GitHub for patterns
3. Test performance benchmarks where applicable (tile rendering, input latency)
4. Document decision in `research.md` with:
   - **Decision**: What was chosen
   - **Rationale**: Why it was chosen (align with constitution performance goals)
   - **Alternatives Considered**: What else was evaluated
   - **Trade-offs**: What we gain/lose with this choice

## Phase 1: Design & Contracts

**Status**: Pending (blocked on Phase 0 research)
**Output**: `data-model.md`, `contracts/`, `quickstart.md`

### Data Model Extraction

From spec.md Key Entities section, generate `data-model.md` with:

**Core Entities:**

1. **Canvas**
   - Fields: width, height, zoomLevel, panOffset (x,y), rotationAngle, layers[]
   - Validation: width/height 256-4096px, zoom 12.5%-6400%, rotation 0-360deg
   - State Transitions: none (pure data structure)

2. **Layer**
   - Fields: id, name, visible, opacity (0-100%), blendMode (Normal/Multiply/Screen), zIndex, tileData[]
   - Validation: opacity 0-100, zIndex maintained in order, blendMode enum
   - State Transitions: visibility toggle, opacity slide, blend mode change

3. **Stroke**
   - Fields: id, layerId, points[], brushConfig, timestamp
   - Validation: points.length > 0, brushConfig matches Brush schema
   - Represents: Single undo-able action

4. **Brush**
   - Fields: baseSize (1-500px), color, pressureSizeCurve, pressureOpacityCurve, blendMode
   - Validation: baseSize 1-500, color RGB, curves 0-1 mapping
   - State Transitions: size adjustment, color change

5. **InputPoint**
   - Fields: x, y, pressure (0-1), tiltX, tiltY, timestamp, pointerType (stylus/touch/mouse)
   - Validation: pressure 0-1, tilt -90 to 90 degrees
   - Represents: Single input sample from PointerEvent

6. **HistoryEntry**
   - Fields: actionType (stroke|layerPropChange), actionData, layerId, timestamp
   - Validation: actionData sufficient for redo/undo
   - State Transitions: push to undo stack, pop for undo, push to redo stack

7. **Tile** (Valkyrie internal)
   - Fields: gridX, gridY, pixelData (TypedArray), dirty (boolean), gpuTexture (handle)
   - Validation: gridX/Y within canvas bounds, pixelData matches tile dimensions
   - State Transitions: mark dirty on stroke, upload to GPU, clear dirty flag

### API Contracts Generation

Generate TypeScript interfaces in `contracts/` for each layer:

**contracts/types.ts** (shared):
```typescript
export interface Point2D { x: number; y: number; }
export interface Color { r: number; g: number; b: number; a: number; }
export enum BlendMode { Normal, Multiply, Screen }
export enum PointerType { Stylus, Touch, Mouse }
```

**contracts/valkyrie.ts**:
```typescript
export interface IValkyrieRenderer {
  initCanvas(width: number, height: number): void;
  setZoom(level: number): void;
  setPan(offset: Point2D): void;
  setRotation(angle: number): void;
  compositeLayer(layerId: string, opacity: number, blendMode: BlendMode): void;
  renderTile(tileId: string, pixelData: Uint16Array): void;
  markTileDirty(tileId: string): void;
  requestFrame(): void; // Triggers render on next RAF
}
```

**contracts/sensory.ts**:
```typescript
export interface ISensoryInput {
  startSampling(): void;
  stopSampling(): void;
  onStrokeBegin(callback: (point: InputPoint) => void): void;
  onStrokeMove(callback: (point: InputPoint) => void): void;
  onStrokeEnd(callback: () => void): void;
  onGesture(type: GestureType, callback: (data: GestureData) => void): void;
}

export type GestureType = 'pinch' | 'pan' | 'rotate' | 'twoFingerTap' | 'threeFingerTap';
export interface GestureData { center: Point2D; scale?: number; angle?: number; }
```

**contracts/alchemy.ts**:
```typescript
export interface IAlchemyBrush {
  setBrush(config: BrushConfig): void;
  plotStroke(points: InputPoint[]): StampPlot[];
  previewBrush(size: number): ImageData; // For cursor preview
}

export interface BrushConfig {
  baseSize: number;
  color: Color;
  pressureSizeCurve: (pressure: number) => number;
  pressureOpacityCurve: (pressure: number) => number;
}

export interface StampPlot {
  position: Point2D;
  size: number;
  opacity: number;
  color: Color;
}
```

**contracts/chronos.ts**:
```typescript
export interface IChronosHistory {
  recordAction(action: HistoryAction): void;
  undo(): HistoryAction | null;
  redo(): HistoryAction | null;
  canUndo(): boolean;
  canRedo(): boolean;
  createCheckpoint(): void;
  serialize(callback: (data: Blob) => void): void; // Async via Worker
}

export interface HistoryAction {
  type: 'stroke' | 'layerPropChange';
  layerId: string;
  data: StrokeData | LayerPropData;
  timestamp: number;
}
```

**contracts/luma.ts**:
```typescript
export interface ILumaUI {
  render(): void;
  showLayerPanel(): void;
  hideLayerPanel(): void;
  updateBrushPreview(size: number): void;
  setActiveLayer(layerId: string): void;
}

// UI emits events via core/events.ts, doesn't directly call other layers
```

### Critical Layer Interfaces (for parallel work)

These interfaces MUST be defined first to enable parallel development:

1. **Valkyrie ↔ Alchemy** interface:
   - `renderTile(tileId, pixelData)` - Alchemy generates pixel data, Valkyrie uploads to GPU
   - `markTileDirty(tileId)` - Alchemy notifies which tiles changed

2. **Sensory ↔ Alchemy** interface:
   - `onStrokeMove(point)` - Sensory emits input points, Alchemy consumes for plotting
   - `InputPoint` type - Shared structure

3. **Alchemy ↔ Chronos** interface:
   - `recordAction({ type: 'stroke', data: StrokeData })` - Alchemy sends completed strokes to history
   - `StrokeData` type - Contains points[], brushConfig for replay

4. **Chronos ↔ Valkyrie** interface:
   - Chronos doesn't directly call Valkyrie
   - Instead: Chronos emits events, application layer replays actions through Alchemy → Valkyrie

5. **Luma ↔ Core Events** interface:
   - Luma emits: `BrushSizeChanged`, `LayerVisibilityToggled`, `UndoRequested`, etc.
   - Core event bus routes to appropriate layer

### Quickstart Guide

Generate `quickstart.md` with:
- Development setup (bun install, bun dev)
- Architecture overview (5 layers diagram)
- How to add a new brush type (Alchemy workflow)
- How to add a new gesture (Sensory FSM workflow)
- How to test layer boundaries (contract test pattern)
- Performance monitoring guidelines (frame budget, profiling)

## Phase 1 Completion Checklist

- [ ] Phase 0 research.md completed with all technology decisions documented
- [ ] data-model.md generated with all 7 core entities
- [ ] contracts/ directory created with TypeScript interfaces for all 5 layers
- [ ] Critical interfaces documented for parallel work
- [ ] quickstart.md written with development workflows
- [ ] Agent context updated via update-agent-context.sh script
- [ ] Constitution Check re-evaluated post-design
- [ ] All NEEDS CLARIFICATION items resolved

## Next Steps

After Phase 1 completion:
1. Run `/speckit.tasks` to generate dependency-ordered implementation tasks
2. Assign tasks to specialized subagents:
   - `valkyrie-engine` for rendering work
   - `sensory-interaction` for input handling
   - `alchemy-brush` for brush logic
   - `chronos-state` for history system
   - `luma-ui` for UI overlay
3. Begin bottom-up implementation: Valkyrie → Sensory → Alchemy → Luma → Chronos integration
