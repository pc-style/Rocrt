import type { Canvas, Layer, Point2D } from '../core/types';
import { BlendMode } from '../core/types';
import { CANVAS_DEFAULTS } from '../core/config';

export function createCanvas(width?: number, height?: number): Canvas {
  const id = generateId();
  const now = Date.now();
  
  const defaultLayer = createLayer('Background');
  
  return {
    id,
    width: width ?? CANVAS_DEFAULTS.width,
    height: height ?? CANVAS_DEFAULTS.height,
    zoomLevel: CANVAS_DEFAULTS.zoomLevel,
    panOffset: { x: 0, y: 0 },
    rotationAngle: 0,
    layers: [defaultLayer],
    activeLayerId: defaultLayer.id,
    createdAt: now,
    modifiedAt: now,
  };
}

export function createLayer(name?: string): Layer {
  return {
    id: generateId(),
    name: name ?? `Layer ${Date.now() % 1000}`,
    visible: true,
    opacity: 1.0,
    blendMode: BlendMode.Normal,
    zIndex: 0,
    tileData: new Map(),
    createdAt: Date.now(),
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class CanvasState {
  private canvas: Canvas;

  constructor(width?: number, height?: number) {
    this.canvas = createCanvas(width, height);
  }

  getCanvas(): Canvas {
    return this.canvas;
  }

  getActiveLayer(): Layer | null {
    return this.canvas.layers.find((l) => l.id === this.canvas.activeLayerId) ?? null;
  }

  setActiveLayer(layerId: string): void {
    if (this.canvas.layers.some((l) => l.id === layerId)) {
      this.canvas.activeLayerId = layerId;
    }
  }

  addLayer(name?: string): Layer {
    const layer = createLayer(name);
    layer.zIndex = this.canvas.layers.length;
    this.canvas.layers.push(layer);
    this.canvas.activeLayerId = layer.id;
    this.canvas.modifiedAt = Date.now();
    return layer;
  }

  removeLayer(layerId: string): boolean {
    if (this.canvas.layers.length <= 1) return false;
    
    const index = this.canvas.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return false;
    
    this.canvas.layers.splice(index, 1);
    
    if (this.canvas.activeLayerId === layerId) {
      this.canvas.activeLayerId = this.canvas.layers[Math.max(0, index - 1)]!.id;
    }
    
    this.canvas.modifiedAt = Date.now();
    return true;
  }

  setZoom(level: number): void {
    this.canvas.zoomLevel = Math.max(0.125, Math.min(64, level));
    this.canvas.modifiedAt = Date.now();
  }

  setPan(offset: Point2D): void {
    this.canvas.panOffset = offset;
    this.canvas.modifiedAt = Date.now();
  }

  setRotation(angle: number): void {
    this.canvas.rotationAngle = angle % 360;
    this.canvas.modifiedAt = Date.now();
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.visible = visible;
      this.canvas.modifiedAt = Date.now();
    }
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
      this.canvas.modifiedAt = Date.now();
    }
  }

  setLayerBlendMode(layerId: string, blendMode: BlendMode): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.blendMode = blendMode;
      this.canvas.modifiedAt = Date.now();
    }
  }
}
