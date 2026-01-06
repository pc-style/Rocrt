import type { ISensoryInput } from '../core/contracts';
import type { InputPoint, GestureType, GestureData, Point2D } from '../core/types';
import { PointerType } from '../core/types';
import { eventBus, Events } from '../core/events';
import { GestureFSM } from './gesture-fsm';

const TAP_MAX_DURATION_MS = 240;
const TAP_MOVE_THRESHOLD = 12;
const SCRUB_MOVE_THRESHOLD = 28;
const DOUBLE_TAP_WINDOW_MS = 320;

type StrokeCallback = (point: InputPoint) => void;
type StrokePredictionCallback = (points: InputPoint[]) => void;
type StrokeEndCallback = () => void;
type GestureCallback = (data: GestureData) => void;
type Subscription = { unsubscribe: () => void };

interface TouchPoint {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export class InputSampler implements ISensoryInput {
  private canvas: HTMLCanvasElement | null = null;
  private isActive: boolean = false;
  private activePointerId: number | null = null;
  private strokeBeginCallbacks: StrokeCallback[] = [];
  private strokeMoveCallbacks: StrokeCallback[] = [];
  private strokeEndCallbacks: StrokeEndCallback[] = [];
  private strokePredictionCallbacks: StrokePredictionCallback[] = [];
  private gestureCallbacks: Map<GestureType, GestureCallback[]> = new Map();
  private gestureSubscriptions: Subscription[] = [];
  private gestureFSM = new GestureFSM();
  private touchPointers: Map<number, TouchPoint> = new Map();
  private threeFingerScrubTriggered: boolean = false;
  private pendingTwoFingerTapTimer: number | null = null;
  private pendingTwoFingerTapCenter: Point2D | null = null;
  private predictionEnabled: boolean = true;
  private highRatePollingEnabled: boolean = true;
  private tapState = {
    startTime: 0,
    maxPointers: 0,
    moved: false,
    pointerStarts: new Map<number, Point2D>(),
  };

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
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    // Color drop drag-and-drop support
    this.canvas.addEventListener('dragover', this.handleDragOver);
    this.canvas.addEventListener('drop', this.handleDrop);

    this.subscribeToGestures();
    this.isActive = false;
  }

  stopSampling(): void {
    if (!this.canvas) return;

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dragover', this.handleDragOver);
    this.canvas.removeEventListener('drop', this.handleDrop);

    for (const sub of this.gestureSubscriptions) {
      sub.unsubscribe();
    }
    this.gestureSubscriptions = [];
    if (this.pendingTwoFingerTapTimer !== null) {
      window.clearTimeout(this.pendingTwoFingerTapTimer);
      this.pendingTwoFingerTapTimer = null;
      this.pendingTwoFingerTapCenter = null;
    }
  }

  private subscribeToGestures(): void {
    if (this.gestureSubscriptions.length > 0) return;

    this.gestureSubscriptions = [
      eventBus.on(Events.GESTURE_PINCH, (data: GestureData) => this.dispatchGesture('pinch', data)),
      eventBus.on(Events.GESTURE_PAN, (data: GestureData) => this.dispatchGesture('pan', data)),
      eventBus.on(Events.GESTURE_ROTATE, (data: GestureData) => this.dispatchGesture('rotate', data)),
      eventBus.on(Events.GESTURE_TWO_FINGER_TAP, (data: GestureData) => this.dispatchGesture('twoFingerTap', data)),
      eventBus.on(Events.GESTURE_TWO_FINGER_DOUBLE_TAP, (data: GestureData) => this.dispatchGesture('twoFingerDoubleTap', data)),
      eventBus.on(Events.GESTURE_THREE_FINGER_TAP, (data: GestureData) => this.dispatchGesture('threeFingerTap', data)),
      eventBus.on(Events.GESTURE_THREE_FINGER_SCRUB, (data: GestureData) => this.dispatchGesture('threeFingerScrub', data)),
    ];
  }

  private handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();

    const pointerType = this.mapPointerType(event.pointerType);
    if (pointerType === PointerType.Touch) {
      this.trackTouchStart(event);
      this.gestureFSM.handlePointerDown(event);
      return;
    }

