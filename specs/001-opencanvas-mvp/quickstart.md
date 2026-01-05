# OpenCanvas MVP - Quickstart Guide

**Branch**: 001-opencanvas-mvp
**Date**: 2026-01-05

## Overview

This guide helps developers get started with the OpenCanvas MVP codebase. OpenCanvas is a web-based Procreate-like drawing application built with five architectural layers: Valkyrie (rendering), Sensory (input), Alchemy (brushes), Chronos (state), and Luma (UI).

---

## Development Setup

### Prerequisites

- **Node.js**: v20+ (for bun compatibility)
- **Bun**: v1.0+ (package manager and bundler)
- **Modern browser**: Chrome 90+ or Safari 14+ (for WebGL 2.0 support)
- **Device**: Wacom tablet, iPad + Apple Pencil, or pressure-sensitive stylus recommended

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/procreate-clone.git
cd procreate-clone

# Checkout feature branch
git checkout 001-opencanvas-mvp

# Install dependencies
bun install
```

### Development Commands

```bash
# Start Vite dev server (HMR enabled)
bun run dev                    # http://localhost:5173

# Run tests (Vitest)
bun run test                   # Unit tests
bun run test:watch             # Watch mode
bun run test:coverage          # Coverage report

# Build for production
bun run build                  # Output: dist/

# Preview production build
bun run preview                # http://localhost:4173
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Luma (UI)                      │
│    React/Preact UI, Floating Controls           │
└───────┬─────────────────────────────────────────┘
        │ Events (via core/events.ts)
        ▼
┌──────────────┬──────────────┬──────────────────┐
│   Sensory    │   Alchemy    │     Chronos      │
│  (Input &    │   (Brush     │  (State &        │
│   Gestures)  │    Logic)    │   History)       │
└──────┬───────┴──────┬───────┴──────┬───────────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
          ┌────────────────────────┐
          │  Valkyrie (Rendering)  │
          │  Tile-based WebGL GPU  │
          └────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Key Files |
|-------|----------------|-----------|
| **Valkyrie** | WebGL rendering, tile management, GPU compositing | `src/valkyrie/` |
| **Sensory** | Input sampling (120Hz), gesture FSM, palm rejection | `src/sensory/` |
| **Alchemy** | Brush plotting, pressure dynamics, stamp rendering | `src/alchemy/` |
| **Chronos** | Action-led history, undo/redo, IndexedDB persistence | `src/chronos/` |
| **Luma** | Preact UI, floating toolbars, layer panel | `src/luma/` |

**Key Principle**: Layers communicate via events (`core/events.ts`) and contracts (`specs/001-opencanvas-mvp/contracts/`). Never call across layers directly except through public APIs.

---

## Common Workflows

### 1. Adding a New Brush Type

**Goal**: Extend Alchemy layer with a new brush shape (e.g., square brush)

**Steps**:

1. **Define brush config** in `contracts/alchemy.ts`:
   ```typescript
   export enum BrushShape {
     Round = 'round',
     Square = 'square', // New
   }
   ```

2. **Implement shape renderer** in `src/alchemy/brush-shapes.ts`:
   ```typescript
   export function renderSquareBrush(size: number): Uint8Array {
     // Generate square alpha mask
   }
   ```

3. **Update `plotStroke()`** in `src/alchemy/brush-engine.ts`:
   ```typescript
   plotStroke(points: InputPoint[]): StampPlot[] {
     const shape = this.config.shape;
     if (shape === BrushShape.Square) {
       // Use square stamp
     }
   }
   ```

4. **Add UI control** in `src/luma/brush-selector.tsx`:
   ```tsx
   <button onClick={() => setBrushShape(BrushShape.Square)}>
     Square
   </button>
   ```

5. **Test**:
   ```bash
   bun test src/alchemy/brush-engine.test.ts
   ```

---

### 2. Adding a New Gesture

**Goal**: Recognize a four-finger swipe gesture in Sensory layer

**Steps**:

1. **Define gesture type** in `contracts/types.ts`:
   ```typescript
   export enum GestureType {
     // Existing...
     FourFingerSwipe = 'fourFingerSwipe', // New
   }
   ```

2. **Update FSM** in `src/sensory/gesture-fsm.ts`:
   ```typescript
   handlePointerDown(event: PointerEvent) {
     if (this.activePointers === 4) {
       this.state = InputStateType.Gesture;
       this.gestureType = GestureType.FourFingerSwipe;
     }
   }
   ```

3. **Emit gesture event** when detected:
   ```typescript
   this.emit(GestureType.FourFingerSwipe, {
     center: { x, y },
     velocity: { x: dx, y: dy },
   });
   ```

4. **Listen in application layer** (`src/main.ts`):
   ```typescript
   sensory.onGesture(GestureType.FourFingerSwipe, (data) => {
     // Handle gesture (e.g., undo all, clear canvas)
   });
   ```

