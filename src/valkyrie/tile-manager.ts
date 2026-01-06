import { TILE_SIZE } from '../core/config';

export interface Tile {
  id: string;
  gridX: number;
  gridY: number;
  pixelData: Float32Array;
  dirty: boolean;
  gpuTexture: WebGLTexture | null;
}

export class TileManager {
  private tiles: Map<string, Tile> = new Map();
  private gl: WebGL2RenderingContext | null = null;

  init(gl: WebGL2RenderingContext, _canvasWidth: number, _canvasHeight: number): void {
    this.gl = gl;
  }

  getTileId(gridX: number, gridY: number): string {
    return `${gridX},${gridY}`;
  }

  getTileFromCanvas(canvasX: number, canvasY: number): { gridX: number; gridY: number; localX: number; localY: number } {
    const gridX = Math.floor(canvasX / TILE_SIZE);
    const gridY = Math.floor(canvasY / TILE_SIZE);
    const localX = canvasX - gridX * TILE_SIZE;
    const localY = canvasY - gridY * TILE_SIZE;
    return { gridX, gridY, localX, localY };
  }

  getTile(gridX: number, gridY: number): Tile | null {
    return this.tiles.get(this.getTileId(gridX, gridY)) ?? null;
  }

  getOrCreateTile(gridX: number, gridY: number): Tile {
    const id = this.getTileId(gridX, gridY);
    let tile = this.tiles.get(id);

    if (!tile) {
      tile = {
        id,
        gridX,
        gridY,
        pixelData: new Float32Array(TILE_SIZE * TILE_SIZE * 4),
        dirty: true,
        gpuTexture: null,
      };
      this.tiles.set(id, tile);
    }

    return tile;
  }

  markTileDirty(gridX: number, gridY: number): void {
    const tile = this.tiles.get(this.getTileId(gridX, gridY));
    if (tile) {
      tile.dirty = true;
    }
  }

  getDirtyTiles(): Tile[] {
    return Array.from(this.tiles.values()).filter((tile) => tile.dirty);
  }

  uploadDirtyTiles(): void {
    if (!this.gl) return;

    const dirtyTiles = this.getDirtyTiles();
    for (const tile of dirtyTiles) {
      this.uploadTile(tile);
    }
  }

  private uploadTile(tile: Tile): void {
    if (!this.gl) return;

    if (!tile.gpuTexture) {
      tile.gpuTexture = this.gl.createTexture();
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, tile.gpuTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA32F,
      TILE_SIZE,
      TILE_SIZE,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      tile.pixelData
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    tile.dirty = false;
  }

  clearTile(gridX: number, gridY: number): void {
    const tile = this.tiles.get(this.getTileId(gridX, gridY));
    if (tile) {
      tile.pixelData.fill(0);
      tile.dirty = true;
    }
  }

  getAllocatedCount(): number {
    return this.tiles.size;
  }

  getAllTiles(): Tile[] {
    return Array.from(this.tiles.values());
  }

  dispose(): void {
    if (this.gl) {
      for (const tile of this.tiles.values()) {
        if (tile.gpuTexture) {
          this.gl.deleteTexture(tile.gpuTexture);
        }
      }
    }
    this.tiles.clear();
  }
}
