import type { IAlchemyBrush } from '../core/contracts';
import type { InputPoint, BrushConfig, StampPlot, Color } from '../core/types';
import { BlendMode } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';

export class BrushEngine implements IAlchemyBrush {
  private config: BrushConfig;

  constructor() {
    this.config = {
      baseSize: BRUSH_DEFAULTS.baseSize,
      color: { ...BRUSH_DEFAULTS.color },
      pressureSizeCurve: (p: number) => p,
      pressureOpacityCurve: (p: number) => p,
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
      this.config.spacing = Math.max(0.01, Math.min(1.0, config.spacing));
    }
  }

  getBrush(): BrushConfig {
    return { ...this.config };
  }

  plotStroke(points: InputPoint[]): StampPlot[] {
    if (points.length === 0) return [];

    const stamps: StampPlot[] = [];
    const spacingPx = this.config.baseSize * this.config.spacing;

    let lastX = points[0]!.x;
    let lastY = points[0]!.y;
    let accumulatedDistance = 0;

    for (const point of points) {
      const dx = point.x - lastX;
      const dy = point.y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      accumulatedDistance += distance;

      while (accumulatedDistance >= spacingPx) {
        const t = spacingPx / accumulatedDistance;
        const stampX = lastX + dx * t;
        const stampY = lastY + dy * t;

        const size = this.config.baseSize * this.config.pressureSizeCurve(point.pressure);
        const opacity = this.config.pressureOpacityCurve(point.pressure);

        stamps.push({
          position: { x: stampX, y: stampY },
          size,
          opacity,
          color: this.applyOpacity(this.config.color, opacity),
        });

        accumulatedDistance -= spacingPx;
        lastX = stampX;
        lastY = stampY;
      }

      lastX = point.x;
      lastY = point.y;
    }

    return stamps;
  }

  private applyOpacity(color: Color, opacity: number): Color {
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: Math.round(color.a * opacity),
    };
  }

  previewBrush(_size: number): ImageData | null {
    // TODO: Implement brush preview in Phase 6
    return null;
  }
}
