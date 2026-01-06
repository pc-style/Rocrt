import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Gallery, ProjectMeta } from './gallery';
import { CanvasView } from './canvas-view';
import { IndexedDBStore, StoredProject } from '../chronos/indexed-db-store';
import { eventBus } from '../core/events';
import { CANVAS_DEFAULTS } from '../core/config';
import { BlendMode } from '../core/types';
import type { Canvas, Layer } from '../core/types';

type AppView = 'gallery' | 'canvas';

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

export function App() {
  const [view, setView] = useState<AppView>('gallery');
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [store] = useState(() => new IndexedDBStore());
  const [storeReady, setStoreReady] = useState(false);

  // init store and load projects
  useEffect(() => {
    store.init().then(async () => {
      setStoreReady(true);
      await refreshProjects();
    });
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!storeReady) return;
    try {
      const stored = await store.listProjects();
      const metas: ProjectMeta[] = stored.map((p) => ({
        id: p.id,
        name: p.name,
        width: p.canvas.width,
        height: p.canvas.height,
        thumbnail: p.thumbnail ?? null,
        createdAt: p.createdAt,
        modifiedAt: p.modifiedAt,
        layerCount: p.canvas.layers.length,
      }));
      setProjects(metas);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [store, storeReady]);

  const handleCreateProject = useCallback(async (width: number, height: number, name?: string) => {
    const projectName = name || `Canvas ${projects.length + 1}`;
    const canvas = createDefaultCanvas(width, height);
    const project: StoredProject = {
      id: canvas.id,
      name: projectName,
      canvas,
      createdAt: canvas.createdAt,
      modifiedAt: canvas.modifiedAt,
    };
    await store.saveProject(project);
    await refreshProjects();
    setCurrentProjectId(project.id);
    setView('canvas');
  }, [store, projects.length, refreshProjects]);

  const handleOpenProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setView('canvas');
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    await store.deleteProject(id);
    await refreshProjects();
  }, [store, refreshProjects]);

  const handleDuplicateProject = useCallback(async (id: string) => {
    const original = await store.loadProject(id);
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
    await store.saveProject(newProject);
    await refreshProjects();
  }, [store, refreshProjects]);

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    const project = await store.loadProject(id);
    if (!project) return;
    project.name = name;
    project.modifiedAt = Date.now();
    await store.saveProject(project);
    await refreshProjects();
  }, [store, refreshProjects]);

  const handleImportProject = useCallback(async (data: unknown) => {
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
      await store.saveProject(project);
      await refreshProjects();
    } catch (err) {
      console.error('Failed to import:', err);
    }
  }, [store, refreshProjects]);

  const handleBackToGallery = useCallback(async () => {
    // save current project before going back
    if (currentProjectId) {
      eventBus.emit('checkpoint:requested', null);
    }
    setView('gallery');
    setCurrentProjectId(null);
    await refreshProjects();
  }, [currentProjectId, refreshProjects]);

  // listen for gallery navigation event
  useEffect(() => {
    const sub = eventBus.on('app:navigate-gallery', () => {
      handleBackToGallery();
    });
    return () => sub.unsubscribe();
  }, [handleBackToGallery]);

  if (!storeReady) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: '#1c1c1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  if (view === 'gallery') {
    return (
      <Gallery
        projects={projects}
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
        onRenameProject={handleRenameProject}
        onImportProject={handleImportProject}
      />
    );
  }

  return (
    <CanvasView
      projectId={currentProjectId}
      store={store}
      onBack={handleBackToGallery}
    />
  );
}

export function mountApp(container: HTMLElement) {
  render(<App />, container);
}
