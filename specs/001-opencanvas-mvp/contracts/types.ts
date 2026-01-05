/**
 * Shared type definitions for OpenCanvas MVP
 * Used across all architectural layers (Valkyrie, Sensory, Alchemy, Chronos, Luma)
 */

// ============================================================================
// Geometric Types
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Color Types
// ============================================================================

export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-255
}

export enum BlendMode {
  Normal = 'normal',
  Multiply = 'multiply',
  Screen = 'screen',
}

// ============================================================================
// Input Types
// ============================================================================

export enum PointerType {
  Stylus = 'pen',
  Touch = 'touch',
  Mouse = 'mouse',
}

export interface InputPoint {
  x: number;                    // Canvas coordinates (pixels)
  y: number;                    // Canvas coordinates (pixels)
  pressure: number;             // 0.0 - 1.0 (normalized, calibrated)
  tiltX: number;                // -90 to 90 degrees
  tiltY: number;                // -90 to 90 degrees
  timestamp: number;            // DOMHighResTimeStamp (ms)
  pointerType: PointerType;     // Input device type
}

// ============================================================================
// Gesture Types
// ============================================================================

export enum GestureType {
  Pinch = 'pinch',
  Pan = 'pan',
  Rotate = 'rotate',
  TwoFingerTap = 'twoFingerTap',
  ThreeFingerTap = 'threeFingerTap',
}

export interface GestureData {
  center: Point2D;     // Gesture focal point (canvas coordinates)
  scale?: number;      // Pinch scale factor (> 1 = zoom in, < 1 = zoom out)
  angle?: number;      // Rotation angle (degrees, -180 to 180)
  velocity?: Point2D;  // Pan velocity (pixels/ms)
}

// ============================================================================
// Brush Types
// ============================================================================

export interface BrushConfig {
  baseSize: number;                                      // 1-500 pixels
  color: Color;                                          // RGBA color
  pressureSizeCurve: (pressure: number) => number;       // [0,1] → [0,1]
  pressureOpacityCurve: (pressure: number) => number;    // [0,1] → [0,1]
  blendMode: BlendMode;                                  // Brush blend mode
  spacing: number;                                       // 0.01-1.0 (1%-100% of brush size)
  hardness: number;                                      // 0.0-1.0 (edge falloff, future use)
}

export interface StampPlot {
  position: Point2D;   // Stamp center (canvas coordinates)
  size: number;        // Stamp diameter (pixels)
  opacity: number;     // 0.0-1.0
  color: Color;        // RGBA color
}

// ============================================================================
// Layer Types
// ============================================================================

export interface Layer {
  id: string;                              // UUID
  name: string;                            // User-visible name (max 64 chars)
  visible: boolean;                        // Visibility toggle
  opacity: number;                         // 0.0-1.0 (0%-100%)
  blendMode: BlendMode;                    // Composite blend mode
  zIndex: number;                          // Render order (0 = bottom)
  tileData: Map<string, Uint16Array>;      // Sparse tile storage "{gridX},{gridY}" → pixels
  createdAt: number;                       // Unix timestamp (ms)
}

// ============================================================================
// Canvas Types
// ============================================================================

export interface Canvas {
  id: string;                 // UUID
  width: number;              // 256-4096 pixels
  height: number;             // 256-4096 pixels
  zoomLevel: number;          // 0.125-64.0 (12.5%-6400%)
  panOffset: Point2D;         // Pan offset (canvas pixels)
  rotationAngle: number;      // 0-360 degrees
  layers: Layer[];            // Ordered array (index 0 = bottom)
  activeLayerId: string;      // UUID of currently selected layer
  createdAt: number;          // Unix timestamp (ms)
  modifiedAt: number;         // Unix timestamp (ms)
}

// ============================================================================
// Stroke Types
// ============================================================================

export interface Stroke {
  id: string;                // UUID
  layerId: string;           // Target layer UUID
  points: InputPoint[];      // Sampled input points (120Hz+)
  brushConfig: BrushConfig;  // Brush state snapshot
  affectedTiles: string[];   // Tile IDs: ["{gridX},{gridY}", ...]
  timestamp: number;         // Stroke start time (Unix timestamp ms)
  duration: number;          // Stroke duration (ms)
}

