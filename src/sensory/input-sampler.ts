import type { ISensoryInput } from '../core/contracts';
import type { InputPoint, GestureType, GestureData } from '../core/types';
import { PointerType } from '../core/types';
import { eventBus, Events } from '../core/events';

type StrokeCallback = (point: InputPoint) => void;
type StrokeEndCallback = () => void;
type GestureCallback = (data: GestureData) => void;

export class InputSampler implements ISensoryInput {
  private canvas: HTMLCanvasElement | null = null;
  private isActive: boolean = false;
  private strokeBeginCallbacks: StrokeCallback[] = [];
  private strokeMoveCallbacks: StrokeCallback[] = [];
  private strokeEndCallbacks: StrokeEndCallback[] = [];
  private gestureCallbacks: Map<GestureType, GestureCallback[]> = new Map();

  startSampling(): void {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerUp);

    this.isActive = false;
  }

  stopSampling(): void {
    if (!this.canvas) return;

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.isActive = true;

    const point = this.eventToInputPoint(event);
    this.strokeBeginCallbacks.forEach((cb) => cb(point));
    eventBus.emit(Events.STROKE_BEGIN, point);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isActive) return;
    event.preventDefault();

    const coalescedEvents = event.getCoalescedEvents?.() ?? [event];
    for (const e of coalescedEvents) {
      const point = this.eventToInputPoint(e);
      this.strokeMoveCallbacks.forEach((cb) => cb(point));
      eventBus.emit(Events.STROKE_MOVE, point);
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isActive) return;
    event.preventDefault();
    this.isActive = false;

    this.strokeEndCallbacks.forEach((cb) => cb());
    eventBus.emit(Events.STROKE_END, null);
  };

  private eventToInputPoint(event: PointerEvent): InputPoint {
    const rect = this.canvas?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = rect ? (event.clientX - rect.left) * dpr : event.clientX;
    const y = rect ? (event.clientY - rect.top) * dpr : event.clientY;

    return {
      x,
      y,
      pressure: event.pressure || 0.5,
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      timestamp: event.timeStamp,
      pointerType: this.mapPointerType(event.pointerType),
    };
  }

  private mapPointerType(type: string): PointerType {
    switch (type) {
      case 'pen':
        return PointerType.Stylus;
      case 'touch':
        return PointerType.Touch;
      default:
        return PointerType.Mouse;
    }
  }

  onStrokeBegin(callback: StrokeCallback): void {
    this.strokeBeginCallbacks.push(callback);
  }

  onStrokeMove(callback: StrokeCallback): void {
    this.strokeMoveCallbacks.push(callback);
  }

  onStrokeEnd(callback: StrokeEndCallback): void {
    this.strokeEndCallbacks.push(callback);
  }

  onGesture(type: GestureType, callback: GestureCallback): void {
    if (!this.gestureCallbacks.has(type)) {
      this.gestureCallbacks.set(type, []);
    }
    this.gestureCallbacks.get(type)!.push(callback);
  }
}
