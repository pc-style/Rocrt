import { render, h } from 'preact';
import { Gallery, ProjectMeta } from './luma/gallery';
import { IndexedDBStore, StoredProject } from './chronos/indexed-db-store';
import { eventBus } from './core/events';
import { CANVAS_DEFAULTS } from './core/config';
import { BlendMode } from './core/types';
import type { Canvas, Layer } from './core/types';

// this module handles the gallery-first app flow
// it manages view switching between gallery and canvas

function generateId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createDefaultCanvas(width: number, height: number): Canvas {
  const now = Date.now();
  const layer: Layer = {
    id: `layer-${now}`,
    name: 'Layer 1',
    visible: true,
    locked: false,
    alphaLocked: false,
    opacity: 1,
    blendMode: BlendMode.Normal,
    zIndex: 0,
    tileData: new Map(),
    createdAt: now,
  };

  return {
    id: generateId(),
    width,
    height,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
    rotationAngle: 0,
    backgroundColor: { ...CANVAS_DEFAULTS.backgroundColor },
    layers: [layer],
    activeLayerId: layer.id,
    referenceLayerId: null,
    createdAt: now,
    modifiedAt: now,
  };
}

class GalleryApp {
  private store: IndexedDBStore;
  private projects: ProjectMeta[] = [];
  private galleryRoot: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private canvasInitialized = false;

  constructor() {
    this.store = new IndexedDBStore();
  }

  async init(): Promise<void> {
    await this.store.init();
    this.galleryRoot = document.getElementById('gallery-root');
    this.canvasContainer = document.getElementById('canvas-container');

    await this.refreshProjects();
    this.renderGallery();
    this.showGallery();

    // listen for navigation back to gallery
    eventBus.on('app:navigate-gallery', () => {
      this.showGallery();
    });
  }

  private async refreshProjects(): Promise<void> {
    try {
      const stored = await this.store.listProjects();
      this.projects = stored.map((p) => ({
        id: p.id,
        name: p.name,
        width: p.canvas.width,
        height: p.canvas.height,
        thumbnail: p.thumbnail ?? null,
        createdAt: p.createdAt,
        modifiedAt: p.modifiedAt,
        layerCount: p.canvas.layers.length,
      }));
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }

  private renderGallery(): void {
    if (!this.galleryRoot) return;

    const element = h(Gallery, {
      projects: this.projects,
      onOpenProject: (id: string) => this.openProject(id),
      onCreateProject: (w: number, h: number, name?: string) => this.createProject(w, h, name),
      onDeleteProject: (id: string) => this.deleteProject(id),
      onDuplicateProject: (id: string) => this.duplicateProject(id),
      onRenameProject: (id: string, name: string) => this.renameProject(id, name),
      onImportProject: (data: unknown) => this.importProject(data),
    });

    render(element, this.galleryRoot);
  }

  private showGallery(): void {
    this.galleryRoot?.classList.remove('hidden');
    this.canvasContainer?.classList.add('hidden');
  }

  private showCanvas(): void {
    this.galleryRoot?.classList.add('hidden');
    this.canvasContainer?.classList.remove('hidden');
  }

  private async openProject(id: string): Promise<void> {
    this.showCanvas();

    // if canvas app isn't initialized, do so now
    if (!this.canvasInitialized) {
      await this.initializeCanvasApp();
    }

    // load project into canvas
    const project = await this.store.loadProject(id);
    if (project) {
      eventBus.emit('project:load', project);
    }
  }

  private async initializeCanvasApp(): Promise<void> {
    // dynamically import and init the canvas app
    const { app } = await import('./main');
    await app.init();
    this.canvasInitialized = true;
  }

  private async createProject(width: number, height: number, name?: string): Promise<void> {
    const projectName = name || `Canvas ${this.projects.length + 1}`;
    const canvas = createDefaultCanvas(width, height);
    const project: StoredProject = {
      id: canvas.id,
      name: projectName,
      canvas,
      createdAt: canvas.createdAt,
      modifiedAt: canvas.modifiedAt,
    };
    await this.store.saveProject(project);
    await this.refreshProjects();
    this.renderGallery();
    await this.openProject(project.id);
  }

  private async deleteProject(id: string): Promise<void> {
    await this.store.deleteProject(id);
    await this.refreshProjects();
    this.renderGallery();
  }

  private async duplicateProject(id: string): Promise<void> {
    const original = await this.store.loadProject(id);
    if (!original) return;

    const now = Date.now();
    const newCanvas = { ...original.canvas, id: generateId(), createdAt: now, modifiedAt: now };
    const newProject: StoredProject = {
      id: newCanvas.id,
      name: `${original.name} Copy`,
      canvas: newCanvas,
      thumbnail: original.thumbnail,
      createdAt: now,
      modifiedAt: now,
    };
    await this.store.saveProject(newProject);
    await this.refreshProjects();
    this.renderGallery();
  }

  private async renameProject(id: string, name: string): Promise<void> {
    const project = await this.store.loadProject(id);
    if (!project) return;
    project.name = name;
    project.modifiedAt = Date.now();
    await this.store.saveProject(project);
    await this.refreshProjects();
    this.renderGallery();
  }

  private async importProject(data: unknown): Promise<void> {
    try {
      const parsed = data as { canvas?: Canvas; version?: number };
      if (!parsed.canvas) return;

      const now = Date.now();
      const canvas = {
        ...parsed.canvas,
        id: generateId(),
        modifiedAt: now,
      };
      const project: StoredProject = {
        id: canvas.id,
        name: `Imported ${new Date().toLocaleDateString()}`,
        canvas,
        createdAt: canvas.createdAt || now,
        modifiedAt: now,
      };
      await this.store.saveProject(project);
      await this.refreshProjects();
      this.renderGallery();
    } catch (err) {
      console.error('Failed to import:', err);
    }
  }
}

// only run if we're the main entry point
let galleryApp: GalleryApp | null = null;

export function initGalleryApp(): Promise<void> {
  galleryApp = new GalleryApp();
  return galleryApp.init();
}

export { galleryApp };
