import { ValkyrieRenderer } from './valkyrie';
import { InputSampler, StrokeBuilder } from './sensory';
import { BrushEngine, Rasterizer } from './alchemy';
import { HistoryStack, CanvasState } from './chronos';
import { mountUI } from './luma/canvas-overlay';
import { CANVAS_DEFAULTS } from './core/config';
import { performanceMonitor } from './core/performance-monitor';
import type { InputPoint } from './core/types';

class OpenCanvasApp {
  private renderer: ValkyrieRenderer;
  private inputSampler: InputSampler;
  private brushEngine: BrushEngine;
  private history: HistoryStack;
  private canvasState: CanvasState;
  private strokeBuilder: StrokeBuilder;
  private rasterizer: Rasterizer;

  constructor() {
    this.renderer = new ValkyrieRenderer();
    this.inputSampler = new InputSampler();
    this.brushEngine = new BrushEngine();
    this.history = new HistoryStack();
    this.canvasState = new CanvasState();
    this.strokeBuilder = new StrokeBuilder();
    this.rasterizer = new Rasterizer();
  }

  async init(): Promise<void> {
    try {
      this.renderer.initCanvas(CANVAS_DEFAULTS.width, CANVAS_DEFAULTS.height);
      this.rasterizer.init(this.renderer.getTileManager());
      this.inputSampler.startSampling();
      this.setupEventHandlers();
      this.mountUI();
      this.renderer.startRenderLoop();
      console.log('OpenCanvas initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenCanvas:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    const activeLayer = this.canvasState.getActiveLayer();
    const activeLayerId = activeLayer?.id ?? '';

    this.inputSampler.onStrokeBegin((point: InputPoint) => {
      performanceMonitor.startFrame();
      this.strokeBuilder.begin(point, activeLayerId, this.brushEngine.getBrush());
      this.rasterizeCurrentStroke();
    });

    this.inputSampler.onStrokeMove((point: InputPoint) => {
      this.strokeBuilder.addPoint(point);
      this.rasterizeCurrentStroke();
    });

    this.inputSampler.onStrokeEnd(() => {
      const stroke = this.strokeBuilder.end();
      if (stroke) {
        this.history.recordAction({
          actionType: 'stroke',
          layerId: stroke.layerId,
          data: stroke,
          inverseData: { affectedTiles: stroke.affectedTiles },
        });
      }
      performanceMonitor.endFrame();
    });
  }

  private rasterizeCurrentStroke(): void {
    const points = this.strokeBuilder.getPoints();
    if (points.length < 2) return;
    
    const recentPoints = points.slice(-10);
    const stamps = this.brushEngine.plotStroke(recentPoints);
    this.rasterizer.rasterizeStamps(stamps);
  }

  private mountUI(): void {
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) {
      mountUI(uiRoot);
    }
  }

  getRenderer(): ValkyrieRenderer {
    return this.renderer;
  }

  getInputSampler(): InputSampler {
    return this.inputSampler;
  }

  getBrushEngine(): BrushEngine {
    return this.brushEngine;
  }

  getHistory(): HistoryStack {
    return this.history;
  }
}

const app = new OpenCanvasApp();

document.addEventListener('DOMContentLoaded', () => {
  app.init().catch((error) => {
    console.error('OpenCanvas initialization failed:', error);
  });
});

export { app };
