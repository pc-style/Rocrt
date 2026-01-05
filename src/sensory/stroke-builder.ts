import type { InputPoint, Stroke, BrushConfig } from '../core/types';

export class StrokeBuilder {
  private points: InputPoint[] = [];
  private startTime: number = 0;
  private isActive: boolean = false;
  private layerId: string = '';
  private brushConfig: BrushConfig | null = null;

  begin(point: InputPoint, layerId: string, brushConfig: BrushConfig): void {
    this.points = [point];
    this.startTime = point.timestamp;
    this.isActive = true;
    this.layerId = layerId;
    this.brushConfig = { ...brushConfig };
  }

  addPoint(point: InputPoint): void {
    if (!this.isActive) return;
    this.points.push(point);
  }

  end(): Stroke | null {
    if (!this.isActive || !this.brushConfig || this.points.length === 0) {
      this.reset();
      return null;
    }

    const lastPoint = this.points[this.points.length - 1]!;
    const stroke: Stroke = {
      id: this.generateId(),
      layerId: this.layerId,
      points: [...this.points],
      brushConfig: this.brushConfig,
      affectedTiles: [],
      timestamp: this.startTime,
      duration: lastPoint.timestamp - this.startTime,
    };

    this.reset();
    return stroke;
  }

  cancel(): void {
    this.reset();
  }

  isDrawing(): boolean {
    return this.isActive;
  }

  getPoints(): InputPoint[] {
    return this.points;
  }

  getPointCount(): number {
    return this.points.length;
  }

  private reset(): void {
    this.points = [];
    this.startTime = 0;
    this.isActive = false;
    this.layerId = '';
    this.brushConfig = null;
  }

  private generateId(): string {
    return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