    if (this.activePointerId !== null) return;
    if (pointerType === PointerType.Mouse && event.button !== 0) return;

    this.isActive = true;
    this.activePointerId = event.pointerId;
    this.canvas?.setPointerCapture(event.pointerId);

    const point = this.eventToInputPoint(event);
    this.strokeBeginCallbacks.forEach((cb) => cb(point));
    eventBus.emit(Events.STROKE_BEGIN, point);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const pointerType = this.mapPointerType(event.pointerType);
    if (pointerType === PointerType.Touch) {
      event.preventDefault();
      this.trackTouchMove(event);
      this.gestureFSM.handlePointerMove(event);
      return;
    }

    if (!this.isActive || this.activePointerId !== event.pointerId) return;
    event.preventDefault();

    // high-rate polling: process all coalesced events for smoother strokes
    const events = this.highRatePollingEnabled && event.getCoalescedEvents
      ? event.getCoalescedEvents()
      : [event];

    for (const e of events) {
      const point = this.eventToInputPoint(e);
      this.strokeMoveCallbacks.forEach((cb) => cb(point));
      eventBus.emit(Events.STROKE_MOVE, point);
    }

    // stroke prediction: emit predicted future positions to reduce perceived latency
    if (this.predictionEnabled && this.strokePredictionCallbacks.length > 0) {
      const predictedEvents = event.getPredictedEvents?.() ?? [];
      if (predictedEvents.length > 0) {
        const predictedPoints = predictedEvents.map((e) => this.eventToInputPoint(e));
        this.strokePredictionCallbacks.forEach((cb) => cb(predictedPoints));
        eventBus.emit(Events.STROKE_PREDICTED, predictedPoints);
      }
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const pointerType = this.mapPointerType(event.pointerType);
    if (pointerType === PointerType.Touch) {
      event.preventDefault();
      this.trackTouchEnd(event);
      this.gestureFSM.handlePointerUp(event);
      return;
    }

    if (!this.isActive || this.activePointerId !== event.pointerId) return;
    event.preventDefault();

    this.isActive = false;
    this.activePointerId = null;

    if (this.canvas?.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    this.strokeEndCallbacks.forEach((cb) => cb());
    eventBus.emit(Events.STROKE_END, null);
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!this.canvas) return;
    event.preventDefault();

    const center = { x: event.clientX, y: event.clientY };
    const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    if (event.ctrlKey || event.metaKey) {
      const rawScale = Math.exp(-(event.deltaY * deltaScale) * 0.001);
      const scale = Math.max(0.5, Math.min(2.0, rawScale));
      eventBus.emit(Events.GESTURE_PINCH, { center, scale });
      return;
    }

    const displacement = {
      x: -(event.deltaX * deltaScale),
      y: -(event.deltaY * deltaScale),
    };
    eventBus.emit(Events.GESTURE_PAN, { center, displacement });
  };

  private handleDragOver = (event: DragEvent): void => {
    // Prevent default to allow drop
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  private handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    if (!this.canvas) return;

    // Check if this is a color drop
    const data = event.dataTransfer?.getData('text/plain');
    if (data !== 'colordrop') return;

    // Calculate canvas-relative position
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (event.clientX - rect.left) * dpr;
    const y = (event.clientY - rect.top) * dpr;

    // Emit color drop at this position
    eventBus.emit('sensory:color-drop-at-position', { x, y });
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

  private trackTouchStart(event: PointerEvent): void {
    if (this.touchPointers.size === 0) {
      this.tapState.startTime = event.timeStamp;
      this.tapState.maxPointers = 0;
      this.tapState.moved = false;
      this.tapState.pointerStarts.clear();
    }

    this.touchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
    this.tapState.pointerStarts.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    this.tapState.maxPointers = Math.max(this.tapState.maxPointers, this.touchPointers.size);
    if (this.tapState.maxPointers > 3) {
      this.tapState.moved = true;
    }
  }

  private trackTouchMove(event: PointerEvent): void {
    const pointer = this.touchPointers.get(event.pointerId);
    if (!pointer) return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    const dx = pointer.x - pointer.startX;
    const dy = pointer.y - pointer.startY;
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) {
      this.tapState.moved = true;
    }

    if (this.touchPointers.size === 3 && !this.threeFingerScrubTriggered) {
      const movedDistance = this.getMaxScrubDistance();
      if (movedDistance > SCRUB_MOVE_THRESHOLD) {
        this.threeFingerScrubTriggered = true;
        this.tapState.moved = true;
        eventBus.emit(Events.GESTURE_THREE_FINGER_SCRUB, {
          center: this.getCurrentTouchCenter(),
          displacement: this.getScrubDisplacement(),
        });
      }
    }
  }

