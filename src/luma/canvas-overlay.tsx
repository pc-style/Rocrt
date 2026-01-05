import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { Layer, Color } from '../core/types';
import { BRUSH_DEFAULTS } from '../core/config';
import { eventBus, Events } from '../core/events';

interface AppState {
  brushSize: number;
  brushColor: Color;
  layers: Layer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
}

function Toolbar({ state, onUndo, onRedo }: { state: AppState; onUndo: () => void; onRedo: () => void }) {
  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      display: 'flex',
      gap: '8px',
      background: 'rgba(40, 40, 40, 0.9)',
      padding: '8px',
      borderRadius: '12px',
    }}>
      <button
        onClick={onUndo}
        disabled={!state.canUndo}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.canUndo ? '#4a4a4a' : '#2a2a2a',
          color: state.canUndo ? '#fff' : '#666',
          cursor: state.canUndo ? 'pointer' : 'not-allowed',
          fontSize: '18px',
        }}
        title="Undo"
      >
        ↩
      </button>
      <button
        onClick={onRedo}
        disabled={!state.canRedo}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.canRedo ? '#4a4a4a' : '#2a2a2a',
          color: state.canRedo ? '#fff' : '#666',
          cursor: state.canRedo ? 'pointer' : 'not-allowed',
          fontSize: '18px',
        }}
        title="Redo"
      >
        ↪
      </button>
    </div>
  );
}

function BrushControls({ size, color }: { size: number; color: Color }) {
  const handleSizeChange = (e: Event) => {
    const newSize = parseInt((e.target as HTMLInputElement).value, 10);
    eventBus.emit(Events.BRUSH_SIZE_CHANGED, newSize);
  };

  const handleColorChange = (e: Event) => {
    const hex = (e.target as HTMLInputElement).value;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      eventBus.emit(Events.BRUSH_COLOR_CHANGED, {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
        a: 255,
      });
    }
  };

  const colorHex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'rgba(40, 40, 40, 0.9)',
      padding: '12px',
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>Size</span>
        <input
          type="range"
          min={BRUSH_DEFAULTS.minSize}
          max={BRUSH_DEFAULTS.maxSize}
          value={size}
          onInput={handleSizeChange}
          style={{ width: '120px' }}
        />
        <span style={{ color: '#fff', fontSize: '12px', width: '40px' }}>{size}px</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>Color</span>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: colorHex,
          border: '2px solid #555',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <input
            type="color"
            value={colorHex}
            onInput={handleColorChange}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusIndicator() {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      background: 'rgba(40, 40, 40, 0.9)',
      padding: '8px 12px',
      borderRadius: '8px',
      color: '#6a6',
      fontSize: '12px',
    }}>
      ● Ready to draw
    </div>
  );
}

export function CanvasOverlay() {
  const [state, setState] = useState<AppState>({
    brushSize: BRUSH_DEFAULTS.baseSize,
    brushColor: { ...BRUSH_DEFAULTS.color },
    layers: [],
    activeLayerId: '',
    canUndo: false,
    canRedo: false,
  });

  useEffect(() => {
    const sizeSub = eventBus.on(Events.BRUSH_SIZE_CHANGED, (size: number) => {
      setState((s) => ({ ...s, brushSize: size }));
    });

    const colorSub = eventBus.on(Events.BRUSH_COLOR_CHANGED, (color: Color) => {
      setState((s) => ({ ...s, brushColor: color }));
    });

    return () => {
      sizeSub.unsubscribe();
      colorSub.unsubscribe();
    };
  }, []);

  const handleUndo = () => eventBus.emit(Events.UNDO_REQUESTED, null);
  const handleRedo = () => eventBus.emit(Events.REDO_REQUESTED, null);

  return (
    <div class="canvas-overlay" style={{ width: '100%', height: '100%' }}>
      <Toolbar state={state} onUndo={handleUndo} onRedo={handleRedo} />
      <BrushControls size={state.brushSize} color={state.brushColor} />
      <StatusIndicator />
    </div>
  );
}

export function mountUI(container: HTMLElement) {
  render(<CanvasOverlay />, container);
}
