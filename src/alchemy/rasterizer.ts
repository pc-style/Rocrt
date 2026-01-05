import type { StampPlot } from '../core/types';
import { TILE_SIZE } from '../core/config';
import { drawCircle } from '../valkyrie/pixel-buffer';
import type { TileManager } from '../valkyrie/tile-manager';

export class Rasterizer {
  private tileManager: TileManager | null = null;

  init(tileManager: TileManager): void {
    this.tileManager = tileManager;
  }

  rasterizeStamps(stamps: StampPlot[]): string[] {
    if (!this.tileManager) return [];

    const affectedTileIds = new Set<string>();

    for (const stamp of stamps) {
      const tileIds = this.rasterizeStamp(stamp);
      tileIds.forEach((id) => affectedTileIds.add(id));
    }

    return Array.from(affectedTileIds);
  }

  private rasterizeStamp(stamp: StampPlot): string[] {
    if (!this.tileManager) return [];

    const { position, size, color } = stamp;
    const radius = size / 2;

    const minGridX = Math.floor((position.x - radius) / TILE_SIZE);
    const maxGridX = Math.floor((position.x + radius) / TILE_SIZE);
    const minGridY = Math.floor((position.y - radius) / TILE_SIZE);
    const maxGridY = Math.floor((position.y + radius) / TILE_SIZE);

    const affectedTileIds: string[] = [];

    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        if (gridX < 0 || gridY < 0) continue;

        const tile = this.tileManager.getOrCreateTile(gridX, gridY);
        
        const localX = position.x - gridX * TILE_SIZE;
        const localY = position.y - gridY * TILE_SIZE;

        drawCircle(tile.pixelData, localX, localY, radius, color);
        
        tile.dirty = true;
        affectedTileIds.push(tile.id);
      }
    }

    return affectedTileIds;
  }
}
