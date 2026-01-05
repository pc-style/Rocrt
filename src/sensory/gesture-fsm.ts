import type { Point2D, GestureData } from '../core/types';
import { eventBus, Events } from '../core/events';

export enum GestureState {
  IDLE = 'idle',
  DRAWING = 'drawing',
  GESTURE = 'gesture',
}

interface PointerInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export class GestureFSM {
  private state: GestureState = GestureState.IDLE;
  private pointers: Map<number, PointerInfo> = new Map();
  private gestureStartDistance: number = 0;
  private gestureStartAngle: number = 0;
  private gestureStartCenter: Point2D = { x: 0, y: 0 };

  handlePointerDown(event: PointerEvent): void {
    this.pointers.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });

    if (this.pointers.size === 1) {
      this.state = GestureState.DRAWING;
    } else if (this.pointers.size === 2) {
      this.state = GestureState.GESTURE;
      this.initializeGesture();
    }
  }

  handlePointerMove(event: PointerEvent): void {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.state === GestureState.GESTURE && this.pointers.size === 2) {
      this.processGesture();
    }
  }

  handlePointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);

    if (this.pointers.size === 0) {
      this.state = GestureState.IDLE;
    } else if (this.pointers.size === 1) {
      this.state = GestureState.DRAWING;
    }
  }

  private initializeGesture(): void {
    const points = Array.from(this.pointers.values());
    if (points.length < 2) return;

    const p1 = points[0]!;
    const p2 = points[1]!;

    this.gestureStartDistance = this.getDistance(p1, p2);
    this.gestureStartAngle = this.getAngle(p1, p2);
    this.gestureStartCenter = this.getCenter(p1, p2);
  }

  private processGesture(): void {
    const points = Array.from(this.pointers.values());
    if (points.length < 2) return;

    const p1 = points[0]!;
    const p2 = points[1]!;

    const currentDistance = this.getDistance(p1, p2);
    const currentAngle = this.getAngle(p1, p2);
    const currentCenter = this.getCenter(p1, p2);

    const scale = currentDistance / this.gestureStartDistance;
    const angleDelta = currentAngle - this.gestureStartAngle;
    const displacement: Point2D = {
      x: currentCenter.x - this.gestureStartCenter.x,
      y: currentCenter.y - this.gestureStartCenter.y,
    };

    if (Math.abs(scale - 1) > 0.01) {
      const gestureData: GestureData = {
        center: currentCenter,
        scale,
      };
      eventBus.emit(Events.GESTURE_PINCH, gestureData);
    }

    if (Math.abs(displacement.x) > 2 || Math.abs(displacement.y) > 2) {
      const gestureData: GestureData = {
        center: currentCenter,
        displacement,
      };
      eventBus.emit(Events.GESTURE_PAN, gestureData);
    }

    if (Math.abs(angleDelta) > 0.02) {
      const gestureData: GestureData = {
        center: currentCenter,
        angle: angleDelta,
      };
      eventBus.emit(Events.GESTURE_ROTATE, gestureData);
    }

    this.gestureStartDistance = currentDistance;
    this.gestureStartAngle = currentAngle;
    this.gestureStartCenter = currentCenter;
  }

  private getDistance(p1: PointerInfo, p2: PointerInfo): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getAngle(p1: PointerInfo, p2: PointerInfo): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  private getCenter(p1: PointerInfo, p2: PointerInfo): Point2D {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  getState(): GestureState {
    return this.state;
  }

  getPointerCount(): number {
    return this.pointers.size;
  }

  isDrawing(): boolean {
    return this.state === GestureState.DRAWING;
  }

  isGesturing(): boolean {
    return this.state === GestureState.GESTURE;
  }
}
