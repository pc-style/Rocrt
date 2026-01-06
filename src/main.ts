import { SkiaRenderer } from './valkyrie/skia-renderer';
import { InputSampler } from './sensory';
import { HistoryStack, IndexedDBStore } from './chronos';
import { CanvasState, createLayer } from './chronos/canvas-state';
import { ViewTransformer } from './valkyrie/view-transformer';
import { mountUI } from './luma/canvas-overlay';
import { BRUSH_DEFAULTS, CANVAS_VIEW_DEFAULTS, CANVAS_DEFAULTS, GRID_DEFAULTS, ROTATION_SNAP_DEGREES } from './core/config';
import { eventBus, Events } from './core/events';
import { BlendMode, PointerType } from './core/types';
import type { InputPoint, Color, Stroke, Point2D, GestureData, Layer, Canvas } from './core/types';

interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  alphaLocked: boolean;
  opacity: number;
  blendMode: BlendMode;
  zIndex: number;
  createdAt: number;
}

interface SerializedStroke {
  id: string;
  layerId: string;
  points: InputPoint[];
  color: Color;
  size: number;
  timestamp: number;
  duration: number;
}

interface SerializedFill {
  id: string;
  layerId: string;
  width: number;
  height: number;
  timestamp: number;
  pixels: string;
}

interface FillRecord {
  id: string;
  layerId: string;
  width: number;
  height: number;
  pixels: Uint8Array;
  timestamp: number;
}

interface SelectionState {
  basePolygon: Point2D[];
  transformedPolygon: Point2D[];
  baseCenter: Point2D;
  center: Point2D;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  selectedStrokeIds: string[];
  transform: { tx: number; ty: number; scale: number; rotation: number };
}

interface ProjectData {
  version: 1;
  exportedAt: number;
  canvas: {
    id: string;
    width: number;
    height: number;
    backgroundColor: Color;
    layers: SerializedLayer[];
    activeLayerId: string;
    referenceLayerId?: string | null;
    createdAt: number;
    modifiedAt: number;
  };
  strokes: SerializedStroke[];
  fills: SerializedFill[];
  view: {
    zoom: number;
    pan: Point2D;
    rotation: number;
  };
  grid: {
    visible: boolean;
    spacing: number;
    color: Color;
  };
  brush: {
    size: number;
    color: Color;
    stabilization: number;
  };
}

