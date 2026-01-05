/**
 * Luma Layer - UI Overlay Contract
 * Responsible for: Floating UI, brush controls, layer panel, minimal canvas-first interface
 */

import type {
  Layer,
  Color,
  BlendMode,
} from './types';

// ============================================================================
// Luma UI Interface
// ============================================================================

export interface ILumaUI {
  /**
   * Render UI overlay
   * Called on each React render cycle (Preact)
   * Should be minimal and non-blocking
   */
  render(): void;

  /**
   * Show layer panel (modal overlay)
   * Displays layer stack with visibility, opacity, blend mode controls
   */
  showLayerPanel(): void;

  /**
   * Hide layer panel
   * Dismisses modal, returns focus to canvas
   */
  hideLayerPanel(): void;

  /**
   * Update brush size preview (cursor)
   * Shows circular preview at cursor position
   *
   * @param size - Brush diameter in pixels
   */
  updateBrushPreview(size: number): void;

  /**
   * Set active layer (highlight in layer panel)
   *
   * @param layerId - UUID of layer to activate
   */
  setActiveLayer(layerId: string): void;

  /**
   * Update undo/redo button states
   *
   * @param canUndo - True if undo is available
   * @param canRedo - True if redo is available
   */
  updateHistoryButtons(canUndo: boolean, canRedo: boolean): void;

  /**
   * Show toast notification (temporary message)
   *
   * @param message - Text to display
   * @param duration - Display duration in milliseconds (default 3000ms)
   */
  showToast(message: string, duration?: number): void;
}

// ============================================================================
// UI Component Interfaces
// ============================================================================

/**
 * Top Toolbar Component
 * Floating toolbar with primary tools (max 9 icons per constitution)
 */
export interface IToolbar {
  onBrushTool(): void;                // Select brush tool (default)
  onUndoTap(): void;                  // Undo button (also two-finger tap gesture)
  onRedoTap(): void;                  // Redo button (also three-finger tap gesture)
  onLayersTap(): void;                // Open layer panel
  onColorTap(): void;                 // Open color picker
  onSettingsTap(): void;              // Open settings modal (future)
}

/**
 * Layer Panel Component
 * Modal overlay showing layer stack
 */
export interface ILayerPanel {
  layers: Layer[];                    // Ordered layers (index 0 = bottom)
  activeLayerId: string;              // Currently selected layer

  onLayerSelect(layerId: string): void;
  onLayerVisibilityToggle(layerId: string): void;
  onLayerOpacityChange(layerId: string, opacity: number): void;
  onLayerBlendModeChange(layerId: string, blendMode: BlendMode): void;
  onLayerAdd(): void;
  onLayerDelete(layerId: string): void;
  onClose(): void;                    // Close layer panel
}

/**
 * Brush Slider Component
 * Floating slider for brush size/opacity
 */
export interface IBrushSlider {
  type: 'size' | 'opacity';
  value: number;                      // Current value (size: 1-500px, opacity: 0-100%)
  onValueChange(value: number): void;
  onRelease(): void;                  // Called when slider is released (hide slider)
}

/**
 * Color Picker Component
 * Modal color selection interface
 */
export interface IColorPicker {
  currentColor: Color;                // Current brush color

  onColorSelect(color: Color): void;
  onClose(): void;                    // Close color picker
}

/**
 * Brush Cursor Preview Component
 * Circular preview following cursor
 */
export interface IBrushCursor {
  x: number;                          // Cursor x position (screen coordinates)
  y: number;                          // Cursor y position (screen coordinates)
  size: number;                       // Brush diameter in pixels (affected by zoom)
  color: Color;                       // Brush color (for preview)
  visible: boolean;                   // Show/hide cursor preview
}

// ============================================================================
// UI State Types
// ============================================================================

export interface UIState {
  activeTool: 'brush' | 'eraser' | 'pan' | 'zoom'; // Current tool (MVP: only brush)
  layerPanelOpen: boolean;
  colorPickerOpen: boolean;
  brushSliderVisible: boolean;
  brushSliderType: 'size' | 'opacity' | null;
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  toast: {
    message: string;
    visible: boolean;
    timestamp: number;
  } | null;
}

// ============================================================================
// UI Events (emitted via core/events.ts)
// ============================================================================

export interface UIEvents {
  // Brush events
  brushSizeChanged: (size: number) => void;
  brushColorChanged: (color: Color) => void;
  brushToolSelected: () => void;

  // Layer events
  layerSelected: (layerId: string) => void;
  layerVisibilityToggled: (layerId: string) => void;
  layerOpacityChanged: (layerId: string, opacity: number) => void;
  layerBlendModeChanged: (layerId: string, blendMode: BlendMode) => void;
  layerAddRequested: () => void;
  layerDeleteRequested: (layerId: string) => void;

  // History events
  undoRequested: () => void;
  redoRequested: () => void;

  // Canvas events
  canvasClearRequested: () => void;
}

// ============================================================================
// Styling Constants (Canvas-First UI)
// ============================================================================

export const UI_CONSTANTS = {
  // Toolbar
  TOOLBAR_HEIGHT: 48,                 // pixels
  TOOLBAR_ICON_SIZE: 32,              // pixels
  TOOLBAR_PADDING: 8,                 // pixels
  MAX_TOOLBAR_ICONS: 9,               // Constitution limit

  // Layer Panel
  LAYER_PANEL_WIDTH: 320,             // pixels
  LAYER_THUMBNAIL_SIZE: 64,           // pixels
  LAYER_ROW_HEIGHT: 80,               // pixels

  // Sliders
  SLIDER_WIDTH: 280,                  // pixels
  SLIDER_HEIGHT: 48,                  // pixels
  SLIDER_THUMB_SIZE: 24,              // pixels

  // Color Picker
  COLOR_PICKER_SIZE: 280,             // pixels (square)

  // Brush Cursor
  CURSOR_RING_THICKNESS: 2,           // pixels
  CURSOR_MIN_SIZE: 8,                 // pixels (minimum visible size)

  // Animations (max 150ms per constitution)
  ANIMATION_DURATION: 150,            // milliseconds
  TOAST_DURATION: 3000,               // milliseconds

  // Z-indexes (ensure UI floats above canvas)
  Z_INDEX_CANVAS: 0,
  Z_INDEX_CURSOR: 10,
  Z_INDEX_TOOLBAR: 100,
  Z_INDEX_SLIDER: 200,
  Z_INDEX_MODAL: 300,                 // Layer panel, color picker
  Z_INDEX_TOAST: 400,
} as const;

// ============================================================================
// Icon Definitions (Flat, Monochrome per Constitution)
// ============================================================================

export enum IconType {
  Brush = 'brush',
  Undo = 'undo',
  Redo = 'redo',
  Layers = 'layers',
  Color = 'color',
  Settings = 'settings',
  Add = 'add',
  Delete = 'delete',
  Visible = 'visible',
  Hidden = 'hidden',
  Close = 'close',
}

export interface Icon {
  type: IconType;
  svg: string;                        // Inline SVG path (monochrome)
  label: string;                      // Accessibility label (not displayed by default)
}
