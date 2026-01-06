import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { Layer, Color } from '../core/types';
import { BlendMode } from '../core/types';
import { BRUSH_DEFAULTS, CANVAS_DEFAULTS, CANVAS_VIEW_DEFAULTS, GRID_DEFAULTS } from '../core/config';
import { eventBus, Events } from '../core/events';

interface AppState {
  brushSize: number;
  brushColor: Color;
  brushOpacity: number;
  brushStabilization: number;
  colorHistory: Color[];
  backgroundColor: Color;
  gridVisible: boolean;
  gridSpacing: number;
  gridColor: Color;
  gridSnap: boolean;
  canvasWidth: number;
  canvasHeight: number;
  showCanvasSize: boolean;
  layers: Layer[];
  activeLayerId: string;
  soloLayerId: string | null;
  referenceLayerId: string | null;
  uiHidden: boolean;
  isReadOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoomLevel: number;
  rotationAngle: number;
  hasAutosave: boolean;
  autosaveTimestamp: number | null;
  eyedropperActive: boolean;
  panModeActive: boolean;
  rotationSnap: boolean;
  timelapseRecording: boolean;
  timelapseSupported: boolean;
  colorDropActive: boolean;
  colorDropThreshold: number;
  colorDropDragging: boolean;
  lassoActive: boolean;
  selectionActive: boolean;
}

