import type { CanvasKit, Surface, Canvas, Path, Image as SkImage } from 'canvaskit-wasm';
import CanvasKitInit from 'canvaskit-wasm';
import type { Color, InputPoint, Stroke, Point2D } from '../core/types';
import { CANVAS_DEFAULTS, GRID_DEFAULTS } from '../core/config';

interface StrokeData {
  path: Path;
  color: Color;
  width: number;
  layerId: string;
  strokeId: string;
  timestamp: number;
}

interface FillData {
  image: SkImage;
  layerId: string;
  fillId: string;
  timestamp: number;
  width: number;
  height: number;
}

export class SkiaRenderer {
  private ck: CanvasKit | null = null;
  private surface: Surface | null = null;
  private canvas: Canvas | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;

  private layerVisibility: Map<string, boolean> = new Map();
  private layerOpacity: Map<string, number> = new Map();
  private layerOrder: string[] = [];
  
  // Store completed strokes with their paint settings
  private completedStrokes: StrokeData[] = [];
  private completedFills: FillData[] = [];
  
  // Current stroke state
  private currentPath: Path | null = null;
  private currentColor: Color = { r: 255, g: 255, b: 255, a: 255 };
  private currentWidth: number = 20;
  private currentLayerId: string = '';
  private currentStrokePoints: InputPoint[] = [];
  private currentBackground: Color = { ...CANVAS_DEFAULTS.backgroundColor };
  private gridVisible: boolean = GRID_DEFAULTS.visible;
  private gridSpacing: number = GRID_DEFAULTS.spacing;
  private gridColor: Color = { ...GRID_DEFAULTS.color };
  private viewZoom: number = 1;
  private viewPan: Point2D = { x: 0, y: 0 };
  private viewRotation: number = 0;

  async init(canvasId: string): Promise<void> {
    this.ck = await CanvasKitInit({
      locateFile: (file: string) => `https://unpkg.com/canvaskit-wasm@0.40.0/bin/${file}`,
    });

    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvasElement) {
      throw new Error(`Canvas element '${canvasId}' not found`);
    }

    this.resizeCanvasToDisplaySize();

    this.surface = this.ck.MakeCanvasSurface(this.canvasElement);
    if (!this.surface) {
      throw new Error('Failed to create CanvasKit surface');
    }

