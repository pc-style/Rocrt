/**
 * Alchemy Layer - Brush Logic & Physics Contract
 * Responsible for: Procedural brush rendering, stamp plotting, pressure dynamics
 */

import type {
  InputPoint,
  BrushConfig,
  StampPlot,
  Color,
} from './types';

// ============================================================================
// Alchemy Brush Interface
// ============================================================================

export interface IAlchemyBrush {
  /**
   * Set active brush configuration
   * Updates internal brush state for subsequent stroke plotting
   *
   * @param config - Brush configuration (size, color, pressure curves, etc.)
   */
  setBrush(config: BrushConfig): void;

  /**
   * Plot stroke from input points
   * Generates stamp plots with proper spacing and pressure dynamics
   *
   * @param points - Array of InputPoints sampled from Sensory layer
   * @returns Array of StampPlots to be rendered to canvas tiles
   */
  plotStroke(points: InputPoint[]): StampPlot[];

  /**
   * Preview brush appearance at specified size
   * Used for cursor preview in Luma layer
   *
   * @param size - Preview diameter in pixels
   * @returns ImageData with brush preview (alpha channel represents brush shape)
   */
  previewBrush(size: number): ImageData;

  /**
   * Render stamp to tile pixel data
   * Applies color, opacity, and blend mode to target tile
   *
   * @param stamp - StampPlot with position, size, opacity, color
   * @param tileData - Target tile pixel buffer (Uint16Array, RGBA16)
   * @param tileGridX - Tile column index
   * @param tileGridY - Tile row index
   * @param tileSize - Tile dimensions (256 or 512 pixels)
   */
  renderStampToTile(
    stamp: StampPlot,
    tileData: Uint16Array,
    tileGridX: number,
    tileGridY: number,
    tileSize: number
  ): void;

  /**
   * Calculate affected tiles for a stroke
   * Returns list of tile IDs that intersect with stroke bounds
   *
   * @param points - Stroke input points
   * @param brushSize - Maximum brush size (considering pressure)
   * @param canvasWidth - Canvas width in pixels
   * @param canvasHeight - Canvas height in pixels
   * @param tileSize - Tile dimensions
   * @returns Array of tile IDs: ["{gridX},{gridY}", ...]
   */
  calculateAffectedTiles(
    points: InputPoint[],
    brushSize: number,
    canvasWidth: number,
    canvasHeight: number,
    tileSize: number
  ): string[];

  /**
   * Smooth stroke path using Bezier curves
   * Reduces jitter from input sampling
   *
   * @param points - Raw input points
   * @param smoothing - Smoothing factor (0.0 = none, 1.0 = maximum)
   * @returns Smoothed input points
   */
  smoothStroke(points: InputPoint[], smoothing: number): InputPoint[];
}

// ============================================================================
// Helper Types
// ============================================================================

export interface BrushDynamics {
  /**
   * Calculate brush size at given pressure
   *
   * @param pressure - Normalized pressure (0-1)
   * @param baseSize - Base brush size (pixels)
   * @param curve - Pressure-to-size curve function
   * @returns Actual brush size in pixels
   */
  calculateSize(pressure: number, baseSize: number, curve: (p: number) => number): number;

  /**
   * Calculate brush opacity at given pressure
   *
   * @param pressure - Normalized pressure (0-1)
   * @param curve - Pressure-to-opacity curve function
   * @returns Opacity value (0.0-1.0)
   */
  calculateOpacity(pressure: number, curve: (p: number) => number): number;
}

export interface StampSpacing {
  /**
   * Calculate stamp positions along stroke path
   * Ensures even spacing based on brush size
   *
   * @param points - Stroke input points
   * @param spacing - Spacing factor (0.01-1.0, as fraction of brush size)
   * @param brushSize - Current brush size (pixels)
   * @returns Indices of points[] where stamps should be plotted
   */
  calculateSpacing(points: InputPoint[], spacing: number, brushSize: number): number[];
}

// ============================================================================
// Brush Shape Types (Future: Textured Brushes)
// ============================================================================

export enum BrushShape {
  Round = 'round',              // MVP: Simple round brush
  // Future shapes:
  // Square = 'square',
  // Textured = 'textured',
  // Particle = 'particle',
}

export interface BrushShapeRenderer {
  /**
   * Render brush shape to pixel buffer
   * Used for creating brush stamps
   *
   * @param size - Brush diameter (pixels)
   * @param hardness - Edge falloff (0.0 = soft, 1.0 = hard)
   * @returns Grayscale alpha mask (Uint8Array)
   */
  renderShape(size: number, hardness: number): Uint8Array;
}

// ============================================================================
// Color Blending (Linear Color Space)
// ============================================================================

export interface ColorBlending {
  /**
   * Blend source color over destination using specified blend mode
   * Operates in 16-bit linear color space
   *
   * @param src - Source color (RGBA, 0-65535 per channel)
   * @param dst - Destination color (RGBA, 0-65535 per channel)
   * @param srcAlpha - Source alpha (0.0-1.0)
   * @param blendMode - Blend mode (Normal, Multiply, Screen)
   * @returns Blended color (RGBA, 0-65535 per channel)
   */
  blend(src: Uint16Array, dst: Uint16Array, srcAlpha: number, blendMode: string): Uint16Array;

  /**
   * Convert 8-bit sRGB color to 16-bit linear color
   *
   * @param srgb - sRGB color (RGBA, 0-255 per channel)
   * @returns Linear color (RGBA, 0-65535 per channel)
   */
  sRGBToLinear(srgb: Color): Uint16Array;

  /**
   * Convert 16-bit linear color to 8-bit sRGB color
   *
   * @param linear - Linear color (RGBA, 0-65535 per channel)
   * @returns sRGB color (RGBA, 0-255 per channel)
   */
  linearToSRGB(linear: Uint16Array): Color;
}