  private trackTouchEnd(event: PointerEvent): void {
    this.touchPointers.delete(event.pointerId);

    if (this.touchPointers.size > 0) return;

    const elapsed = event.timeStamp - this.tapState.startTime;
    if (!this.tapState.moved && elapsed <= TAP_MAX_DURATION_MS) {
      const center = this.getTapCenter();
      if (this.tapState.maxPointers === 2) {
        if (this.pendingTwoFingerTapTimer !== null) {
          window.clearTimeout(this.pendingTwoFingerTapTimer);
          this.pendingTwoFingerTapTimer = null;
          this.pendingTwoFingerTapCenter = null;
          eventBus.emit(Events.GESTURE_TWO_FINGER_DOUBLE_TAP, { center });
        } else {
          this.pendingTwoFingerTapCenter = center;
          this.pendingTwoFingerTapTimer = window.setTimeout(() => {
            const tapCenter = this.pendingTwoFingerTapCenter ?? center;
            this.pendingTwoFingerTapTimer = null;
            this.pendingTwoFingerTapCenter = null;
            eventBus.emit(Events.GESTURE_TWO_FINGER_TAP, { center: tapCenter });
          }, DOUBLE_TAP_WINDOW_MS);
        }
      } else if (this.tapState.maxPointers === 3) {
        eventBus.emit(Events.GESTURE_THREE_FINGER_TAP, { center });
      }
    }

    this.tapState.pointerStarts.clear();
    this.tapState.maxPointers = 0;
    this.tapState.moved = false;
    this.tapState.startTime = 0;
    this.threeFingerScrubTriggered = false;
  }

  private getTapCenter(): Point2D {
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    for (const point of this.tapState.pointerStarts.values()) {
      sumX += point.x;
      sumY += point.y;
      count++;
    }

    if (count === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: sumX / count,
      y: sumY / count,
    };
  }

  private getCurrentTouchCenter(): Point2D {
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    for (const point of this.touchPointers.values()) {
      sumX += point.x;
      sumY += point.y;
      count++;
    }
    if (count === 0) {
      return { x: 0, y: 0 };
    }
    return { x: sumX / count, y: sumY / count };
  }

  private getMaxScrubDistance(): number {
    let maxDistance = 0;
    for (const point of this.touchPointers.values()) {
      const dx = point.x - point.startX;
      const dy = point.y - point.startY;
      maxDistance = Math.max(maxDistance, Math.hypot(dx, dy));
    }
    return maxDistance;
  }

  private getScrubDisplacement(): Point2D {
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    for (const point of this.touchPointers.values()) {
      sumX += point.x - point.startX;
      sumY += point.y - point.startY;
      count++;
    }
    if (count === 0) {
      return { x: 0, y: 0 };
    }
    return { x: sumX / count, y: sumY / count };
  }

  private dispatchGesture(type: GestureType, data: GestureData): void {
    const callbacks = this.gestureCallbacks.get(type);
    if (!callbacks) return;
    callbacks.forEach((cb) => cb(data));
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

  onStrokePrediction(callback: StrokePredictionCallback): void {
    this.strokePredictionCallbacks.push(callback);
  }

  setPredictionEnabled(enabled: boolean): void {
    this.predictionEnabled = enabled;
  }

  setHighRatePollingEnabled(enabled: boolean): void {
    this.highRatePollingEnabled = enabled;
  }

  isPredictionEnabled(): boolean {
    return this.predictionEnabled;
  }

  isHighRatePollingEnabled(): boolean {
    return this.highRatePollingEnabled;
  }
}