    this.canvas = this.surface.getCanvas();
    this.isInitialized = true;
    this.render();
  }

  registerLayer(layerId: string, visible: boolean = true, opacity: number = 1): void {
    this.layerVisibility.set(layerId, visible);
    this.layerOpacity.set(layerId, Math.max(0, Math.min(1, opacity)));
    if (!this.layerOrder.includes(layerId)) {
      this.layerOrder.push(layerId);
    }
  }

  resizeToDisplaySize(): void {
    if (!this.ck || !this.canvasElement) return;
    const didResize = this.resizeCanvasToDisplaySize();
    if (!didResize) return;

    if (this.surface) {
      this.surface.delete();
      this.surface = null;
    }

    this.surface = this.ck.MakeCanvasSurface(this.canvasElement);
    if (!this.surface) {
      console.error('Failed to recreate CanvasKit surface after resize');
      return;
    }

    this.canvas = this.surface.getCanvas();
    this.render();
  }

  exportPng(filename?: string): void {
    if (!this.surface || !this.canvasElement) return;
    const snapshot = this.surface.makeImageSnapshot();
    const bytes = snapshot.encodeToBytes();
    snapshot.delete();
    if (!bytes) {
      console.error('Failed to encode canvas snapshot');
      return;
    }

    const safeBytes = new Uint8Array(bytes);
    const blob = new Blob([safeBytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = filename?.trim() || `opencanvas-${Date.now()}.png`;
    link.href = url;
    link.download = safeName;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportPngWithBackground(filename?: string): void {
    if (!this.ck) return;
    this.exportWithBackground(this.ck.ImageFormat.PNG, filename ?? `opencanvas-${Date.now()}-bg.png`);
  }

  exportJpegWithBackground(filename?: string, quality: number = 92): void {
    if (!this.ck) return;
    const safeQuality = Math.max(0, Math.min(100, quality));
    this.exportWithBackground(this.ck.ImageFormat.JPEG, filename ?? `opencanvas-${Date.now()}.jpg`, safeQuality);
  }

  private exportWithBackground(format: any, filename: string, quality?: number): void {
    if (!this.surface || !this.canvasElement || !this.ck) return;
    const snapshot = this.surface.makeImageSnapshot();
    const info = snapshot.getImageInfo();
    const width = info.width ?? this.canvasElement.width;
    const height = info.height ?? this.canvasElement.height;
    const colorType = info.colorType ?? this.ck.ColorType.RGBA_8888;
    const alphaType = info.alphaType ?? this.ck.AlphaType.Premul;
    const imageInfo = {
      width,
      height,
      colorType,
      alphaType,
      colorSpace: this.ck.ColorSpace.SRGB,
    };
    const bytesPerRow = width * 4;
    const pixels = snapshot.readPixels(0, 0, imageInfo, undefined, bytesPerRow);
    snapshot.delete();
    if (!pixels) {
      console.error('Failed to read pixels for export');
      return;
    }

    const bg = this.currentBackground;
    const bgR = bg.r / 255;
    const bgG = bg.g / 255;
    const bgB = bg.b / 255;
    const out = new Uint8Array(width * height * 4);
    for (let i = 0; i < out.length; i += 4) {
      const r = (pixels[i] ?? 0) / 255;
      const g = (pixels[i + 1] ?? 0) / 255;
      const b = (pixels[i + 2] ?? 0) / 255;
      const a = (pixels[i + 3] ?? 0) / 255;
      const invA = 1 - a;
      out[i] = Math.round((r * a + bgR * invA) * 255);
      out[i + 1] = Math.round((g * a + bgG * invA) * 255);
      out[i + 2] = Math.round((b * a + bgB * invA) * 255);
      out[i + 3] = 255;
    }

    const image = this.ck.MakeImage(imageInfo, out, bytesPerRow);
    if (!image) {
      console.error('Failed to create export image');
      return;
    }

    const encoded = image.encodeToBytes(format, quality);
    image.delete();
    if (!encoded) {
      console.error('Failed to encode background export');
      return;
    }
    const safeBytes = new Uint8Array(encoded);
    const blobType = format === this.ck.ImageFormat.JPEG ? 'image/jpeg' : 'image/png';
    const blob = new Blob([safeBytes], { type: blobType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private resizeCanvasToDisplaySize(): boolean {
    if (!this.canvasElement) return false;
    const rect = this.canvasElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvasElement.width === width && this.canvasElement.height === height) {
      return false;
    }
    this.canvasElement.width = width;
    this.canvasElement.height = height;
    return true;
  }

  private ensureLayerState(layerId: string): void {
    if (!this.layerVisibility.has(layerId)) {
      this.layerVisibility.set(layerId, true);
    }
    if (!this.layerOpacity.has(layerId)) {
      this.layerOpacity.set(layerId, 1);
    }
  }

  private isLayerVisible(layerId: string): boolean {
    return this.layerVisibility.get(layerId) !== false;
  }

  private getLayerOpacity(layerId: string): number {
    return this.layerOpacity.get(layerId) ?? 1;
  }

  setColor(color: Color): void {
    this.currentColor = { ...color };
  }

  setBackgroundColor(color: Color): void {
    this.currentBackground = { ...color };
    this.render();
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.render();
  }

  setGridSpacing(spacing: number): void {
    this.gridSpacing = Math.max(8, Math.min(512, spacing));
    this.render();
  }

  setGridColor(color: Color): void {
    this.gridColor = { ...color };
    this.render();
  }

  setStrokeWidth(width: number): void {
    this.currentWidth = Math.max(0.1, width);
  }

  setLayerId(layerId: string): void {
    this.ensureLayerState(layerId);
    this.currentLayerId = layerId;
  }

  setViewTransform(zoom: number, pan: Point2D, rotation: number): void {
    this.viewZoom = Math.max(0.125, Math.min(64, zoom));
    this.viewPan = { ...pan };
    this.viewRotation = rotation;
    this.render();
  }

  beginStroke(point: InputPoint, layerId: string): void {
    if (!this.ck) return;
    
    this.ensureLayerState(layerId);
    this.currentPath = new this.ck.Path();
    this.currentPath.moveTo(point.x, point.y);
    this.currentLayerId = layerId;
    this.currentStrokePoints = [point];
  }

  continueStroke(point: InputPoint): void {
    if (!this.currentPath) return;
    const previous = this.currentStrokePoints[this.currentStrokePoints.length - 1];
    if (previous) {
      if (this.currentStrokePoints.length < 2) {
        this.currentPath.lineTo(point.x, point.y);
      } else {
        const midX = (previous.x + point.x) / 2;
        const midY = (previous.y + point.y) / 2;
        this.currentPath.quadTo(previous.x, previous.y, midX, midY);
      }
    } else {
      this.currentPath.lineTo(point.x, point.y);
    }
    this.currentStrokePoints.push(point);
    this.render();
  }

  endStroke(): Stroke | null {
    if (!this.currentPath) return null;

    if (this.currentStrokePoints.length >= 2) {
      const lastPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1]!;
      this.currentPath.lineTo(lastPoint.x, lastPoint.y);
    }
    
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Store the stroke with its current paint settings
    this.completedStrokes.push({
      path: this.currentPath,
      color: { ...this.currentColor },
      width: this.currentWidth,
      layerId: this.currentLayerId,
      strokeId,
      timestamp: Date.now(),
    });
    
    const stroke: Stroke = {
      id: strokeId,
      layerId: this.currentLayerId,
      points: [...this.currentStrokePoints],
      brushConfig: {
        baseSize: this.currentWidth,
        color: { ...this.currentColor },
        pressureSizeCurve: (p) => 0.3 + p * 0.7,
        pressureOpacityCurve: (p) => 0.5 + p * 0.5,
        blendMode: 'normal' as any,
        spacing: 0.05,
      },
      affectedTiles: [],
      timestamp: Date.now(),
      duration: this.currentStrokePoints.length > 1
        ? this.currentStrokePoints[this.currentStrokePoints.length - 1]!.timestamp
          - this.currentStrokePoints[0]!.timestamp
        : 0,
    };
    
    this.currentPath = null;
    this.currentStrokePoints = [];
    this.render();
    
    return stroke;
  }

  private createPaint(color: Color, width: number, opacity: number) {
    if (!this.ck) return null;

    const paint = new this.ck.Paint();
    paint.setStyle(this.ck.PaintStyle.Stroke);
    paint.setAntiAlias(true);
    paint.setStrokeCap(this.ck.StrokeCap.Round);
    paint.setStrokeJoin(this.ck.StrokeJoin.Round);
    paint.setStrokeWidth(Math.max(0.1, width));
    const alpha = Math.max(0, Math.min(1, opacity)) * (color.a / 255);
    paint.setColor(
      this.ck.Color4f(color.r / 255, color.g / 255, color.b / 255, alpha)
    );
    return paint;
  }

  private render(): void {
    if (!this.ck || !this.canvas || !this.surface) return;

    // Clear with dark background
    const bg = this.currentBackground;
    this.canvas.clear(this.ck.Color4f(bg.r / 255, bg.g / 255, bg.b / 255, bg.a / 255));

    const canvasWidth = this.canvasElement?.width ?? 0;
    const canvasHeight = this.canvasElement?.height ?? 0;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    this.canvas.save();
    this.canvas.translate(centerX + this.viewPan.x, centerY + this.viewPan.y);
    this.canvas.rotate(this.viewRotation, 0, 0);
    this.canvas.scale(this.viewZoom, this.viewZoom);
    this.canvas.translate(-centerX, -centerY);

    if (this.gridVisible) {
      const gridPaint = this.createPaint(this.gridColor, Math.max(1 / this.viewZoom, 0.5), 1);
      if (gridPaint) {
        const path = new this.ck.Path();
        const spacing = Math.max(8, this.gridSpacing);
        for (let x = 0; x <= canvasWidth; x += spacing) {
          path.moveTo(x, 0);
          path.lineTo(x, canvasHeight);
        }
        for (let y = 0; y <= canvasHeight; y += spacing) {
          path.moveTo(0, y);
          path.lineTo(canvasWidth, y);
        }
        this.canvas.drawPath(path, gridPaint);
        path.delete();
        gridPaint.delete();
      }
    }

    // Draw completed strokes and fills in layer order
    const strokeLayers = Array.from(new Set(this.completedStrokes.map((stroke) => stroke.layerId)));
    const fillLayers = Array.from(new Set(this.completedFills.map((fill) => fill.layerId)));
    const allLayers = Array.from(new Set([...strokeLayers, ...fillLayers]));
    const orderedLayers = this.layerOrder.length > 0
      ? [...this.layerOrder, ...allLayers.filter((id) => !this.layerOrder.includes(id))]
      : allLayers;
    for (const layerId of orderedLayers) {
      if (!this.isLayerVisible(layerId)) continue;
      const opacity = this.getLayerOpacity(layerId);
      const items: Array<{ kind: 'stroke' | 'fill'; timestamp: number; stroke?: StrokeData; fill?: FillData }> = [];
      for (const stroke of this.completedStrokes) {
        if (stroke.layerId !== layerId) continue;
        items.push({ kind: 'stroke', timestamp: stroke.timestamp, stroke });
      }
      for (const fill of this.completedFills) {
        if (fill.layerId !== layerId) continue;
        items.push({ kind: 'fill', timestamp: fill.timestamp, fill });
      }
      items.sort((a, b) => a.timestamp - b.timestamp);
      for (const item of items) {
        if (item.kind === 'stroke' && item.stroke) {
          const paint = this.createPaint(item.stroke.color, item.stroke.width, opacity);
          if (paint) {
            this.canvas.drawPath(item.stroke.path, paint);
            paint.delete();
          }
        } else if (item.kind === 'fill' && item.fill) {
          const paint = new this.ck.Paint();
          paint.setAlphaf(Math.max(0, Math.min(1, opacity)));
          this.canvas.drawImageRect(
            item.fill.image,
            this.ck.XYWHRect(0, 0, item.fill.width, item.fill.height),
            this.ck.XYWHRect(0, 0, item.fill.width, item.fill.height),
            paint
          );
          paint.delete();
        }
      }
    }

    // Draw current stroke in progress with current settings
    if (this.currentPath && this.isLayerVisible(this.currentLayerId)) {
      const opacity = this.getLayerOpacity(this.currentLayerId);
      const paint = this.createPaint(this.currentColor, this.currentWidth, opacity);
      if (paint) {
        this.canvas.drawPath(this.currentPath, paint);
        paint.delete();
      }
    }

    this.canvas.restore();
    this.surface.flush();
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.ensureLayerState(layerId);
    this.layerVisibility.set(layerId, visible);
    this.render();
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.ensureLayerState(layerId);
    this.layerOpacity.set(layerId, Math.max(0, Math.min(1, opacity)));
    this.render();
  }

  removeLayer(layerId: string): void {
    this.layerVisibility.delete(layerId);
    this.layerOpacity.delete(layerId);
    this.layerOrder = this.layerOrder.filter((id) => id !== layerId);
    this.completedStrokes = this.completedStrokes.filter((stroke) => {
      if (stroke.layerId === layerId) {
        stroke.path.delete();
        return false;
      }
      return true;
    });
    this.completedFills = this.completedFills.filter((fill) => {
      if (fill.layerId === layerId) {
        fill.image.delete();
        return false;
      }
      return true;
    });
    this.render();
  }

  resetLayerState(): void {
    this.layerVisibility.clear();
    this.layerOpacity.clear();
    this.layerOrder = [];
    this.render();
  }

  undoStroke(strokeId: string): void {
    const index = this.completedStrokes.findIndex(s => s.strokeId === strokeId);
    if (index !== -1) {
      this.completedStrokes[index]!.path.delete();
      this.completedStrokes.splice(index, 1);
      this.render();
    }
  }

  addFillFromPixels(fillId: string, layerId: string, width: number, height: number, pixels: Uint8Array, timestamp: number): boolean {
    if (!this.ck) return false;
    this.ensureLayerState(layerId);
    const info = {
      width,
      height,
      colorType: this.ck.ColorType.RGBA_8888,
      alphaType: this.ck.AlphaType.Premul,
      colorSpace: this.ck.ColorSpace.SRGB,
    };
    const image = this.ck.MakeImage(info, pixels, width * 4);
    if (!image) return false;

    this.completedFills.push({
      image,
      layerId,
      fillId,
      timestamp,
      width,
      height,
    });
    this.render();
    return true;
  }

  removeFill(fillId: string): void {
    const index = this.completedFills.findIndex((fill) => fill.fillId === fillId);
    if (index === -1) return;
    this.completedFills[index]!.image.delete();
    this.completedFills.splice(index, 1);
    this.render();
  }

  updateFillLayer(fillId: string, layerId: string): void {
    const entry = this.completedFills.find((fill) => fill.fillId === fillId);
    if (!entry) return;
    this.ensureLayerState(layerId);
    entry.layerId = layerId;
    this.render();
  }

  getLayerPixels(layerId: string, width: number, height: number): Uint8Array | null {
    if (!this.ck) return null;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const surface = this.ck.MakeCanvasSurface(tempCanvas);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.clear(this.ck.Color4f(0, 0, 0, 0));

    const opacity = this.getLayerOpacity(layerId);
    const items: Array<{ kind: 'stroke' | 'fill'; timestamp: number; stroke?: StrokeData; fill?: FillData }> = [];
    for (const stroke of this.completedStrokes) {
      if (stroke.layerId !== layerId) continue;
      items.push({ kind: 'stroke', timestamp: stroke.timestamp, stroke });
    }
    for (const fill of this.completedFills) {
      if (fill.layerId !== layerId) continue;
      items.push({ kind: 'fill', timestamp: fill.timestamp, fill });
    }
    items.sort((a, b) => a.timestamp - b.timestamp);
    for (const item of items) {
      if (item.kind === 'stroke' && item.stroke) {
        const paint = this.createPaint(item.stroke.color, item.stroke.width, opacity);
        if (paint) {
          canvas.drawPath(item.stroke.path, paint);
          paint.delete();
        }
      } else if (item.kind === 'fill' && item.fill) {
        const paint = new this.ck.Paint();
        paint.setAlphaf(Math.max(0, Math.min(1, opacity)));
        canvas.drawImageRect(
          item.fill.image,
          this.ck.XYWHRect(0, 0, item.fill.width, item.fill.height),
          this.ck.XYWHRect(0, 0, item.fill.width, item.fill.height),
          paint
        );
        paint.delete();
      }
    }

    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const imageInfo = {
      width,
      height,
      colorType: this.ck.ColorType.RGBA_8888,
      alphaType: this.ck.AlphaType.Premul,
      colorSpace: this.ck.ColorSpace.SRGB,
    };
    const pixels = snapshot.readPixels(0, 0, imageInfo, undefined, width * 4);
    snapshot.delete();
    surface.delete();
    if (!pixels) return null;
    return new Uint8Array(pixels);
  }

  replayStroke(stroke: Stroke): void {
    if (!this.ck || stroke.points.length === 0) return;
    this.ensureLayerState(stroke.layerId);

    const path = this.buildPath(stroke.points);
    if (!path) return;

    const color = stroke.brushConfig?.color ?? this.currentColor;
    const width = stroke.brushConfig?.baseSize ?? this.currentWidth;

    this.completedStrokes.push({
      path,
      color: { ...color },
      width,
      layerId: stroke.layerId,
      strokeId: stroke.id,
      timestamp: stroke.timestamp,
    });
    this.render();
  }

  replaceStrokePath(strokeId: string, points: InputPoint[]): void {
    if (!this.ck) return;
    const index = this.completedStrokes.findIndex((stroke) => stroke.strokeId === strokeId);
    if (index === -1) return;

    const path = this.buildPath(points);
    if (!path) return;

    this.completedStrokes[index]!.path.delete();
    this.completedStrokes[index] = {
      ...this.completedStrokes[index]!,
      path,
    };
    this.render();
  }

  updateStrokeLayer(strokeId: string, layerId: string): void {
    const entry = this.completedStrokes.find((stroke) => stroke.strokeId === strokeId);
    if (!entry) return;
    this.ensureLayerState(layerId);
    entry.layerId = layerId;
    this.render();
  }

  setLayerOrder(order: string[]): void {
    const unique = order.filter((id, index) => order.indexOf(id) === index);
    this.layerOrder = unique;
    this.render();
  }

  private buildPath(points: InputPoint[]): Path | null {
    if (!this.ck || points.length === 0) return null;
    const path = new this.ck.Path();
    path.moveTo(points[0]!.x, points[0]!.y);
    if (points.length === 1) return path;

    for (let i = 1; i < points.length; i++) {
      const point = points[i]!;
      if (i === 1) {
        path.lineTo(point.x, point.y);
        continue;
      }
      const prev = points[i - 1]!;
      const midX = (prev.x + point.x) / 2;
      const midY = (prev.y + point.y) / 2;
      path.quadTo(prev.x, prev.y, midX, midY);
    }

    const last = points[points.length - 1]!;
    path.lineTo(last.x, last.y);
    return path;
  }

  clear(): void {
    // Delete old paths to free WASM memory
    for (const stroke of this.completedStrokes) {
      stroke.path.delete();
    }
    this.completedStrokes = [];

    for (const fill of this.completedFills) {
      fill.image.delete();
    }
    this.completedFills = [];
    
    if (this.currentPath) {
      this.currentPath.delete();
      this.currentPath = null;
    }
    this.currentStrokePoints = [];
    
    this.render();
  }

  pickColorAt(screenX: number, screenY: number): Color | null {
    if (!this.surface || !this.canvasElement || !this.ck) return null;
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    if (x < 0 || y < 0 || x >= this.canvasElement.width || y >= this.canvasElement.height) {
      return null;
    }

    const snapshot = this.surface.makeImageSnapshot();
    const imageInfo = {
      width: 1,
      height: 1,
      colorType: this.ck.ColorType.RGBA_8888,
      alphaType: this.ck.AlphaType.Premul,
      colorSpace: this.ck.ColorSpace.SRGB,
    };
    const pixels = snapshot.readPixels(x, y, imageInfo, undefined, 4);
    snapshot.delete();
    if (!pixels || pixels.length < 4) return null;

    let r = pixels[0] ?? 0;
    let g = pixels[1] ?? 0;
    let b = pixels[2] ?? 0;
    const a = pixels[3] ?? 255;

    if (a > 0 && a < 255) {
      const scale = 255 / a;
      r = Math.min(255, Math.round(r * scale));
      g = Math.min(255, Math.round(g * scale));
      b = Math.min(255, Math.round(b * scale));
    }

    return { r, g, b, a };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    this.clear();
    
    if (this.surface) {
      this.surface.delete();
      this.surface = null;
    }

    this.layerVisibility.clear();
    this.layerOpacity.clear();
    this.layerOrder = [];
    this.ck = null;
    this.isInitialized = false;
  }
}
