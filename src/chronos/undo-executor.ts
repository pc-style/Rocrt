import type { HistoryEntry, Stroke } from '../core/types';
import type { TileManager } from '../valkyrie/tile-manager';
import type { Rasterizer } from '../alchemy/rasterizer';
import { BrushEngine } from '../alchemy/brush-engine';

export class UndoExecutor {
  private tileManager: TileManager | null = null;
  private rasterizer: Rasterizer | null = null;

  init(tileManager: TileManager, rasterizer: Rasterizer): void {
    this.tileManager = tileManager;
    this.rasterizer = rasterizer;
  }

  executeUndo(entry: HistoryEntry): void {
    if (!this.tileManager) return;

    switch (entry.actionType) {
      case 'stroke':
        this.undoStroke(entry);
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
    }
  }

  executeRedo(entry: HistoryEntry): void {
    if (!this.tileManager || !this.rasterizer) return;

    switch (entry.actionType) {
      case 'stroke':
        this.redoStroke(entry);
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
    }
  }

  private undoStroke(entry: HistoryEntry): void {
    if (!this.tileManager) return;

    const inverseData = entry.inverseData as { affectedTiles: string[] };
    if (!inverseData?.affectedTiles) return;

    for (const tileId of inverseData.affectedTiles) {
      const [gridXStr, gridYStr] = tileId.split(',');
      const gridX = parseInt(gridXStr ?? '0', 10);
      const gridY = parseInt(gridYStr ?? '0', 10);
      this.tileManager.clearTile(gridX, gridY);
    }
  }

  private redoStroke(entry: HistoryEntry): void {
    if (!this.rasterizer) return;

    const stroke = (entry.data as { stroke?: Stroke })?.stroke ?? entry.data as Stroke;
    if (!stroke?.points || !stroke?.brushConfig) return;

    const tempBrush = new BrushEngine();
    tempBrush.setBrush(stroke.brushConfig);
    
    const stamps = tempBrush.plotStroke(stroke.points);
    this.rasterizer.rasterizeStamps(stamps);
  }

  private undoLayerPropChange(entry: HistoryEntry): void {
    // Layer property changes are handled by CanvasState
    // This method is a placeholder for future implementation
    console.log('Undo layer prop change:', entry.inverseData);
  }

  private redoLayerPropChange(entry: HistoryEntry): void {
    console.log('Redo layer prop change:', entry.data);
  }

  private undoLayerAdd(entry: HistoryEntry): void {
    console.log('Undo layer add:', entry.inverseData);
  }

  private redoLayerAdd(entry: HistoryEntry): void {
    console.log('Redo layer add:', entry.data);
  }

  private undoLayerDelete(entry: HistoryEntry): void {
    console.log('Undo layer delete:', entry.inverseData);
  }

  private redoLayerDelete(entry: HistoryEntry): void {
    console.log('Redo layer delete:', entry.data);
  }
}
