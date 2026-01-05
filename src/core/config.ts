export const TILE_SIZE = 256;

export const CANVAS_DEFAULTS = {
  width: 2048,
  height: 2048,
  zoomLevel: 1.0,
  backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
};

export const BRUSH_DEFAULTS = {
  baseSize: 20,
  color: { r: 0, g: 0, b: 0, a: 255 },
  spacing: 0.05,
  minSize: 1,
  maxSize: 500,
};

export const PERFORMANCE_BUDGETS = {
  frameTimeMs: 16.67,
  inputLatencyMs: 8,
  undoRedoTimeMs: 100,
  layerToggleTimeMs: 100,
  maxTilesPerFrame: 50,
  targetFps: 60,
};

export const HISTORY_CONFIG = {
  maxUndoSteps: 100,
  checkpointInterval: 50,
};

export const ZOOM_LEVELS = [
  0.125, 0.25, 0.33, 0.5, 0.66, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 16.0, 32.0, 64.0,
];

export const DEBUG_CONFIG = {
  showFPS: false,
  showTileBoundaries: false,
  logInputEvents: false,
  logGestureState: false,
  logHistoryActions: false,
};
