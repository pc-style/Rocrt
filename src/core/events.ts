type EventCallback<T = unknown> = (data: T) => void;

interface EventSubscription {
  unsubscribe: () => void;
}

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T>(event: string, callback: EventCallback<T>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback as EventCallback);

    return {
      unsubscribe: () => {
        callbacks.delete(callback as EventCallback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      },
    };
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  once<T>(event: string, callback: EventCallback<T>): EventSubscription {
    const wrappedCallback: EventCallback<T> = (data) => {
      subscription.unsubscribe();
      callback(data);
    };
    const subscription = this.on(event, wrappedCallback);
    return subscription;
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();

export const Events = {
  STROKE_BEGIN: 'sensory:stroke-begin',
  STROKE_MOVE: 'sensory:stroke-move',
  STROKE_END: 'sensory:stroke-end',
  STROKE_PREDICTED: 'sensory:stroke-predicted',
  GESTURE_PINCH: 'sensory:gesture-pinch',
  GESTURE_PAN: 'sensory:gesture-pan',
  GESTURE_ROTATE: 'sensory:gesture-rotate',
  GESTURE_TWO_FINGER_TAP: 'sensory:gesture-two-finger-tap',
  GESTURE_TWO_FINGER_DOUBLE_TAP: 'sensory:gesture-two-finger-double-tap',
  GESTURE_THREE_FINGER_TAP: 'sensory:gesture-three-finger-tap',
  GESTURE_THREE_FINGER_SCRUB: 'sensory:gesture-three-finger-scrub',
  BRUSH_SIZE_CHANGED: 'luma:brush-size-changed',
  BRUSH_COLOR_CHANGED: 'luma:brush-color-changed',
  BRUSH_OPACITY_CHANGED: 'luma:brush-opacity-changed',
  BRUSH_STABILIZATION_CHANGED: 'luma:brush-stabilization-changed',
  LAYER_VISIBILITY_TOGGLED: 'luma:layer-visibility-toggled',
  LAYER_OPACITY_CHANGED: 'luma:layer-opacity-changed',
  LAYER_BLEND_MODE_CHANGED: 'luma:layer-blend-mode-changed',
  LAYER_LOCK_TOGGLED: 'luma:layer-lock-toggled',
  LAYER_ALPHA_LOCK_TOGGLED: 'luma:layer-alpha-lock-toggled',
  LAYER_MOVED_UP: 'luma:layer-moved-up',
  LAYER_MOVED_DOWN: 'luma:layer-moved-down',
  LAYER_RENAMED: 'luma:layer-renamed',
  LAYER_DUPLICATED: 'luma:layer-duplicated',
  LAYER_SOLO_TOGGLED: 'luma:layer-solo-toggled',
  LAYER_MERGED_DOWN: 'luma:layer-merged-down',
  LAYER_REFERENCE_TOGGLED: 'luma:layer-reference-toggled',
  LAYER_SELECTED: 'luma:layer-selected',
  LAYER_ADDED: 'luma:layer-added',
  LAYER_DELETED: 'luma:layer-deleted',
  LAYER_CLEAR_REQUESTED: 'luma:layer-clear-requested',
  UNDO_REQUESTED: 'luma:undo-requested',
  REDO_REQUESTED: 'luma:redo-requested',
  CANVAS_EXPORT_REQUESTED: 'luma:canvas-export-requested',
  CANVAS_EXPORT_BACKGROUND_REQUESTED: 'luma:canvas-export-background-requested',
  CANVAS_EXPORT_JPEG_REQUESTED: 'luma:canvas-export-jpeg-requested',
  PROJECT_EXPORT_REQUESTED: 'luma:project-export-requested',
  PROJECT_IMPORT_REQUESTED: 'luma:project-import-requested',
  PROJECT_RECOVER_REQUESTED: 'luma:project-recover-requested',
  PROJECT_AUTOSAVE_UPDATED: 'chronos:project-autosave-updated',
  EYEDROPPER_TOGGLED: 'luma:eyedropper-toggled',
  PAN_MODE_TOGGLED: 'luma:pan-mode-toggled',
  CANVAS_RESIZE_REQUESTED: 'luma:canvas-resize-requested',
  CANVAS_FIT_REQUESTED: 'luma:canvas-fit-requested',
  VIEW_FIT_REQUESTED: 'valkyrie:view-fit-requested',
  VIEW_ROTATION_SNAP_TOGGLED: 'valkyrie:view-rotation-snap-toggled',
  TIMELAPSE_TOGGLED: 'chronos:timelapse-toggled',
  TIMELAPSE_STATUS_CHANGED: 'chronos:timelapse-status-changed',
  COLOR_DROP_TOGGLED: 'alchemy:color-drop-toggled',
  COLOR_DROP_THRESHOLD_CHANGED: 'alchemy:color-drop-threshold-changed',
  COLOR_DROP_DRAGGING_CHANGED: 'alchemy:color-drop-dragging-changed',
  LASSO_TOGGLED: 'luma:lasso-toggled',
  SELECTION_UPDATED: 'luma:selection-updated',
  UI_TOGGLED: 'luma:ui-toggled',
  READONLY_TOGGLED: 'luma:readonly-toggled',
  CANVAS_CLEAR_REQUESTED: 'luma:canvas-clear-requested',
  VIEW_RESET_REQUESTED: 'valkyrie:view-reset-requested',
  BACKGROUND_COLOR_CHANGED: 'luma:background-color-changed',
  GRID_TOGGLED: 'luma:grid-toggled',
  GRID_SPACING_CHANGED: 'luma:grid-spacing-changed',
  GRID_COLOR_CHANGED: 'luma:grid-color-changed',
  GRID_SNAP_TOGGLED: 'luma:grid-snap-toggled',
  VIEW_TRANSFORM_CHANGED: 'valkyrie:view-transform-changed',
  CANVAS_DIRTY: 'valkyrie:canvas-dirty',
  FRAME_RENDERED: 'valkyrie:frame-rendered',
  ACTION_RECORDED: 'chronos:action-recorded',
  UNDO_EXECUTED: 'chronos:undo-executed',
  REDO_EXECUTED: 'chronos:redo-executed',
  HISTORY_STATE_CHANGED: 'chronos:history-state-changed',
  ERASER_TOGGLED: 'luma:eraser-toggled',
  TRANSFORM_MODE_TOGGLED: 'luma:transform-mode-toggled',
} as const;