// ============================================================================
// History Types
// ============================================================================

export enum ActionType {
  Stroke = 'stroke',
  LayerPropChange = 'layerPropChange',
  LayerAdd = 'layerAdd',
  LayerDelete = 'layerDelete',
}

export interface StrokeActionData {
  stroke: Stroke;
}

export interface StrokeActionInverse {
  affectedTiles: string[];   // Tiles to clear on undo
}

export interface LayerPropChangeData {
  property: 'visibility' | 'opacity' | 'blendMode';
  newValue: boolean | number | BlendMode;
}

export interface LayerPropChangeInverse {
  property: 'visibility' | 'opacity' | 'blendMode';
  oldValue: boolean | number | BlendMode;
}

export interface LayerAddData {
  layer: Layer;
  index: number;             // Insert position in layers[]
}

export interface LayerAddInverse {
  layerId: string;           // ID to remove on undo
}

export interface LayerDeleteData {
  layerId: string;
}

export interface LayerDeleteInverse {
  layer: Layer;              // Full layer to restore
  index: number;             // Original position
}

export type HistoryActionData =
  | StrokeActionData
  | LayerPropChangeData
  | LayerAddData
  | LayerDeleteData;

export type HistoryActionInverse =
  | StrokeActionInverse
  | LayerPropChangeInverse
  | LayerAddInverse
  | LayerDeleteInverse;

export interface HistoryEntry {
  id: string;                           // UUID
  actionType: ActionType;               // Action type discriminator
  layerId: string;                      // Affected layer UUID
  data: HistoryActionData;              // Forward action data
  inverseData: HistoryActionInverse;    // Reverse action data (for undo)
  timestamp: number;                    // Action completion time (Unix timestamp ms)
}

// ============================================================================
// Tile Types (Valkyrie Internal)
// ============================================================================

export interface Tile {
  id: string;                      // Format: "{gridX},{gridY}"
  gridX: number;                   // Tile column index
  gridY: number;                   // Tile row index
  pixelData: Uint16Array;          // RGBA16 pixel buffer
  dirty: boolean;                  // Needs GPU upload?
  gpuTexture: WebGLTexture | null; // GPU texture handle
}

// ============================================================================
// Event Types (Cross-Layer Communication)
// ============================================================================

export enum EventType {
  // Brush events
  BrushSizeChanged = 'brush:sizeChanged',
  BrushColorChanged = 'brush:colorChanged',

  // Layer events
  LayerAdded = 'layer:added',
  LayerDeleted = 'layer:deleted',
  LayerVisibilityToggled = 'layer:visibilityToggled',
  LayerOpacityChanged = 'layer:opacityChanged',
  LayerBlendModeChanged = 'layer:blendModeChanged',
  LayerActivated = 'layer:activated',

  // History events
  UndoRequested = 'history:undoRequested',
  RedoRequested = 'history:redoRequested',
  HistoryChanged = 'history:changed',

  // Canvas events
  CanvasZoomed = 'canvas:zoomed',
  CanvasPanned = 'canvas:panned',
  CanvasRotated = 'canvas:rotated',

  // Rendering events
  FrameRendered = 'render:frameRendered',
  TileDirty = 'render:tileDirty',
}

export interface Event<T = any> {
  type: EventType;
  payload: T;
  timestamp: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PerformanceConfig {
  targetFPS: number;                  // 60 or 120
  frameBudgetMs: number;              // 16.67ms @ 60fps, 8.33ms @ 120fps
  maxTilesPerFrame: number;           // Tile upload budget (e.g., 50)
  inputSamplingRateHz: number;        // 120Hz minimum
}

export interface RenderConfig {
  tileSize: number;                   // 256 or 512 pixels
  useWebGL2: boolean;                 // true (WebGPU future)
  enable16BitColor: boolean;          // true for professional color
  enableLinearBlending: boolean;      // true for accurate color mixing
}

export interface AppConfig {
  performance: PerformanceConfig;
  rendering: RenderConfig;
  debug: {
    showFPS: boolean;
    showTileBoundaries: boolean;
    logInputEvents: boolean;
  };
}
