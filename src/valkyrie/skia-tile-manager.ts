import type { CanvasKit, Image as SkImage } from 'canvaskit-wasm';
import { TILE_SIZE } from '../core/config';

export interface SkiaTile {
    id: string;
    gridX: number;
    gridY: number;
    image: SkImage | null;
    dirty: boolean;
}

export class SkiaTileManager {
    private ck: CanvasKit;
    private tiles: Map<string, SkiaTile> = new Map();

    constructor(ck: CanvasKit) {
        this.ck = ck;
    }

    getTileId(gridX: number, gridY: number): string {
        return `${gridX},${gridY}`;
    }

    getTileFromCanvas(canvasX: number, canvasY: number) {
        const gridX = Math.floor(canvasX / TILE_SIZE);
        const gridY = Math.floor(canvasY / TILE_SIZE);
        const localX = canvasX - gridX * TILE_SIZE;
        const localY = canvasY - gridY * TILE_SIZE;
        return { gridX, gridY, localX, localY };
    }

    getTile(gridX: number, gridY: number): SkiaTile | null {
        return this.tiles.get(this.getTileId(gridX, gridY)) ?? null;
    }

    getOrCreateTile(gridX: number, gridY: number): SkiaTile {
        const id = this.getTileId(gridX, gridY);
        let tile = this.tiles.get(id);

        if (!tile) {
            tile = {
                id,
                gridX,
                gridY,
                image: null,
                dirty: false,
            };
            this.tiles.set(id, tile);
        }

        return tile;
    }

    /**
     * Bake a drawing command into a tile.
     */
    bakeIntoTile(gridX: number, gridY: number, drawFn: (canvas: any) => void): void {
        const tile = this.getOrCreateTile(gridX, gridY);

        // Create a temporary surface for the tile
        const surface = this.ck.MakeSurface(TILE_SIZE, TILE_SIZE);
        if (!surface) return;

        const canvas = surface.getCanvas();
        canvas.clear(this.ck.TRANSPARENT);

        const xOffset = -gridX * TILE_SIZE;
        const yOffset = -gridY * TILE_SIZE;

        // Draw existing content if any
        if (tile.image) {
            canvas.drawImage(tile.image, 0, 0, null);
        }

        // Apply drawing command in tile space
        canvas.save();
        canvas.translate(xOffset, yOffset);
        drawFn(canvas);
        canvas.restore();

        // Capture new content
        const oldImage = tile.image;
        tile.image = surface.makeImageSnapshot();

        // Cleanup
        if (oldImage) oldImage.delete();
        surface.delete();
        tile.dirty = true;
    }

    getTiles(): SkiaTile[] {
        return Array.from(this.tiles.values());
    }

    clear(): void {
        for (const tile of this.tiles.values()) {
            if (tile.image) {
                tile.image.delete();
            }
        }
        this.tiles.clear();
    }

    dispose(): void {
        this.clear();
    }
}
