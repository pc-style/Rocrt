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

  private isValidTileId(tileId: string): boolean {
    const parts = tileId.split(',');
    if (parts.length !== 2) return false;
    const [x, y] = parts;
    return x !== undefined && y !== undefined && !isNaN(parseInt(x, 10)) && !isNaN(parseInt(y, 10));
  }

  private parseTileId(tileId: string): { gridX: number; gridY: number } | null {
    if (!this.isValidTileId(tileId)) {
      console.error(`Invalid tile ID format: "${tileId}"`);
      return null;
    }
    const [gridXStr, gridYStr] = tileId.split(',');
    return {
      gridX: parseInt(gridXStr!, 10),
      gridY: parseInt(gridYStr!, 10),
    };
  }

  private isValidLayerClearInverseData(data: unknown): data is { tiles: Array<{ id: string; data: Float32Array }> } {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    if (!Array.isArray(obj.tiles)) return false;
    return obj.tiles.every(
      (tile) =>
        tile &&
        typeof tile === 'object' &&
        typeof (tile as Record<string, unknown>).id === 'string' &&
        (tile as Record<string, unknown>).data instanceof Float32Array
    );
  }

  private isValidAffectedTilesData(data: unknown): data is { affectedTiles: string[] } {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return Array.isArray(obj.affectedTiles) && obj.affectedTiles.every((t) => typeof t === 'string');
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
      case 'layerClear':
        this.undoLayerClear(entry);
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
      case 'layerClear':
        this.redoLayerClear(entry);
        break;
    }
  }

  private undoStroke(entry: HistoryEntry): void {
    if (!this.tileManager) return;

    if (!this.isValidAffectedTilesData(entry.inverseData)) {
      console.error('Invalid inverseData for undoStroke:', entry.inverseData);
      return;
    }

    for (const tileId of entry.inverseData.affectedTiles) {
      const coords = this.parseTileId(tileId);
      if (!coords) continue;
      this.tileManager.clearTile(coords.gridX, coords.gridY);
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
    // TODO: Implement layer property change undo
    // This requires integration with CanvasState to restore layer properties
    // For now, this is a no-op - layer property changes cannot be undone
    console.warn('Layer property change undo not yet implemented:', entry.inverseData);
  }

  private redoLayerPropChange(entry: HistoryEntry): void {
    // TODO: Implement layer property change redo
    console.warn('Layer property change redo not yet implemented:', entry.data);
  }

  private undoLayerAdd(entry: HistoryEntry): void {
    // TODO: Implement layer add undo (remove the added layer)
    // This requires integration with CanvasState to remove the layer
    console.warn('Layer add undo not yet implemented:', entry.inverseData);
  }

  private redoLayerAdd(entry: HistoryEntry): void {
    // TODO: Implement layer add redo (re-add the layer)
    console.warn('Layer add redo not yet implemented:', entry.data);
  }

  private undoLayerDelete(entry: HistoryEntry): void {
    // TODO: Implement layer delete undo (restore the deleted layer)
    // This requires integration with CanvasState to restore the layer
    console.warn('Layer delete undo not yet implemented:', entry.inverseData);
  }

  private redoLayerDelete(entry: HistoryEntry): void {
    // TODO: Implement layer delete redo (delete the layer again)
    console.warn('Layer delete redo not yet implemented:', entry.data);
  }

  private undoLayerClear(entry: HistoryEntry): void {
    if (!this.tileManager) return;

    if (!this.isValidLayerClearInverseData(entry.inverseData)) {
      console.error('Invalid inverseData for undoLayerClear:', entry.inverseData);
      return;
    }

    for (const tileInfo of entry.inverseData.tiles) {
      const coords = this.parseTileId(tileInfo.id);
      if (!coords) continue;

      const tile = this.tileManager.getOrCreateTile(coords.gridX, coords.gridY);
      tile.pixelData.set(tileInfo.data);
      this.tileManager.markTileDirty(coords.gridX, coords.gridY);
    }
  }

  private redoLayerClear(entry: HistoryEntry): void {
    if (!this.tileManager) return;

    if (!this.isValidAffectedTilesData(entry.data)) {
      console.error('Invalid data for redoLayerClear:', entry.data);
      return;
    }

    for (const tileId of entry.data.affectedTiles) {
      const coords = this.parseTileId(tileId);
      if (!coords) continue;
      this.tileManager.clearTile(coords.gridX, coords.gridY);
    }
  }
}
