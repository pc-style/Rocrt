import type { IAlchemyBrush } from '../core/contracts';
import type { InputPoint, BrushConfig, StampPlot, Point2D } from '../core/types';
import { BlendMode } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';

/**
 * Seeded pseudo-random number generator for reproducible brush effects.
 * Uses a linear congruential generator algorithm.
 */
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

/**
 * Brush engine that generates stamp plots from input points.
 * Supports advanced features like scatter, rotation jitter, and pressure curves.
 */
export class BrushEngine implements IAlchemyBrush {
  private config: BrushConfig;
  private lastPlottedX: number = 0;
  private lastPlottedY: number = 0;
  private hasLastPoint: boolean = false;
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

  /**
   * Updates brush configuration with partial config.
   * Values are clamped to valid ranges.
   */
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

  /** Returns a copy of the current brush configuration. */
  getBrush(): BrushConfig {
    return { ...this.config };
  }

  /** Resets stroke state for a new stroke. */
  resetStroke(): void {
    this.hasLastPoint = false;
    this.random = new SeededRandom(Date.now());
  }

  /**
   * Generates stamp plots along input points based on brush settings.
   * @param points - Array of input points with coordinates and pressure
   * @returns Array of stamp plots to render
   */
  /**
   * Generates stamp plots along input points based on brush settings.
   * @param points - Array of input points with coordinates and pressure
   * @returns Array of stamp plots to render
   */
  plotStroke(points: InputPoint[]): StampPlot[] {
    if (points.length === 0) return [];

    const stamps: StampPlot[] = [];
    // Minimum spacing to prevent infinite loops, max spacing for performance
    const spacing = Math.max(1, this.config.baseSize * Math.max(0.05, this.config.spacing));

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

      // Only plot if we've moved enough
      if (segmentDist < 0.5) continue;

      // Calculate stroke direction angle
      const strokeAngle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Calculate number of steps based on spacing
      // Using floor ensures we don't overshoot, but we need to track accumulation
      // For simplicity in this engine, we'll step by spacing distance
      const steps = Math.floor(segmentDist / spacing);

      if (steps > 0) {
        for (let s = 1; s <= steps; s++) {
          // Using distT for interpolation
          const distT = (s * spacing) / segmentDist;

          const x = this.lastPlottedX + dx * distT;
          const y = this.lastPlottedY + dy * distT;

          // Interpolate pressure
          const prevPressure = i > 0 ? points[i - 1]!.pressure : point.pressure;
          const pressure = prevPressure + (point.pressure - prevPressure) * distT;

          this.addStampsAtPosition(stamps, x, y, pressure, strokeAngle);
        }

        // Advance last plotted position to the last stamp location
        // This keeps spacing consistent across points
        const lastStepT = (steps * spacing) / segmentDist;
        this.lastPlottedX = this.lastPlottedX + dx * lastStepT;
        this.lastPlottedY = this.lastPlottedY + dy * lastStepT;
      }
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
      let scatterX = 0;
      let scatterY = 0;

      if (scatter > 0) {
        const scatterDistance = scatter * this.config.baseSize * 2 * this.random.next();
        let scatterAngle: number;

        if (scatterBoth) {
          scatterAngle = this.random.nextRange(0, 360) * (Math.PI / 180);
        } else {
          // Perpendicular to stroke (strokeAngle is in degrees)
          // Add 90 degrees (+/- 180 random)
          const side = this.random.next() > 0.5 ? 90 : -90;
          scatterAngle = (strokeAngle + side) * (Math.PI / 180);
        }

        scatterX = Math.cos(scatterAngle) * scatterDistance;
        scatterY = Math.sin(scatterAngle) * scatterDistance;
      }

      const stamp = this.createStamp(
        x + scatterX,
        y + scatterY,
        pressure,
        strokeAngle,
        { x: scatterX, y: scatterY }
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
    const jitterMult = sizeJitter > 0 ? 1 - sizeJitter * this.random.next() : 1;
    const pressureSize = this.config.pressureSizeCurve(pressure);
    const baseSize = this.config.baseSize * pressureSize;
    const size = Math.max(1, baseSize * jitterMult);

    // Apply flow to opacity (pressure * flow)
    const pressureOpacity = this.config.pressureOpacityCurve(pressure);
    // Flow acts as a multiplier on top of pressure opacity, and also accumulation density
    // For simple stamp engine, multiplying opacity is a good approximation
    const opacity = Math.max(0, Math.min(1, pressureOpacity * flow));

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
      color: { ...this.config.color }, // Color is handled at render time usually, but storing here
      rotation: stampRotation,
      roundness: roundness ?? 1,
      hardness: hardness ?? 1,
      scatterOffset,
    };
  }

  previewBrush(_size: number): ImageData | null {
    return null;
  }
}