function Toolbar({
  state,
  onUndo,
  onRedo,
  onExportProject,
  onImportProject,
  onRecoverProject,
  onToggleEyedropper,
  onTogglePanMode,
  onCanvasSizeToggle,
  onViewFit,
  onRotationSnapToggle,
  onTimelapseToggle,
  onColorDropToggle,
  onLassoToggle,
}: {
  state: AppState;
  onUndo: () => void;
  onRedo: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
  onRecoverProject: () => void;
  onToggleEyedropper: () => void;
  onTogglePanMode: () => void;
  onCanvasSizeToggle: () => void;
  onViewFit: () => void;
  onRotationSnapToggle: () => void;
  onTimelapseToggle: () => void;
  onColorDropToggle: () => void;
  onLassoToggle: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '8px',
      background: 'rgba(40, 40, 40, 0.9)',
      padding: '8px',
      borderRadius: '12px',
      pointerEvents: 'auto',
    }}>
      <button
        onClick={() => eventBus.emit('app:navigate-gallery', null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#3a3a4a',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
        }}
        title="Gallery"
      >
        ←
      </button>
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
      <button
        onClick={() => eventBus.emit(Events.CANVAS_EXPORT_REQUESTED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#4a4a4a',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
        }}
        title="Export PNG"
      >
        ⤓
      </button>
      <button
        onClick={onExportProject}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#3a3a3a',
          color: '#ddd',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Save Project"
      >
        Save
      </button>
      <button
        onClick={onImportProject}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#2a2a2a',
          color: '#bbb',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Load Project"
      >
        Load
      </button>
      <button
        onClick={onRecoverProject}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.hasAutosave ? '#384a3a' : '#232323',
          color: state.hasAutosave ? '#d5f5da' : '#666',
          cursor: state.hasAutosave ? 'pointer' : 'not-allowed',
          fontSize: '11px',
        }}
        title={state.hasAutosave ? 'Recover Autosave' : 'No autosave found'}
        disabled={!state.hasAutosave}
      >
        Recover
      </button>
      <button
        onClick={onToggleEyedropper}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.eyedropperActive ? '#35506a' : '#2a2a2a',
          color: state.eyedropperActive ? '#e7f3ff' : '#aaa',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title={state.eyedropperActive ? 'Eyedropper Active (I)' : 'Eyedropper (I)'}
      >
        Pick
      </button>
      <button
        onClick={onColorDropToggle}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.colorDropActive ? '#3a3f5a' : '#2a2a2a',
          color: state.colorDropActive ? '#dfe4ff' : '#aaa',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title={state.colorDropActive ? 'ColorDrop Active (D)' : 'ColorDrop (D)'}
      >
        Drop
      </button>
      <button
        onClick={onLassoToggle}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.lassoActive ? '#304a3a' : '#2a2a2a',
          color: state.lassoActive ? '#d7ffe4' : '#aaa',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title={state.lassoActive ? 'Lasso Active (S)' : 'Lasso (S)'}
      >
        Lasso
      </button>
      <button
        onClick={onTogglePanMode}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.panModeActive ? '#30444a' : '#2a2a2a',
          color: state.panModeActive ? '#d6f5ff' : '#aaa',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title={state.panModeActive ? 'Hand Tool Active (Space)' : 'Hand Tool (Space)'}
      >
        Hand
      </button>
      <button
        onClick={onCanvasSizeToggle}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.showCanvasSize ? '#3f3a54' : '#2a2a2a',
          color: state.showCanvasSize ? '#efe4ff' : '#aaa',
          cursor: 'pointer',
          fontSize: '11px',
        }}
        title="Canvas Size"
      >
        Size
      </button>
      <button
        onClick={() => eventBus.emit(Events.CANVAS_EXPORT_BACKGROUND_REQUESTED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#3a3a3a',
          color: '#ddd',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        title="Export PNG (with background)"
      >
        ⤓□
      </button>
      <button
        onClick={() => eventBus.emit(Events.CANVAS_EXPORT_JPEG_REQUESTED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#2a2a2a',
          color: '#ddd',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Export JPEG (with background)"
      >
        JPG
      </button>
      <button
        onClick={() => eventBus.emit(Events.UI_TOGGLED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#1f1f1f',
          color: '#bbb',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        title="Hide UI"
      >
        ⨯
      </button>
      <button
        onClick={() => eventBus.emit(Events.CANVAS_CLEAR_REQUESTED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#3a2a2a',
          color: '#f5c7c7',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Clear Canvas"
      >
        Clear
      </button>
      <button
        onClick={() => eventBus.emit(Events.VIEW_RESET_REQUESTED, null)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#2b2b2b',
          color: '#ddd',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Reset View"
      >
        Reset
      </button>
      <button
        onClick={onViewFit}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#2a2a2a',
          color: '#bbb',
          cursor: 'pointer',
          fontSize: '12px',
        }}
        title="Fit View (F)"
      >
        Fit
      </button>
      <button
        onClick={onRotationSnapToggle}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.rotationSnap ? '#3b3a2a' : '#2a2a2a',
          color: state.rotationSnap ? '#f5e7b2' : '#aaa',
          cursor: 'pointer',
          fontSize: '11px',
        }}
        title={state.rotationSnap ? 'Rotation Snap On (R)' : 'Rotation Snap Off (R)'}
      >
        Snap
      </button>
      <button
        onClick={onTimelapseToggle}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: state.timelapseRecording ? '#6a2a2a' : '#2a2a2a',
          color: state.timelapseRecording ? '#ffd7d7' : '#aaa',
          cursor: state.timelapseSupported ? 'pointer' : 'not-allowed',
          fontSize: '11px',
        }}
        title={state.timelapseRecording ? 'Stop Timelapse' : 'Start Timelapse'}
        disabled={!state.timelapseSupported}
      >
        Rec
      </button>
    </div>
  );
}

function EdgeSliders({
  size,
  opacity,
}: {
  size: number;
  opacity: number;
}) {
  const handleSizeChange = (e: Event) => {
    const newSize = parseInt((e.target as HTMLInputElement).value, 10);
    const clampedSize = Math.max(BRUSH_DEFAULTS.minSize, Math.min(BRUSH_DEFAULTS.maxSize, newSize));
    eventBus.emit(Events.BRUSH_SIZE_CHANGED, clampedSize);
  };

  const handleOpacityChange = (e: Event) => {
    const raw = parseInt((e.target as HTMLInputElement).value, 10);
    const clamped = Math.max(0, Math.min(100, raw));
    eventBus.emit(Events.BRUSH_OPACITY_CHANGED, clamped / 100);
  };

  const opacityPercent = Math.round(opacity * 100);

  const sliderStyle = {
    width: '180px',
    transform: 'rotate(-90deg)',
  };

  return (
    <>
      <div style={{
        position: 'absolute',
        left: '8px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <div style={{ color: '#ddd', fontSize: '11px' }}>{size}px</div>
        <input
          type="range"
          min={BRUSH_DEFAULTS.minSize}
          max={BRUSH_DEFAULTS.maxSize}
          value={size}
          onInput={handleSizeChange}
          style={sliderStyle}
          aria-label="Brush size"
        />
      </div>
      <div style={{
        position: 'absolute',
        right: '8px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
      }}>
        <div style={{ color: '#ddd', fontSize: '11px' }}>{opacityPercent}%</div>
        <input
          type="range"
          min={0}
          max={100}
          value={opacityPercent}
          onInput={handleOpacityChange}
          style={sliderStyle}
          aria-label="Brush opacity"
        />
      </div>
    </>
  );
}

function BrushControls({
  color,
  opacity,
  stabilization,
  colorHistory,
  backgroundColor,
  gridVisible,
  gridSpacing,
  gridColor,
  gridSnap,
}: {
  color: Color;
  opacity: number;
  stabilization: number;
  colorHistory: Color[];
  backgroundColor: Color;
  gridVisible: boolean;
  gridSpacing: number;
  gridColor: Color;
  gridSnap: boolean;
}) {
  const handleColorChange = (e: Event) => {
    const hex = (e.target as HTMLInputElement).value.replace('#', '');
    if (hex.length !== 6) return;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    eventBus.emit(Events.BRUSH_COLOR_CHANGED, { r, g, b, a: Math.round(opacity * 255) });
  };

  const handleStabilizationChange = (e: Event) => {
    const raw = parseInt((e.target as HTMLInputElement).value, 10);
    const clamped = Math.max(0, Math.min(100, raw));
    eventBus.emit(Events.BRUSH_STABILIZATION_CHANGED, clamped / 100);
  };

  const handleBackgroundChange = (e: Event) => {
    const hex = (e.target as HTMLInputElement).value.replace('#', '');
    if (hex.length !== 6) return;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    eventBus.emit(Events.BACKGROUND_COLOR_CHANGED, { r, g, b, a: 255 });
  };

  const handleGridToggle = () => {
    eventBus.emit(Events.GRID_TOGGLED, !gridVisible);
  };

  const handleGridSpacingChange = (e: Event) => {
    const raw = parseInt((e.target as HTMLInputElement).value, 10);
    const clamped = Math.max(8, Math.min(512, raw));
    eventBus.emit(Events.GRID_SPACING_CHANGED, clamped);
  };

  const handleGridColorChange = (e: Event) => {
    const hex = (e.target as HTMLInputElement).value.replace('#', '');
    if (hex.length !== 6) return;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    eventBus.emit(Events.GRID_COLOR_CHANGED, { r, g, b, a: 160 });
  };

  const handleGridSnapToggle = () => {
    eventBus.emit(Events.GRID_SNAP_TOGGLED, !gridSnap);
  };

  const colorHex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
  const backgroundHex = `#${backgroundColor.r.toString(16).padStart(2, '0')}${backgroundColor.g.toString(16).padStart(2, '0')}${backgroundColor.b.toString(16).padStart(2, '0')}`;
  const gridHex = `#${gridColor.r.toString(16).padStart(2, '0')}${gridColor.g.toString(16).padStart(2, '0')}${gridColor.b.toString(16).padStart(2, '0')}`;
  const stabilizationPercent = Math.round(stabilization * 100);

  const renderSwatch = (swatch: Color, index: number) => {
    const swatchHex = `#${swatch.r.toString(16).padStart(2, '0')}${swatch.g.toString(16).padStart(2, '0')}${swatch.b.toString(16).padStart(2, '0')}`;
    return (
      <button
        key={`${swatchHex}-${index}`}
        onClick={() => eventBus.emit(Events.BRUSH_COLOR_CHANGED, swatch)}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '6px',
          border: '1px solid #444',
          background: swatchHex,
          cursor: 'pointer',
        }}
        title={swatchHex}
      />
    );
  };

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
      pointerEvents: 'auto',
    }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>Stabilize</span>
        <input
          type="range"
          min={0}
          max={100}
          value={stabilizationPercent}
          onInput={handleStabilizationChange}
          style={{ width: '120px' }}
        />
        <span style={{ color: '#fff', fontSize: '12px', width: '40px' }}>{stabilizationPercent}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>Palette</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {colorHistory.map(renderSwatch)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>BG</span>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: backgroundHex,
          border: '2px solid #555',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <input
            type="color"
            value={backgroundHex}
            onInput={handleBackgroundChange}
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
        <span style={{ color: '#fff', fontSize: '12px' }}>{backgroundHex}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#aaa', fontSize: '12px', width: '40px' }}>Grid</span>
        <button
          onClick={handleGridToggle}
          style={{
            width: '56px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: gridVisible ? '#4a4a4a' : '#2a2a2a',
            color: gridVisible ? '#fff' : '#777',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          title={gridVisible ? 'Hide grid' : 'Show grid'}
        >
          {gridVisible ? 'On' : 'Off'}
        </button>
        <button
          onClick={handleGridSnapToggle}
          style={{
            width: '56px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: gridSnap ? '#4a4a4a' : '#2a2a2a',
            color: gridSnap ? '#fff' : '#777',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          title={gridSnap ? 'Disable snapping' : 'Enable snapping'}
        >
          Snap
        </button>
        <input
          type="range"
          min={8}
          max={512}
          value={gridSpacing}
          onInput={handleGridSpacingChange}
          style={{ flex: 1 }}
        />
        <span style={{ color: '#fff', fontSize: '12px', width: '36px' }}>{gridSpacing}</span>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: gridHex,
          border: '2px solid #555',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <input
            type="color"
            value={gridHex}
            onInput={handleGridColorChange}
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

function CanvasSizePanel({
  width,
  height,
  onWidthChange,
  onHeightChange,
  onApply,
  onFit,
}: {
  width: number;
  height: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onApply: () => void;
  onFit: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      background: 'rgba(40, 40, 40, 0.92)',
      borderRadius: '12px',
      padding: '12px',
      width: '200px',
      pointerEvents: 'auto',
    }}>
      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
        Canvas Size
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ color: '#aaa', fontSize: '12px' }}>
          Width
          <input
            type="number"
            min={1}
            max={8192}
            value={width}
            onInput={(e) => onWidthChange(parseInt((e.target as HTMLInputElement).value, 10))}
            style={{
              width: '100%',
              marginTop: '4px',
              background: '#1c1c1c',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              padding: '6px',
            }}
          />
        </label>
        <label style={{ color: '#aaa', fontSize: '12px' }}>
          Height
          <input
            type="number"
            min={1}
            max={8192}
            value={height}
            onInput={(e) => onHeightChange(parseInt((e.target as HTMLInputElement).value, 10))}
            style={{
              width: '100%',
              marginTop: '4px',
              background: '#1c1c1c',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              padding: '6px',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onApply}
            style={{
              flex: 1,
              borderRadius: '6px',
              border: 'none',
              background: '#4a4a4a',
              color: '#fff',
              padding: '8px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Apply
          </button>
          <button
            onClick={onFit}
            style={{
              flex: 1,
              borderRadius: '6px',
              border: 'none',
              background: '#2a2a2a',
              color: '#bbb',
              padding: '8px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
}

function LayerPanel({ state }: { state: AppState }) {
  const activeLayer = state.layers.find((layer) => layer.id === state.activeLayerId) ?? state.layers[0] ?? null;
  const canDelete = state.layers.length > 1;
  const activeOpacity = activeLayer ? Math.round(activeLayer.opacity * 100) : 100;
  const activeBlendMode = activeLayer?.blendMode ?? BlendMode.Normal;
  const topLayerId = state.layers[state.layers.length - 1]?.id ?? '';
  const bottomLayerId = state.layers[0]?.id ?? '';

  const handleAddLayer = () => {
    eventBus.emit(Events.LAYER_ADDED, null);
  };
  const handleDeleteLayer = (layerId: string) => {
    if (!canDelete) return;
    eventBus.emit(Events.LAYER_DELETED, layerId);
  };
  const handleToggleVisibility = (layerId: string, visible: boolean) => {
    eventBus.emit(Events.LAYER_VISIBILITY_TOGGLED, { layerId, visible });
  };
  const handleToggleLock = (layerId: string, locked: boolean) => {
    eventBus.emit(Events.LAYER_LOCK_TOGGLED, { layerId, locked });
  };
  const handleToggleAlphaLock = (layerId: string, alphaLocked: boolean) => {
    eventBus.emit(Events.LAYER_ALPHA_LOCK_TOGGLED, { layerId, alphaLocked });
  };
  const handleSelectLayer = (layerId: string) => {
    eventBus.emit(Events.LAYER_SELECTED, layerId);
  };
  const handleOpacityChange = (e: Event) => {
    if (!activeLayer) return;
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    const opacity = Math.max(0, Math.min(100, value)) / 100;
    eventBus.emit(Events.LAYER_OPACITY_CHANGED, { layerId: activeLayer.id, opacity });
  };
  const handleBlendModeChange = (e: Event) => {
    if (!activeLayer) return;
    const value = (e.target as HTMLSelectElement).value as BlendMode;
    eventBus.emit(Events.LAYER_BLEND_MODE_CHANGED, { layerId: activeLayer.id, blendMode: value });
  };
  const handleRenameLayer = (layerId: string, currentName: string) => {
    const nextName = window.prompt('Rename layer', currentName);
    if (!nextName || !nextName.trim()) return;
    eventBus.emit(Events.LAYER_RENAMED, { layerId, name: nextName });
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      width: '200px',
      maxHeight: '400px',
      background: 'rgba(40, 40, 40, 0.9)',
      borderRadius: '12px',
      padding: '12px',
      pointerEvents: 'auto',
      overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #555',
      }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Layers</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => activeLayer && eventBus.emit(Events.LAYER_CLEAR_REQUESTED, activeLayer.id)}
            disabled={!activeLayer}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: activeLayer ? '#3a3a3a' : '#2a2a2a',
              color: activeLayer ? '#fff' : '#555',
              cursor: activeLayer ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear Active Layer"
          >
            ⟲
          </button>
          <button
            onClick={handleAddLayer}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: '#4a4a4a',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Add Layer"
          >
            +
          </button>
        </div>
      </div>
      {state.layers.length === 0 ? (
        <div style={{ color: '#888', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
          No layers yet
        </div>
      ) : (
        [...state.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => handleSelectLayer(layer.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              borderRadius: '6px',
              background: layer.id === state.activeLayerId ? '#4a4a4a' : 'transparent',
              cursor: 'pointer',
              marginBottom: '4px',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleVisibility(layer.id, !layer.visible);
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: layer.visible ? '#4a4a4a' : '#2a2a2a',
                color: layer.visible ? '#fff' : '#666',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={layer.visible ? 'Hide' : 'Show'}
            >
              {layer.visible ? '👁' : '○'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLock(layer.id, !layer.locked);
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: layer.locked ? '#5a4a2a' : '#2a2a2a',
                color: layer.locked ? '#ffe7a1' : '#666',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={layer.locked ? 'Unlock' : 'Lock'}
            >
              {layer.locked ? '🔒' : '🔓'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleAlphaLock(layer.id, !layer.alphaLocked);
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: layer.alphaLocked ? '#5a3a2a' : '#2a2a2a',
                color: layer.alphaLocked ? '#ffd4a1' : '#666',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={layer.alphaLocked ? 'Disable Alpha Lock' : 'Enable Alpha Lock'}
            >
              α
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_REFERENCE_TOGGLED, { layerId: layer.id });
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: state.referenceLayerId === layer.id ? '#2f5a4a' : '#2a2a2a',
                color: state.referenceLayerId === layer.id ? '#b8ffe0' : '#666',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={state.referenceLayerId === layer.id ? 'Unset Reference Layer' : 'Set as Reference Layer'}
            >
              R
            </button>
            <span style={{
              color: '#fff',
              fontSize: '13px',
              flex: 1,
              opacity: layer.visible ? (layer.locked ? 0.6 : 1) : 0.4,
            }}>
              {layer.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_SOLO_TOGGLED, layer.id);
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: state.soloLayerId === layer.id ? '#4a4a4a' : '#2a2a2a',
                color: state.soloLayerId === layer.id ? '#fff' : '#777',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={state.soloLayerId === layer.id ? 'Unsolo' : 'Solo'}
            >
              S
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_DUPLICATED, layer.id);
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: '#3a3a3a',
                color: '#bbb',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Duplicate Layer"
            >
              ⧉
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_MERGED_DOWN, layer.id);
              }}
              disabled={layer.id === bottomLayerId}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: layer.id === bottomLayerId ? '#2a2a2a' : '#3a3a3a',
                color: layer.id === bottomLayerId ? '#555' : '#bbb',
                cursor: layer.id === bottomLayerId ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Merge Down"
            >
              ⇓
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_MOVED_UP, layer.id);
              }}
              disabled={layer.id === topLayerId}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: layer.id === topLayerId ? '#2a2a2a' : '#3a3a3a',
                color: layer.id === topLayerId ? '#555' : '#ccc',
                cursor: layer.id === topLayerId ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Move Up"
            >
              ↑
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                eventBus.emit(Events.LAYER_MOVED_DOWN, layer.id);
              }}
              disabled={layer.id === bottomLayerId}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: layer.id === bottomLayerId ? '#2a2a2a' : '#3a3a3a',
                color: layer.id === bottomLayerId ? '#555' : '#ccc',
                cursor: layer.id === bottomLayerId ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Move Down"
            >
              ↓
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenameLayer(layer.id, layer.name);
              }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: '#3a3a3a',
                color: '#bbb',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Rename Layer"
            >
              ✎
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteLayer(layer.id);
              }}
              disabled={!canDelete}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: 'none',
                background: canDelete ? '#3a3a3a' : '#2a2a2a',
                color: canDelete ? '#888' : '#555',
                cursor: canDelete ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Delete Layer"
            >
              ×
            </button>
          </div>
        ))
      )}
      <div style={{ marginTop: '12px', borderTop: '1px solid #444', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', width: '56px' }}>Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={activeOpacity}
            onInput={handleOpacityChange}
            disabled={!activeLayer}
            style={{ flex: 1 }}
          />
          <span style={{ color: '#fff', fontSize: '12px', width: '36px', textAlign: 'right' }}>
            {activeOpacity}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <span style={{ color: '#aaa', fontSize: '12px', width: '56px' }}>Blend</span>
          <select
            value={activeBlendMode}
            onChange={handleBlendModeChange}
            disabled={!activeLayer}
            style={{
              flex: 1,
              background: '#2a2a2a',
              border: '1px solid #555',
              borderRadius: '6px',
              color: '#fff',
              padding: '4px 6px',
              fontSize: '12px',
            }}
          >
            <option value={BlendMode.Normal}>Normal</option>
            <option value={BlendMode.Multiply}>Multiply</option>
            <option value={BlendMode.Screen}>Screen</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({
  zoomLevel,
  rotationAngle,
  hasAutosave,
  eyedropperActive,
  panModeActive,
  timelapseRecording,
  colorDropActive,
  colorDropThreshold,
  lassoActive,
  selectionActive,
}: {
  zoomLevel: number;
  rotationAngle: number;
  hasAutosave: boolean;
  eyedropperActive: boolean;
  panModeActive: boolean;
  timelapseRecording: boolean;
  colorDropActive: boolean;
  colorDropThreshold: number;
  lassoActive: boolean;
  selectionActive: boolean;
}) {
  const zoomPercent = Math.round(zoomLevel * 100);
  const rotation = Math.round(rotationAngle);
  const rotationLabel = rotation !== 0 ? ` · ${rotation}°` : '';
  const autosaveLabel = hasAutosave ? ' · Saved' : '';
  const pickLabel = eyedropperActive ? ' · Picker' : '';
  const panLabel = panModeActive ? ' · Hand' : '';
  const recLabel = timelapseRecording ? ' · Rec' : '';
  const dropLabel = colorDropActive ? ` · Drop ${Math.round(colorDropThreshold * 100)}%` : '';
  const lassoLabel = lassoActive ? ' · Lasso' : '';
  const selectionLabel = selectionActive ? ' · Sel' : '';

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
      pointerEvents: 'auto',
    }}>
      ● Zoom {zoomPercent}%{rotationLabel}{autosaveLabel}{pickLabel}{panLabel}{recLabel}{dropLabel}{lassoLabel}{selectionLabel}
    </div>
  );
}