5. **Test gesture recognition**:
   - Use multi-touch device or browser DevTools touch emulation
   - Verify FSM state transitions in console logs

---

### 3. Testing Layer Boundaries

**Goal**: Ensure layers only communicate via public contracts

**Pattern**: Contract tests validate that each layer exposes the expected interface

**Example** (`tests/contract/valkyrie.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import type { IValkyrieRenderer } from '../../specs/001-opencanvas-mvp/contracts/valkyrie';
import { ValkyrieRenderer } from '../../src/valkyrie/index';

describe('Valkyrie Contract', () => {
  it('implements IValkyrieRenderer interface', () => {
    const renderer = new ValkyrieRenderer();

    // Verify all required methods exist
    expect(renderer.initCanvas).toBeDefined();
    expect(renderer.setZoom).toBeDefined();
    expect(renderer.renderTile).toBeDefined();
    // ... etc
  });

  it('enforces layer boundary (no direct Alchemy imports)', () => {
    // Static analysis: check that Valkyrie doesn't import from Alchemy
    // Use dependency-cruiser or similar tool
  });
});
```

**Run contract tests**:
```bash
bun test tests/contract/
```

---

### 4. Performance Monitoring

**Goal**: Ensure 60fps rendering and <16ms frame times

**Built-in Performance Monitor**:

```typescript
import { PerformanceMonitor } from './core/performance-monitor';

const monitor = new PerformanceMonitor();

// In render loop
monitor.startFrame();
// ... rendering code ...
monitor.endFrame();

// Check stats
const stats = monitor.getStats();
console.log(`FPS: ${stats.fps}, Frame Time: ${stats.lastFrameTimeMs}ms`);

if (stats.droppedFrames > 0) {
  console.warn(`⚠️ Dropped ${stats.droppedFrames} frames!`);
}
```

**Browser DevTools Profiling**:

1. Open Chrome DevTools → Performance tab
2. Click Record, draw on canvas, stop recording
3. Check frame timeline for dropped frames (red bars)
4. Analyze JavaScript call stack and GPU utilization

**Performance Budgets** (from constitution):

| Metric | Budget | Critical? |
|--------|--------|-----------|
| Frame time | <16.67ms @ 60fps | ✅ Yes |
| Input latency | <8ms | ✅ Yes |
| Undo/redo time | <100ms | ✅ Yes |
| Layer visibility toggle | <100ms | ✅ Yes |
| Tile upload per frame | < 50 tiles | ⚠️ Monitor |

**Troubleshooting Slow Performance**:

- **Symptom**: Dropped frames during drawing
  - **Check**: Valkyrie tile upload count (`getStats().dirtyTiles`)
  - **Fix**: Reduce tile size or batch uploads

- **Symptom**: Input lag (cursor lags behind stylus)
  - **Check**: Sensory sampling rate (`getState().samplingRateHz`)
  - **Fix**: Increase polling frequency or use PointerEvent `getCoalescedEvents()`

- **Symptom**: Slow undo/redo
  - **Check**: Chronos action log size (`getStats().undoStackSize`)
  - **Fix**: Implement checkpoint snapshots (every 50 actions)

---

## Directory Structure

```
procreate-clone/
├── src/
│   ├── valkyrie/          # Rendering layer
│   │   ├── tile-manager.ts
│   │   ├── texture-atlas.ts
│   │   ├── compositor.ts
│   │   ├── shaders/
│   │   │   ├── brush-blend.glsl
│   │   │   ├── layer-composite.glsl
│   │   │   └── tile-render.glsl
│   │   └── index.ts       # Public API
│   │
│   ├── sensory/           # Input layer
│   │   ├── input-sampler.ts
│   │   ├── gesture-fsm.ts
│   │   ├── palm-rejection.ts
│   │   ├── stroke-predictor.ts
│   │   ├── bezier-smoother.ts
│   │   └── index.ts
│   │
│   ├── alchemy/           # Brush layer
│   │   ├── brush-engine.ts
│   │   ├── pressure-curves.ts
│   │   ├── stamp-plotter.ts
│   │   ├── dynamics.ts
│   │   └── index.ts
│   │
│   ├── chronos/           # State layer
│   │   ├── action-log.ts
│   │   ├── history-stack.ts
│   │   ├── checkpoint.ts
│   │   ├── serializer.ts
│   │   └── index.ts
│   │
│   ├── luma/              # UI layer
│   │   ├── canvas-overlay.tsx
│   │   ├── toolbar.tsx
│   │   ├── layer-panel.tsx
│   │   ├── brush-slider.tsx
│   │   ├── color-picker.tsx
│   │   └── index.tsx
│   │
│   ├── core/              # Shared infrastructure
│   │   ├── types.ts
│   │   ├── events.ts
│   │   ├── config.ts
│   │   └── performance-monitor.ts
│   │
│   └── main.ts            # Application entry point
│
├── specs/001-opencanvas-mvp/
│   ├── spec.md            # Feature specification
│   ├── plan.md            # Implementation plan
│   ├── research.md        # Technology decisions
│   ├── data-model.md      # Entity definitions
│   ├── quickstart.md      # This file
│   └── contracts/         # TypeScript interfaces
│       ├── types.ts
│       ├── valkyrie.ts
│       ├── sensory.ts
│       ├── alchemy.ts
│       ├── chronos.ts
│       └── luma.ts
│
├── tests/
│   ├── contract/          # Layer boundary tests
│   ├── integration/       # Cross-layer workflow tests
│   └── unit/              # Isolated component tests
│
├── public/                # Static assets
├── dist/                  # Build output
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

---

## Debugging Tips

### 1. Enable Debug Logging

In `src/core/config.ts`:

```typescript
export const DEBUG_CONFIG = {
  showFPS: true,                    // Show FPS counter
  showTileBoundaries: true,         // Render tile grid overlay
  logInputEvents: true,             // Log PointerEvents to console
  logGestureState: true,            // Log FSM state transitions
  logHistoryActions: true,          // Log undo/redo actions
};
```

### 2. Inspect WebGL State

```typescript
// In Valkyrie layer
console.log('WebGL Context:', this.gl);
console.log('Allocated Tiles:', this.tileManager.getAllocatedCount());
console.log('Dirty Tiles:', this.tileManager.getDirtyTiles());

// Check for WebGL errors
const error = this.gl.getError();
if (error !== this.gl.NO_ERROR) {
  console.error('WebGL Error:', error);
}
```

### 3. Profile Input Sampling Rate

```typescript
// In Sensory layer
const sampler = new InputSampler();
sampler.startSampling();

setInterval(() => {
  const state = sampler.getState();
  console.log(`Sampling @ ${state.samplingRateHz}Hz`);
}, 1000);
```

### 4. Visualize History Stack

```typescript
// In Chronos layer
const stats = chronos.getStats();
console.table({
  'Undo Stack': stats.undoStackSize,
  'Redo Stack': stats.redoStackSize,
  'Total Actions': stats.totalActions,
  'Memory (MB)': stats.estimatedMemoryMB.toFixed(2),
});
```

---

## Troubleshooting

### Problem: Canvas doesn't render

**Check**:
1. WebGL 2.0 context created? (`gl instanceof WebGL2RenderingContext`)
2. Required extensions available? (`gl.getExtension('EXT_color_buffer_float')`)
3. Shaders compiled successfully? (check console for GLSL errors)
4. Canvas element has non-zero dimensions? (`canvas.width > 0`)

**Solution**:
```typescript
// Validate WebGL setup
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');
if (!gl) {
  throw new Error('WebGL 2.0 not supported');
}
console.log('WebGL Version:', gl.getParameter(gl.VERSION));
```

### Problem: Pressure sensitivity doesn't work

**Check**:
1. Using PointerEvent API? (not TouchEvent or MouseEvent)
2. Device supports pressure? (check `event.pressure` value)
3. Pressure calibration applied? (see `contracts/sensory.ts`)

**Solution**:
```typescript
// Log pressure values
sensory.onStrokeMove((point) => {
  console.log(`Pressure: ${point.pressure.toFixed(2)}, Device: ${point.pointerType}`);
});
```

### Problem: Gestures conflict with drawing

**Check**:
1. FSM correctly distinguishes DRAWING_STATE from GESTURE_STATE?
2. Palm rejection enabled? (`sensory.setPalmRejection(true)`)
3. Pointer count correctly tracked?

**Solution**: Enable FSM debug logging in `src/sensory/gesture-fsm.ts`

### Problem: Undo/redo doesn't work correctly

**Check**:
1. Actions recorded in history? (`chronos.getStats().undoStackSize > 0`)
2. Inverse data complete? (check `HistoryEntry.inverseData`)
3. Tiles cleared on undo? (check Valkyrie dirty tile tracking)

**Solution**: Log every history action:
```typescript
chronos.recordAction = (action) => {
  console.log('Recording action:', action.actionType, action);
  // ... original implementation
};
```

---

## Next Steps

1. **Run `/speckit.tasks`** to generate dependency-ordered implementation tasks
2. **Assign tasks to specialized subagents**:
   - `valkyrie-engine` for rendering work
   - `sensory-interaction` for input handling
   - `alchemy-brush` for brush logic
   - `chronos-state` for history system
   - `luma-ui` for UI overlay
3. **Start bottom-up implementation**: Valkyrie → Sensory → Alchemy → Luma → Chronos integration

## Resources

- **Architecture**: [architecture.md](../../../architecture.md)
- **Style Guide**: [style.md](../../../style.md)
- **Constitution**: [.specify/memory/constitution.md](../../../.specify/memory/constitution.md)
- **Feature Spec**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Research Decisions**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contracts**: [contracts/](./contracts/)

**Questions?** Refer to constitution for governance and development workflow standards.
