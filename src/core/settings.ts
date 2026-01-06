import type { Color, Point2D } from './types';

export interface BrushSettings {
    size: number;
    color: Color;
    stabilization: number;
    selectedBrushId?: string;
}

export interface GridSettings {
    visible: boolean;
    spacing: number;
    color?: Color;
    snap?: boolean;
}

export interface ViewSettings {
    zoom: number;
    pan: Point2D;
    rotation: number;
}

export class SettingsManager {
    private readonly brushStorageKey = 'opencanvas:brush-settings';
    private readonly viewStorageKey = 'opencanvas:view-settings';
    private readonly readonlyStorageKey = 'opencanvas:readonly';
    private readonly backgroundStorageKey = 'opencanvas:background-color';
    private readonly gridStorageKey = 'opencanvas:grid-settings';

    constructor() { }

    saveBrushSettings(settings: BrushSettings): void {
        this.save(this.brushStorageKey, settings);
    }

    loadBrushSettings(): BrushSettings | null {
        return this.load<BrushSettings>(this.brushStorageKey);
    }

    saveGridSettings(settings: GridSettings): void {
        this.save(this.gridStorageKey, settings);
    }

    loadGridSettings(): GridSettings | null {
        return this.load<GridSettings>(this.gridStorageKey);
    }

    saveViewSettings(settings: ViewSettings): void {
        this.save(this.viewStorageKey, settings);
    }

    loadViewSettings(): ViewSettings | null {
        return this.load<ViewSettings>(this.viewStorageKey);
    }

    saveBackgroundColor(color: Color): void {
        this.save(this.backgroundStorageKey, color);
    }

    loadBackgroundColor(): Color | null {
        return this.load<Color>(this.backgroundStorageKey);
    }

    saveReadOnlyState(isReadOnly: boolean): void {
        this.save(this.readonlyStorageKey, isReadOnly);
    }

    loadReadOnlyState(): boolean | null {
        return this.load<boolean>(this.readonlyStorageKey);
    }

    private save<T>(key: string, data: T): void {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn(`Failed to save settings for key ${key}`, error);
        }
    }

    private load<T>(key: string): T | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw) as T;
        } catch (error) {
            console.warn(`Failed to load settings for key ${key}`, error);
            return null;
        }
    }
}
