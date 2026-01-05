# Data Model: OpenCanvas MVP

**Feature**: OpenCanvas MVP
**Branch**: 001-opencanvas-mvp
**Date**: 2026-01-05

## Overview

This document defines the core data entities for the OpenCanvas MVP. These entities map to the five architectural layers (Valkyrie, Sensory, Alchemy, Chronos, Luma) and define the structure of data flowing between layers.

---

## Core Entities

### 1. Canvas

**Owner Layer**: Valkyrie (rendering state), Luma (UI representation)

**Description**: The primary drawing surface containing all layers, view transformation state, and rendering metadata.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `id` | string (UUID) | Non-empty | Unique canvas identifier |
| `width` | number | 256-4096 px | Canvas width in pixels |
| `height` | number | 256-4096 px | Canvas height in pixels |
| `zoomLevel` | number | 0.125-64.0 (12.5%-6400%) | Current zoom magnification |
| `panOffset` | Point2D | {x: number, y: number} | Pan offset in canvas pixels |
| `rotationAngle` | number | 0-360 degrees | Canvas rotation |
| `layers` | Layer[] | Min 1 layer, max constrained by memory | Ordered array of layers (index 0 = bottom) |
| `activeLayerId` | string (UUID) | Must match layer.id in layers[] | Currently selected layer for drawing |
| `createdAt` | number (timestamp) | Unix timestamp (ms) | Canvas creation time |
| `modifiedAt` | number (timestamp) | Unix timestamp (ms) | Last modification time |

**Validation Rules**:
- `width` and `height` must be multiples of tile size (256 or 512)
- `zoomLevel` increments follow standard progression: 12.5%, 25%, 33%, 50%, 66%, 100%, 200%, ...
- `layers.length` >= 1 (always at least one layer)
- `activeLayerId` must exist in `layers[]`

**State Transitions**:
- **Created**: Initialize with default 2048×2048px, zoom 100%, pan (0,0), rotation 0°, 1 default layer
- **Zoomed**: Update `zoomLevel` via Sensory pinch gesture or Luma zoom controls
- **Panned**: Update `panOffset` via Sensory two-finger drag
- **Rotated**: Update `rotationAngle` via Sensory two-finger rotation gesture
- **Layer Added**: Append new Layer to `layers[]`, set as `activeLayerId`

**Relationships**:
- Contains 1+ `Layer` entities (composition relationship)
- Referenced by `HistoryEntry` for checkpoint snapshots

---

### 2. Layer

**Owner Layer**: Valkyrie (tile storage), Chronos (history tracking)

**Description**: An independent drawing surface within the canvas, supporting visibility, opacity, and blend modes for non-destructive compositing.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `id` | string (UUID) | Non-empty | Unique layer identifier |
| `name` | string | Max 64 chars, default "Layer N" | User-visible layer name |
| `visible` | boolean | true/false | Layer visibility toggle |
| `opacity` | number | 0.0-1.0 (0%-100%) | Layer opacity for compositing |
| `blendMode` | BlendMode | Normal \| Multiply \| Screen | Blend mode enum |
| `zIndex` | number | 0-N (implicit from array position) | Render order (0 = bottom) |
| `tileData` | Map<string, Uint16Array> | tileId → pixelData | Sparse tile storage (only allocated tiles stored) |
| `createdAt` | number (timestamp) | Unix timestamp (ms) | Layer creation time |

**Validation Rules**:
- `opacity` clamped to [0.0, 1.0]
- `blendMode` must be one of: `Normal`, `Multiply`, `Screen`
- `tileData` keys are tile IDs in format `"{gridX},{gridY}"` (e.g., "0,0", "1,2")
- Pixel data in `tileData` is `Uint16Array` (RGBA, 4 channels × 16-bit = 8 bytes per pixel)

**State Transitions**:
- **Created**: Initialize with `visible=true`, `opacity=1.0`, `blendMode=Normal`, empty `tileData`
- **Visibility Toggled**: Flip `visible` boolean (triggers Valkyrie re-composite)
- **Opacity Changed**: Update `opacity` via Luma slider (triggers Valkyrie re-composite)
- **Blend Mode Changed**: Update `blendMode` via Luma dropdown (triggers Valkyrie re-composite)
- **Tile Modified**: Add/update entry in `tileData` when Alchemy renders stroke

**Relationships**:
- Parent: `Canvas.layers[]` (array membership determines zIndex)
- Referenced by: `Stroke.layerId`, `HistoryEntry.layerId`

---

### 3. Stroke

**Owner Layer**: Alchemy (stroke generation), Chronos (history storage)

