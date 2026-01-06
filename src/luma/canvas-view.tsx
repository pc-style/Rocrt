import { useEffect, useRef, useState } from 'preact/hooks';
import { IndexedDBStore } from '../chronos/indexed-db-store';
import { eventBus, Events } from '../core/events';
import type { Color, Layer } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';

// procreate-style colors
const colors = {
  bg: '#1c1c1e',
  surface: 'rgba(44, 44, 46, 0.95)',
  surfaceLight: 'rgba(58, 58, 60, 0.95)',
  accent: '#0a84ff',
  text: '#ffffff',
  textSecondary: '#8e8e93',
};

interface CanvasViewProps {
  projectId: string | null;
  store: IndexedDBStore;
  onBack: () => void;
}

interface AppState {
  brushSize: number;
  brushColor: Color;
  brushOpacity: number;
  layers: Layer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  zoomLevel: number;
}

// minimal procreate-style toolbar at top
function TopBar({ onBack, canUndo, canRedo }: { onBack: () => void; canUndo: boolean; canRedo: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      background: 'linear-gradient(to bottom, rgba(28,28,30,0.95) 0%, rgba(28,28,30,0) 100%)',
      pointerEvents: 'none',
    }}>
      {/* left: gallery button */}
      <button
        onClick={onBack}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          border: 'none',
          background: colors.surface,
          color: colors.text,
          fontSize: '18px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Gallery"
      >
        ←
      </button>

      {/* center: tools */}
      <div style={{
        display: 'flex',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={() => eventBus.emit(Events.UNDO_REQUESTED, null)}
          disabled={!canUndo}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: 'none',
            background: canUndo ? colors.surface : 'rgba(44,44,46,0.5)',
            color: canUndo ? colors.text : colors.textSecondary,
            fontSize: '16px',
            cursor: canUndo ? 'pointer' : 'default',
          }}
          title="Undo"
        >
          ↩
        </button>
        <button
          onClick={() => eventBus.emit(Events.REDO_REQUESTED, null)}
          disabled={!canRedo}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: 'none',
            background: canRedo ? colors.surface : 'rgba(44,44,46,0.5)',
            color: canRedo ? colors.text : colors.textSecondary,
            fontSize: '16px',
            cursor: canRedo ? 'pointer' : 'default',
          }}
          title="Redo"
        >
          ↪
        </button>
      </div>

      {/* right: actions */}
      <div style={{
        display: 'flex',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <button
          onClick={() => eventBus.emit(Events.CANVAS_EXPORT_REQUESTED, null)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: 'none',
            background: colors.surface,
            color: colors.text,
            fontSize: '14px',
            cursor: 'pointer',
          }}
          title="Export"
        >
          ⤓
        </button>
      </div>
    </div>
  );
}

