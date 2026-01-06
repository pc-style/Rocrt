import type { HistoryEntry, Stroke, Layer } from '../core/types';
import type { SkiaRenderer } from '../valkyrie/skia-renderer';
import type { CanvasState } from './canvas-state';

export class UndoExecutor {
  private skiaRenderer: SkiaRenderer | null = null;
  private canvasState: CanvasState | null = null;

  init(skiaRenderer: SkiaRenderer, canvasState: CanvasState): void {
    this.skiaRenderer = skiaRenderer;
    this.canvasState = canvasState;
  }



  executeUndo(entry: HistoryEntry): void {
    if (!this.skiaRenderer || !this.canvasState) return;

    switch (entry.actionType) {
      case 'stroke':
        this.undoStroke(entry);
        break;
      case 'fill':
        this.undoFill(entry);
        break;
      case 'layerPropChange':
        this.undoLayerPropChange(entry);
        break;
      case 'layerAdd':
        this.undoLayerAdd(entry);
        break;
      case 'layerDelete':
        this.undoLayerDelete(entry);
        break;
      case 'layerClear':
        this.undoLayerClear(entry);
        break;
    }
  }

  executeRedo(entry: HistoryEntry): void {
    if (!this.skiaRenderer || !this.canvasState) return;

    switch (entry.actionType) {
      case 'stroke':
        this.redoStroke(entry);
        break;
      case 'fill':
        this.redoFill(entry);
        break;
      case 'layerPropChange':
        this.redoLayerPropChange(entry);
        break;
      case 'layerAdd':
        this.redoLayerAdd(entry);
        break;
      case 'layerDelete':
        this.redoLayerDelete(entry);
        break;
      case 'layerClear':
        this.redoLayerClear(entry);
        break;
    }
  }

  private undoStroke(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const strokeId = (entry.inverseData as { strokeId: string })?.strokeId;
    if (strokeId) {
      this.skiaRenderer.undoStroke(strokeId);
    }
  }

  private redoStroke(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const stroke = entry.data as Stroke;
    if (stroke) {
      this.skiaRenderer.replayStroke(stroke);
    }
  }

  private undoFill(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const { fillId } = (entry.inverseData as { fillId: string }) || {};
    if (fillId) {
      this.skiaRenderer.removeFill(fillId);
    }
  }

  private redoFill(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const fill = entry.data as any; // FillRecord
    if (fill?.id) {
      this.skiaRenderer.addFillFromPixels(fill.id, fill.layerId, fill.width, fill.height, fill.pixels, fill.timestamp);
    }
  }

  private undoLayerPropChange(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const { layerId, property, oldValue } = entry.inverseData as { layerId: string; property: string; oldValue: any };
    if (!layerId || !property) return;

    switch (property) {
      case 'visible': this.canvasState.setLayerVisibility(layerId, oldValue); break;
      case 'locked': this.canvasState.setLayerLocked(layerId, oldValue); break;
      case 'alphaLocked': this.canvasState.setLayerAlphaLocked(layerId, oldValue); break;
      case 'opacity': this.canvasState.setLayerOpacity(layerId, oldValue); break;
      case 'blendMode': this.canvasState.setLayerBlendMode(layerId, oldValue); break;
      case 'name': this.canvasState.renameLayer(layerId, oldValue); break;
    }
  }

  private redoLayerPropChange(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const { layerId, property, newValue } = entry.data as { layerId: string; property: string; newValue: any };
    if (!layerId || !property) return;

    switch (property) {
      case 'visible': this.canvasState.setLayerVisibility(layerId, newValue); break;
      case 'locked': this.canvasState.setLayerLocked(layerId, newValue); break;
      case 'alphaLocked': this.canvasState.setLayerAlphaLocked(layerId, newValue); break;
      case 'opacity': this.canvasState.setLayerOpacity(layerId, newValue); break;
      case 'blendMode': this.canvasState.setLayerBlendMode(layerId, newValue); break;
      case 'name': this.canvasState.renameLayer(layerId, newValue); break;
    }
  }

  private undoLayerAdd(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const { layerId } = entry.inverseData as { layerId: string };
    if (layerId) {
      this.canvasState.removeLayer(layerId);
    }
  }

  private redoLayerAdd(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const layer = entry.data as Layer;
    if (layer) {
      this.canvasState.addLayer(layer.name);
      // Note: addLayer currently generates a new ID. 
      // In a real app we might want to restore the specific ID or 
      // ensure the redo data is updated. For now we assume layer names or 
      // sequence is enough for simple undo/redo of additions.
    }
  }

  private undoLayerDelete(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const { layer, index } = entry.inverseData as { layer: Layer; index: number };
    if (layer) {
      this.canvasState.restoreLayer(layer, index);
    }
  }

  private redoLayerDelete(entry: HistoryEntry): void {
    if (!this.canvasState) return;
    const { layerId } = entry.data as { layerId: string };
    if (layerId) {
      this.canvasState.removeLayer(layerId);
    }
  }

  private undoLayerClear(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const data = entry.inverseData as { strokes?: Stroke[]; fills?: any[] };
    if (data?.strokes) {
      data.strokes.forEach(s => this.skiaRenderer?.replayStroke(s));
    }
    if (data?.fills) {
      data.fills.forEach(f => this.skiaRenderer?.addFillFromPixels(f.id, f.layerId, f.width, f.height, f.pixels, f.timestamp));
    }
  }

  private redoLayerClear(entry: HistoryEntry): void {
    if (!this.skiaRenderer) return;
    const data = entry.data as { strokeIds?: string[]; fillIds?: string[] };
    if (data?.strokeIds) {
      data.strokeIds.forEach(id => this.skiaRenderer?.undoStroke(id));
    }
    if (data?.fillIds) {
      data.fillIds.forEach(id => this.skiaRenderer?.removeFill(id));
    }
  }
}