**Description**: A single continuous drawing action from pointerdown to pointerup, representing one undo-able unit.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `id` | string (UUID) | Non-empty | Unique stroke identifier |
| `layerId` | string (UUID) | Must match Layer.id | Target layer for this stroke |
| `points` | InputPoint[] | Min 1 point | Sampled input points (120Hz+) |
| `brushConfig` | BrushConfig | Valid brush configuration | Brush state at stroke time |
| `affectedTiles` | string[] | Tile IDs: ["{x},{y}", ...] | List of tiles modified by stroke |
| `timestamp` | number (timestamp) | Unix timestamp (ms) | Stroke start time |
| `duration` | number | Milliseconds | Stroke duration (pointerup - pointerdown) |

**Validation Rules**:
- `points.length` >= 1 (even single-point tap creates stroke)
- `points` must be temporally ordered (increasing timestamps)
- `brushConfig` must be valid BrushConfig object (see entity #4)
- `affectedTiles` contains only tiles actually modified (dirty tiles)

**State Transitions**:
- **Created**: On pointerdown, initialize with first InputPoint
- **Extended**: On pointermove, append InputPoints to `points[]`
- **Completed**: On pointerup, finalize `duration` and `affectedTiles`, send to Chronos

**Relationships**:
- References: `Layer` (via `layerId`)
- Contains: `InputPoint[]` (composition)
- Contains: `BrushConfig` (snapshot)
- Stored in: `HistoryEntry.data` (as `StrokeData`)

**Usage**:
- **Alchemy**: Builds Stroke during active drawing
- **Chronos**: Stores Stroke in HistoryEntry for undo/redo
- **Replay**: Chronos can replay Stroke through Alchemy to reconstruct canvas state

---

### 4. Brush

**Owner Layer**: Alchemy (brush engine), Luma (brush controls)

**Description**: The tool configuration for creating strokes, including size, color, pressure response curves, and procedural rendering properties.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `baseSize` | number | 1-500 px | Brush base diameter in pixels |
| `color` | Color | {r,g,b,a}: [0-255] each | Brush color (RGBA) |
| `pressureSizeCurve` | (pressure: number) => number | Input [0-1] → Output [0-1] | Pressure-to-size mapping function |
| `pressureOpacityCurve` | (pressure: number) => number | Input [0-1] → Output [0-1] | Pressure-to-opacity mapping function |
| `blendMode` | BlendMode | Normal \| Multiply \| Screen | How brush blends with layer |
| `spacing` | number | 0.01-1.0 (1%-100% of brush size) | Stamp spacing for continuous strokes |
| `hardness` | number | 0.0-1.0 (0%-100%) | Edge falloff (future: round brush is fixed 100%) |

**Validation Rules**:
- `baseSize` clamped to [1, 500]
- `color` components clamped to [0, 255]
- `pressureSizeCurve` and `pressureOpacityCurve` must return values in [0, 1]
- `spacing` clamped to [0.01, 1.0] (prevents gaps or excessive overlaps)

**State Transitions**:
- **Size Changed**: Update `baseSize` via Luma slider
- **Color Changed**: Update `color` via Luma color picker
- **Pressure Curves Adjusted**: Update curve functions (future calibration UI)

**Pressure Curve Defaults**:
```typescript
// Default linear pressure response
pressureSizeCurve: (p) => p        // 0% pressure = 0% size, 100% pressure = 100% size
pressureOpacityCurve: (p) => p     // Same for opacity
```

**Relationships**:
- Used by: `Stroke.brushConfig` (snapshot captured at stroke start)
- Controlled by: Luma UI components (sliders, color picker)

**Usage**:
- **Alchemy**: Reads Brush config to calculate stamp size/opacity during plotting
- **Luma**: Provides UI controls to modify global Brush instance
- **Chronos**: Stores Brush snapshot in Stroke for accurate replay

---

### 5. InputPoint

**Owner Layer**: Sensory (input sampling), Alchemy (stroke consumption)

**Description**: A single sample from a PointerEvent, captured at high frequency (120Hz+) during active drawing.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `x` | number | Canvas coordinates (px) | Horizontal position |
| `y` | number | Canvas coordinates (px) | Vertical position |
| `pressure` | number | 0.0-1.0 | Normalized pressure (0=no pressure, 1=full pressure) |
| `tiltX` | number | -90 to 90 degrees | Stylus tilt angle (X-axis) |
| `tiltY` | number | -90 to 90 degrees | Stylus tilt angle (Y-axis) |
| `timestamp` | number (DOMHighResTimeStamp) | Monotonic increasing | High-resolution timestamp |
| `pointerType` | PointerType | Stylus \| Touch \| Mouse | Input device type |

**Validation Rules**:
- `pressure` clamped to [0, 1] (handled by Sensory calibration)
- `tiltX`, `tiltY` clamped to [-90, 90]
- `timestamp` must be monotonically increasing within a Stroke
- `pointerType` must be valid enum value

**State Transitions**:
- **Captured**: On each PointerEvent (pointermove, pointerdown, pointerup)
- **Calibrated**: Sensory applies device-specific pressure calibration
- **Consumed**: Alchemy reads InputPoint to calculate brush stamp position/size/opacity

**Relationships**:
- Contained by: `Stroke.points[]`
- Generated by: Sensory input sampler
- Consumed by: Alchemy stamp plotter

**Usage**:
- **Sensory**: Samples PointerEvent properties into InputPoint structure
- **Alchemy**: Iterates InputPoints to generate brush stamps (with spacing logic)
- **Chronos**: Stores InputPoints in Stroke for replay

---

### 6. HistoryEntry

**Owner Layer**: Chronos (history management)

**Description**: A single undo-able action in the history stack, containing sufficient data to redo or undo the action.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `id` | string (UUID) | Non-empty | Unique history entry identifier |
| `actionType` | ActionType | Stroke \| LayerPropChange \| LayerAdd \| LayerDelete | Type of action |
| `layerId` | string (UUID) | Must match Layer.id | Affected layer |
| `data` | StrokeData \| LayerPropData | Variant based on actionType | Action-specific payload |
| `timestamp` | number (timestamp) | Unix timestamp (ms) | Action completion time |
| `inverseData` | StrokeData \| LayerPropData | Variant based on actionType | Data needed to undo action |

**Action Type Variants**:

**Stroke Action**:
```typescript
data: {
  stroke: Stroke          // Complete stroke object
}
inverseData: {
  affectedTiles: string[] // Tile IDs to clear on undo
}
```

**LayerPropChange Action**:
```typescript
data: {
  property: 'visibility' | 'opacity' | 'blendMode',
  newValue: boolean | number | BlendMode
}
inverseData: {
  property: string,
  oldValue: boolean | number | BlendMode
}
```

**LayerAdd Action**:
```typescript
data: {
  layer: Layer            // New layer object
}
inverseData: {
  layerId: string         // ID to remove on undo
}
```

**LayerDelete Action**:
```typescript
data: {
  layerId: string         // ID of deleted layer
}
inverseData: {
  layer: Layer,           // Full layer data to restore on undo
  index: number           // Original position in layers[]
}
```

**Validation Rules**:
- `actionType` must match one of the defined enum values
- `data` and `inverseData` must be valid for the `actionType`
- `layerId` must exist at time of action creation

**State Transitions**:
- **Created**: When action completes (e.g., stroke ends, layer property changes)
- **Pushed to Undo Stack**: Immediately after creation
- **Popped from Undo Stack**: On undo operation (moved to redo stack)
- **Popped from Redo Stack**: On redo operation (moved back to undo stack)
- **Redo Stack Cleared**: When new action is created after undo (constitution requirement)

**Relationships**:
- References: `Layer` (via `layerId`)
- Contains: `Stroke` (for stroke actions)
- Managed by: Chronos history stack

**Usage**:
- **Chronos**: Maintains undo/redo stacks as arrays of HistoryEntry
- **Replay**: `data` field contains forward action, `inverseData` contains reverse action
- **Checkpoints**: Every 50 HistoryEntries, Chronos creates a checkpoint snapshot

---

### 7. Tile (Valkyrie Internal)

**Owner Layer**: Valkyrie (rendering engine)

**Description**: A subdivision of the canvas used for memory-efficient GPU rendering. Tiles are allocated on-demand and tracked for dirty state.

**Fields**:
| Field | Type | Range/Constraints | Description |
|-------|------|-------------------|-------------|
| `id` | string | Format: "{gridX},{gridY}" | Tile coordinate identifier |
| `gridX` | number | 0 to ceil(canvasWidth / tileSize) | Tile column index |
| `gridY` | number | 0 to ceil(canvasHeight / tileSize) | Tile row index |
| `pixelData` | Uint16Array | Length = tileSize² × 4 (RGBA) | 16-bit pixel buffer |
| `dirty` | boolean | true/false | Needs GPU upload? |
| `gpuTexture` | WebGLTexture \| null | WebGL texture handle | GPU-side texture reference |

**Validation Rules**:
- `gridX`, `gridY` must be within canvas bounds
- `pixelData` length must equal `tileSize × tileSize × 4` (e.g., 256×256×4 = 262,144 for 256px tiles)
- `gpuTexture` is `null` if not yet uploaded to GPU

**State Transitions**:
- **Allocated**: Created on first stroke affecting this tile region
- **Marked Dirty**: Set `dirty=true` when Alchemy modifies pixels
- **Uploaded**: Transfer `pixelData` to `gpuTexture`, set `dirty=false`
- **Composited**: Rendered to framebuffer during Valkyrie layer composite pass

**Tile Size Decision** (from research.md):
- **MVP**: 256×256 px tiles (64KB per tile in 16-bit RGBA)
- **Rationale**: Balances memory usage vs upload granularity
- **Future**: Make configurable based on canvas size (512×512 for large canvases)

**Relationships**:
- Parent: `Layer.tileData` (sparse map, only allocated tiles stored)
- Referenced by: `Stroke.affectedTiles[]`

**Usage**:
- **Valkyrie**: Manages tile allocation, dirty tracking, GPU uploads
- **Alchemy**: Writes pixels to `tileData`, marks tiles dirty
- **Chronos**: Stores `affectedTiles` in Stroke for incremental undo

---

## Data Flow Diagrams

### Stroke Creation Flow

```
Sensory                  Alchemy                  Valkyrie                 Chronos
   |                        |                        |                        |
   |-- InputPoint --------->|                        |                        |
   |   (120Hz sampling)     |                        |                        |
   |                        |-- Stamp Plot --------->|                        |
   |                        |   (brush rendering)    |                        |
   |                        |                        |-- Mark Tile Dirty ---->|
   |                        |                        |   (tileData update)    |
   |                        |                        |                        |
   |-- Stroke End --------->|                        |                        |
   |                        |-- Stroke Complete ---->|                        |-- Record History
   |                        |                        |                        |   (HistoryEntry)
```

### Undo/Redo Flow

```
Luma                     Chronos                  Alchemy                  Valkyrie
   |                        |                        |                        |
   |-- Undo Button -------->|                        |                        |
   |                        |-- Pop History Stack -->|                        |
   |                        |   (HistoryEntry)       |                        |
   |                        |                        |-- Clear Tiles -------->|
   |                        |                        |   (inverseData)        |
   |                        |                        |                        |-- Mark Dirty
   |                        |                        |                        |-- Re-composite
```

### Layer Composite Flow

```
Valkyrie Compositor
   |
   |-- For each visible Layer (bottom to top):
   |     |
   |     |-- For each dirty Tile in layer:
   |     |     |
   |     |     |-- Upload tileData to gpuTexture
   |     |     |-- Set dirty = false
   |     |
   |     |-- Composite layer with blend mode:
   |           - Sample gpuTexture (all tiles)
   |           - Apply opacity
   |           - Apply blend mode shader (Normal/Multiply/Screen)
   |           - Render to framebuffer
   |
   |-- Apply linearToSRGB color conversion
   |-- Render framebuffer to screen
```

---

## Persistence Schema

**IndexedDB Structure** (managed by Chronos):

```
Database: opencanvas_v1
├── Store: canvases
│   Key: canvasId (UUID)
│   Value: { Canvas object with serialized layers }
│
├── Store: checkpoints
│   Key: checkpointId (UUID)
│   Value: { timestamp, canvasSnapshot: Blob, historyIndex: number }
│
└── Store: preferences
    Key: 'lastActiveCanvas' | 'brushDefaults' | ...
    Value: JSON blobs
```

**Serialization Format**:
- **Tiles**: Compress `Uint16Array` with LZ4 before storing in IndexedDB
- **Strokes**: Store as JSON with base64-encoded binary data for `points[]`
- **Checkpoints**: Full canvas snapshot every 50 HistoryEntries (gzipped Blob)

---

## Entity Relationships Summary

```
Canvas (1) ──> (*) Layer
   |
   └──> (1) ActiveLayer (reference)

Layer (1) ──> (*) Tile
   |
   └──> Referenced by Stroke, HistoryEntry

Stroke (1) ──> (*) InputPoint
   |
   ├──> (1) Layer (target)
   ├──> (1) BrushConfig (snapshot)
   └──> (*) Tile (affectedTiles)

HistoryEntry (1) ──> (1) Layer
   |
   └──> (1) Stroke | LayerPropData (variant)
```

---

## Validation & Invariants

**Global Invariants**:
1. Canvas always has at least one Layer
2. Canvas.activeLayerId always points to existing layer
3. Layers are ordered by zIndex (array index = zIndex)
4. HistoryEntry redo stack is cleared when new action is created
5. Tile dirty flags are cleared after GPU upload
6. All timestamps are monotonically increasing within their scope

**Performance Constraints**:
- Tile upload budget: Max 50 tiles per frame (16.67ms @ 60fps)
- History stack size: 100 minimum (constitution), unbounded maximum (memory-permitting)
- Checkpoint frequency: Every 50 actions (constitution)

---

## Compliance Check

All data models align with constitution requirements:

- ✅ **Action-Oriented History**: Stroke stores full replay data, not pixel diffs
- ✅ **Tile-Based Rendering**: Tile entity supports sparse allocation, dirty tracking
- ✅ **Layer Independence**: Layers are isolated, composited via GPU
- ✅ **Gesture Support**: InputPoint captures pointerType for disambiguation
- ✅ **16-bit Color**: Tile pixelData is Uint16Array (RGBA16)

**Status**: ✅ Data model complete and constitution-compliant