class OpenCanvasApp {
  private skiaRenderer: SkiaRenderer;
  private inputSampler: InputSampler;
  private history: HistoryStack;
  private canvasState: CanvasState;
  private viewTransformer: ViewTransformer;
  private dbStore: IndexedDBStore;
  private strokeIndex: Map<string, Stroke> = new Map();
  private layerStrokeIndex: Map<string, Set<string>> = new Map();
  private activeStrokeIds: Set<string> = new Set();
  private fillIndex: Map<string, FillRecord> = new Map();
  private layerFillIndex: Map<string, Set<string>> = new Map();
  private activeFillIds: Set<string> = new Set();
  private quickShapeHoldMs = 180;
  private quickShapeLineTolerance = 8;
  private quickShapeCircleTolerance = 0.22;
  private quickShapeRectTolerance = 8;
  private quickShapeCornerAngle = 0.55;
  private quickShapeCornerSeparation = 12;
  private currentStabilization: number = BRUSH_DEFAULTS.stabilization;
  private lastSmoothedPoint: InputPoint | null = null;
  private soloLayerId: string | null = null;
  private savedLayerVisibility: Map<string, boolean> | null = null;
  private readonly brushStorageKey = 'opencanvas:brush-settings';
  private readonly viewStorageKey = 'opencanvas:view-settings';
  private readonly readonlyStorageKey = 'opencanvas:readonly';
  private readonly backgroundStorageKey = 'opencanvas:background-color';
  private readonly gridStorageKey = 'opencanvas:grid-settings';
  private isReadOnly = false;
  private autosaveTimer: number | null = null;
  private lastAutosaveAt = 0;
  private autosaveIntervalMs = 3000;
  private isImporting = false;
  private eyedropperActive = false;
  private isSamplingColor = false;
  private panModeActive = false;
  private isPanning = false;
  private lastPanPoint: Point2D | null = null;
  private isResizingCanvas = false;
  private timelapseRecorder: MediaRecorder | null = null;
  private timelapseStream: MediaStream | null = null;
  private timelapseChunks: BlobPart[] = [];
  private timelapseRecording = false;
  private alphaLockRejecting = false;
  private colorDropActive = false;
  private colorDropThreshold = 0.15;
  private colorDropDragging = false;
  private colorDropSeed: InputPoint | null = null;
  private colorDropStartX = 0;
  private lassoActive = false;
  private lassoDrawing = false;
  private lassoPoints: Point2D[] = [];
  private selection: SelectionState | null = null;
  private selectionOriginalPoints: Map<string, InputPoint[]> = new Map();
  private selectionDragStart: Point2D | null = null;
  private selectionStartTransform: { tx: number; ty: number; scale: number; rotation: number } | null = null;
  private isTransformingSelection = false;
  private isShiftDown = false;
  private isAltDown = false;
  private currentColor: Color = { ...BRUSH_DEFAULTS.color };
  private currentBackground: Color = { ...CANVAS_DEFAULTS.backgroundColor };
  private gridVisible = GRID_DEFAULTS.visible;
  private gridSpacing = GRID_DEFAULTS.spacing;
  private gridColor: Color = { ...GRID_DEFAULTS.color };
  private gridSnap = GRID_DEFAULTS.snap;
  private rotationSnap = CANVAS_VIEW_DEFAULTS.rotationSnap ?? false;
  private currentSize: number = BRUSH_DEFAULTS.baseSize;
  private handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (event.key === 'Shift') {
      this.isShiftDown = true;
    }
    if (event.key === 'Alt') {
      this.isAltDown = true;
    }

    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) {
      if (key === ' ') {
        event.preventDefault();
        this.setPanModeActive(true);
        return;
      }
      if (key === 'h') {
        event.preventDefault();
        eventBus.emit(Events.UI_TOGGLED, null);
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        eventBus.emit(Events.EYEDROPPER_TOGGLED, null);
        return;
      }
      if (key === 'd') {
        event.preventDefault();
        eventBus.emit(Events.COLOR_DROP_TOGGLED, null);
        return;
      }
      if (key === 's') {
        event.preventDefault();
        eventBus.emit(Events.LASSO_TOGGLED, null);
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        if (event.shiftKey) {
          eventBus.emit(Events.GRID_SNAP_TOGGLED, null);
        } else {
          eventBus.emit(Events.GRID_TOGGLED, null);
        }
        return;
      }
      if (key === 'l') {
        event.preventDefault();
        eventBus.emit(Events.READONLY_TOGGLED, null);
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        eventBus.emit(Events.VIEW_FIT_REQUESTED, null);
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        eventBus.emit(Events.VIEW_ROTATION_SNAP_TOGGLED, null);
        return;
      }
      if (key === 'q') {
        event.preventDefault();
        this.rotateViewBy(-ROTATION_SNAP_DEGREES);
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        this.rotateViewBy(ROTATION_SNAP_DEGREES);
        return;
      }
      if (key === 'backspace' || key === 'delete') {
        event.preventDefault();
        this.clearActiveLayer();
      }
      if (key === 'escape') {
        event.preventDefault();
        this.clearSelection();
        if (this.lassoActive) {
          this.setLassoActive(false);
        }
        if (this.colorDropActive) {
          this.colorDropActive = false;
          this.colorDropDragging = false;
          this.colorDropSeed = null;
          eventBus.emit(Events.COLOR_DROP_DRAGGING_CHANGED, false);
          eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        }
        if (this.eyedropperActive) {
          this.setEyedropperActive(false);
        }
        if (this.panModeActive) {
          this.setPanModeActive(false);
        }
      }
      return;
    }

    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        eventBus.emit(Events.REDO_REQUESTED, null);
      } else {
        eventBus.emit(Events.UNDO_REQUESTED, null);
      }
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      eventBus.emit(Events.REDO_REQUESTED, null);
      return;
    }

    if (key === 'k') {
      event.preventDefault();
      if (!this.isReadOnly) {
        eventBus.emit(Events.CANVAS_CLEAR_REQUESTED, null);
      }
      return;
    }

    if (key === '0') {
      event.preventDefault();
      eventBus.emit(Events.VIEW_RESET_REQUESTED, null);
      return;
    }

    if (key === '=' || key === '+') {
      event.preventDefault();
      this.viewTransformer.zoomIn();
      this.syncViewTransform();
      return;
    }

    if (key === '-') {
      event.preventDefault();
      this.viewTransformer.zoomOut();
      this.syncViewTransform();
      return;
    }

  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      this.setPanModeActive(false);
      this.isPanning = false;
      this.lastPanPoint = null;
    }
    if (event.key === 'Shift') {
      this.isShiftDown = false;
    }
    if (event.key === 'Alt') {
      this.isAltDown = false;
    }
  };

  private handleBlur = () => {
    if (this.panModeActive) {
      this.setPanModeActive(false);
    }
    this.isPanning = false;
    this.lastPanPoint = null;
  };

  private handleResize = () => {
    this.skiaRenderer.resizeToDisplaySize();
    this.updateViewSize();
    this.syncViewTransform();
  };

  constructor() {
    this.skiaRenderer = new SkiaRenderer();
    this.inputSampler = new InputSampler();
    this.history = new HistoryStack();
    this.canvasState = new CanvasState();
    this.viewTransformer = new ViewTransformer();
    this.dbStore = new IndexedDBStore();
  }

  async init(): Promise<void> {
    try {
      // Initialize IndexedDB first for autosave/project storage
      await this.dbStore.init();

      await this.skiaRenderer.init('canvas');
      this.syncLayersToRenderer();
      this.updateViewSize();
      this.loadViewSettings();
      this.syncViewTransform();
      this.skiaRenderer.setColor(this.currentColor);
      this.skiaRenderer.setStrokeWidth(this.currentSize);
      this.inputSampler.startSampling();
      this.setupEventHandlers();
      this.mountUI();
      this.loadBrushSettings();
      this.loadBackgroundSettings();
      this.loadGridSettings();
      this.loadReadOnlyState();
      this.history.emitState();
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleBlur);
      window.addEventListener('resize', this.handleResize);

      // Emit initial layer state
      this.emitLayerUpdate();
      window.setTimeout(() => {
        this.emitLayerUpdate();
      }, 0);

      console.log('OpenCanvas initialized with CanvasKit (Skia)');
    } catch (error) {
      console.error('Failed to initialize OpenCanvas:', error);
      throw error;
    }
  }

  dispose(): void {
    // Clean up event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    // Clear autosave timer
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    // Stop input sampling
    this.inputSampler.stopSampling();

    // Close IndexedDB connection
    this.dbStore.close();

    // Stop renderer loop (SkiaRenderer manages its own render loop)
    // No explicit stop needed for SkiaRenderer as it uses requestAnimationFrame
  }

  private setupEventHandlers(): void {
    this.inputSampler.onStrokeBegin((point: InputPoint) => {
      if (this.panModeActive) {
        this.isPanning = true;
        this.lastPanPoint = { x: point.x, y: point.y };
        return;
      }
      if (this.lassoActive) {
        const mapped = this.viewTransformer.screenToCanvas(point.x, point.y);
        if (this.selection && this.isPointInPolygon(mapped, this.selection.transformedPolygon)) {
          this.beginSelectionTransform(mapped);
          return;
        }
        this.beginLasso(mapped);
        return;
      }
      if (this.eyedropperActive) {
        const picked = this.skiaRenderer.pickColorAt(point.x, point.y);
        if (picked) {
          this.currentColor = { ...picked };
          this.skiaRenderer.setColor(this.currentColor);
          eventBus.emit(Events.BRUSH_COLOR_CHANGED, this.currentColor);
          eventBus.emit(Events.BRUSH_OPACITY_CHANGED, this.currentColor.a / 255);
          this.saveBrushSettings();
        }
        this.isSamplingColor = true;
        this.setEyedropperActive(false);
        return;
      }
      if (this.colorDropActive) {
        const mapped = this.viewTransformer.screenToCanvas(point.x, point.y);
        this.colorDropSeed = { ...point, x: mapped.x, y: mapped.y };
        this.colorDropStartX = point.x;
        this.colorDropDragging = true;
        eventBus.emit(Events.COLOR_DROP_DRAGGING_CHANGED, true);
        eventBus.emit(Events.COLOR_DROP_THRESHOLD_CHANGED, this.colorDropThreshold);
        return;
      }
      if (this.isReadOnly) return;
      const activeLayer = this.ensureActiveLayer();
      const activeLayerId = activeLayer?.id ?? '';
      if (!activeLayerId) {
        return;
      }
      if (activeLayer?.locked) {
        return;
      }
      const mappedPoint = this.mapInputPoint(point);
      if (activeLayer?.alphaLocked) {
        if (!this.isPointInLayerMask(activeLayerId, mappedPoint)) {
          this.alphaLockRejecting = true;
          return;
        }
      }
      this.alphaLockRejecting = false;
      const smoothedPoint = this.smoothPoint(mappedPoint);
      // Apply pressure to stroke width
      const width = this.currentSize * (0.3 + smoothedPoint.pressure * 0.7);
      this.skiaRenderer.setStrokeWidth(width);
      this.skiaRenderer.setLayerId(activeLayerId);
      this.skiaRenderer.beginStroke(smoothedPoint, activeLayerId);
    });

    this.inputSampler.onStrokeMove((point: InputPoint) => {
      if (this.isPanning && this.lastPanPoint) {
        const delta = { x: point.x - this.lastPanPoint.x, y: point.y - this.lastPanPoint.y };
        this.lastPanPoint = { x: point.x, y: point.y };
        this.viewTransformer.applyPan(delta);
        this.syncViewTransform();
        return;
      }
      if (this.lassoDrawing) {
        const mapped = this.viewTransformer.screenToCanvas(point.x, point.y);
        this.extendLasso(mapped);
        return;
      }
      if (this.isTransformingSelection) {
        const mapped = this.viewTransformer.screenToCanvas(point.x, point.y);
        this.updateSelectionTransform(mapped);
        return;
      }
      if (this.isSamplingColor) return;
      if (this.colorDropDragging) {
        const dx = point.x - this.colorDropStartX;
        const next = Math.max(0.02, Math.min(1, this.colorDropThreshold + dx / 400));
        if (next !== this.colorDropThreshold) {
          this.colorDropThreshold = next;
          eventBus.emit(Events.COLOR_DROP_THRESHOLD_CHANGED, this.colorDropThreshold);
        }
        return;
      }
      if (this.isReadOnly) return;
      if (this.alphaLockRejecting) return;
      const mappedPoint = this.mapInputPoint(point);
      const activeLayer = this.canvasState.getActiveLayer();
      const activeLayerId = activeLayer?.id ?? '';
      if (activeLayer?.alphaLocked) {
        if (!this.isPointInLayerMask(activeLayerId, mappedPoint)) {
          this.alphaLockRejecting = true;
          return;
        }
      }
      const smoothedPoint = this.smoothPoint(mappedPoint);
      this.skiaRenderer.continueStroke(smoothedPoint);
    });

    this.inputSampler.onStrokeEnd(() => {
      if (this.isPanning) {
        this.isPanning = false;
        this.lastPanPoint = null;
        return;
      }
      if (this.lassoDrawing) {
        this.finishLasso();
        return;
      }
      if (this.isTransformingSelection) {
        this.finishSelectionTransform();
        return;
      }
      if (this.isSamplingColor) {
        this.isSamplingColor = false;
        return;
      }
      if (this.colorDropDragging) {
        const seed = this.colorDropSeed;
        this.colorDropDragging = false;
        eventBus.emit(Events.COLOR_DROP_DRAGGING_CHANGED, false);
        this.colorDropSeed = null;
        if (seed && !this.isReadOnly) {
          this.performColorDrop(seed, this.colorDropThreshold);
        }
        if (this.colorDropActive) {
          this.colorDropActive = false;
          eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        }
        return;
      }
      this.alphaLockRejecting = false;
      if (this.isReadOnly) return;
      const stroke = this.skiaRenderer.endStroke();
      if (stroke) {
        const snapped = this.applyQuickShape(stroke);
        if (snapped) {
          stroke.points = snapped.points;
          this.skiaRenderer.replaceStrokePath(stroke.id, snapped.points);
        }
        // Record stroke to history
        this.history.recordAction({
          actionType: 'stroke',
          layerId: stroke.layerId,
          data: stroke,
          inverseData: { strokeId: stroke.id },
        });
        this.indexStroke(stroke);
        this.activeStrokeIds.add(stroke.id);
        this.scheduleAutosave();
      }
      this.lastSmoothedPoint = null;
    });

    // Connect UI events
    eventBus.on(Events.BRUSH_SIZE_CHANGED, (size: number) => {
      this.currentSize = size;
      this.skiaRenderer.setStrokeWidth(size);
      this.saveBrushSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.BRUSH_COLOR_CHANGED, (color: Color) => {
      this.currentColor = { ...color };
      this.skiaRenderer.setColor(color);
      this.saveBrushSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.BRUSH_OPACITY_CHANGED, (opacity: number) => {
      const clamped = Math.max(0, Math.min(1, opacity));
      this.currentColor = { ...this.currentColor, a: Math.round(clamped * 255) };
      this.skiaRenderer.setColor(this.currentColor);
      this.saveBrushSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.BRUSH_STABILIZATION_CHANGED, (value: number) => {
      this.currentStabilization = Math.max(0, Math.min(1, value));
      this.saveBrushSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.BACKGROUND_COLOR_CHANGED, (color: Color) => {
      this.currentBackground = {
        r: Math.max(0, Math.min(255, color.r)),
        g: Math.max(0, Math.min(255, color.g)),
        b: Math.max(0, Math.min(255, color.b)),
        a: Math.max(0, Math.min(255, color.a)),
      };
      this.canvasState.setBackgroundColor(this.currentBackground);
      this.skiaRenderer.setBackgroundColor(this.currentBackground);
      this.saveBackgroundSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.GRID_TOGGLED, (visible?: boolean) => {
      this.gridVisible = visible ?? !this.gridVisible;
      this.skiaRenderer.setGridVisible(this.gridVisible);
      this.saveGridSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.GRID_SPACING_CHANGED, (spacing: number) => {
      this.gridSpacing = Math.max(8, Math.min(512, spacing));
      this.skiaRenderer.setGridSpacing(this.gridSpacing);
      this.saveGridSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.GRID_COLOR_CHANGED, (color: Color) => {
      this.gridColor = {
        r: Math.max(0, Math.min(255, color.r)),
        g: Math.max(0, Math.min(255, color.g)),
        b: Math.max(0, Math.min(255, color.b)),
        a: Math.max(0, Math.min(255, color.a)),
      };
      this.skiaRenderer.setGridColor(this.gridColor);
      this.saveGridSettings();
      this.scheduleAutosave();
    });

    eventBus.on(Events.GRID_SNAP_TOGGLED, (snap?: boolean) => {
      if (typeof snap === 'boolean') {
        this.gridSnap = snap;
      } else {
        this.gridSnap = !this.gridSnap;
      }
      this.saveGridSettings();
      this.scheduleAutosave();
    });

    // Undo/Redo handlers
    eventBus.on(Events.UNDO_REQUESTED, () => {
      if (this.isReadOnly) return;
      const entry = this.history.undo();
      if (entry && entry.actionType === 'stroke') {
        const strokeId = (entry.data as any)?.id;
        if (strokeId) {
          this.skiaRenderer.undoStroke(strokeId);
          this.activeStrokeIds.delete(strokeId);
        }
      }
      if (entry && entry.actionType === 'fill') {
        const fill = entry.data as FillRecord;
        if (fill?.id) {
          this.skiaRenderer.removeFill(fill.id);
          this.activeFillIds.delete(fill.id);
        }
      }
      if (entry && entry.actionType === 'layerClear') {
        const data = entry.data as { strokes?: Stroke[]; fills?: FillRecord[]; cleared?: { strokes: Stroke[]; fills?: FillRecord[] }[] };
        if (data?.cleared) {
          for (const group of data.cleared) {
            const strokes = (group.strokes ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
            for (const stroke of strokes) {
              this.skiaRenderer.replayStroke(stroke);
              this.activeStrokeIds.add(stroke.id);
            }
            const fills = (group.fills ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
            for (const fill of fills) {
              const added = this.skiaRenderer.addFillFromPixels(fill.id, fill.layerId, fill.width, fill.height, fill.pixels, fill.timestamp);
              if (added) {
                this.indexFill(fill);
                this.activeFillIds.add(fill.id);
              }
            }
          }
        } else {
          const strokes = (data?.strokes ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
          for (const stroke of strokes) {
            this.skiaRenderer.replayStroke(stroke);
            this.activeStrokeIds.add(stroke.id);
          }
          const fills = (data?.fills ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
          for (const fill of fills) {
            const added = this.skiaRenderer.addFillFromPixels(fill.id, fill.layerId, fill.width, fill.height, fill.pixels, fill.timestamp);
            if (added) {
              this.indexFill(fill);
              this.activeFillIds.add(fill.id);
            }
          }
        }
      }
      this.scheduleAutosave();
    });

    eventBus.on(Events.REDO_REQUESTED, () => {
      if (this.isReadOnly) return;
      const entry = this.history.redo();
      if (entry && entry.actionType === 'stroke') {
        const stroke = entry.data as Stroke;
        if (stroke && stroke.points.length > 0) {
          this.skiaRenderer.replayStroke(stroke);
          this.activeStrokeIds.add(stroke.id);
        }
      }
      if (entry && entry.actionType === 'fill') {
        const fill = entry.data as FillRecord;
        if (fill?.id) {
          const added = this.skiaRenderer.addFillFromPixels(fill.id, fill.layerId, fill.width, fill.height, fill.pixels, fill.timestamp);
          if (added) {
            this.indexFill(fill);
            this.activeFillIds.add(fill.id);
          }
        }
      }
      if (entry && entry.actionType === 'layerClear') {
        const data = entry.data as { strokeIds?: string[]; fillIds?: string[]; cleared?: { strokeIds: string[]; fillIds?: string[] }[] };
        if (data?.cleared) {
          for (const group of data.cleared) {
            for (const strokeId of group.strokeIds ?? []) {
              this.skiaRenderer.undoStroke(strokeId);
              this.activeStrokeIds.delete(strokeId);
            }
            for (const fillId of group.fillIds ?? []) {
              this.skiaRenderer.removeFill(fillId);
              this.activeFillIds.delete(fillId);
            }
          }
        } else {
          const strokeIds = data?.strokeIds ?? [];
          for (const strokeId of strokeIds) {
            this.skiaRenderer.undoStroke(strokeId);
            this.activeStrokeIds.delete(strokeId);
          }
          const fillIds = data?.fillIds ?? [];
          for (const fillId of fillIds) {
            this.skiaRenderer.removeFill(fillId);
            this.activeFillIds.delete(fillId);
          }
        }
      }
      this.scheduleAutosave();
    });

    // Layer handlers
    eventBus.on(Events.LAYER_ADDED, () => {
      if (this.isReadOnly) return;
      const layer = this.canvasState.addLayer();
      this.skiaRenderer.registerLayer(layer.id, layer.visible, layer.opacity);
      if (this.soloLayerId && layer.id !== this.soloLayerId) {
        this.canvasState.setLayerVisibility(layer.id, false);
        this.skiaRenderer.setLayerVisibility(layer.id, false);
        this.savedLayerVisibility?.set(layer.id, false);
      }
      this.syncLayerOrder();
      // Emit layer state update
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_SELECTED, (layerId: string) => {
      this.canvasState.setActiveLayer(layerId);
      // Emit layer state update
      this.emitLayerUpdate();
    });

    eventBus.on(Events.LAYER_VISIBILITY_TOGGLED, ({ layerId, visible }: { layerId: string; visible: boolean }) => {
      if (this.isReadOnly) return;
      this.canvasState.setLayerVisibility(layerId, visible);
      if (this.soloLayerId && layerId !== this.soloLayerId) {
        this.savedLayerVisibility?.set(layerId, visible);
        this.canvasState.setLayerVisibility(layerId, false);
        this.skiaRenderer.setLayerVisibility(layerId, false);
      } else {
        this.skiaRenderer.setLayerVisibility(layerId, visible);
        this.savedLayerVisibility?.set(layerId, visible);
      }
      // Emit layer state update
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_LOCK_TOGGLED, ({ layerId, locked }: { layerId: string; locked: boolean }) => {
      if (this.isReadOnly) return;
      this.canvasState.setLayerLocked(layerId, locked);
      // Emit layer state update
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_ALPHA_LOCK_TOGGLED, ({ layerId, alphaLocked }: { layerId: string; alphaLocked: boolean }) => {
      if (this.isReadOnly) return;
      this.canvasState.setLayerAlphaLocked(layerId, alphaLocked);
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_BLEND_MODE_CHANGED, ({ layerId, blendMode }: { layerId: string; blendMode: BlendMode }) => {
      if (this.isReadOnly) return;
      this.canvasState.setLayerBlendMode(layerId, blendMode);
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_REFERENCE_TOGGLED, ({ layerId }: { layerId: string }) => {
      if (this.isReadOnly) return;
      const current = this.canvasState.getReferenceLayerId();
      if (current === layerId) {
        this.canvasState.setReferenceLayer(null);
      } else {
        this.canvasState.setReferenceLayer(layerId);
      }
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_MOVED_UP, (layerId: string) => {
      if (this.isReadOnly) return;
      const moved = this.canvasState.moveLayerUp(layerId);
      if (!moved) return;
      this.syncLayerOrder();
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_MOVED_DOWN, (layerId: string) => {
      if (this.isReadOnly) return;
      const moved = this.canvasState.moveLayerDown(layerId);
      if (!moved) return;
      this.syncLayerOrder();
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_RENAMED, ({ layerId, name }: { layerId: string; name: string }) => {
      if (this.isReadOnly) return;
      const renamed = this.canvasState.renameLayer(layerId, name);
      if (!renamed) return;
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_DUPLICATED, (layerId: string) => {
      if (this.isReadOnly) return;
      const layer = this.canvasState.duplicateLayer(layerId);
      if (!layer) return;
      this.skiaRenderer.registerLayer(layer.id, layer.visible, layer.opacity);
      if (this.soloLayerId && layer.id !== this.soloLayerId) {
        this.canvasState.setLayerVisibility(layer.id, false);
        this.skiaRenderer.setLayerVisibility(layer.id, false);
        this.savedLayerVisibility?.set(layer.id, false);
      }
      this.syncLayerOrder();
      this.duplicateLayerStrokes(layerId, layer.id);
      this.duplicateLayerFills(layerId, layer.id);
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_SOLO_TOGGLED, (layerId: string) => {
      if (this.isReadOnly) return;
      if (this.soloLayerId === layerId) {
        this.restoreLayerVisibility();
        this.soloLayerId = null;
      } else {
        this.applySoloLayer(layerId);
        this.soloLayerId = layerId;
      }
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_MERGED_DOWN, (layerId: string) => {
      if (this.isReadOnly) return;
      const targetLayerId = this.canvasState.mergeLayerDown(layerId);
      if (!targetLayerId) return;

      this.transferLayerStrokes(layerId, targetLayerId);
      this.transferLayerFills(layerId, targetLayerId);
      if (this.soloLayerId === layerId) {
        this.soloLayerId = targetLayerId;
        this.applySoloLayer(targetLayerId);
      }

      this.syncLayerOrder();
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_OPACITY_CHANGED, ({ layerId, opacity }: { layerId: string; opacity: number }) => {
      if (this.isReadOnly) return;
      this.canvasState.setLayerOpacity(layerId, opacity);
      this.skiaRenderer.setLayerOpacity(layerId, opacity);
      // Emit layer state update
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.LAYER_DELETED, (layerId: string) => {
      if (this.isReadOnly) return;
      const removed = this.canvasState.removeLayer(layerId);
      if (!removed) {
        return;
      }
      this.skiaRenderer.removeLayer(layerId);
      if (this.soloLayerId === layerId) {
        this.restoreLayerVisibility();
        this.soloLayerId = null;
      }
      this.savedLayerVisibility?.delete(layerId);
      this.layerStrokeIndex.delete(layerId);
      this.layerFillIndex.delete(layerId);
      this.syncLayerOrder();
      const remainingActive = new Set<string>();
      for (const strokeId of this.activeStrokeIds) {
        const stroke = this.strokeIndex.get(strokeId);
        if (stroke?.layerId !== layerId) {
          remainingActive.add(strokeId);
        }
      }
      this.activeStrokeIds = remainingActive;
      const remainingFills = new Set<string>();
      for (const fillId of this.activeFillIds) {
        const fill = this.fillIndex.get(fillId);
        if (fill?.layerId !== layerId) {
          remainingFills.add(fillId);
        }
      }
      this.activeFillIds = remainingFills;
      for (const [strokeId, stroke] of this.strokeIndex.entries()) {
        if (stroke.layerId === layerId) {
          this.strokeIndex.delete(strokeId);
        }
      }
      for (const [fillId, fill] of this.fillIndex.entries()) {
        if (fill.layerId === layerId) {
          this.fillIndex.delete(fillId);
        }
      }
      // Emit layer state update
      this.emitLayerUpdate();
      this.scheduleAutosave();
    });

    eventBus.on(Events.GESTURE_TWO_FINGER_TAP, () => {
      if (this.isReadOnly) return;
      eventBus.emit(Events.UNDO_REQUESTED, null);
    });

    eventBus.on(Events.GESTURE_THREE_FINGER_TAP, () => {
      if (this.isReadOnly) return;
      eventBus.emit(Events.REDO_REQUESTED, null);
    });

    eventBus.on(Events.GESTURE_TWO_FINGER_DOUBLE_TAP, () => {
      eventBus.emit(Events.VIEW_RESET_REQUESTED, null);
    });

    eventBus.on(Events.GESTURE_THREE_FINGER_SCRUB, () => {
      if (this.isReadOnly) return;
      this.clearActiveLayer();
    });

    eventBus.on(Events.LAYER_CLEAR_REQUESTED, (layerId?: string) => {
      if (this.isReadOnly) return;
      if (layerId) {
        this.clearLayerById(layerId);
      } else {
        this.clearActiveLayer();
      }
      this.scheduleAutosave();
    });

    eventBus.on(Events.CANVAS_CLEAR_REQUESTED, () => {
      if (this.isReadOnly) return;
      this.clearAllLayers();
      this.scheduleAutosave();
    });

    eventBus.on(Events.CANVAS_EXPORT_REQUESTED, () => {
      this.skiaRenderer.exportPng();
    });

    eventBus.on(Events.CANVAS_EXPORT_BACKGROUND_REQUESTED, () => {
      this.skiaRenderer.exportPngWithBackground();
    });

    eventBus.on(Events.CANVAS_EXPORT_JPEG_REQUESTED, () => {
      this.skiaRenderer.exportJpegWithBackground();
    });

    eventBus.on(Events.PROJECT_EXPORT_REQUESTED, () => {
      this.exportProject();
    });

    eventBus.on(Events.PROJECT_IMPORT_REQUESTED, (data: ProjectData) => {
      this.importProject(data);
    });

    eventBus.on(Events.PROJECT_RECOVER_REQUESTED, async () => {
      await this.recoverAutosave();
    });

    eventBus.on(Events.READONLY_TOGGLED, (data?: { readonly?: boolean }) => {
      if (typeof data?.readonly === 'boolean') {
        this.isReadOnly = data.readonly;
        this.persistReadOnlyState();
        return;
      }
      this.isReadOnly = !this.isReadOnly;
      this.persistReadOnlyState();
      eventBus.emit(Events.READONLY_TOGGLED, { readonly: this.isReadOnly });
    });

    eventBus.on(Events.EYEDROPPER_TOGGLED, (data?: { active?: boolean }) => {
      if (typeof data?.active === 'boolean') {
        this.eyedropperActive = data.active;
        return;
      }
      this.setEyedropperActive(!this.eyedropperActive);
    });

    eventBus.on(Events.PAN_MODE_TOGGLED, (data?: { active?: boolean }) => {
      if (typeof data?.active === 'boolean') {
        this.setPanModeActive(data.active);
        return;
      }
      this.setPanModeActive(!this.panModeActive);
    });

    eventBus.on(Events.COLOR_DROP_TOGGLED, (data?: { active?: boolean }) => {
      if (typeof data?.active === 'boolean') {
        this.colorDropActive = data.active;
        return;
      }
      this.colorDropActive = !this.colorDropActive;
      eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: this.colorDropActive });
    });

    eventBus.on(Events.LASSO_TOGGLED, (data?: { active?: boolean }) => {
      if (typeof data?.active === 'boolean') {
        this.setLassoActive(data.active);
        return;
      }
      this.setLassoActive(!this.lassoActive);
    });

    eventBus.on(Events.CANVAS_RESIZE_REQUESTED, (data?: { width: number; height: number; anchor?: 'center' | 'topLeft' }) => {
      if (!data) return;
      this.resizeCanvas(data.width, data.height, data.anchor ?? 'center');
    });

    eventBus.on(Events.CANVAS_FIT_REQUESTED, () => {
      this.fitCanvasToContent();
    });

    eventBus.on(Events.VIEW_FIT_REQUESTED, () => {
      this.fitViewToCanvas();
    });

    eventBus.on(Events.VIEW_ROTATION_SNAP_TOGGLED, (snap?: boolean) => {
      if (typeof snap === 'boolean') {
        this.rotationSnap = snap;
      } else {
        this.rotationSnap = !this.rotationSnap;
      }
      this.saveViewSettings();
    });

    eventBus.on(Events.TIMELAPSE_TOGGLED, (data?: { active?: boolean }) => {
      if (typeof data?.active === 'boolean') {
        if (data.active) {
          this.startTimelapse();
        } else {
          this.stopTimelapse();
        }
        return;
      }
      if (this.timelapseRecording) {
        this.stopTimelapse();
      } else {
        this.startTimelapse();
      }
    });

    eventBus.on(Events.GESTURE_PINCH, (data: GestureData) => {
      if (!data.scale) return;
      const center = this.toCanvasPoint(data.center);
      this.viewTransformer.applyPinchZoom(data.scale, center);
      this.syncViewTransform();
    });

    eventBus.on(Events.GESTURE_PAN, (data: GestureData) => {
      if (!data.displacement) return;
      const delta = this.toCanvasDelta(data.displacement);
      this.viewTransformer.applyPan(delta);
      this.syncViewTransform();
    });

    eventBus.on(Events.GESTURE_ROTATE, (data: GestureData) => {
      if (!data.angle) return;
      const angleDeg = data.angle * (180 / Math.PI);
      this.rotateViewBy(angleDeg);
    });

    eventBus.on(Events.VIEW_RESET_REQUESTED, () => {
      this.viewTransformer.setZoom(CANVAS_VIEW_DEFAULTS.zoom);
      this.viewTransformer.setPan(CANVAS_VIEW_DEFAULTS.pan);
      this.viewTransformer.setRotation(CANVAS_VIEW_DEFAULTS.rotation);
      this.syncViewTransform();
    });
  }

  private syncLayersToRenderer(): void {
    const canvas = this.canvasState.getCanvas();
    for (const layer of canvas.layers) {
      this.skiaRenderer.registerLayer(layer.id, layer.visible, layer.opacity);
    }
    this.syncLayerOrder();
  }

  private ensureActiveLayer(): Layer | null {
    const canvas = this.canvasState.getCanvas();
    if (canvas.layers.length === 0) {
      const layer = this.canvasState.addLayer('Layer 1');
      this.skiaRenderer.registerLayer(layer.id, layer.visible, layer.opacity);
      this.syncLayerOrder();
      this.emitLayerUpdate();
      this.scheduleAutosave();
      return layer;
    }

    const activeLayer = this.canvasState.getActiveLayer();
    if (!activeLayer) {
      const fallback = canvas.layers[canvas.layers.length - 1]!;
      this.canvasState.setActiveLayer(fallback.id);
      this.emitLayerUpdate();
      return fallback;
    }

    return activeLayer;
  }

  private emitLayerUpdate(): void {
    const canvas = this.canvasState.getCanvas();
    eventBus.emit('layers:updated', {
      layers: canvas.layers,
      activeLayerId: canvas.activeLayerId,
      soloLayerId: this.soloLayerId,
      referenceLayerId: canvas.referenceLayerId ?? null,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  }

  private loadViewSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.viewStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        zoom?: number;
        pan?: Point2D;
        rotation?: number;
        rotationSnap?: boolean;
      };
      if (parsed.zoom !== undefined && Number.isFinite(parsed.zoom)) {
        this.viewTransformer.setZoom(parsed.zoom);
      }
      if (parsed.pan && Number.isFinite(parsed.pan.x) && Number.isFinite(parsed.pan.y)) {
        this.viewTransformer.setPan({ x: parsed.pan.x, y: parsed.pan.y });
      }
      if (parsed.rotation !== undefined && Number.isFinite(parsed.rotation)) {
        this.viewTransformer.setRotation(parsed.rotation);
      }
      if (typeof parsed.rotationSnap === 'boolean') {
        this.rotationSnap = parsed.rotationSnap;
        eventBus.emit(Events.VIEW_ROTATION_SNAP_TOGGLED, this.rotationSnap);
      }
    } catch (error) {
      console.warn('Failed to load view settings', error);
    }
  }

  private saveViewSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        zoom: this.viewTransformer.getZoom(),
        pan: this.viewTransformer.getPan(),
        rotation: this.viewTransformer.getRotation(),
        rotationSnap: this.rotationSnap,
      };
      window.localStorage.setItem(this.viewStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save view settings', error);
    }
  }

  private loadBrushSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.brushStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        size?: number;
        color?: Color;
        stabilization?: number;
      };
      if (parsed.size && Number.isFinite(parsed.size)) {
        this.currentSize = Math.max(BRUSH_DEFAULTS.minSize, Math.min(BRUSH_DEFAULTS.maxSize, parsed.size));
        this.skiaRenderer.setStrokeWidth(this.currentSize);
        eventBus.emit(Events.BRUSH_SIZE_CHANGED, this.currentSize);
      }
      if (parsed.color) {
        const color = {
          r: Math.max(0, Math.min(255, parsed.color.r ?? this.currentColor.r)),
          g: Math.max(0, Math.min(255, parsed.color.g ?? this.currentColor.g)),
          b: Math.max(0, Math.min(255, parsed.color.b ?? this.currentColor.b)),
          a: Math.max(0, Math.min(255, parsed.color.a ?? this.currentColor.a)),
        };
        this.currentColor = color;
        this.skiaRenderer.setColor(color);
        eventBus.emit(Events.BRUSH_COLOR_CHANGED, color);
        eventBus.emit(Events.BRUSH_OPACITY_CHANGED, color.a / 255);
      }
      if (parsed.stabilization !== undefined && Number.isFinite(parsed.stabilization)) {
        this.currentStabilization = Math.max(0, Math.min(1, parsed.stabilization));
        eventBus.emit(Events.BRUSH_STABILIZATION_CHANGED, this.currentStabilization);
      }
    } catch (error) {
      console.warn('Failed to load brush settings', error);
    }
  }

  private loadBackgroundSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.backgroundStorageKey);
      if (!raw) {
        this.skiaRenderer.setBackgroundColor(this.currentBackground);
        return;
      }
      const parsed = JSON.parse(raw) as Color;
      if (!parsed) return;
      const color = {
        r: Math.max(0, Math.min(255, parsed.r ?? this.currentBackground.r)),
        g: Math.max(0, Math.min(255, parsed.g ?? this.currentBackground.g)),
        b: Math.max(0, Math.min(255, parsed.b ?? this.currentBackground.b)),
        a: Math.max(0, Math.min(255, parsed.a ?? this.currentBackground.a)),
      };
      this.currentBackground = color;
      this.canvasState.setBackgroundColor(color);
      this.skiaRenderer.setBackgroundColor(color);
      eventBus.emit(Events.BACKGROUND_COLOR_CHANGED, color);
    } catch (error) {
      console.warn('Failed to load background color', error);
      this.skiaRenderer.setBackgroundColor(this.currentBackground);
    }
  }

  private loadGridSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.gridStorageKey);
      if (!raw) {
        this.skiaRenderer.setGridVisible(this.gridVisible);
        this.skiaRenderer.setGridSpacing(this.gridSpacing);
        return;
      }
      const parsed = JSON.parse(raw) as { visible?: boolean; spacing?: number; color?: Color; snap?: boolean };
      if (typeof parsed.visible === 'boolean') {
        this.gridVisible = parsed.visible;
      }
      if (parsed.spacing !== undefined && Number.isFinite(parsed.spacing)) {
        this.gridSpacing = Math.max(8, Math.min(512, parsed.spacing));
      }
      if (parsed.color) {
        this.gridColor = {
          r: Math.max(0, Math.min(255, parsed.color.r ?? this.gridColor.r)),
          g: Math.max(0, Math.min(255, parsed.color.g ?? this.gridColor.g)),
          b: Math.max(0, Math.min(255, parsed.color.b ?? this.gridColor.b)),
          a: Math.max(0, Math.min(255, parsed.color.a ?? this.gridColor.a)),
        };
      }
      if (typeof parsed.snap === 'boolean') {
        this.gridSnap = parsed.snap;
      }
      this.skiaRenderer.setGridVisible(this.gridVisible);
      this.skiaRenderer.setGridSpacing(this.gridSpacing);
      this.skiaRenderer.setGridColor(this.gridColor);
      eventBus.emit(Events.GRID_TOGGLED, this.gridVisible);
      eventBus.emit(Events.GRID_SPACING_CHANGED, this.gridSpacing);
      eventBus.emit(Events.GRID_COLOR_CHANGED, this.gridColor);
      eventBus.emit(Events.GRID_SNAP_TOGGLED, this.gridSnap);
    } catch (error) {
      console.warn('Failed to load grid settings', error);
      this.skiaRenderer.setGridVisible(this.gridVisible);
      this.skiaRenderer.setGridSpacing(this.gridSpacing);
      this.skiaRenderer.setGridColor(this.gridColor);
    }
  }

  private loadReadOnlyState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(this.readonlyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'boolean' && parsed) {
        // Prevent accidental lockout across sessions.
        this.isReadOnly = false;
        window.localStorage.setItem(this.readonlyStorageKey, JSON.stringify(false));
        eventBus.emit(Events.READONLY_TOGGLED, { readonly: this.isReadOnly });
      }
    } catch (error) {
      console.warn('Failed to load read-only state', error);
    }
  }

  private persistReadOnlyState(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.readonlyStorageKey, JSON.stringify(this.isReadOnly));
    } catch (error) {
      console.warn('Failed to save read-only state', error);
    }
  }

  private saveBrushSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        size: this.currentSize,
        color: this.currentColor,
        stabilization: this.currentStabilization,
      };
      window.localStorage.setItem(this.brushStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save brush settings', error);
    }
  }

  private saveGridSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        visible: this.gridVisible,
        spacing: this.gridSpacing,
        color: this.gridColor,
        snap: this.gridSnap,
      };
      window.localStorage.setItem(this.gridStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to save grid settings', error);
    }
  }

  private saveBackgroundSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.backgroundStorageKey, JSON.stringify(this.currentBackground));
    } catch (error) {
      console.warn('Failed to save background color', error);
    }
  }

  private setEyedropperActive(active: boolean): void {
    this.eyedropperActive = active;
    eventBus.emit(Events.EYEDROPPER_TOGGLED, { active });
  }

  private setPanModeActive(active: boolean): void {
    this.panModeActive = active;
    eventBus.emit(Events.PAN_MODE_TOGGLED, { active });
  }

  private resizeCanvas(width: number, height: number, anchor: 'center' | 'topLeft'): void {
    if (this.isResizingCanvas) return;
    const canvas = this.canvasState.getCanvas();
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;

    this.isResizingCanvas = true;
    try {
      const oldWidth = canvas.width;
      const oldHeight = canvas.height;
      const deltaX = nextWidth - oldWidth;
      const deltaY = nextHeight - oldHeight;
      let shiftX = 0;
      let shiftY = 0;
      if (anchor === 'center') {
        shiftX = deltaX / 2;
        shiftY = deltaY / 2;
      }

      const strokesToShift: Stroke[] = [];
      for (const strokeId of this.activeStrokeIds) {
        const stroke = this.strokeIndex.get(strokeId);
        if (stroke) {
          strokesToShift.push(stroke);
        }
      }

      if (shiftX !== 0 || shiftY !== 0) {
        for (const stroke of strokesToShift) {
          for (const point of stroke.points) {
            point.x += shiftX;
            point.y += shiftY;
          }
          this.skiaRenderer.replaceStrokePath(stroke.id, stroke.points);
        }
      }

      this.canvasState.setCanvasSize(nextWidth, nextHeight);
      this.scheduleAutosave();
      this.emitLayerUpdate();
    } finally {
      this.isResizingCanvas = false;
    }
  }

  private fitCanvasToContent(): void {
    const margin = 64;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let hasPoints = false;

    for (const strokeId of this.activeStrokeIds) {
      const stroke = this.strokeIndex.get(strokeId);
      if (!stroke) continue;
      for (const point of stroke.points) {
        hasPoints = true;
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    if (!hasPoints) return;
    const nextWidth = Math.max(1, Math.round(maxX - minX + margin * 2));
    const nextHeight = Math.max(1, Math.round(maxY - minY + margin * 2));

    const shiftX = margin - minX;
    const shiftY = margin - minY;
    if (shiftX !== 0 || shiftY !== 0) {
      for (const strokeId of this.activeStrokeIds) {
        const stroke = this.strokeIndex.get(strokeId);
        if (!stroke) continue;
        for (const point of stroke.points) {
          point.x += shiftX;
          point.y += shiftY;
        }
        this.skiaRenderer.replaceStrokePath(stroke.id, stroke.points);
      }
    }

    this.canvasState.setCanvasSize(nextWidth, nextHeight);
    this.scheduleAutosave();
    this.emitLayerUpdate();
  }

  private fitViewToCanvas(): void {
    const canvas = this.canvasState.getCanvas();
    const canvasEl = document.getElementById('canvas') as HTMLCanvasElement | null;
    if (!canvasEl) return;
    const viewWidth = canvasEl.width || canvasEl.clientWidth;
    const viewHeight = canvasEl.height || canvasEl.clientHeight;
    if (viewWidth <= 0 || viewHeight <= 0 || canvas.width <= 0 || canvas.height <= 0) return;

    const fitScale = Math.min(viewWidth / canvas.width, viewHeight / canvas.height);
    const margin = 0.92;
    const zoom = Math.max(0.125, Math.min(64, fitScale * margin));
    this.viewTransformer.setZoom(zoom);
    this.viewTransformer.setPan({ x: 0, y: 0 });
    this.viewTransformer.setRotation(CANVAS_VIEW_DEFAULTS.rotation);
    this.syncViewTransform();
  }

  private performColorDrop(seed: InputPoint, threshold: number): void {
    const activeLayer = this.ensureActiveLayer();
    if (!activeLayer) return;
    const canvas = this.canvasState.getCanvas();
    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) return;

    const referenceLayerId = canvas.referenceLayerId ?? activeLayer.id;
    const pixels = this.skiaRenderer.getLayerPixels(referenceLayerId, width, height);
    if (!pixels || pixels.length < width * height * 4) return;

    const seedX = Math.max(0, Math.min(width - 1, Math.round(seed.x)));
    const seedY = Math.max(0, Math.min(height - 1, Math.round(seed.y)));
    const seedIndex = (seedY * width + seedX) * 4;

    const target = this.unpremultiplyColor(
      pixels[seedIndex] ?? 0,
      pixels[seedIndex + 1] ?? 0,
      pixels[seedIndex + 2] ?? 0,
      pixels[seedIndex + 3] ?? 0
    );

    const maxDiff = Math.max(0.01, Math.min(1, threshold)) * 255;
    const maxDiffSq = maxDiff * maxDiff;

    const visited = new Uint8Array(width * height);
    const queue = new Uint32Array(width * height);
    let head = 0;
    let tail = 0;
    const seedFlat = seedY * width + seedX;
    queue[tail++] = seedFlat;
    visited[seedFlat] = 1;

    const output = new Uint8Array(width * height * 4);
    const fillColor = this.currentColor;
    const fillA = Math.max(0, Math.min(255, fillColor.a));
    const fillR = Math.round((fillColor.r * fillA) / 255);
    const fillG = Math.round((fillColor.g * fillA) / 255);
    const fillB = Math.round((fillColor.b * fillA) / 255);

    const withinThreshold = (idx: number): boolean => {
      const r = pixels[idx] ?? 0;
      const g = pixels[idx + 1] ?? 0;
      const b = pixels[idx + 2] ?? 0;
      const a = pixels[idx + 3] ?? 0;
      const c = this.unpremultiplyColor(r, g, b, a);
      const dr = c.r - target.r;
      const dg = c.g - target.g;
      const db = c.b - target.b;
      const da = c.a - target.a;
      return (dr * dr + dg * dg + db * db + da * da) <= maxDiffSq;
    };

    while (head < tail) {
      const flatIndex = queue[head++]!;
      const x = flatIndex % width;
      const y = Math.floor(flatIndex / width);
      const pixelIndex = flatIndex * 4;
      if (!withinThreshold(pixelIndex)) {
        continue;
      }

      output[pixelIndex] = fillR;
      output[pixelIndex + 1] = fillG;
      output[pixelIndex + 2] = fillB;
      output[pixelIndex + 3] = fillA;

      if (x > 0) {
        const left = flatIndex - 1;
        if (!visited[left]) {
          visited[left] = 1;
          queue[tail++] = left;
        }
      }
      if (x < width - 1) {
        const right = flatIndex + 1;
        if (!visited[right]) {
          visited[right] = 1;
          queue[tail++] = right;
        }
      }
      if (y > 0) {
        const up = flatIndex - width;
        if (!visited[up]) {
          visited[up] = 1;
          queue[tail++] = up;
        }
      }
      if (y < height - 1) {
        const down = flatIndex + width;
        if (!visited[down]) {
          visited[down] = 1;
          queue[tail++] = down;
        }
      }
    }

    const fill: FillRecord = {
      id: this.generateFillId(),
      layerId: activeLayer.id,
      width,
      height,
      pixels: output,
      timestamp: Date.now(),
    };
    const added = this.skiaRenderer.addFillFromPixels(fill.id, fill.layerId, fill.width, fill.height, fill.pixels, fill.timestamp);
    if (!added) return;
    this.indexFill(fill);
    this.activeFillIds.add(fill.id);

    this.history.recordAction({
      actionType: 'fill',
      layerId: activeLayer.id,
      data: fill,
      inverseData: { fillId: fill.id },
    });
    this.scheduleAutosave();
  }

  private unpremultiplyColor(r: number, g: number, b: number, a: number): { r: number; g: number; b: number; a: number } {
    if (a <= 0) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const scale = 255 / a;
    return {
      r: Math.min(255, Math.round(r * scale)),
      g: Math.min(255, Math.round(g * scale)),
      b: Math.min(255, Math.round(b * scale)),
      a,
    };
  }

  private setLassoActive(active: boolean): void {
    this.lassoActive = active;
    if (!active) {
      this.clearSelection();
    }
    eventBus.emit(Events.LASSO_TOGGLED, { active: this.lassoActive });
  }

  private beginLasso(point: Point2D): void {
    this.lassoDrawing = true;
    this.lassoPoints = [point];
    this.clearSelection();
  }

  private extendLasso(point: Point2D): void {
    const last = this.lassoPoints[this.lassoPoints.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
    this.lassoPoints.push(point);
  }

  private finishLasso(): void {
    this.lassoDrawing = false;
    if (this.lassoPoints.length < 3) {
      this.lassoPoints = [];
      return;
    }
    this.createSelectionFromLasso(this.lassoPoints);
    this.lassoPoints = [];
  }

  private createSelectionFromLasso(polygon: Point2D[]): void {
    const activeLayer = this.canvasState.getActiveLayer();
    if (!activeLayer) return;
    const selected: string[] = [];
    const baseCenter = this.computePolygonCenter(polygon);

    for (const strokeId of this.layerStrokeIndex.get(activeLayer.id) ?? []) {
      if (!this.activeStrokeIds.has(strokeId)) continue;
      const stroke = this.strokeIndex.get(strokeId);
      if (!stroke) continue;
      const points = stroke.points;
      const step = Math.max(1, Math.floor(points.length / 32));
      let inside = false;
      for (let i = 0; i < points.length; i += step) {
        if (this.isPointInPolygon(points[i]!, polygon)) {
          inside = true;
          break;
        }
      }
      if (inside) {
        selected.push(strokeId);
      }
    }

    if (selected.length === 0) {
      this.clearSelection();
      return;
    }

    this.selectionOriginalPoints.clear();
    for (const strokeId of selected) {
      const stroke = this.strokeIndex.get(strokeId);
      if (!stroke) continue;
      this.selectionOriginalPoints.set(strokeId, stroke.points.map((p) => ({ ...p })));
    }

    const transformedPolygon = polygon.map((p) => ({ ...p }));
    const bounds = this.computeBounds(transformedPolygon);
    this.selection = {
      basePolygon: polygon.map((p) => ({ ...p })),
      transformedPolygon,
      baseCenter,
      center: { ...baseCenter },
      bounds,
      selectedStrokeIds: selected,
      transform: { tx: 0, ty: 0, scale: 1, rotation: 0 },
    };
    eventBus.emit(Events.SELECTION_UPDATED, { active: true });
  }

  private clearSelection(): void {
    this.lassoDrawing = false;
    this.lassoPoints = [];
    this.selection = null;
    this.selectionOriginalPoints.clear();
    this.isTransformingSelection = false;
    this.selectionDragStart = null;
    this.selectionStartTransform = null;
    eventBus.emit(Events.SELECTION_UPDATED, { active: false });
  }

  private beginSelectionTransform(point: Point2D): void {
    if (!this.selection) return;
    this.isTransformingSelection = true;
    this.selectionDragStart = { ...point };
    this.selectionStartTransform = { ...this.selection.transform };
  }

  private updateSelectionTransform(point: Point2D): void {
    if (!this.selection || !this.selectionDragStart || !this.selectionStartTransform) return;
    const dx = point.x - this.selectionDragStart.x;
    const dy = point.y - this.selectionDragStart.y;
    let next = { ...this.selectionStartTransform };

    if (this.isAltDown) {
      next.rotation = this.selectionStartTransform.rotation + dx * 0.3;
    } else if (this.isShiftDown) {
      next.scale = Math.max(0.1, Math.min(10, this.selectionStartTransform.scale + dx / 200));
    } else {
      next.tx = this.selectionStartTransform.tx + dx;
      next.ty = this.selectionStartTransform.ty + dy;
    }

    this.applySelectionTransform(next);
  }

  private finishSelectionTransform(): void {
    this.isTransformingSelection = false;
    this.selectionDragStart = null;
    this.selectionStartTransform = null;
  }

  private applySelectionTransform(transform: { tx: number; ty: number; scale: number; rotation: number }): void {
    if (!this.selection) return;
    const baseCenter = this.selection.baseCenter;
    const center = { x: baseCenter.x + transform.tx, y: baseCenter.y + transform.ty };
    const radians = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    for (const strokeId of this.selection.selectedStrokeIds) {
      const original = this.selectionOriginalPoints.get(strokeId);
      if (!original) continue;
      const nextPoints = original.map((p) => {
        let x = p.x - baseCenter.x;
        let y = p.y - baseCenter.y;
        x *= transform.scale;
        y *= transform.scale;
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        return { ...p, x: rx + center.x, y: ry + center.y };
      });
      const stroke = this.strokeIndex.get(strokeId);
      if (stroke) {
        stroke.points = nextPoints;
      }
      this.skiaRenderer.replaceStrokePath(strokeId, nextPoints);
    }

    const transformedPolygon = this.selection.basePolygon.map((p) => {
      let x = p.x - baseCenter.x;
      let y = p.y - baseCenter.y;
      x *= transform.scale;
      y *= transform.scale;
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      return { x: rx + center.x, y: ry + center.y };
    });
    this.selection = {
      ...this.selection,
      transformedPolygon,
      bounds: this.computeBounds(transformedPolygon),
      center,
      transform,
    };
  }

  private computePolygonCenter(points: Point2D[]): Point2D {
    const bounds = this.computeBounds(points);
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  }

  private computeBounds(points: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  }

  private isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i]!.x;
      const yi = polygon[i]!.y;
      const xj = polygon[j]!.x;
      const yj = polygon[j]!.y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private startTimelapse(): void {
    if (this.timelapseRecording) return;
    if (typeof window === 'undefined') return;
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== 'function') {
      eventBus.emit(Events.TIMELAPSE_STATUS_CHANGED, { recording: false, supported: false });
      return;
    }
    try {
      this.timelapseStream = canvas.captureStream(30);
      const recorder = new MediaRecorder(this.timelapseStream, { mimeType: 'video/webm' });
      this.timelapseChunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.timelapseChunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(this.timelapseChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `opencanvas-timelapse-${Date.now()}.webm`;
        link.click();
        URL.revokeObjectURL(url);
        this.timelapseChunks = [];
      };
      recorder.start();
      this.timelapseRecorder = recorder;
      this.timelapseRecording = true;
      eventBus.emit(Events.TIMELAPSE_STATUS_CHANGED, { recording: true, supported: true });
    } catch (error) {
      console.warn('Failed to start timelapse recording', error);
      this.timelapseRecording = false;
      eventBus.emit(Events.TIMELAPSE_STATUS_CHANGED, { recording: false, supported: false });
    }
  }

  private stopTimelapse(): void {
    if (!this.timelapseRecording) return;
    this.timelapseRecording = false;
    if (this.timelapseRecorder && this.timelapseRecorder.state !== 'inactive') {
      this.timelapseRecorder.stop();
    }
    this.timelapseRecorder = null;
    if (this.timelapseStream) {
      this.timelapseStream.getTracks().forEach((track) => track.stop());
      this.timelapseStream = null;
    }
    eventBus.emit(Events.TIMELAPSE_STATUS_CHANGED, { recording: false, supported: true });
  }

  private scheduleAutosave(): void {
    if (this.isImporting || typeof window === 'undefined') return;
    if (this.autosaveTimer !== null) return;
    const now = Date.now();
    const elapsed = now - this.lastAutosaveAt;
    const delay = elapsed >= this.autosaveIntervalMs ? 0 : this.autosaveIntervalMs - elapsed;
    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      this.performAutosave();
    }, delay);
  }

  private async performAutosave(): Promise<void> {
    if (this.isImporting || typeof window === 'undefined') return;
    try {
      const canvas = this.canvasState.getCanvas();
      // TODO: Generate thumbnail from current canvas view once captureSnapshot is implemented
      await this.dbStore.saveAutosave(canvas);
      this.lastAutosaveAt = Date.now();
      eventBus.emit(Events.PROJECT_AUTOSAVE_UPDATED, { available: true, timestamp: this.lastAutosaveAt });
    } catch (error) {
      console.warn('Failed to autosave project to IndexedDB', error);
    }
  }

  private async recoverAutosave(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const autosave = await this.dbStore.loadAutosave();
      if (!autosave) return;

      // Prompt user to recover autosave
      const shouldRecover = confirm('An auto-saved project was found. Would you like to recover it?');
      if (!shouldRecover) {
        await this.dbStore.deleteAutosave();
        return;
      }

      // Load the autosaved canvas
      this.canvasState.loadCanvas(autosave.canvas);
      this.syncLayersToRenderer();
      this.emitLayerUpdate();

      // Clear autosave after successful recovery
      await this.dbStore.deleteAutosave();
    } catch (error) {
      console.warn('Failed to recover autosave from IndexedDB', error);
    }
  }

  private exportProject(): void {
    if (typeof window === 'undefined') return;
    const data = this.buildProjectData();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `opencanvas-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildProjectData(): ProjectData {
    const canvas = this.canvasState.getCanvas();
    const layers: SerializedLayer[] = canvas.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      alphaLocked: layer.alphaLocked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      zIndex: layer.zIndex,
      createdAt: layer.createdAt,
    }));

    const strokes: SerializedStroke[] = [];
    for (const strokeId of this.activeStrokeIds) {
      const stroke = this.strokeIndex.get(strokeId);
      if (!stroke) continue;
      strokes.push({
        id: stroke.id,
        layerId: stroke.layerId,
        points: stroke.points.map((point) => ({ ...point })),
        color: { ...(stroke.brushConfig?.color ?? this.currentColor) },
        size: stroke.brushConfig?.baseSize ?? this.currentSize,
        timestamp: stroke.timestamp,
        duration: stroke.duration,
      });
    }

    strokes.sort((a, b) => a.timestamp - b.timestamp);

    const fills: SerializedFill[] = [];
    for (const fillId of this.activeFillIds) {
      const fill = this.fillIndex.get(fillId);
      if (!fill) continue;
      fills.push({
        id: fill.id,
        layerId: fill.layerId,
        width: fill.width,
        height: fill.height,
        timestamp: fill.timestamp,
        pixels: this.encodePixels(fill.pixels),
      });
    }
    fills.sort((a, b) => a.timestamp - b.timestamp);

    return {
      version: 1,
      exportedAt: Date.now(),
      canvas: {
        id: canvas.id,
        width: canvas.width,
        height: canvas.height,
        backgroundColor: { ...canvas.backgroundColor },
        layers,
        activeLayerId: canvas.activeLayerId,
        referenceLayerId: canvas.referenceLayerId ?? null,
        createdAt: canvas.createdAt,
        modifiedAt: canvas.modifiedAt,
      },
      strokes,
      fills,
      view: {
        zoom: this.viewTransformer.getZoom(),
        pan: this.viewTransformer.getPan(),
        rotation: this.viewTransformer.getRotation(),
      },
      grid: {
        visible: this.gridVisible,
        spacing: this.gridSpacing,
        color: { ...this.gridColor },
      },
      brush: {
        size: this.currentSize,
        color: { ...this.currentColor },
        stabilization: this.currentStabilization,
      },
    };
  }

  private importProject(data: ProjectData | null): void {
    if (!data || typeof data !== 'object') return;

    this.isImporting = true;
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    try {
      const now = Date.now();
      const canvasData = (data as ProjectData).canvas ?? ({} as ProjectData['canvas']);
      const layersData = Array.isArray(canvasData.layers) ? canvasData.layers : [];
      const layers: Layer[] = [];
      const usedLayerIds = new Set<string>();
      const layerIdMap = new Map<string, string>();

      for (let i = 0; i < layersData.length; i++) {
        const raw = layersData[i]!;
        const base = createLayer(raw.name);
        const preferredId = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : this.generateLayerId();
        let layerId = preferredId;
        if (usedLayerIds.has(layerId)) {
          layerId = this.generateLayerId();
        }
        usedLayerIds.add(layerId);
        if (typeof raw.id === 'string') {
          layerIdMap.set(raw.id, layerId);
        }

        base.id = layerId;
        base.name = typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : base.name;
        base.visible = typeof raw.visible === 'boolean' ? raw.visible : true;
        base.locked = typeof raw.locked === 'boolean' ? raw.locked : false;
        base.alphaLocked = typeof raw.alphaLocked === 'boolean' ? raw.alphaLocked : false;
        base.opacity = this.coerceNumber(raw.opacity, 1);
        base.blendMode = Object.values(BlendMode).includes(raw.blendMode) ? raw.blendMode : BlendMode.Normal;
        base.zIndex = this.coerceNumber(raw.zIndex, i);
        base.createdAt = this.coerceNumber(raw.createdAt, now);
        layers.push(base);
      }

      if (layers.length === 0) {
        layers.push(createLayer('Layer 1'));
      }

      layers.sort((a, b) => a.zIndex - b.zIndex);
      layers.forEach((layer, index) => {
        layer.zIndex = index;
      });

      let activeLayerId = typeof canvasData.activeLayerId === 'string'
        ? layerIdMap.get(canvasData.activeLayerId) ?? canvasData.activeLayerId
        : '';
      if (!layers.some((layer) => layer.id === activeLayerId)) {
        activeLayerId = layers[0]!.id;
      }
      let referenceLayerId = typeof canvasData.referenceLayerId === 'string'
        ? layerIdMap.get(canvasData.referenceLayerId) ?? canvasData.referenceLayerId
        : null;
      if (!layers.some((layer) => layer.id === referenceLayerId)) {
        referenceLayerId = null;
      }

      const background = this.coerceColor(canvasData.backgroundColor, this.currentBackground);

      const canvas: Canvas = {
        id: typeof canvasData.id === 'string' && canvasData.id ? canvasData.id : this.canvasState.getCanvas().id,
        width: this.coerceNumber(canvasData.width, CANVAS_DEFAULTS.width),
        height: this.coerceNumber(canvasData.height, CANVAS_DEFAULTS.height),
        zoomLevel: CANVAS_VIEW_DEFAULTS.zoom,
        panOffset: { ...CANVAS_VIEW_DEFAULTS.pan },
        rotationAngle: CANVAS_VIEW_DEFAULTS.rotation,
        backgroundColor: background,
        layers,
        activeLayerId,
        referenceLayerId,
        createdAt: this.coerceNumber(canvasData.createdAt, now),
        modifiedAt: now,
      };

      this.skiaRenderer.clear();
      this.skiaRenderer.resetLayerState();
      this.strokeIndex.clear();
      this.layerStrokeIndex.clear();
      this.activeStrokeIds.clear();
      this.fillIndex.clear();
      this.layerFillIndex.clear();
      this.activeFillIds.clear();
      this.history = new HistoryStack();
      this.history.emitState();
      this.lastSmoothedPoint = null;
      this.soloLayerId = null;
      this.savedLayerVisibility = null;

      this.canvasState.loadCanvas(canvas);
      for (const layer of layers) {
        this.skiaRenderer.registerLayer(layer.id, layer.visible, layer.opacity);
      }
      this.syncLayerOrder();

      const view = (data as ProjectData).view;
      if (view) {
        this.viewTransformer.setZoom(this.coerceNumber(view.zoom, CANVAS_VIEW_DEFAULTS.zoom));
        const pan = view.pan && Number.isFinite(view.pan.x) && Number.isFinite(view.pan.y)
          ? { x: view.pan.x, y: view.pan.y }
          : { ...CANVAS_VIEW_DEFAULTS.pan };
        this.viewTransformer.setPan(pan);
        this.viewTransformer.setRotation(this.coerceNumber(view.rotation, CANVAS_VIEW_DEFAULTS.rotation));
        this.syncViewTransform();
      } else {
        this.viewTransformer.setZoom(CANVAS_VIEW_DEFAULTS.zoom);
        this.viewTransformer.setPan({ ...CANVAS_VIEW_DEFAULTS.pan });
        this.viewTransformer.setRotation(CANVAS_VIEW_DEFAULTS.rotation);
        this.syncViewTransform();
      }

      const grid = (data as ProjectData).grid;
      if (grid) {
        this.gridVisible = !!grid.visible;
        this.gridSpacing = this.coerceNumber(grid.spacing, GRID_DEFAULTS.spacing);
        this.gridColor = this.coerceColor(grid.color, GRID_DEFAULTS.color);
        this.skiaRenderer.setGridVisible(this.gridVisible);
        this.skiaRenderer.setGridSpacing(this.gridSpacing);
        this.skiaRenderer.setGridColor(this.gridColor);
        this.saveGridSettings();
        eventBus.emit(Events.GRID_TOGGLED, this.gridVisible);
        eventBus.emit(Events.GRID_SPACING_CHANGED, this.gridSpacing);
        eventBus.emit(Events.GRID_COLOR_CHANGED, this.gridColor);
      }

      const brush = (data as ProjectData).brush;
      if (brush) {
        this.currentSize = this.coerceNumber(brush.size, BRUSH_DEFAULTS.baseSize);
        this.currentColor = this.coerceColor(brush.color, this.currentColor);
        this.currentStabilization = Math.max(0, Math.min(1, this.coerceNumber(brush.stabilization, BRUSH_DEFAULTS.stabilization)));
        this.skiaRenderer.setStrokeWidth(this.currentSize);
        this.skiaRenderer.setColor(this.currentColor);
        this.saveBrushSettings();
        eventBus.emit(Events.BRUSH_SIZE_CHANGED, this.currentSize);
        eventBus.emit(Events.BRUSH_COLOR_CHANGED, this.currentColor);
        eventBus.emit(Events.BRUSH_OPACITY_CHANGED, this.currentColor.a / 255);
        eventBus.emit(Events.BRUSH_STABILIZATION_CHANGED, this.currentStabilization);
      }

      this.currentBackground = background;
      this.canvasState.setBackgroundColor(background);
      this.skiaRenderer.setBackgroundColor(background);
      this.saveBackgroundSettings();
      eventBus.emit(Events.BACKGROUND_COLOR_CHANGED, background);

      const rawStrokes = Array.isArray((data as ProjectData).strokes) ? (data as ProjectData).strokes : [];
      const usedStrokeIds = new Set<string>();
      const importedStrokes: Stroke[] = [];

      for (const raw of rawStrokes) {
        const rawId = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : this.generateStrokeId();
        let strokeId = rawId;
        if (usedStrokeIds.has(strokeId)) {
          strokeId = this.generateStrokeId();
        }
        usedStrokeIds.add(strokeId);

        const layerId = layerIdMap.get(raw.layerId) ?? raw.layerId ?? activeLayerId;
        const fallbackLayerId = layers.some((layer) => layer.id === layerId) ? layerId : activeLayerId;
        const points = this.coercePoints(raw.points);
        if (points.length === 0) continue;

        const color = this.coerceColor(raw.color, this.currentColor);
        const size = this.coerceNumber(raw.size, BRUSH_DEFAULTS.baseSize);
        const timestamp = this.coerceNumber(raw.timestamp, now);
        const duration = this.coerceNumber(raw.duration, 0);

        importedStrokes.push({
          id: strokeId,
          layerId: fallbackLayerId,
          points,
          brushConfig: {
            baseSize: size,
            color,
            pressureSizeCurve: (pressure: number) => 0.3 + pressure * 0.7,
            pressureOpacityCurve: (pressure: number) => 0.5 + pressure * 0.5,
            blendMode: BlendMode.Normal,
            spacing: 0.05,
          },
          affectedTiles: [],
          timestamp,
          duration,
        });
      }

      importedStrokes.sort((a, b) => a.timestamp - b.timestamp);
      for (const stroke of importedStrokes) {
        this.skiaRenderer.replayStroke(stroke);
        this.indexStroke(stroke);
        this.activeStrokeIds.add(stroke.id);
      }

      const rawFills = Array.isArray((data as ProjectData).fills) ? (data as ProjectData).fills : [];
      for (const raw of rawFills) {
        if (!raw || typeof raw !== 'object') continue;
        const rawId = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : this.generateFillId();
        const fillId = this.activeFillIds.has(rawId) ? this.generateFillId() : rawId;
        const layerId = layerIdMap.get(raw.layerId) ?? raw.layerId ?? activeLayerId;
        const fallbackLayerId = layers.some((layer) => layer.id === layerId) ? layerId : activeLayerId;
        const width = this.coerceNumber(raw.width, canvas.width);
        const height = this.coerceNumber(raw.height, canvas.height);
        const pixels = this.decodePixels(raw.pixels);
        if (pixels.length === 0 || width <= 0 || height <= 0) continue;
        const timestamp = this.coerceNumber(raw.timestamp, now);
        const record: FillRecord = {
          id: fillId,
          layerId: fallbackLayerId,
          width,
          height,
          pixels,
          timestamp,
        };
        const added = this.skiaRenderer.addFillFromPixels(record.id, record.layerId, record.width, record.height, record.pixels, record.timestamp);
        if (added) {
          this.indexFill(record);
          this.activeFillIds.add(record.id);
        }
      }

      this.emitLayerUpdate();
    } finally {
      this.isImporting = false;
      this.performAutosave();
    }
  }

  private coerceNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private coerceColor(value: unknown, fallback: Color): Color {
    const color = value as Color | undefined;
    if (!color || typeof color !== 'object') {
      return { ...fallback };
    }
    return {
      r: Math.max(0, Math.min(255, this.coerceNumber(color.r, fallback.r))),
      g: Math.max(0, Math.min(255, this.coerceNumber(color.g, fallback.g))),
      b: Math.max(0, Math.min(255, this.coerceNumber(color.b, fallback.b))),
      a: Math.max(0, Math.min(255, this.coerceNumber(color.a, fallback.a))),
    };
  }

  private coercePoints(points: unknown): InputPoint[] {
    if (!Array.isArray(points)) return [];
    const sanitized: InputPoint[] = [];
    for (const point of points) {
      const p = point as Partial<InputPoint>;
      const x = this.coerceNumber(p.x, NaN);
      const y = this.coerceNumber(p.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const pointerType = this.coercePointerType(p.pointerType);
      sanitized.push({
        x,
        y,
        pressure: Math.max(0, Math.min(1, this.coerceNumber(p.pressure, 0.5))),
        tiltX: this.coerceNumber(p.tiltX, 0),
        tiltY: this.coerceNumber(p.tiltY, 0),
        timestamp: this.coerceNumber(p.timestamp, Date.now()),
        pointerType,
      });
    }
    return sanitized;
  }

  private coercePointerType(value: unknown): PointerType {
    if (value === PointerType.Mouse || value === PointerType.Touch || value === PointerType.Stylus) {
      return value;
    }
    return PointerType.Mouse;
  }

  private encodePixels(pixels: Uint8Array): string {
    if (typeof window === 'undefined') return '';
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < pixels.length; i += chunkSize) {
      const chunk = pixels.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary);
  }

  private decodePixels(encoded: string): Uint8Array {
    if (typeof window === 'undefined') return new Uint8Array();
    if (!encoded || typeof encoded !== 'string') return new Uint8Array();
    const binary = window.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private generateLayerId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private syncLayerOrder(): void {
    const canvas = this.canvasState.getCanvas();
    const order = [...canvas.layers].sort((a, b) => a.zIndex - b.zIndex).map((layer) => layer.id);
    this.skiaRenderer.setLayerOrder(order);
  }

  private smoothPoint(point: InputPoint): InputPoint {
    if (!this.lastSmoothedPoint) {
      this.lastSmoothedPoint = point;
      return point;
    }

    const strength = Math.max(0, Math.min(1, this.currentStabilization));
    const alpha = 1 - strength * 0.8;
    const smoothed: InputPoint = {
      ...point,
      x: this.lastSmoothedPoint.x + (point.x - this.lastSmoothedPoint.x) * alpha,
      y: this.lastSmoothedPoint.y + (point.y - this.lastSmoothedPoint.y) * alpha,
    };
    this.lastSmoothedPoint = smoothed;
    return smoothed;
  }

  private indexStroke(stroke: Stroke): void {
    this.strokeIndex.set(stroke.id, stroke);
    if (!this.layerStrokeIndex.has(stroke.layerId)) {
      this.layerStrokeIndex.set(stroke.layerId, new Set());
    }
    this.layerStrokeIndex.get(stroke.layerId)!.add(stroke.id);
  }

  private indexFill(fill: FillRecord): void {
    this.fillIndex.set(fill.id, fill);
    if (!this.layerFillIndex.has(fill.layerId)) {
      this.layerFillIndex.set(fill.layerId, new Set());
    }
    this.layerFillIndex.get(fill.layerId)!.add(fill.id);
  }

  private duplicateLayerStrokes(sourceLayerId: string, targetLayerId: string): void {
    const strokeIds = this.layerStrokeIndex.get(sourceLayerId);
    if (!strokeIds) return;
    const activeIds = Array.from(strokeIds).filter((id) => this.activeStrokeIds.has(id));
    for (const strokeId of activeIds) {
      const stroke = this.strokeIndex.get(strokeId);
      if (!stroke) continue;
      const cloned: Stroke = {
        ...stroke,
        id: this.generateStrokeId(),
        layerId: targetLayerId,
        points: stroke.points.map((point) => ({ ...point })),
        brushConfig: {
          ...stroke.brushConfig,
          color: { ...stroke.brushConfig.color },
        },
        timestamp: Date.now(),
      };
      this.skiaRenderer.replayStroke(cloned);
      this.indexStroke(cloned);
      this.activeStrokeIds.add(cloned.id);
    }
  }

  private duplicateLayerFills(sourceLayerId: string, targetLayerId: string): void {
    const fillIds = this.layerFillIndex.get(sourceLayerId);
    if (!fillIds) return;
    const activeIds = Array.from(fillIds).filter((id) => this.activeFillIds.has(id));
    for (const fillId of activeIds) {
      const fill = this.fillIndex.get(fillId);
      if (!fill) continue;
      const cloned: FillRecord = {
        id: this.generateFillId(),
        layerId: targetLayerId,
        width: fill.width,
        height: fill.height,
        pixels: new Uint8Array(fill.pixels),
        timestamp: Date.now(),
      };
      const added = this.skiaRenderer.addFillFromPixels(cloned.id, cloned.layerId, cloned.width, cloned.height, cloned.pixels, cloned.timestamp);
      if (!added) continue;
      this.indexFill(cloned);
      this.activeFillIds.add(cloned.id);
    }
  }

  private transferLayerStrokes(sourceLayerId: string, targetLayerId: string): void {
    const sourceStrokes = this.layerStrokeIndex.get(sourceLayerId);
    if (!sourceStrokes) return;
    if (!this.layerStrokeIndex.has(targetLayerId)) {
      this.layerStrokeIndex.set(targetLayerId, new Set());
    }
    const targetSet = this.layerStrokeIndex.get(targetLayerId)!;

    for (const strokeId of sourceStrokes) {
      const stroke = this.strokeIndex.get(strokeId);
      if (stroke) {
        stroke.layerId = targetLayerId;
      }
      targetSet.add(strokeId);
      if (this.activeStrokeIds.has(strokeId)) {
        this.skiaRenderer.updateStrokeLayer(strokeId, targetLayerId);
      }
    }

    this.layerStrokeIndex.delete(sourceLayerId);
  }

  private transferLayerFills(sourceLayerId: string, targetLayerId: string): void {
    const sourceFills = this.layerFillIndex.get(sourceLayerId);
    if (!sourceFills) return;
    if (!this.layerFillIndex.has(targetLayerId)) {
      this.layerFillIndex.set(targetLayerId, new Set());
    }
    const targetSet = this.layerFillIndex.get(targetLayerId)!;

    for (const fillId of sourceFills) {
      const fill = this.fillIndex.get(fillId);
      if (fill) {
        fill.layerId = targetLayerId;
      }
      targetSet.add(fillId);
      if (this.activeFillIds.has(fillId)) {
        this.skiaRenderer.updateFillLayer(fillId, targetLayerId);
      }
    }

    this.layerFillIndex.delete(sourceLayerId);
  }

  private applySoloLayer(layerId: string): void {
    const canvas = this.canvasState.getCanvas();
    this.savedLayerVisibility = new Map(canvas.layers.map((layer) => [layer.id, layer.visible]));
    for (const layer of canvas.layers) {
      const visible = layer.id === layerId;
      this.canvasState.setLayerVisibility(layer.id, visible);
      this.skiaRenderer.setLayerVisibility(layer.id, visible);
    }
  }

  private restoreLayerVisibility(): void {
    if (!this.savedLayerVisibility) return;
    for (const [layerId, visible] of this.savedLayerVisibility.entries()) {
      this.canvasState.setLayerVisibility(layerId, visible);
      this.skiaRenderer.setLayerVisibility(layerId, visible);
    }
    this.savedLayerVisibility = null;
  }

  private generateStrokeId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateFillId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private clearActiveLayer(): void {
    const layerId = this.canvasState.getCanvas().activeLayerId;
    if (!layerId) return;
    this.clearLayerById(layerId);
  }

  private clearLayerById(layerId: string): void {
    const strokeIds = this.layerStrokeIndex.get(layerId);
    const fillIds = this.layerFillIndex.get(layerId);
    if ((!strokeIds || strokeIds.size === 0) && (!fillIds || fillIds.size === 0)) return;

    const activeIds = strokeIds ? Array.from(strokeIds).filter((id) => this.activeStrokeIds.has(id)) : [];
    const activeFillIds = fillIds ? Array.from(fillIds).filter((id) => this.activeFillIds.has(id)) : [];
    if (activeIds.length === 0 && activeFillIds.length === 0) return;

    const strokes: Stroke[] = [];
    for (const strokeId of activeIds) {
      this.skiaRenderer.undoStroke(strokeId);
      this.activeStrokeIds.delete(strokeId);
      const stroke = this.strokeIndex.get(strokeId);
      if (stroke) {
        strokes.push(stroke);
      }
    }

    const fills: FillRecord[] = [];
    for (const fillId of activeFillIds) {
      this.skiaRenderer.removeFill(fillId);
      this.activeFillIds.delete(fillId);
      const fill = this.fillIndex.get(fillId);
      if (fill) {
        fills.push(fill);
      }
    }

    this.history.recordAction({
      actionType: 'layerClear',
      layerId,
      data: { layerId, strokeIds: activeIds, strokes, fillIds: activeFillIds, fills },
      inverseData: { layerId, strokeIds: activeIds, strokes, fillIds: activeFillIds, fills },
    });
  }

  private clearAllLayers(): void {
    const canvas = this.canvasState.getCanvas();
    const cleared: { layerId: string; strokeIds: string[]; strokes: Stroke[]; fillIds: string[]; fills: FillRecord[] }[] = [];

    for (const layer of canvas.layers) {
      const strokeIds = this.layerStrokeIndex.get(layer.id);
      const fillIds = this.layerFillIndex.get(layer.id);
      if ((!strokeIds || strokeIds.size === 0) && (!fillIds || fillIds.size === 0)) continue;
      const activeIds = strokeIds ? Array.from(strokeIds).filter((id) => this.activeStrokeIds.has(id)) : [];
      const activeFillIds = fillIds ? Array.from(fillIds).filter((id) => this.activeFillIds.has(id)) : [];
      if (activeIds.length === 0 && activeFillIds.length === 0) continue;

      const strokes: Stroke[] = [];
      for (const strokeId of activeIds) {
        this.skiaRenderer.undoStroke(strokeId);
        this.activeStrokeIds.delete(strokeId);
        const stroke = this.strokeIndex.get(strokeId);
        if (stroke) {
          strokes.push(stroke);
        }
      }

      const fills: FillRecord[] = [];
      for (const fillId of activeFillIds) {
        this.skiaRenderer.removeFill(fillId);
        this.activeFillIds.delete(fillId);
        const fill = this.fillIndex.get(fillId);
        if (fill) {
          fills.push(fill);
        }
      }

      cleared.push({ layerId: layer.id, strokeIds: activeIds, strokes, fillIds: activeFillIds, fills });
    }

    if (cleared.length === 0) return;
    this.history.recordAction({
      actionType: 'layerClear',
      layerId: 'canvas',
      data: { cleared },
      inverseData: { cleared },
    });
  }

  private applyQuickShape(stroke: Stroke): Stroke | null {
    const points = stroke.points;
    if (points.length < 6) return null;
    if (!this.detectHold(points)) return null;

    const linePoints = this.trySnapLine(points);
    if (linePoints) {
      return { ...stroke, points: linePoints };
    }

    const circlePoints = this.trySnapCircle(points);
    if (circlePoints) {
      return { ...stroke, points: circlePoints };
    }

    const rectPoints = this.trySnapRect(points);
    if (rectPoints) {
      return { ...stroke, points: rectPoints };
    }

    const trianglePoints = this.trySnapPolygon(points, 3);
    if (trianglePoints) {
      return { ...stroke, points: trianglePoints };
    }

    const quadPoints = this.trySnapPolygon(points, 4);
    if (quadPoints) {
      return { ...stroke, points: quadPoints };
    }

    return null;
  }

  private detectHold(points: InputPoint[]): boolean {
    const last = points[points.length - 1]!;
    const start = points[0]!;
    if (last.timestamp - start.timestamp < this.quickShapeHoldMs) {
      return false;
    }

    let tailIndex = points.length - 1;
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i]!;
      if (last.timestamp - p.timestamp > this.quickShapeHoldMs) {
        tailIndex = i;
        break;
      }
    }

    const tailPoint = points[tailIndex] ?? last;
    const dx = last.x - tailPoint.x;
    const dy = last.y - tailPoint.y;
    return Math.hypot(dx, dy) < 6;
  }

  private trySnapLine(points: InputPoint[]): InputPoint[] | null {
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 12) return null;

    const tolerance = Math.min(this.quickShapeLineTolerance, length * 0.08);
    const denom = dx * dx + dy * dy;
    let maxDistance = 0;

    for (const point of points) {
      const t = denom === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / denom;
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      const dist = Math.hypot(point.x - projX, point.y - projY);
      if (dist > maxDistance) {
        maxDistance = dist;
      }
      if (maxDistance > tolerance) {
        return null;
      }
    }

    const snappedEnd = this.snapLineAngle(start, end, length);
    return this.buildLinearPoints(start, snappedEnd, points);
  }

  private snapLineAngle(start: InputPoint, end: InputPoint, length: number): InputPoint {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const snapStep = Math.PI / 4;
    const snapped = Math.round(angle / snapStep) * snapStep;
    return {
      ...end,
      x: start.x + Math.cos(snapped) * length,
      y: start.y + Math.sin(snapped) * length,
    };
  }

  private trySnapCircle(points: InputPoint[]): InputPoint[] | null {
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const bbox = this.getBounds(points);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const size = Math.min(width, height);
    if (size < 16) return null;

    const closeDist = Math.hypot(end.x - start.x, end.y - start.y);
    if (closeDist > size * 0.3) return null;

    const ratio = width > 0 ? height / width : 0;
    if (ratio < 1 - this.quickShapeCircleTolerance || ratio > 1 + this.quickShapeCircleTolerance) {
      return null;
    }

    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    const radius = (width + height) / 4;
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);

    return this.buildCirclePoints(centerX, centerY, radius, startAngle, points);
  }

  private trySnapRect(points: InputPoint[]): InputPoint[] | null {
    const bbox = this.getBounds(points);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    if (width < 16 || height < 16) return null;

    const tolerance = Math.min(this.quickShapeRectTolerance, Math.min(width, height) * 0.2);
    let nearEdgeCount = 0;
    for (const point of points) {
      const distLeft = Math.abs(point.x - bbox.minX);
      const distRight = Math.abs(point.x - bbox.maxX);
      const distTop = Math.abs(point.y - bbox.minY);
      const distBottom = Math.abs(point.y - bbox.maxY);
      const edgeDist = Math.min(distLeft, distRight, distTop, distBottom);
      if (edgeDist <= tolerance) {
        nearEdgeCount++;
      }
    }

    if (nearEdgeCount / points.length < 0.85) return null;
    return this.buildRectPoints(bbox, points);
  }

  private trySnapPolygon(points: InputPoint[], cornerCount: number): InputPoint[] | null {
    if (points.length < cornerCount * 3) return null;
    const bbox = this.getBounds(points);
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const size = Math.min(width, height);
    if (size < 24) return null;

    const start = points[0]!;
    const end = points[points.length - 1]!;
    const closeDist = Math.hypot(end.x - start.x, end.y - start.y);
    if (closeDist > size * 0.35) return null;

    const vertices = this.detectPolygonVertices(points, cornerCount);
    if (!vertices) return null;
    return this.buildPolygonPoints(vertices, points);
  }

  private detectPolygonVertices(points: InputPoint[], cornerCount: number): Point2D[] | null {
    const corners: Point2D[] = [];
    const minSeparation = this.quickShapeCornerSeparation;
    let lastCornerIndex = 0;

    const pushCorner = (idx: number) => {
      const point = points[idx]!;
      const last = corners[corners.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < minSeparation) {
        return;
      }
      corners.push({ x: point.x, y: point.y });
      lastCornerIndex = idx;
    };

    pushCorner(0);
    for (let i = 2; i < points.length - 2; i++) {
      const prev = points[i - 1]!;
      const current = points[i]!;
      const next = points[i + 1]!;
      const v1x = current.x - prev.x;
      const v1y = current.y - prev.y;
      const v2x = next.x - current.x;
      const v2y = next.y - current.y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);
      if (len1 < 2 || len2 < 2) continue;

      const dot = (v1x / len1) * (v2x / len2) + (v1y / len1) * (v2y / len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > this.quickShapeCornerAngle && i - lastCornerIndex > 3) {
        pushCorner(i);
      }
    }
    pushCorner(points.length - 1);

    // Remove closing duplicate corner
    if (corners.length > 2) {
      const first = corners[0]!;
      const last = corners[corners.length - 1]!;
      if (Math.hypot(first.x - last.x, first.y - last.y) < minSeparation * 1.2) {
        corners.pop();
      }
    }

    if (corners.length !== cornerCount) return null;
    return corners;
  }

  private buildPolygonPoints(vertices: Point2D[], source: InputPoint[]): InputPoint[] {
    const template = this.averagePoint(source);
    const start = source[0]!;
    const end = source[source.length - 1]!;
    const duration = Math.max(0, end.timestamp - start.timestamp);
    const totalEdges = vertices.length;
    const segmentsPerEdge = Math.max(8, Math.min(64, Math.round(source.length / totalEdges)));
    const points: InputPoint[] = [];
    let segmentIndex = 0;

    for (let i = 0; i < totalEdges; i++) {
      const a = vertices[i]!;
      const b = vertices[(i + 1) % totalEdges]!;
      for (let s = 0; s < segmentsPerEdge; s++) {
        const t = segmentsPerEdge === 1 ? 1 : s / segmentsPerEdge;
        const timestamp = start.timestamp + duration * (segmentIndex / (segmentsPerEdge * totalEdges));
        points.push({
          ...template,
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          timestamp,
        });
        segmentIndex++;
      }
    }

    // Close shape
    points.push({
      ...template,
      x: vertices[0]!.x,
      y: vertices[0]!.y,
      timestamp: start.timestamp + duration,
    });

    return points;
  }

  private getBounds(points: InputPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY };
  }

  private buildLinearPoints(start: InputPoint, end: InputPoint, source: InputPoint[]): InputPoint[] {
    const segments = Math.max(8, Math.min(64, source.length));
    const duration = Math.max(0, end.timestamp - start.timestamp);
    const template = this.averagePoint(source);
    const points: InputPoint[] = [];
    for (let i = 0; i < segments; i++) {
      const t = segments === 1 ? 1 : i / (segments - 1);
      points.push({
        ...template,
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        timestamp: start.timestamp + duration * t,
      });
    }
    return points;
  }

  private buildCirclePoints(centerX: number, centerY: number, radius: number, startAngle: number, source: InputPoint[]): InputPoint[] {
    const segments = 64;
    const duration = source[source.length - 1]!.timestamp - source[0]!.timestamp;
    const template = this.averagePoint(source);
    const points: InputPoint[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * Math.PI * 2;
      points.push({
        ...template,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        timestamp: source[0]!.timestamp + duration * t,
      });
    }
    return points;
  }

  private buildRectPoints(bbox: { minX: number; maxX: number; minY: number; maxY: number }, source: InputPoint[]): InputPoint[] {
    const template = this.averagePoint(source);
    const start = source[0]!;
    const end = source[source.length - 1]!;
    const duration = Math.max(0, end.timestamp - start.timestamp);
    const corners = [
      { x: bbox.minX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.minY },
      { x: bbox.maxX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.maxY },
      { x: bbox.minX, y: bbox.minY },
    ];
    const totalSegments = corners.length - 1;
    const points: InputPoint[] = [];
    for (let i = 0; i < corners.length; i++) {
      const t = totalSegments === 0 ? 0 : i / totalSegments;
      points.push({
        ...template,
        x: corners[i]!.x,
        y: corners[i]!.y,
        timestamp: start.timestamp + duration * t,
      });
    }
    return points;
  }

  private averagePoint(points: InputPoint[]): InputPoint {
    let pressureSum = 0;
    let tiltXSum = 0;
    let tiltYSum = 0;
    for (const p of points) {
      pressureSum += p.pressure;
      tiltXSum += p.tiltX;
      tiltYSum += p.tiltY;
    }
    const base = points[0]!;
    const count = points.length;
    return {
      ...base,
      pressure: pressureSum / count,
      tiltX: tiltXSum / count,
      tiltY: tiltYSum / count,
    };
  }

  private updateViewSize(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const width = canvas.width || canvas.clientWidth;
    const height = canvas.height || canvas.clientHeight;
    this.viewTransformer.init(width, height);
  }

  private syncViewTransform(): void {
    const zoom = this.viewTransformer.getZoom();
    const pan = this.viewTransformer.getPan();
    const rotation = this.viewTransformer.getRotation();
    this.canvasState.setZoom(zoom);
    this.canvasState.setPan(pan);
    this.canvasState.setRotation(rotation);
    this.skiaRenderer.setViewTransform(zoom, pan, rotation);
    eventBus.emit(Events.VIEW_TRANSFORM_CHANGED, { zoom, pan, rotation });
    this.saveViewSettings();
  }

  private rotateViewBy(deltaDegrees: number): void {
    this.viewTransformer.applyRotation(deltaDegrees);
    if (this.rotationSnap) {
      const snapped = Math.round(this.viewTransformer.getRotation() / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES;
      this.viewTransformer.setRotation(snapped);
    }
    this.syncViewTransform();
  }

  private mapInputPoint(point: InputPoint): InputPoint {
    const mapped = this.viewTransformer.screenToCanvas(point.x, point.y);
    if (this.gridSnap && this.gridSpacing > 0) {
      return {
        ...point,
        x: Math.round(mapped.x / this.gridSpacing) * this.gridSpacing,
        y: Math.round(mapped.y / this.gridSpacing) * this.gridSpacing,
      };
    }
    return { ...point, x: mapped.x, y: mapped.y };
  }

  private isPointInLayerMask(layerId: string, point: InputPoint): boolean {
    const strokeIds = this.layerStrokeIndex.get(layerId);
    const fillIds = this.layerFillIndex.get(layerId);
    const hasStrokes = strokeIds && strokeIds.size > 0;
    const hasFills = fillIds && fillIds.size > 0;
    if (!hasStrokes && !hasFills) return false;

    if (hasFills) {
      for (const fillId of fillIds!) {
        if (!this.activeFillIds.has(fillId)) continue;
        const fill = this.fillIndex.get(fillId);
        if (!fill) continue;
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        if (x < 0 || y < 0 || x >= fill.width || y >= fill.height) continue;
        const idx = (y * fill.width + x) * 4 + 3;
        if ((fill.pixels[idx] ?? 0) > 0) {
          return true;
        }
      }
    }

    if (hasStrokes) {
      for (const strokeId of strokeIds!) {
        if (!this.activeStrokeIds.has(strokeId)) continue;
        const stroke = this.strokeIndex.get(strokeId);
        if (!stroke) continue;
        const baseSize = stroke.brushConfig?.baseSize ?? this.currentSize;
        const radius = Math.max(2, baseSize * 0.5);
        const radiusSq = radius * radius;
        const points = stroke.points;
        const step = Math.max(1, Math.floor(points.length / 32));
        for (let i = 0; i < points.length; i += step) {
          const p = points[i]!;
          const dx = point.x - p.x;
          const dy = point.y - p.y;
          if (dx * dx + dy * dy <= radiusSq) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private toCanvasPoint(point: Point2D): Point2D {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
    if (!canvas) return point;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (point.x - rect.left) * dpr,
      y: (point.y - rect.top) * dpr,
    };
  }

  private toCanvasDelta(delta: Point2D): Point2D {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: delta.x * dpr,
      y: delta.y * dpr,
    };
  }

  private mountUI(): void {
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) {
      mountUI(uiRoot);
    }
  }

  getCanvasState(): CanvasState {
    return this.canvasState;
  }

  getSkiaRenderer(): SkiaRenderer {
    return this.skiaRenderer;
  }

  getInputSampler(): InputSampler {
    return this.inputSampler;
  }

  getHistory(): HistoryStack {
    return this.history;
  }

  clear(): void {
    this.skiaRenderer.clear();
  }
}

const app = new OpenCanvasApp();

// Expose app to window for UI access
(window as any).app = app;

// gallery-first mode: import gallery-app which handles view switching
// the canvas app will be initialized when a project is opened
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { initGalleryApp } = await import('./gallery-app');
    await initGalleryApp();
  } catch (error) {
    console.error('OpenCanvas initialization failed:', error);
    // fallback to direct canvas mode
    app.init().catch((err: unknown) => {
      console.error('Fallback initialization failed:', err);
    });
  }
});

export { app };
