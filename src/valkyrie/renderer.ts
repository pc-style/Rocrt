import type { IValkyrieRenderer } from '../core/contracts';
import type { Point2D, BlendMode, Color } from '../core/types';
import { DebugRenderer } from './debug-renderer';
import { TileManager } from './tile-manager';
import { TileRenderer } from './tile-renderer';

export class ValkyrieRenderer implements IValkyrieRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private zoomLevel: number = 1.0;
  private panOffset: Point2D = { x: 0, y: 0 };
  private rotationAngle: number = 0;
  private dirtyTiles: Set<string> = new Set();
  private debugRenderer: DebugRenderer = new DebugRenderer();
  private tileManager: TileManager = new TileManager();
  private tileRenderer: TileRenderer = new TileRenderer();

  initCanvas(_docWidth: number, _docHeight: number): void {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }

    // Use viewport size for rendering
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;

    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      this.showWebGLError();
      throw new Error('WebGL 2.0 not supported');
    }

    this.gl = gl;
    this.validateExtensions();
    this.setupViewport();
    this.debugRenderer.init(gl);
    this.tileManager.init(gl, this.canvas.width, this.canvas.height);
    this.tileRenderer.init(gl);
  }

  private validateExtensions(): void {
    if (!this.gl) return;

    const requiredExtensions = ['EXT_color_buffer_float'];
    const optionalExtensions = ['OES_texture_float_linear'];

    for (const ext of requiredExtensions) {
      if (!this.gl.getExtension(ext)) {
        console.error(`Required WebGL extension not available: ${ext}`);
        throw new Error(`Required WebGL extension not available: ${ext}`);
      }
    }

    for (const ext of optionalExtensions) {
      if (!this.gl.getExtension(ext)) {
        console.warn(`Optional WebGL extension not available: ${ext}`);
      }
    }
  }

  private setupViewport(): void {
    if (!this.gl || !this.canvas) return;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
  }

  private showWebGLError(): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="webgl-error">
          <h1>WebGL 2.0 Not Supported</h1>
          <p>Your browser does not support WebGL 2.0, which is required for OpenCanvas.</p>
          <p>Please try a modern browser like Chrome, Firefox, or Safari.</p>
        </div>
      `;
    }
  }

  setZoom(level: number): void {
    this.zoomLevel = Math.max(0.125, Math.min(64, level));
  }

  setPan(offset: Point2D): void {
    this.panOffset = offset;
  }

  setRotation(angle: number): void {
    this.rotationAngle = angle % 360;
  }

  compositeLayer(_layerId: string, _opacity: number, _blendMode: BlendMode): void {
    // TODO: Implement layer compositing in Phase 5
  }

  renderTile(_tileId: string, _pixelData: Float32Array): void {
    // TODO: Implement tile rendering in Phase 3
  }

  markTileDirty(tileId: string): void {
    this.dirtyTiles.add(tileId);
  }

  requestFrame(): void {
    if (this.isRunning) return;
    this.renderFrame();
  }

  startRenderLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderLoop();
  }

  stopRenderLoop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderLoop(): void {
    if (!this.isRunning) return;
    this.renderFrame();
    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  private renderFrame(): void {
    if (!this.gl) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    this.tileManager.uploadDirtyTiles();
    this.tileRenderer.renderTiles(
      this.tileManager,
      this.zoomLevel,
      this.panOffset.x,
      this.panOffset.y
    );
    
    this.debugRenderer.render();
    this.dirtyTiles.clear();
  }

  getTileManager(): TileManager {
    return this.tileManager;
  }

  drawDebugPoint(position: Point2D, size: number = 20, color: Color = { r: 255, g: 100, b: 100, a: 255 }): void {
    this.debugRenderer.addPoint(position, size, color);
  }

  clearDebugPoints(): void {
    this.debugRenderer.clearPoints();
  }

  getContext(): WebGL2RenderingContext | null {
    return this.gl;
  }

  getZoom(): number {
    return this.zoomLevel;
  }

  getPan(): Point2D {
    return this.panOffset;
  }

  getRotation(): number {
    return this.rotationAngle;
  }
}