export function CanvasOverlay() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<AppState>({
    brushSize: BRUSH_DEFAULTS.baseSize,
    brushColor: { ...BRUSH_DEFAULTS.color },
    brushOpacity: BRUSH_DEFAULTS.color.a / 255,
    brushStabilization: BRUSH_DEFAULTS.stabilization,
    colorHistory: [
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 85, b: 85, a: 255 },
      { r: 85, g: 153, b: 255, a: 255 },
      { r: 255, g: 221, b: 102, a: 255 },
      { r: 120, g: 220, b: 140, a: 255 },
    ],
    backgroundColor: { ...CANVAS_DEFAULTS.backgroundColor },
    gridVisible: GRID_DEFAULTS.visible,
    gridSpacing: GRID_DEFAULTS.spacing,
    gridColor: { ...GRID_DEFAULTS.color },
    gridSnap: GRID_DEFAULTS.snap,
    layers: [],
    activeLayerId: '',
    soloLayerId: null,
    referenceLayerId: null,
    uiHidden: false,
    isReadOnly: false,
    canUndo: false,
    canRedo: false,
    zoomLevel: 1,
    rotationAngle: 0,
    hasAutosave: false,
    autosaveTimestamp: null,
    eyedropperActive: false,
    panModeActive: false,
    canvasWidth: CANVAS_DEFAULTS.width,
    canvasHeight: CANVAS_DEFAULTS.height,
    showCanvasSize: false,
    rotationSnap: CANVAS_VIEW_DEFAULTS.rotationSnap ?? false,
    timelapseRecording: false,
    timelapseSupported: true,
    colorDropActive: false,
    colorDropThreshold: 0.15,
    colorDropDragging: false,
    lassoActive: false,
    selectionActive: false,
  });

  useEffect(() => {
    // Listen for layer state updates from main.ts
    const layerUpdateSub = eventBus.on('layers:updated', (data: any) => {
      setState((s) => ({
        ...s,
        layers: data.layers,
        activeLayerId: data.activeLayerId,
        soloLayerId: data.soloLayerId ?? null,
        referenceLayerId: data.referenceLayerId ?? null,
        canvasWidth: data.canvasWidth ?? s.canvasWidth,
        canvasHeight: data.canvasHeight ?? s.canvasHeight,
      }));
    });
    const app = (window as any)?.app;
    if (app?.getCanvasState) {
      const canvas = app.getCanvasState().getCanvas();
      setState((s) => ({
        ...s,
        layers: canvas.layers,
        activeLayerId: canvas.activeLayerId,
        referenceLayerId: canvas.referenceLayerId ?? null,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      }));
    }

    const sizeSub = eventBus.on(Events.BRUSH_SIZE_CHANGED, (size: number) => {
      setState((s) => ({ ...s, brushSize: size }));
    });

    const colorSub = eventBus.on(Events.BRUSH_COLOR_CHANGED, (color: Color) => {
      setState((s) => {
        const key = `${color.r}-${color.g}-${color.b}-${color.a}`;
        const filtered = s.colorHistory.filter((c) => `${c.r}-${c.g}-${c.b}-${c.a}` !== key);
        const history = [color, ...filtered].slice(0, 6);
        return { ...s, brushColor: color, brushOpacity: color.a / 255, colorHistory: history };
      });
    });

    const opacitySub = eventBus.on(Events.BRUSH_OPACITY_CHANGED, (opacity: number) => {
      setState((s) => ({ ...s, brushOpacity: opacity }));
    });

    const stabilizationSub = eventBus.on(Events.BRUSH_STABILIZATION_CHANGED, (value: number) => {
      setState((s) => ({ ...s, brushStabilization: value }));
    });

    const backgroundSub = eventBus.on(Events.BACKGROUND_COLOR_CHANGED, (color: Color) => {
      setState((s) => ({ ...s, backgroundColor: color }));
    });

    const gridToggleSub = eventBus.on(Events.GRID_TOGGLED, (visible?: boolean) => {
      if (typeof visible === 'boolean') {
        setState((s) => ({ ...s, gridVisible: visible }));
      } else {
        setState((s) => ({ ...s, gridVisible: !s.gridVisible }));
      }
    });

    const gridSpacingSub = eventBus.on(Events.GRID_SPACING_CHANGED, (spacing: number) => {
      setState((s) => ({ ...s, gridSpacing: spacing }));
    });

    const gridColorSub = eventBus.on(Events.GRID_COLOR_CHANGED, (color: Color) => {
      setState((s) => ({ ...s, gridColor: color }));
    });

    const gridSnapSub = eventBus.on(Events.GRID_SNAP_TOGGLED, (snap?: boolean) => {
      if (snap === undefined) {
        setState((s) => ({ ...s, gridSnap: !s.gridSnap }));
        return;
      }
      setState((s) => ({ ...s, gridSnap: snap }));
    });

    const historySub = eventBus.on(Events.HISTORY_STATE_CHANGED, (data: { canUndo: boolean; canRedo: boolean }) => {
      setState((s) => ({ ...s, canUndo: data.canUndo, canRedo: data.canRedo }));
    });

    const viewSub = eventBus.on(Events.VIEW_TRANSFORM_CHANGED, (data: { zoom: number; rotation: number }) => {
      setState((s) => ({ ...s, zoomLevel: data.zoom, rotationAngle: data.rotation }));
    });

    const autosaveSub = eventBus.on(Events.PROJECT_AUTOSAVE_UPDATED, (data: { available?: boolean; timestamp?: number }) => {
      const available = data?.available;
      if (available === undefined) return;
      setState((s) => ({
        ...s,
        hasAutosave: available,
        autosaveTimestamp: typeof data?.timestamp === 'number' ? data.timestamp : s.autosaveTimestamp,
      }));
    });

    const eyedropperSub = eventBus.on(Events.EYEDROPPER_TOGGLED, (data?: { active?: boolean }) => {
      const active = data?.active;
      if (active === undefined) {
        setState((s) => ({ ...s, eyedropperActive: !s.eyedropperActive }));
        return;
      }
      setState((s) => ({ ...s, eyedropperActive: active }));
    });

    const panModeSub = eventBus.on(Events.PAN_MODE_TOGGLED, (data?: { active?: boolean }) => {
      const active = data?.active;
      if (active === undefined) {
        setState((s) => ({ ...s, panModeActive: !s.panModeActive }));
        return;
      }
      setState((s) => ({ ...s, panModeActive: active }));
    });

    const rotationSnapSub = eventBus.on(Events.VIEW_ROTATION_SNAP_TOGGLED, (snap?: boolean) => {
      if (snap === undefined) {
        setState((s) => ({ ...s, rotationSnap: !s.rotationSnap }));
        return;
      }
      setState((s) => ({ ...s, rotationSnap: snap }));
    });

    const timelapseSub = eventBus.on(Events.TIMELAPSE_STATUS_CHANGED, (data: { recording?: boolean; supported?: boolean }) => {
      setState((s) => ({
        ...s,
        timelapseRecording: data.recording ?? s.timelapseRecording,
        timelapseSupported: data.supported ?? s.timelapseSupported,
      }));
    });

    const colorDropSub = eventBus.on(Events.COLOR_DROP_TOGGLED, (data?: { active?: boolean }) => {
      const active = data?.active;
      if (active === undefined) {
        setState((s) => ({ ...s, colorDropActive: !s.colorDropActive }));
        return;
      }
      setState((s) => ({ ...s, colorDropActive: active }));
    });

    const colorDropThresholdSub = eventBus.on(Events.COLOR_DROP_THRESHOLD_CHANGED, (value: number) => {
      if (!Number.isFinite(value)) return;
      setState((s) => ({ ...s, colorDropThreshold: Math.max(0, Math.min(1, value)) }));
    });

    const colorDropDraggingSub = eventBus.on(Events.COLOR_DROP_DRAGGING_CHANGED, (value: boolean) => {
      setState((s) => ({ ...s, colorDropDragging: value }));
    });

    const lassoSub = eventBus.on(Events.LASSO_TOGGLED, (data?: { active?: boolean }) => {
      const active = data?.active;
      if (active === undefined) {
        setState((s) => ({ ...s, lassoActive: !s.lassoActive }));
        return;
      }
      setState((s) => ({ ...s, lassoActive: active }));
    });

    const selectionSub = eventBus.on(Events.SELECTION_UPDATED, (data?: { active?: boolean }) => {
      const active = data?.active;
      if (active === undefined) {
        return;
      }
      setState((s) => ({ ...s, selectionActive: active }));
    });

    const uiSub = eventBus.on(Events.UI_TOGGLED, () => {
      setState((s) => {
        const next = !s.uiHidden;
        try {
          window.localStorage.setItem('opencanvas:ui-hidden', JSON.stringify(next));
        } catch (error) {
          console.warn('Failed to persist UI state', error);
        }
        return { ...s, uiHidden: next };
      });
    });

    const readOnlySub = eventBus.on(Events.READONLY_TOGGLED, (data?: { readonly?: boolean }) => {
      setState((s) => ({ ...s, isReadOnly: data?.readonly ?? !s.isReadOnly }));
    });

    return () => {
      layerUpdateSub.unsubscribe();
      sizeSub.unsubscribe();
      colorSub.unsubscribe();
      opacitySub.unsubscribe();
      stabilizationSub.unsubscribe();
      backgroundSub.unsubscribe();
      gridToggleSub.unsubscribe();
      gridSpacingSub.unsubscribe();
      gridColorSub.unsubscribe();
      gridSnapSub.unsubscribe();
      historySub.unsubscribe();
      viewSub.unsubscribe();
      autosaveSub.unsubscribe();
      eyedropperSub.unsubscribe();
      panModeSub.unsubscribe();
      rotationSnapSub.unsubscribe();
      timelapseSub.unsubscribe();
      colorDropSub.unsubscribe();
      colorDropThresholdSub.unsubscribe();
      colorDropDraggingSub.unsubscribe();
      lassoSub.unsubscribe();
      selectionSub.unsubscribe();
      uiSub.unsubscribe();
      readOnlySub.unsubscribe();
    };
  }, []);

  const handleUndo = () => eventBus.emit(Events.UNDO_REQUESTED, null);
  const handleRedo = () => eventBus.emit(Events.REDO_REQUESTED, null);
  const handleProjectExport = () => eventBus.emit(Events.PROJECT_EXPORT_REQUESTED, null);
  const handleProjectImport = () => {
    fileInputRef.current?.click();
  };
  const handleProjectRecover = () => eventBus.emit(Events.PROJECT_RECOVER_REQUESTED, null);
  const handleEyedropperToggle = () => eventBus.emit(Events.EYEDROPPER_TOGGLED, null);
  const handlePanModeToggle = () => eventBus.emit(Events.PAN_MODE_TOGGLED, null);
  const handleCanvasSizeToggle = () => {
    setState((s) => ({ ...s, showCanvasSize: !s.showCanvasSize }));
  };
  const handleViewFit = () => eventBus.emit(Events.VIEW_FIT_REQUESTED, null);
  const handleRotationSnapToggle = () => eventBus.emit(Events.VIEW_ROTATION_SNAP_TOGGLED, null);
  const handleTimelapseToggle = () => eventBus.emit(Events.TIMELAPSE_TOGGLED, null);
  const handleColorDropToggle = () => eventBus.emit(Events.COLOR_DROP_TOGGLED, null);
  const handleLassoToggle = () => eventBus.emit(Events.LASSO_TOGGLED, null);
  const handleCanvasWidthChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    setState((s) => ({ ...s, canvasWidth: Math.max(1, Math.min(8192, value)) }));
  };
  const handleCanvasHeightChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    setState((s) => ({ ...s, canvasHeight: Math.max(1, Math.min(8192, value)) }));
  };
  const handleCanvasResizeApply = () => {
    eventBus.emit(Events.CANVAS_RESIZE_REQUESTED, {
      width: state.canvasWidth,
      height: state.canvasHeight,
      anchor: 'center',
    });
  };
  const handleCanvasFit = () => eventBus.emit(Events.CANVAS_FIT_REQUESTED, null);

  const loadProjectFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      eventBus.emit(Events.PROJECT_IMPORT_REQUESTED, parsed);
    } catch (error) {
      console.error('Failed to import project', error);
    }
  };

  const handleProjectFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await loadProjectFile(file);
    input.value = '';
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('opencanvas:ui-hidden');
      if (stored) {
        const hidden = JSON.parse(stored);
        if (typeof hidden === 'boolean') {
          setState((s) => ({ ...s, uiHidden: hidden }));
        }
      }
      const brushRaw = window.localStorage.getItem('opencanvas:brush-settings');
      if (brushRaw) {
        const parsed = JSON.parse(brushRaw) as { size?: number; color?: Color; stabilization?: number };
        setState((s) => ({
          ...s,
          brushSize: parsed.size && Number.isFinite(parsed.size) ? Math.max(BRUSH_DEFAULTS.minSize, Math.min(BRUSH_DEFAULTS.maxSize, parsed.size)) : s.brushSize,
          brushColor: parsed.color ?? s.brushColor,
          brushOpacity: parsed.color ? parsed.color.a / 255 : s.brushOpacity,
          brushStabilization: parsed.stabilization !== undefined && Number.isFinite(parsed.stabilization) ? Math.max(0, Math.min(1, parsed.stabilization)) : s.brushStabilization,
        }));
      }
      const bgRaw = window.localStorage.getItem('opencanvas:background-color');
      if (bgRaw) {
        const parsed = JSON.parse(bgRaw) as Color;
        if (parsed) {
          setState((s) => ({ ...s, backgroundColor: parsed }));
        }
      }
      const gridRaw = window.localStorage.getItem('opencanvas:grid-settings');
      if (gridRaw) {
        const parsed = JSON.parse(gridRaw) as { visible?: boolean; spacing?: number; color?: Color; snap?: boolean };
        setState((s) => ({
          ...s,
          gridVisible: typeof parsed.visible === 'boolean' ? parsed.visible : s.gridVisible,
          gridSpacing: parsed.spacing !== undefined && Number.isFinite(parsed.spacing) ? Math.max(8, Math.min(512, parsed.spacing)) : s.gridSpacing,
          gridColor: parsed.color ?? s.gridColor,
          gridSnap: typeof parsed.snap === 'boolean' ? parsed.snap : s.gridSnap,
        }));
      }
      const readOnlyRaw = window.localStorage.getItem('opencanvas:readonly');
      if (readOnlyRaw) {
        const parsed = JSON.parse(readOnlyRaw);
        if (typeof parsed === 'boolean') {
          setState((s) => ({ ...s, isReadOnly: parsed }));
        }
      }
      const autosaveRaw = window.localStorage.getItem('opencanvas:autosave');
      if (autosaveRaw) {
        try {
          const parsed = JSON.parse(autosaveRaw);
          if (parsed) {
            const timestamp = typeof parsed.exportedAt === 'number' ? parsed.exportedAt : null;
            setState((s) => ({ ...s, hasAutosave: true, autosaveTimestamp: timestamp }));
          }
        } catch {
          setState((s) => ({ ...s, hasAutosave: false, autosaveTimestamp: null }));
        }
      }
      const paletteRaw = window.localStorage.getItem('opencanvas:palette');
      if (paletteRaw) {
        const parsed = JSON.parse(paletteRaw) as Color[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setState((s) => ({ ...s, colorHistory: parsed.slice(0, 6) }));
        }
      }
    } catch (error) {
      console.warn('Failed to load UI state', error);
    }
  }, []);

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
        return;
      }
      void loadProjectFile(file);
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('opencanvas:palette', JSON.stringify(state.colorHistory));
    } catch (error) {
      console.warn('Failed to persist palette', error);
    }
  }, [state.colorHistory]);

  return (
    <div class="canvas-overlay" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleProjectFileChange}
      />
      {state.uiHidden ? (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          pointerEvents: 'auto',
          display: 'flex',
          gap: '8px',
        }}>
          <button
            onClick={() => eventBus.emit(Events.UI_TOGGLED, null)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: 'none',
              background: 'rgba(40, 40, 40, 0.85)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            title="Show UI"
          >
            ⊕
          </button>
          <button
            onClick={() => eventBus.emit(Events.READONLY_TOGGLED, null)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: 'none',
              background: state.isReadOnly ? 'rgba(160, 70, 70, 0.9)' : 'rgba(40, 40, 40, 0.85)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            title={state.isReadOnly ? 'Unlock drawing' : 'Lock drawing'}
          >
            {state.isReadOnly ? '🔒' : '🔓'}
          </button>
        </div>
      ) : (
        <>
          <Toolbar
            state={state}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onExportProject={handleProjectExport}
            onImportProject={handleProjectImport}
            onRecoverProject={handleProjectRecover}
            onToggleEyedropper={handleEyedropperToggle}
            onTogglePanMode={handlePanModeToggle}
            onCanvasSizeToggle={handleCanvasSizeToggle}
            onViewFit={handleViewFit}
            onRotationSnapToggle={handleRotationSnapToggle}
            onTimelapseToggle={handleTimelapseToggle}
            onColorDropToggle={handleColorDropToggle}
            onLassoToggle={handleLassoToggle}
          />
          <EdgeSliders size={state.brushSize} opacity={state.brushOpacity} />
          <LayerPanel state={state} />
          <BrushControls
            color={state.brushColor}
            opacity={state.brushOpacity}
            stabilization={state.brushStabilization}
            colorHistory={state.colorHistory}
            backgroundColor={state.backgroundColor}
            gridVisible={state.gridVisible}
            gridSpacing={state.gridSpacing}
            gridColor={state.gridColor}
            gridSnap={state.gridSnap}
          />
          {state.showCanvasSize && (
            <CanvasSizePanel
              width={state.canvasWidth}
              height={state.canvasHeight}
              onWidthChange={handleCanvasWidthChange}
              onHeightChange={handleCanvasHeightChange}
              onApply={handleCanvasResizeApply}
              onFit={handleCanvasFit}
            />
          )}
          <StatusIndicator
            zoomLevel={state.zoomLevel}
            rotationAngle={state.rotationAngle}
            hasAutosave={state.hasAutosave}
            eyedropperActive={state.eyedropperActive}
            panModeActive={state.panModeActive}
            timelapseRecording={state.timelapseRecording}
            colorDropActive={state.colorDropActive}
            colorDropThreshold={state.colorDropThreshold}
            lassoActive={state.lassoActive}
            selectionActive={state.selectionActive}
          />
          {state.isReadOnly && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(160, 70, 70, 0.92)',
              padding: '6px 10px',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
              pointerEvents: 'auto',
            }}>
              Read-only
            </div>
          )}
          {state.colorDropDragging && (
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '4px',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 1000,
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                height: '100%',
                width: `${state.colorDropThreshold * 100}%`,
                background: `rgb(${state.brushColor.r}, ${state.brushColor.g}, ${state.brushColor.b})`,
                boxShadow: '0 0 8px rgba(255,255,255,0.5)',
                transition: 'width 0.05s ease-out',
              }} />
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(20,20,20,0.85)',
                color: '#fff',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}>
                COLOR DROP THRESHOLD: {Math.round(state.colorDropThreshold * 100)}%
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function mountUI(container: HTMLElement) {
  render(<CanvasOverlay />, container);
}
