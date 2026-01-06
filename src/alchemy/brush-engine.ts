import type { IAlchemyBrush } from '../core/contracts';
import type { InputPoint, BrushConfig, StampPlot, Point2D } from '../core/types';
import { BlendMode } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';

// Seeded random for reproducibility
class SeededRandom {
  private seed: number;
  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export class BrushEngine implements IAlchemyBrush {
  private config: BrushConfig;
  private lastPlottedX: number = 0;
  private lastPlottedY: number = 0;
  private hasLastPoint: boolean = false;
  private lastAngle: number = 0;
  private random: SeededRandom = new SeededRandom();

  constructor() {
    this.config = {
      baseSize: BRUSH_DEFAULTS.baseSize,
      color: { ...BRUSH_DEFAULTS.color },
      pressureSizeCurve: (p: number) => 0.3 + p * 0.7,
      pressureOpacityCurve: (p: number) => 0.5 + p * 0.5,
      blendMode: BlendMode.Normal,
      spacing: BRUSH_DEFAULTS.spacing,
      // Advanced defaults
      scatter: 0,
      scatterBoth: true,
      rotation: 0,
      rotationJitter: 0,
      rotateToStroke: false,
      sizeJitter: 0,
      count: 1,
      flow: 1,
      roundness: 1,
      angle: 0,
      hardness: 1,
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
      this.config.spacing = Math.max(0.05, Math.min(2.0, config.spacing));
    }
    // Advanced properties
    if (config.scatter !== undefined) {
      this.config.scatter = Math.max(0, Math.min(1, config.scatter));
    }
    if (config.scatterBoth !== undefined) {
      this.config.scatterBoth = config.scatterBoth;
    }
    if (config.rotation !== undefined) {
      this.config.rotation = config.rotation;
    }
    if (config.rotationJitter !== undefined) {
      this.config.rotationJitter = Math.max(0, Math.min(360, config.rotationJitter));
    }
    if (config.rotateToStroke !== undefined) {
      this.config.rotateToStroke = config.rotateToStroke;
    }
    if (config.sizeJitter !== undefined) {
      this.config.sizeJitter = Math.max(0, Math.min(1, config.sizeJitter));
    }
    if (config.count !== undefined) {
      this.config.count = Math.max(1, Math.min(20, Math.floor(config.count)));
    }
    if (config.flow !== undefined) {
      this.config.flow = Math.max(0, Math.min(1, config.flow));
    }
    if (config.roundness !== undefined) {
      this.config.roundness = Math.max(0.1, Math.min(1, config.roundness));
    }
    if (config.angle !== undefined) {
      this.config.angle = config.angle;
    }
    if (config.hardness !== undefined) {
      this.config.hardness = Math.max(0, Math.min(1, config.hardness));
    }
  }

  getBrush(): BrushConfig {
    return { ...this.config };
  }

  resetStroke(): void {
    this.hasLastPoint = false;
    this.lastAngle = 0;
    this.random = new SeededRandom(Date.now());
  }

  plotStroke(points: InputPoint[]): StampPlot[] {
    if (points.length === 0) return [];

    const stamps: StampPlot[] = [];
    const spacing = Math.max(1, this.config.baseSize * this.config.spacing);

    for (let i = 0; i < points.length; i++) {
      const point = points[i]!;

      if (!this.hasLastPoint) {
        this.lastPlottedX = point.x;
        this.lastPlottedY = point.y;
        this.hasLastPoint = true;

        this.addStampsAtPosition(stamps, point.x, point.y, point.pressure, 0);
        continue;
      }

      const dx = point.x - this.lastPlottedX;
      const dy = point.y - this.lastPlottedY;
      const segmentDist = Math.sqrt(dx * dx + dy * dy);

      if (segmentDist < 0.1) continue;

      // Calculate stroke direction angle
      const strokeAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      this.lastAngle = strokeAngle;

      const steps = Math.ceil(segmentDist / spacing);

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const x = this.lastPlottedX + dx * t;
        const y = this.lastPlottedY + dy * t;

        const prevPressure = i > 0 ? points[i - 1]!.pressure : point.pressure;
        const pressure = prevPressure + (point.pressure - prevPressure) * t;

        this.addStampsAtPosition(stamps, x, y, pressure, strokeAngle);
      }

      this.lastPlottedX = point.x;
      this.lastPlottedY = point.y;
    }

    return stamps;
  }

  private addStampsAtPosition(
    stamps: StampPlot[],
    x: number,
    y: number,
    pressure: number,
    strokeAngle: number
  ): void {
    const { count, scatter, scatterBoth } = this.config;

    for (let c = 0; c < count; c++) {
      // Calculate scatter offset
      const scatterDistance = scatter * this.config.baseSize * 2 * this.random.next();
      let scatterAngle: number;

      if (scatterBoth) {
        scatterAngle = this.random.nextRange(0, 360) * (Math.PI / 180);
      } else {
        // Perpendicular to stroke
        scatterAngle = (strokeAngle + 90 + (this.random.next() > 0.5 ? 0 : 180)) * (Math.PI / 180);
      }

      const scatterOffset: Point2D = {
        x: Math.cos(scatterAngle) * scatterDistance,
        y: Math.sin(scatterAngle) * scatterDistance,
      };

      const stamp = this.createStamp(
        x + scatterOffset.x,
        y + scatterOffset.y,
        pressure,
        strokeAngle,
        scatterOffset
      );
      stamps.push(stamp);
    }
  }

  private createStamp(
    x: number,
    y: number,
    pressure: number,
    strokeAngle: number,
    scatterOffset: Point2D
  ): StampPlot {
    const { sizeJitter, rotationJitter, rotation, rotateToStroke, flow, roundness, hardness } = this.config;

    // Apply size jitter
    const jitterMult = 1 - sizeJitter * this.random.next();
    const baseSize = this.config.baseSize * this.config.pressureSizeCurve(pressure);
    const size = Math.max(1, baseSize * jitterMult);

    // Apply flow to opacity
    const baseOpacity = this.config.pressureOpacityCurve(pressure);
    const opacity = baseOpacity * flow;

    // Calculate rotation
    let stampRotation = rotation;
    if (rotateToStroke) {
      stampRotation += strokeAngle;
    }
    if (rotationJitter > 0) {
      stampRotation += this.random.nextRange(-rotationJitter / 2, rotationJitter / 2);
    }

    return {
      position: { x, y },
      size,
      opacity,
      color: {
        r: this.config.color.r,
        g: this.config.color.g,
        b: this.config.color.b,
        a: Math.round(this.config.color.a * opacity),
      },
      rotation: stampRotation,
      roundness,
      hardness,
      scatterOffset,
    };
  }

  previewBrush(_size: number): ImageData | null {
    return null;
  }
}
