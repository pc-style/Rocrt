import type { CanvasKit, Surface, Canvas, Path, Image as SkImage } from 'canvaskit-wasm';
import CanvasKitInit from 'canvaskit-wasm';
import { BlendMode } from '../core/types';
import type { Color, InputPoint, Stroke, Point2D } from '../core/types';
import { CANVAS_DEFAULTS, GRID_DEFAULTS, TILE_SIZE } from '../core/config';
import { SkiaTileManager } from './skia-tile-manager';

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
  private layerBlendModes: Map<string, BlendMode> = new Map();
  private layerTiles: Map<string, SkiaTileManager> = new Map();
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
  private eraserMode: boolean = false;

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

  registerLayer(layerId: string, visible: boolean = true, opacity: number = 1, blendMode: BlendMode = BlendMode.Normal): void {
    this.layerVisibility.set(layerId, visible);
    this.layerOpacity.set(layerId, Math.max(0, Math.min(1, opacity)));
    this.layerBlendModes.set(layerId, blendMode);
    if (!this.layerTiles.has(layerId) && this.ck) {
      this.layerTiles.set(layerId, new SkiaTileManager(this.ck));
    }
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

  captureSnapshot(width: number, height: number): string | null {
    if (!this.ck || !this.surface) return null;

    // Create a temporary surface for the thumbnail
    const surface = this.ck.MakeSurface(width, height);
    if (!surface) return null;

    const canvas = surface.getCanvas();
    const composed = this.getComposedPixels(this.canvasElement?.width || 1024, this.canvasElement?.height || 1024);
    if (!composed) {
      surface.delete();
      return null;
    }

    const info = {
      width: this.canvasElement?.width || 1024,
      height: this.canvasElement?.height || 1024,
      colorType: this.ck.ColorType.RGBA_8888,
      alphaType: this.ck.AlphaType.Premul,
      colorSpace: this.ck.ColorSpace.SRGB,
    };

    const image = this.ck.MakeImage(info, composed, info.width * 4);
    if (!image) {
      surface.delete();
      return null;
    }

    const paint = new this.ck.Paint();
    canvas.clear(this.ck.TRANSPARENT);
    canvas.drawImageRect(
      image,
      this.ck.XYWHRect(0, 0, info.width, info.height),
      this.ck.XYWHRect(0, 0, width, height),
      paint
    );
    paint.delete();

    const snapshot = surface.makeImageSnapshot();
    const bytes = snapshot.encodeToBytes(this.ck.ImageFormat.JPEG, 85);

    snapshot.delete();
    image.delete();
    surface.delete();

    if (!bytes) return null;

    // Return base64
    const binary = String.fromCharCode(...new Uint8Array(bytes));
    return `data:image/jpeg;base64,${btoa(binary)}`;
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
    if (!this.layerBlendModes.has(layerId)) {
      this.layerBlendModes.set(layerId, BlendMode.Normal);
    }
    if (!this.layerTiles.has(layerId) && this.ck) {
      this.layerTiles.set(layerId, new SkiaTileManager(this.ck));
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

  setEraserMode(active: boolean): void {
    this.eraserMode = active;
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
    const strokeData: StrokeData = {
      path: this.currentPath,
      color: { ...this.currentColor },
      width: this.currentWidth,
      layerId: this.currentLayerId,
      strokeId,
      timestamp: Date.now(),
    };

    // Store the stroke with its current paint settings
    this.completedStrokes.push(strokeData);

    // Bake high-performance tiles
    this.bakeStrokeToTiles(strokeData);

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

  private bakeStrokeToTiles(stroke: StrokeData): void {
    const tileMgr = this.layerTiles.get(stroke.layerId);
    if (!tileMgr || !this.ck) return;

    // Determine intersecting tiles (approximation based on path bounds)
    const bounds = stroke.path.getBounds();
    const margin = stroke.width / 2 + 2;
    // Skia Rect is [left, top, right, bottom]
    const minGridX = Math.floor((bounds[0]! - margin) / TILE_SIZE);
    const maxGridX = Math.floor((bounds[2]! + margin) / TILE_SIZE);
    const minGridY = Math.floor((bounds[1]! - margin) / TILE_SIZE);
    const maxGridY = Math.floor((bounds[3]! + margin) / TILE_SIZE);

    const paint = this.createPaint(stroke.color, stroke.width, 1);
    if (!paint) return;

    for (let gx = minGridX; gx <= maxGridX; gx++) {
      for (let gy = minGridY; gy <= maxGridY; gy++) {
        tileMgr.bakeIntoTile(gx, gy, (canvas) => {
          canvas.drawPath(stroke.path, paint);
        });
      }
    }
    paint.delete();
  }

  private reBakeLayer(layerId: string): void {
    const tileMgr = this.layerTiles.get(layerId);
    if (!tileMgr) return;

    tileMgr.clear();
    const strokes = this.completedStrokes.filter(s => s.layerId === layerId);
    const fills = this.completedFills.filter(f => f.layerId === layerId);

    // Re-bake all items in chronological order
    const items = [
      ...strokes.map(s => ({ type: 'stroke' as const, data: s, timestamp: s.timestamp })),
      ...fills.map(f => ({ type: 'fill' as const, data: f, timestamp: f.timestamp }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    for (const item of items) {
      if (item.type === 'stroke') {
        this.bakeStrokeToTiles(item.data as StrokeData);
      } else {
        // For fills, we can optimize by making it a special drawing command
        const fill = item.data as FillData;
        const gxStart = 0;
        const gyStart = 0;
        const gxEnd = Math.floor(fill.width / TILE_SIZE);
        const gyEnd = Math.floor(fill.height / TILE_SIZE);
        for (let gx = gxStart; gx <= gxEnd; gx++) {
          for (let gy = gyStart; gy <= gyEnd; gy++) {
            tileMgr.bakeIntoTile(gx, gy, (canvas) => {
              canvas.drawImage(fill.image, 0, 0, null);
            });
          }
        }
      }
    }
  }

  private createPaint(color: Color, width: number, opacity: number) {
    if (!this.ck) return null;

    const paint = new this.ck.Paint();
    paint.setStyle(this.ck.PaintStyle.Stroke);
    paint.setAntiAlias(true);
    paint.setStrokeCap(this.ck.StrokeCap.Round);
    paint.setStrokeJoin(this.ck.StrokeJoin.Round);
    paint.setStrokeWidth(Math.max(0.1, width));

    if (this.eraserMode) {
      // Eraser: use Clear blend mode to erase pixels
      paint.setBlendMode(this.ck.BlendMode.Clear);
      paint.setColor(this.ck.Color4f(0, 0, 0, 1));
    } else {
      const alpha = Math.max(0, Math.min(1, opacity)) * (color.a / 255);
      paint.setColor(
        this.ck.Color4f(color.r / 255, color.g / 255, color.b / 255, alpha)
      );
    }
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

    // Draw layers from tiles (High Performance)
    const orderedLayers = this.layerOrder.length > 0 ? this.layerOrder : Array.from(this.layerTiles.keys());

    for (const layerId of orderedLayers) {
      if (!this.isLayerVisible(layerId)) continue;
      const opacity = this.getLayerOpacity(layerId);
      const blendMode = this.layerBlendModes.get(layerId) ?? BlendMode.Normal;
      const tileMgr = this.layerTiles.get(layerId);
      if (!tileMgr) continue;

      const layerPaint = new this.ck.Paint();
      layerPaint.setAlphaf(opacity);

      // Apply Porter-Duff blend mode
      if (this.ck) {
        let skBlendMode = this.ck.BlendMode.SrcOver;
        switch (blendMode) {
          case BlendMode.Normal: skBlendMode = this.ck.BlendMode.SrcOver; break;
          case BlendMode.Multiply: skBlendMode = this.ck.BlendMode.Multiply; break;
          case BlendMode.Screen: skBlendMode = this.ck.BlendMode.Screen; break;
          case BlendMode.Overlay: skBlendMode = this.ck.BlendMode.Overlay; break;
          case BlendMode.Darken: skBlendMode = this.ck.BlendMode.Darken; break;
          case BlendMode.Lighten: skBlendMode = this.ck.BlendMode.Lighten; break;
          case BlendMode.ColorDodge: skBlendMode = this.ck.BlendMode.ColorDodge; break;
          case BlendMode.ColorBurn: skBlendMode = this.ck.BlendMode.ColorBurn; break;
          case BlendMode.HardLight: skBlendMode = this.ck.BlendMode.HardLight; break;
          case BlendMode.SoftLight: skBlendMode = this.ck.BlendMode.SoftLight; break;
          case BlendMode.Difference: skBlendMode = this.ck.BlendMode.Difference; break;
          case BlendMode.Exclusion: skBlendMode = this.ck.BlendMode.Exclusion; break;
        }
        layerPaint.setBlendMode(skBlendMode);
      }

      // Use advanced filtering (Bicubic) when zoomed in or out significantly
      const useBicubic = this.viewZoom > 2.0 || this.viewZoom < 0.5;

      for (const tile of tileMgr.getTiles()) {
        if (!tile.image) continue;

        const x = tile.gridX * TILE_SIZE;
        const y = tile.gridY * TILE_SIZE;

        if (useBicubic) {
          // Bicubic interpolation for smoother results (Mitchell-Netravali)
          this.canvas.drawImageCubic(
            tile.image,
            x, y,
            1 / 3, 1 / 3, // B and C parameters for Mitchell-Netravali filter
            layerPaint
          );
        } else {
          // Standard linear interpolation for performance
          this.canvas.drawImageOptions(
            tile.image,
            x, y,
            this.ck.FilterMode.Linear,
            this.ck.MipmapMode.None,
            layerPaint
          );
        }
      }
      layerPaint.delete();
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

  setLayerBlendMode(layerId: string, blendMode: BlendMode): void {
    this.ensureLayerState(layerId);
    this.layerBlendModes.set(layerId, blendMode);
    this.render();
  }

  removeLayer(layerId: string): void {
    this.layerVisibility.delete(layerId);
    this.layerOpacity.delete(layerId);
    this.layerOrder = this.layerOrder.filter((id) => id !== layerId);

    const tileMgr = this.layerTiles.get(layerId);
    if (tileMgr) {
      tileMgr.dispose();
      this.layerTiles.delete(layerId);
    }

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
      const layerId = this.completedStrokes[index]!.layerId;
      this.completedStrokes[index]!.path.delete();
      this.completedStrokes.splice(index, 1);

      // Full re-bake required for undo to maintain pixel integrity
      this.reBakeLayer(layerId);
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

    const fillData: FillData = {
      image,
      layerId,
      fillId,
      timestamp,
      width,
      height,
    };
    this.completedFills.push(fillData);

    // Optimized bake: Only bake this fill into tiles without clearing everything
    const tileMgr = this.layerTiles.get(layerId);
    if (tileMgr) {
      const gxEnd = Math.floor((width - 1) / TILE_SIZE);
      const gyEnd = Math.floor((height - 1) / TILE_SIZE);

      for (let gy = 0; gy <= gyEnd; gy++) {
        for (let gx = 0; gx <= gxEnd; gx++) {
          tileMgr.bakeIntoTile(gx, gy, (tileCanvas) => {
            if (tileCanvas) {
              tileCanvas.drawImage(image, 0, 0, null);
            }
          });
        }
      }
    }

    this.render();
    return true;
  }

  removeFill(fillId: string): void {
    const index = this.completedFills.findIndex((fill) => fill.fillId === fillId);
    if (index === -1) return;
    const layerId = this.completedFills[index]!.layerId;
    this.completedFills[index]!.image.delete();
    this.completedFills.splice(index, 1);
    this.reBakeLayer(layerId);
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
    const tileMgr = this.layerTiles.get(layerId);
    if (!tileMgr) return null;

    const surface = this.ck.MakeSurface(width, height);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.clear(this.ck.Color4f(0, 0, 0, 0));

    const opacity = this.getLayerOpacity(layerId);
    const paint = new this.ck.Paint();
    paint.setAlphaf(opacity);

    // Composite from tiles
    for (const tile of tileMgr.getTiles()) {
      if (tile.image) {
        canvas.drawImage(tile.image, tile.gridX * TILE_SIZE, tile.gridY * TILE_SIZE, paint);
      }
    }
    paint.delete();

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

  getComposedPixels(width: number, height: number): Uint8Array | null {
    if (!this.ck) return null;

    const surface = this.ck.MakeSurface(width, height);
    if (!surface) return null;
    const canvas = surface.getCanvas();

    // Clear with background color
    const bg = this.currentBackground;
    canvas.clear(this.ck.Color4f(bg.r / 255, bg.g / 255, bg.b / 255, bg.a / 255));

    for (const layerId of this.layerOrder) {
      if (!this.isLayerVisible(layerId)) continue;
      const opacity = this.getLayerOpacity(layerId);
      const tileMgr = this.layerTiles.get(layerId);
      if (!tileMgr) continue;

      const paint = new this.ck.Paint();
      paint.setAlphaf(opacity);

      for (const tile of tileMgr.getTiles()) {
        if (tile.image) {
          canvas.drawImage(tile.image, tile.gridX * TILE_SIZE, tile.gridY * TILE_SIZE, paint);
        }
      }
      paint.delete();
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
    return pixels ? new Uint8Array(pixels) : null;
  }

  replayStroke(stroke: Stroke): void {
    if (!this.ck || stroke.points.length === 0) return;
    this.ensureLayerState(stroke.layerId);

    const path = this.buildPath(stroke.points);
    if (!path) return;

    const color = stroke.brushConfig?.color ?? this.currentColor;
    const width = stroke.brushConfig?.baseSize ?? this.currentWidth;

    const strokeData: StrokeData = {
      path,
      color: { ...color },
      width,
      layerId: stroke.layerId,
      strokeId: stroke.id,
      timestamp: stroke.timestamp,
    };

    this.completedStrokes.push(strokeData);
    this.bakeStrokeToTiles(strokeData);
    this.render();
  }

  replaceStrokePath(strokeId: string, points: InputPoint[]): void {
    if (!this.ck) return;
    const index = this.completedStrokes.findIndex((stroke) => stroke.strokeId === strokeId);
    if (index === -1) return;

    const path = this.buildPath(points);
    if (!path) return;

    const layerId = this.completedStrokes[index]!.layerId;
    this.completedStrokes[index]!.path.delete();
    this.completedStrokes[index] = {
      ...this.completedStrokes[index]!,
      path,
    };
    this.reBakeLayer(layerId);
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

    for (const tileMgr of this.layerTiles.values()) {
      tileMgr.clear();
    }

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

    for (const tileMgr of this.layerTiles.values()) {
      tileMgr.dispose();
    }
    this.layerTiles.clear();
    this.layerVisibility.clear();
    this.layerOpacity.clear();
    this.layerOrder = [];
    this.ck = null;
    this.isInitialized = false;
  }
}
