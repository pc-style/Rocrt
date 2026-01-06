import type { Canvas, Layer, Point2D, Color } from '../core/types';
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
    backgroundColor: { ...CANVAS_DEFAULTS.backgroundColor },
    layers: [defaultLayer],
    activeLayerId: defaultLayer.id,
    referenceLayerId: null,
    createdAt: now,
    modifiedAt: now,
  };
}

export function createLayer(name?: string): Layer {
  return {
    id: generateId(),
    name: name ?? `Layer ${Date.now() % 1000}`,
    visible: true,
    locked: false,
    alphaLocked: false,
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

  getReferenceLayerId(): string | null {
    return this.canvas.referenceLayerId ?? null;
  }

  getLayer(layerId: string): Layer | null {
    return this.canvas.layers.find((l) => l.id === layerId) ?? null;
  }

  getLayers(): Layer[] {
    return this.canvas.layers;
  }

  setActiveLayer(layerId: string): void {
    if (this.canvas.layers.some((l) => l.id === layerId)) {
      this.canvas.activeLayerId = layerId;
    }
  }

  setReferenceLayer(layerId: string | null): void {
    if (!layerId) {
      this.canvas.referenceLayerId = null;
      this.canvas.modifiedAt = Date.now();
      return;
    }
    if (this.canvas.layers.some((l) => l.id === layerId)) {
      this.canvas.referenceLayerId = layerId;
      this.canvas.modifiedAt = Date.now();
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
    this.reindexLayers();

    if (this.canvas.activeLayerId === layerId) {
      this.canvas.activeLayerId = this.canvas.layers[Math.max(0, index - 1)]!.id;
    }
    if (this.canvas.referenceLayerId === layerId) {
      this.canvas.referenceLayerId = null;
    }

    this.canvas.modifiedAt = Date.now();
    return true;
  }

  restoreLayer(layer: Layer, index: number): void {
    const insertIndex = Math.max(0, Math.min(this.canvas.layers.length, index));
    this.canvas.layers.splice(insertIndex, 0, layer);
    this.reindexLayers();
    this.canvas.activeLayerId = layer.id;
    this.canvas.modifiedAt = Date.now();
  }

  moveLayerUp(layerId: string): boolean {
    const index = this.canvas.layers.findIndex((l) => l.id === layerId);
    if (index === -1 || index === this.canvas.layers.length - 1) return false;
    const [layer] = this.canvas.layers.splice(index, 1);
    this.canvas.layers.splice(index + 1, 0, layer!);
    this.reindexLayers();
    this.canvas.modifiedAt = Date.now();
    return true;
  }

  moveLayerDown(layerId: string): boolean {
    const index = this.canvas.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return false;
    const [layer] = this.canvas.layers.splice(index, 1);
    this.canvas.layers.splice(index - 1, 0, layer!);
    this.reindexLayers();
    this.canvas.modifiedAt = Date.now();
    return true;
  }

  duplicateLayer(layerId: string): Layer | null {
    const index = this.canvas.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return null;
    const source = this.canvas.layers[index]!;
    const copy = createLayer(`${source.name} copy`);
    copy.visible = source.visible;
    copy.locked = source.locked;
    copy.alphaLocked = source.alphaLocked;
    copy.opacity = source.opacity;
    copy.blendMode = source.blendMode;
    const insertIndex = Math.min(this.canvas.layers.length, index + 1);
    this.canvas.layers.splice(insertIndex, 0, copy);
    this.reindexLayers();
    this.canvas.activeLayerId = copy.id;
    this.canvas.modifiedAt = Date.now();
    return copy;
  }

  mergeLayerDown(layerId: string): string | null {
    if (this.canvas.layers.length <= 1) return null;
    const index = this.canvas.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return null;
    const targetLayerId = this.canvas.layers[index - 1]!.id;
    this.canvas.layers.splice(index, 1);
    this.reindexLayers();
    this.canvas.activeLayerId = targetLayerId;
    if (this.canvas.referenceLayerId === layerId) {
      this.canvas.referenceLayerId = targetLayerId;
    }
    this.canvas.modifiedAt = Date.now();
    return targetLayerId;
  }

  renameLayer(layerId: string, name: string): boolean {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (!layer) return false;
    layer.name = name.trim() || layer.name;
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

  setBackgroundColor(color: Color): void {
    const c = color;
    this.canvas.backgroundColor = {
      r: Math.max(0, Math.min(255, c.r)),
      g: Math.max(0, Math.min(255, c.g)),
      b: Math.max(0, Math.min(255, c.b)),
      a: Math.max(0, Math.min(255, c.a)),
    };
    this.canvas.modifiedAt = Date.now();
  }

  setCanvasSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.modifiedAt = Date.now();
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.visible = visible;
      this.canvas.modifiedAt = Date.now();
    }
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.locked = locked;
      this.canvas.modifiedAt = Date.now();
    }
  }

  setLayerAlphaLocked(layerId: string, alphaLocked: boolean): void {
    const layer = this.canvas.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.alphaLocked = alphaLocked;
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

  loadCanvas(canvas: Canvas): void {
    this.canvas = canvas;
    if (this.canvas.referenceLayerId && !this.canvas.layers.some((l) => l.id === this.canvas.referenceLayerId)) {
      this.canvas.referenceLayerId = null;
    }
    if (!this.canvas.layers.some((l) => l.id === this.canvas.activeLayerId)) {
      this.canvas.activeLayerId = this.canvas.layers[0]?.id ?? '';
    }
  }

  private reindexLayers(): void {
    this.canvas.layers.forEach((layer, idx) => {
      layer.zIndex = idx;
    });
  }
}
