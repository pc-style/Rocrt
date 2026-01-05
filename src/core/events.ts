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
  GESTURE_PINCH: 'sensory:gesture-pinch',
  GESTURE_PAN: 'sensory:gesture-pan',
  GESTURE_ROTATE: 'sensory:gesture-rotate',
  GESTURE_TWO_FINGER_TAP: 'sensory:gesture-two-finger-tap',
  GESTURE_THREE_FINGER_TAP: 'sensory:gesture-three-finger-tap',
  BRUSH_SIZE_CHANGED: 'luma:brush-size-changed',
  BRUSH_COLOR_CHANGED: 'luma:brush-color-changed',
  LAYER_VISIBILITY_TOGGLED: 'luma:layer-visibility-toggled',
  LAYER_OPACITY_CHANGED: 'luma:layer-opacity-changed',
  LAYER_BLEND_MODE_CHANGED: 'luma:layer-blend-mode-changed',
  LAYER_SELECTED: 'luma:layer-selected',
  LAYER_ADDED: 'luma:layer-added',
  LAYER_DELETED: 'luma:layer-deleted',
  UNDO_REQUESTED: 'luma:undo-requested',
  REDO_REQUESTED: 'luma:redo-requested',
  CANVAS_DIRTY: 'valkyrie:canvas-dirty',
  FRAME_RENDERED: 'valkyrie:frame-rendered',
  ACTION_RECORDED: 'chronos:action-recorded',
  UNDO_EXECUTED: 'chronos:undo-executed',
  REDO_EXECUTED: 'chronos:redo-executed',
} as const;
