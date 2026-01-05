import { PERFORMANCE_BUDGETS, DEBUG_CONFIG } from './config';

export interface PerformanceStats {
  fps: number;
  lastFrameTimeMs: number;
  averageFrameTimeMs: number;
  droppedFrames: number;
  totalFrames: number;
}

export class PerformanceMonitor {
  private frameStartTime: number = 0;
  private frameTimes: number[] = [];
  private maxSamples: number = 60;
  private droppedFrames: number = 0;
  private totalFrames: number = 0;
  private lastFps: number = 0;
  private fpsUpdateInterval: number = 500;
  private lastFpsUpdate: number = 0;

  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;
    this.totalFrames++;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    if (frameTime > PERFORMANCE_BUDGETS.frameTimeMs) {
      this.droppedFrames++;
      if (DEBUG_CONFIG.showFPS) {
        console.warn(`⚠️ Frame budget exceeded: ${frameTime.toFixed(2)}ms`);
      }
    }

    const now = performance.now();
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.lastFps = this.calculateFps();
      this.lastFpsUpdate = now;
    }
  }

  private calculateFps(): number {
    if (this.frameTimes.length === 0) return 0;
    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }

  getStats(): PerformanceStats {
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    return {
      fps: this.lastFps,
      lastFrameTimeMs: this.frameTimes[this.frameTimes.length - 1] ?? 0,
      averageFrameTimeMs: avgFrameTime,
      droppedFrames: this.droppedFrames,
      totalFrames: this.totalFrames,
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.droppedFrames = 0;
    this.totalFrames = 0;
    this.lastFps = 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();
