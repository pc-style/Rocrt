import type { StampPlot, Color } from '../core/types';
import { TILE_SIZE } from '../core/config';
import { drawCircle, drawLine } from '../valkyrie/pixel-buffer';
import type { TileManager } from '../valkyrie/tile-manager';

export interface LineSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  radius: number;
  color: Color;
}

export class Rasterizer {
  private tileManager: TileManager | null = null;
  private lastX: number = 0;
  private lastY: number = 0;
  private hasLastPoint: boolean = false;

  init(tileManager: TileManager): void {
    this.tileManager = tileManager;
  }

  resetStroke(): void {
    this.hasLastPoint = false;
  }

  rasterizeStamps(stamps: StampPlot[]): string[] {
    if (!this.tileManager || stamps.length === 0) return [];

    const affectedTileIds = new Set<string>();

    for (const stamp of stamps) {
      const { position, size, color } = stamp;
      const radius = size / 2;

      if (!this.hasLastPoint) {
        // First point - draw a circle
        const tileIds = this.rasterizeCircle(position.x, position.y, radius, color);
        tileIds.forEach((id) => affectedTileIds.add(id));
        this.lastX = position.x;
        this.lastY = position.y;
        this.hasLastPoint = true;
      } else {
        // Draw line from last point to current
        const tileIds = this.rasterizeLine(
          this.lastX, this.lastY,
          position.x, position.y,
          radius, color
        );
        tileIds.forEach((id) => affectedTileIds.add(id));
        this.lastX = position.x;
        this.lastY = position.y;
      }
    }

    return Array.from(affectedTileIds);
  }

  private rasterizeCircle(x: number, y: number, radius: number, color: Color): string[] {
    if (!this.tileManager) return [];

    const minGridX = Math.floor((x - radius) / TILE_SIZE);
    const maxGridX = Math.floor((x + radius) / TILE_SIZE);
    const minGridY = Math.floor((y - radius) / TILE_SIZE);
    const maxGridY = Math.floor((y + radius) / TILE_SIZE);

    const affectedTileIds: string[] = [];

    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        if (gridX < 0 || gridY < 0) continue;

        const tile = this.tileManager.getOrCreateTile(gridX, gridY);
        const localX = x - gridX * TILE_SIZE;
        const localY = y - gridY * TILE_SIZE;

        drawCircle(tile.pixelData, localX, localY, radius, color);
        tile.dirty = true;
        affectedTileIds.push(tile.id);
      }
    }

    return affectedTileIds;
  }

  private rasterizeLine(x0: number, y0: number, x1: number, y1: number, radius: number, color: Color): string[] {
    if (!this.tileManager) return [];

    const minX = Math.min(x0, x1) - radius;
    const maxX = Math.max(x0, x1) + radius;
    const minY = Math.min(y0, y1) - radius;
    const maxY = Math.max(y0, y1) + radius;

    const minGridX = Math.floor(minX / TILE_SIZE);
    const maxGridX = Math.floor(maxX / TILE_SIZE);
    const minGridY = Math.floor(minY / TILE_SIZE);
    const maxGridY = Math.floor(maxY / TILE_SIZE);

    const affectedTileIds: string[] = [];

    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        if (gridX < 0 || gridY < 0) continue;

        const tile = this.tileManager.getOrCreateTile(gridX, gridY);
        const offsetX = gridX * TILE_SIZE;
        const offsetY = gridY * TILE_SIZE;

        drawLine(
          tile.pixelData,
          x0 - offsetX, y0 - offsetY,
          x1 - offsetX, y1 - offsetY,
          radius, color
        );
        tile.dirty = true;
        affectedTileIds.push(tile.id);
      }
    }

    return affectedTileIds;
  }
}
