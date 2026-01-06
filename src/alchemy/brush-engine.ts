import type { IAlchemyBrush } from '../core/contracts';
import type { InputPoint, BrushConfig, StampPlot } from '../core/types';
import { BlendMode } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';

export class BrushEngine implements IAlchemyBrush {
  private config: BrushConfig;
  private lastPlottedX: number = 0;
  private lastPlottedY: number = 0;
  private hasLastPoint: boolean = false;

  constructor() {
    this.config = {
      baseSize: BRUSH_DEFAULTS.baseSize,
      color: { ...BRUSH_DEFAULTS.color },
      pressureSizeCurve: (p: number) => 0.3 + p * 0.7,
      pressureOpacityCurve: (p: number) => 0.5 + p * 0.5,
      blendMode: BlendMode.Normal,
      spacing: BRUSH_DEFAULTS.spacing,
    };
  }

  setBrush(config: Partial<BrushConfig>): void {
    if (config.baseSize !== undefined) {
      this.config.baseSize = Math.max(
        BRUSH_DEFAULTS.minSize,
        Math.min(BRUSH_DEFAULTS.maxSize, config.baseSize)
      );
    }
    if (config.color !== undefined) {
      this.config.color = { ...config.color };
    }
    if (config.pressureSizeCurve !== undefined) {
      this.config.pressureSizeCurve = config.pressureSizeCurve;
    }
    if (config.pressureOpacityCurve !== undefined) {
      this.config.pressureOpacityCurve = config.pressureOpacityCurve;
    }
    if (config.blendMode !== undefined) {
      this.config.blendMode = config.blendMode;
    }
    if (config.spacing !== undefined) {
      this.config.spacing = Math.max(0.05, Math.min(1.0, config.spacing));
    }
  }

  getBrush(): BrushConfig {
    return { ...this.config };
  }

  resetStroke(): void {
    this.hasLastPoint = false;
  }

  plotStroke(points: InputPoint[]): StampPlot[] {
    if (points.length === 0) return [];

    const stamps: StampPlot[] = [];
    const spacing = Math.max(1, this.config.baseSize * this.config.spacing);

    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;
      
      if (!this.hasLastPoint) {
        // First point of stroke - place a stamp
        this.lastPlottedX = point.x;
        this.lastPlottedY = point.y;
        this.hasLastPoint = true;
        
        stamps.push(this.createStamp(point.x, point.y, point.pressure));
        continue;
      }

      // Calculate distance from last plotted point
      const dx = point.x - this.lastPlottedX;
      const dy = point.y - this.lastPlottedY;
      const segmentDist = Math.sqrt(dx * dx + dy * dy);

      if (segmentDist < 0.1) continue;

      // Interpolate stamps along the segment
      const steps = Math.ceil(segmentDist / spacing);
      
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const x = this.lastPlottedX + dx * t;
        const y = this.lastPlottedY + dy * t;
        
        // Interpolate pressure
        const prevPressure = i > 0 ? points[i - 1]!.pressure : point.pressure;
        const pressure = prevPressure + (point.pressure - prevPressure) * t;
        
        stamps.push(this.createStamp(x, y, pressure));
      }

      this.lastPlottedX = point.x;
      this.lastPlottedY = point.y;
    }

    return stamps;
  }

  private createStamp(x: number, y: number, pressure: number): StampPlot {
    const size = this.config.baseSize * this.config.pressureSizeCurve(pressure);
    const opacity = this.config.pressureOpacityCurve(pressure);

    return {
      position: { x, y },
      size: Math.max(1, size),
      opacity,
      color: {
        r: this.config.color.r,
        g: this.config.color.g,
        b: this.config.color.b,
        a: Math.round(this.config.color.a * opacity),
      },
    };
  }

  previewBrush(_size: number): ImageData | null {
    return null;
  }
}
