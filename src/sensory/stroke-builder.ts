import type { InputPoint, Stroke, BrushConfig } from '../core/types';
import { BezierStabilizer, StabilizerConfig } from './bezier-stabilizer';

export class StrokeBuilder {
  private points: InputPoint[] = [];
  private rawPoints: InputPoint[] = []; // original unsmoothed points
  private startTime: number = 0;
  private isActive: boolean = false;
  private layerId: string = '';
  private brushConfig: BrushConfig | null = null;
  private stabilizer: BezierStabilizer;
  private stabilizationEnabled: boolean = true;

  constructor(stabilizerConfig?: Partial<StabilizerConfig>) {
    this.stabilizer = new BezierStabilizer(stabilizerConfig);
  }

  setStabilization(enabled: boolean): void {
    this.stabilizationEnabled = enabled;
  }

  setStabilizerConfig(config: Partial<StabilizerConfig>): void {
    this.stabilizer.setConfig(config);
  }

  begin(point: InputPoint, layerId: string, brushConfig: BrushConfig): void {
    this.rawPoints = [point];
    this.startTime = point.timestamp;
    this.isActive = true;
    this.layerId = layerId;
    this.brushConfig = { ...brushConfig };
    this.stabilizer.reset();

    if (this.stabilizationEnabled) {
      this.points = this.stabilizer.addPoint(point);
    } else {
      this.points = [point];
    }
  }

  // returns newly stabilized points for immediate rendering
  addPoint(point: InputPoint): InputPoint[] {
    if (!this.isActive) return [];
    this.rawPoints.push(point);

    if (this.stabilizationEnabled) {
      const newPoints = this.stabilizer.addPoint(point);
      this.points.push(...newPoints);
      return newPoints;
    } else {
      this.points.push(point);
      return [point];
    }
  }

  // returns final stabilized points when stroke ends
  end(): Stroke | null {
    if (!this.isActive || !this.brushConfig) {
      this.reset();
      return null;
    }

    // flush remaining stabilizer buffer
    if (this.stabilizationEnabled) {
      const finalPoints = this.stabilizer.finish();
      this.points.push(...finalPoints);
    }

    if (this.points.length === 0) {
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

  // get final points when stroke ends (for rendering the flush)
  finishAndGetFinalPoints(): InputPoint[] {
    if (!this.stabilizationEnabled) return [];
    return this.stabilizer.finish();
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
    this.rawPoints = [];
    this.startTime = 0;
    this.isActive = false;
    this.layerId = '';
    this.brushConfig = null;
    this.stabilizer.reset();
  }

  getRawPoints(): InputPoint[] {
    return this.rawPoints;
  }

  private generateId(): string {
    return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
