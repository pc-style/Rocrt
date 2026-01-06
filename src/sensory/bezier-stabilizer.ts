import type { InputPoint, Point2D } from '../core/types';

// stabilizer using catmull-rom to cubic bezier conversion
// smooths hand tremors while preserving stroke intent

export interface StabilizerConfig {
  // how many points to buffer before emitting (higher = smoother, more latency)
  windowSize: number;
  // tension parameter for catmull-rom (0 = smooth, 1 = sharp corners)
  tension: number;
  // minimum distance between points to consider (filters jitter)
  minDistance: number;
  // output resolution - points per pixel of curve length
  outputResolution: number;
}

const DEFAULT_CONFIG: StabilizerConfig = {
  windowSize: 4,
  tension: 0.5,
  minDistance: 1.5,
  outputResolution: 0.5,
};

export class BezierStabilizer {
  private config: StabilizerConfig;
  private buffer: InputPoint[] = [];
  private emittedCount: number = 0;

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.buffer = [];
    this.emittedCount = 0;
  }

  // add a point and get back smoothed points ready for rendering
  addPoint(point: InputPoint): InputPoint[] {
    // filter jitter - skip points too close together
    if (this.buffer.length > 0) {
      const last = this.buffer[this.buffer.length - 1]!;
      const dist = Math.hypot(point.x - last.x, point.y - last.y);
      if (dist < this.config.minDistance) {
        return [];
      }
    }

    this.buffer.push(point);

    // need at least 4 points for catmull-rom
    if (this.buffer.length < 4) {
      // for first point, emit it directly so stroke starts immediately
      if (this.buffer.length === 1) {
        this.emittedCount = 1;
        return [point];
      }
      return [];
    }

    // generate smoothed points for the segment we can now process
    return this.processBuffer();
  }

  // call when stroke ends to flush remaining points
  finish(): InputPoint[] {
    if (this.buffer.length < 2) {
      const result = this.buffer.slice(this.emittedCount);
      this.reset();
      return result;
    }

    // process any remaining segments
    const result = this.flushRemaining();
    this.reset();
    return result;
  }

  private processBuffer(): InputPoint[] {
    const results: InputPoint[] = [];
    const buf = this.buffer;

    // process segments we haven't emitted yet
    // for catmull-rom we need p0,p1,p2,p3 to interpolate between p1 and p2
    while (buf.length >= 4 && this.emittedCount < buf.length - 2) {
      const segmentIdx = this.emittedCount;
      const p0 = buf[segmentIdx]!;
      const p1 = buf[segmentIdx + 1]!;
      const p2 = buf[segmentIdx + 2]!;
      const p3 = buf[segmentIdx + 3]!;

      const segmentPoints = this.catmullRomToBezier(p0, p1, p2, p3);
      results.push(...segmentPoints);

      this.emittedCount++;
    }

    // trim old points we no longer need (keep last 4 for continuity)
    if (buf.length > 8) {
      const trim = buf.length - 6;
      this.buffer = buf.slice(trim);
      this.emittedCount -= trim;
    }

    return results;
  }

  private flushRemaining(): InputPoint[] {
    const results: InputPoint[] = [];
    const buf = this.buffer;

    // handle last segments by extending with virtual points
    if (buf.length >= 2) {
      const remaining = buf.length - 1 - this.emittedCount;

      for (let i = 0; i < remaining; i++) {
        const segmentIdx = this.emittedCount + i;

        // get available points, mirror at boundaries
        const p0 = buf[Math.max(0, segmentIdx)]!;
        const p1 = buf[Math.min(buf.length - 1, segmentIdx + 1)]!;
        const p2 = buf[Math.min(buf.length - 1, segmentIdx + 2)]!;

        // for p3, extrapolate from p1->p2 direction
        let p3: InputPoint;
        if (segmentIdx + 3 < buf.length) {
          p3 = buf[segmentIdx + 3]!;
        } else {
          p3 = this.extrapolatePoint(p1, p2);
        }

        const segmentPoints = this.catmullRomToBezier(p0, p1, p2, p3);
        results.push(...segmentPoints);
      }
    }

    return results;
  }

  private extrapolatePoint(p1: InputPoint, p2: InputPoint): InputPoint {
    return {
      x: p2.x + (p2.x - p1.x),
      y: p2.y + (p2.y - p1.y),
      pressure: p2.pressure,
      tiltX: p2.tiltX,
      tiltY: p2.tiltY,
      timestamp: p2.timestamp + (p2.timestamp - p1.timestamp),
      pointerType: p2.pointerType,
    };
  }

  // convert catmull-rom segment to cubic bezier and sample it
  private catmullRomToBezier(
    p0: InputPoint,
    p1: InputPoint,
    p2: InputPoint,
    p3: InputPoint
  ): InputPoint[] {
    const t = this.config.tension;

    // catmull-rom to bezier control points conversion
    // bezier goes from p1 to p2, with control points c1 and c2
    const c1: Point2D = {
      x: p1.x + (p2.x - p0.x) / (6 * t),
      y: p1.y + (p2.y - p0.y) / (6 * t),
    };

    const c2: Point2D = {
      x: p2.x - (p3.x - p1.x) / (6 * t),
      y: p2.y - (p3.y - p1.y) / (6 * t),
    };

    // calculate curve length for sampling resolution
    const chordLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(chordLength * this.config.outputResolution));

    const results: InputPoint[] = [];

    for (let i = 1; i <= steps; i++) {
      const s = i / steps;

      // cubic bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tC1 + 3(1-t)t²C2 + t³P1
      const u = 1 - s;
      const u2 = u * u;
      const u3 = u2 * u;
      const s2 = s * s;
      const s3 = s2 * s;

      const x = u3 * p1.x + 3 * u2 * s * c1.x + 3 * u * s2 * c2.x + s3 * p2.x;
      const y = u3 * p1.y + 3 * u2 * s * c1.y + 3 * u * s2 * c2.y + s3 * p2.y;

      // interpolate other properties
      const pressure = p1.pressure + (p2.pressure - p1.pressure) * s;
      const tiltX = p1.tiltX + (p2.tiltX - p1.tiltX) * s;
      const tiltY = p1.tiltY + (p2.tiltY - p1.tiltY) * s;
      const timestamp = p1.timestamp + (p2.timestamp - p1.timestamp) * s;

      results.push({
        x,
        y,
        pressure,
        tiltX,
        tiltY,
        timestamp,
        pointerType: p1.pointerType,
      });
    }

    return results;
  }

  setConfig(config: Partial<StabilizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): StabilizerConfig {
    return { ...this.config };
  }
}
