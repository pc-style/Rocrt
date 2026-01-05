import type { Point2D } from '../core/types';
import { ZOOM_LEVELS } from '../core/config';

export class ViewTransformer {
  private zoomLevel: number = 1.0;
  private panOffset: Point2D = { x: 0, y: 0 };
  private rotationAngle: number = 0;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  init(canvasWidth: number, canvasHeight: number): void {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  setZoom(level: number): void {
    this.zoomLevel = Math.max(0.125, Math.min(64, level));
  }

  getZoom(): number {
    return this.zoomLevel;
  }

  zoomIn(): void {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= this.zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      this.zoomLevel = ZOOM_LEVELS[currentIndex + 1] ?? this.zoomLevel;
    }
  }

  zoomOut(): void {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= this.zoomLevel);
    if (currentIndex > 0) {
      this.zoomLevel = ZOOM_LEVELS[currentIndex - 1] ?? this.zoomLevel;
    }
  }

  zoomToFit(): void {
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
  }

  applyPinchZoom(scale: number, center: Point2D): void {
    const newZoom = Math.max(0.125, Math.min(64, this.zoomLevel * scale));
    
    const zoomDelta = newZoom / this.zoomLevel;
    this.panOffset.x = center.x - (center.x - this.panOffset.x) * zoomDelta;
    this.panOffset.y = center.y - (center.y - this.panOffset.y) * zoomDelta;
    
    this.zoomLevel = newZoom;
  }

  setPan(offset: Point2D): void {
    this.panOffset = { ...offset };
  }

  getPan(): Point2D {
    return { ...this.panOffset };
  }

  applyPan(delta: Point2D): void {
    this.panOffset.x += delta.x;
    this.panOffset.y += delta.y;
  }

  setRotation(angle: number): void {
    this.rotationAngle = ((angle % 360) + 360) % 360;
  }

  getRotation(): number {
    return this.rotationAngle;
  }

  applyRotation(angleDelta: number): void {
    this.rotationAngle = ((this.rotationAngle + angleDelta) % 360 + 360) % 360;
  }

  screenToCanvas(screenX: number, screenY: number): Point2D {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    let x = screenX - centerX - this.panOffset.x;
    let y = screenY - centerY - this.panOffset.y;

    x /= this.zoomLevel;
    y /= this.zoomLevel;

    const rad = -this.rotationAngle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;

    return {
      x: rotatedX + centerX,
      y: rotatedY + centerY,
    };
  }

  canvasToScreen(canvasX: number, canvasY: number): Point2D {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    let x = canvasX - centerX;
    let y = canvasY - centerY;

    const rad = this.rotationAngle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;

    x = rotatedX * this.zoomLevel;
    y = rotatedY * this.zoomLevel;

    return {
      x: x + centerX + this.panOffset.x,
      y: y + centerY + this.panOffset.y,
    };
  }

  getTransformMatrix(): number[] {
    const cx = this.canvasWidth / 2;
    const cy = this.canvasHeight / 2;
    const rad = this.rotationAngle * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const z = this.zoomLevel;
    const px = this.panOffset.x;
    const py = this.panOffset.y;

    return [
      z * cos, z * sin, 0, 0,
      -z * sin, z * cos, 0, 0,
      0, 0, 1, 0,
      cx + px - z * (cx * cos - cy * sin),
      cy + py - z * (cx * sin + cy * cos),
      0, 1,
    ];
  }
}