// left side: brush size slider (vertical)
function BrushSizeSlider({ size }: { size: number }) {
  const handleChange = (e: Event) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    eventBus.emit(Events.BRUSH_SIZE_CHANGED, value);
  };

  return (
    <div style={{
      position: 'absolute',
      left: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: colors.surface,
        borderRadius: '20px',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ color: colors.text, fontSize: '11px', fontWeight: '500' }}>{size}</span>
        <input
          type="range"
          min={BRUSH_DEFAULTS.minSize}
          max={BRUSH_DEFAULTS.maxSize}
          value={size}
          onInput={handleChange}
          style={{
            width: '120px',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
        <div style={{
          width: Math.min(24, size),
          height: Math.min(24, size),
          borderRadius: '50%',
          background: colors.text,
          marginTop: '8px',
        }} />
      </div>
    </div>
  );
}

// right side: opacity slider (vertical)
function OpacitySlider({ opacity }: { opacity: number }) {
  const percent = Math.round(opacity * 100);

  const handleChange = (e: Event) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    eventBus.emit(Events.BRUSH_OPACITY_CHANGED, value / 100);
  };

  return (
    <div style={{
      position: 'absolute',
      right: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: colors.surface,
        borderRadius: '20px',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ color: colors.text, fontSize: '11px', fontWeight: '500' }}>{percent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onInput={handleChange}
          style={{
            width: '120px',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
      </div>
    </div>
  );
}

// bottom: color swatch + layers button
function BottomBar({ color, onLayersToggle, layersVisible }: {
  color: Color;
  onLayersToggle: () => void;
  layersVisible: boolean;
}) {
  const colorHex = `#${color.r.toString(16).padStart(2,'0')}${color.g.toString(16).padStart(2,'0')}${color.b.toString(16).padStart(2,'0')}`;

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      pointerEvents: 'auto',
    }}>
      {/* color picker */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '24px',
        background: colorHex,
        border: '3px solid rgba(255,255,255,0.3)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <input
          type="color"
          value={colorHex}
          onInput={(e) => {
            const hex = (e.target as HTMLInputElement).value.replace('#', '');
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            eventBus.emit(Events.BRUSH_COLOR_CHANGED, { r, g, b, a: 255 });
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </div>

      {/* layers button */}
      <button
        onClick={onLayersToggle}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          border: 'none',
          background: layersVisible ? colors.accent : colors.surface,
          color: colors.text,
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
        title="Layers"
      >
        ☰
      </button>
    </div>
  );
}

// layers panel (slides in from right)
function LayersPanel({ layers, activeLayerId }: {
  layers: Layer[];
  activeLayerId: string;
}) {
  return (
    <div style={{
      position: 'absolute',
      right: '60px',
      bottom: '80px',
      width: '220px',
      maxHeight: '400px',
      background: colors.surface,
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      pointerEvents: 'auto',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: colors.text, fontSize: '15px', fontWeight: '600' }}>Layers</span>
        <button
          onClick={() => eventBus.emit(Events.LAYER_ADDED, null)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '14px',
            border: 'none',
            background: colors.accent,
            color: '#fff',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => eventBus.emit(Events.LAYER_SELECTED, layer.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: layer.id === activeLayerId ? 'rgba(10,132,255,0.3)' : 'transparent',
              cursor: 'pointer',
              marginBottom: '4px',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_VISIBILITY_TOGGLED, { layerId: layer.id, visible: !layer.visible });
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '12px',
                border: 'none',
                background: layer.visible ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                color: layer.visible ? colors.text : colors.textSecondary,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {layer.visible ? '●' : '○'}
            </button>
            <span style={{
              flex: 1,
              color: layer.visible ? colors.text : colors.textSecondary,
              fontSize: '14px',
            }}>
              {layer.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CanvasView({ projectId, store, onBack }: CanvasViewProps) {
  const [state, setState] = useState<AppState>({
    brushSize: BRUSH_DEFAULTS.baseSize,
    brushColor: { ...BRUSH_DEFAULTS.color },
    brushOpacity: BRUSH_DEFAULTS.color.a / 255,
    layers: [],
    activeLayerId: '',
    canUndo: false,
    canRedo: false,
    zoomLevel: 1,
  });
  const [showLayers, setShowLayers] = useState(false);
  const canvasInitialized = useRef(false);

  // load project and init canvas system
  useEffect(() => {
    if (!projectId || canvasInitialized.current) return;

    // the canvas is already in the DOM (from index.html)
    // we just need to trigger the app initialization
    // for now, emit an event to signal canvas should be initialized
    canvasInitialized.current = true;

    // load project data
    store.loadProject(projectId).then((project) => {
      if (project) {
        setState((s) => ({
          ...s,
          layers: project.canvas.layers,
          activeLayerId: project.canvas.activeLayerId,
        }));
        // emit event to load this project into the canvas system
        eventBus.emit('project:load', project);
      }
    });
  }, [projectId, store]);

  // subscribe to events
  useEffect(() => {
    const subs = [
      eventBus.on(Events.BRUSH_SIZE_CHANGED, (size: number) => {
        setState((s) => ({ ...s, brushSize: size }));
      }),
      eventBus.on(Events.BRUSH_COLOR_CHANGED, (color: Color) => {
        setState((s) => ({ ...s, brushColor: color }));
      }),
      eventBus.on(Events.BRUSH_OPACITY_CHANGED, (opacity: number) => {
        setState((s) => ({ ...s, brushOpacity: opacity }));
      }),
      eventBus.on(Events.HISTORY_STATE_CHANGED, (data: { canUndo: boolean; canRedo: boolean }) => {
        setState((s) => ({ ...s, canUndo: data.canUndo, canRedo: data.canRedo }));
      }),
      eventBus.on('layers:updated', (data: { layers: Layer[]; activeLayerId: string }) => {
        setState((s) => ({ ...s, layers: data.layers, activeLayerId: data.activeLayerId }));
      }),
    ];

    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }}>
      <TopBar onBack={onBack} canUndo={state.canUndo} canRedo={state.canRedo} />
      <BrushSizeSlider size={state.brushSize} />
      <OpacitySlider opacity={state.brushOpacity} />
      <BottomBar
        color={state.brushColor}
        onLayersToggle={() => setShowLayers(!showLayers)}
        layersVisible={showLayers}
      />
      {showLayers && (
        <LayersPanel
          layers={state.layers}
          activeLayerId={state.activeLayerId}
        />
      )}
    </div>
  );
}
