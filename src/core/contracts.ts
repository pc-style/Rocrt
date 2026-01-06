import type {
  Point2D,
  Color,
  BlendMode,
  InputPoint,
  BrushConfig,
  StampPlot,
  GestureType,
  GestureData,
  HistoryEntry,
  Stroke,
} from './types';

export interface IValkyrieRenderer {
  initCanvas(width: number, height: number): void;
  setZoom(level: number): void;
  setPan(offset: Point2D): void;
  setRotation(angle: number): void;
  compositeLayer(layerId: string, opacity: number, blendMode: BlendMode): void;
  renderTile(tileId: string, pixelData: Float32Array): void;
  markTileDirty(tileId: string): void;
  requestFrame(): void;
  startRenderLoop(): void;
  stopRenderLoop(): void;
  getContext(): WebGL2RenderingContext | null;
}

export interface ISensoryInput {
  startSampling(): void;
  stopSampling(): void;
  onStrokeBegin(callback: (point: InputPoint) => void): void;
  onStrokeMove(callback: (point: InputPoint) => void): void;
  onStrokeEnd(callback: () => void): void;
  onGesture(type: GestureType, callback: (data: GestureData) => void): void;
}

export interface IAlchemyBrush {
  setBrush(config: Partial<BrushConfig>): void;
  getBrush(): BrushConfig;
  plotStroke(points: InputPoint[]): StampPlot[];
  previewBrush(size: number): ImageData | null;
}

export interface IChronosHistory {
  recordAction(action: Omit<HistoryEntry, 'id' | 'timestamp'>): void;
  undo(): HistoryEntry | null;
  redo(): HistoryEntry | null;
  canUndo(): boolean;
  canRedo(): boolean;
  createCheckpoint(): void;
  getUndoStackSize(): number;
  getRedoStackSize(): number;
}

export interface ILumaUI {
  render(): void;
  showLayerPanel(): void;
  hideLayerPanel(): void;
  updateBrushPreview(size: number): void;
  setActiveLayer(layerId: string): void;
}

export type {
  Point2D,
  Color,
  BlendMode,
  InputPoint,
  BrushConfig,
  StampPlot,
  GestureType,
  GestureData,
  HistoryEntry,
  Stroke,
};
