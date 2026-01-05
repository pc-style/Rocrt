/**
 * Valkyrie Layer - Rendering Engine Contract
 * Responsible for: Tile-based GPU rendering, layer compositing, WebGL management
 */

import type {
  Point2D,
  BlendMode,
  Tile,
  Layer,
} from './types';

// ============================================================================
// Valkyrie Renderer Interface
// ============================================================================

export interface IValkyrieRenderer {
  /**
   * Initialize the rendering canvas with specified dimensions
   * Creates WebGL context, initializes shaders, allocates framebuffers
   *
   * @param width - Canvas width in pixels (must be multiple of tileSize)
   * @param height - Canvas height in pixels (must be multiple of tileSize)
   * @throws Error if WebGL 2.0 is unavailable or required extensions missing
   */
  initCanvas(width: number, height: number): void;

  /**
   * Set canvas zoom level
   * Updates view transform for next render pass
   *
   * @param level - Zoom factor (0.125 = 12.5%, 1.0 = 100%, 64.0 = 6400%)
   */
  setZoom(level: number): void;

  /**
   * Set canvas pan offset
   * Updates view transform for next render pass
   *
   * @param offset - Pan offset in canvas pixels
   */
  setPan(offset: Point2D): void;

  /**
   * Set canvas rotation angle
   * Updates view transform for next render pass
   *
   * @param angle - Rotation in degrees (0-360)
   */
  setRotation(angle: number): void;

  /**
   * Composite a layer into the framebuffer
   * Applies opacity and blend mode during composition
   *
   * @param layerId - Layer UUID
   * @param opacity - Layer opacity (0.0-1.0)
   * @param blendMode - Blend mode (Normal, Multiply, Screen)
   */
  compositeLayer(layerId: string, opacity: number, blendMode: BlendMode): void;

  /**
   * Upload tile pixel data to GPU texture
   * Only call for dirty tiles to minimize GPU transfers
   *
   * @param tileId - Tile identifier "{gridX},{gridY}"
   * @param pixelData - RGBA16 pixel buffer (Uint16Array)
   */
  renderTile(tileId: string, pixelData: Uint16Array): void;

  /**
   * Mark tile as dirty (needs GPU re-upload)
   * Called by Alchemy after modifying tile pixels
   *
   * @param tileId - Tile identifier "{gridX},{gridY}"
   */
  markTileDirty(tileId: string): void;

  /**
   * Request next frame render
   * Schedules render on next RequestAnimationFrame
   * Uploads dirty tiles, composites layers, applies color conversion
   */
  requestFrame(): void;

  /**
   * Get tile by grid coordinates
   * Allocates tile if not already created
   *
   * @param gridX - Tile column index
   * @param gridY - Tile row index
   * @returns Tile object with pixel data and GPU texture handle
   */
  getTile(gridX: number, gridY: number): Tile;

  /**
   * Clear canvas (reset all tiles)
   * Used for "clear layer" action
   *
   * @param layerId - Optional layer ID (if omitted, clears all layers)
   */
  clearCanvas(layerId?: string): void;

  /**
   * Get rendering statistics (for performance monitoring)
   */
  getStats(): RenderStats;

  /**
   * Dispose of all GPU resources
   * Call on canvas unmount or context loss
   */
  dispose(): void;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface RenderStats {
  fps: number;                    // Current frames per second
  frameBudgetMs: number;          // Target frame time (16.67ms @ 60fps)
  lastFrameTimeMs: number;        // Actual last frame time
  allocatedTiles: number;         // Total tiles allocated
  dirtyTiles: number;             // Tiles needing GPU upload
  gpuMemoryMB: number;            // Estimated GPU memory usage
  droppedFrames: number;          // Frames exceeding budget (since init)
}

export interface TileUploadBatch {
  tiles: Array<{
    tileId: string;
    pixelData: Uint16Array;
  }>;
  priority: 'high' | 'low';       // High = visible tiles, Low = offscreen
}
