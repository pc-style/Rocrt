import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { Layer, Color } from '../core/types';
import { BRUSH_DEFAULTS, CANVAS_DEFAULTS, CANVAS_VIEW_DEFAULTS, GRID_DEFAULTS } from '../core/config';
import { eventBus, Events } from '../core/events';
import {
  ProcreateSidebar,
  ProcreateToolbar,
  ProcreateToolsPanel,
  ProcreateLayerPanel,
  ProcreateColorPicker,
  BrushLibrary,
} from './procreate';
import { Eye } from 'lucide-preact';

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
  eraserActive: boolean;
  // UI panel states
  layerPanelOpen: boolean;
  colorPickerOpen: boolean;
  brushLibraryOpen: boolean;
}

function CanvasSizePanel({
  width,
  height,
  onWidthChange,
  onHeightChange,
  onApply,
  onFit,
  onClose,
}: {
  width: number;
  height: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onApply: () => void;
  onFit: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '100px',
      left: '80px',
      background: 'rgba(28, 28, 32, 0.96)',
      borderRadius: '16px',
      padding: '16px',
      width: '220px',
      pointerEvents: 'auto',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Canvas Size</span>
        <button
          onClick={onClose}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(60,60,70,0.6)',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              background: 'rgba(40,40,50,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              padding: '8px',
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
              background: 'rgba(40,40,50,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              padding: '8px',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={onApply}
            style={{
              flex: 1,
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(80, 100, 140, 0.8)',
              color: '#fff',
              padding: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Apply
          </button>
          <button
            onClick={onFit}
            style={{
              flex: 1,
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(60, 60, 70, 0.8)',
              color: '#bbb',
              padding: '10px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({
  zoomLevel,
  rotationAngle,
}: {
  zoomLevel: number;
  rotationAngle: number;
}) {
  const zoomPercent = Math.round(zoomLevel * 100);
  const rotation = Math.round(rotationAngle);
  const rotationLabel = rotation !== 0 ? ` · ${rotation}°` : '';

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(30, 30, 35, 0.85)',
      padding: '6px 16px',
      borderRadius: '20px',
      color: 'rgba(180, 200, 180, 0.9)',
      fontSize: '12px',
      fontWeight: 500,
      pointerEvents: 'none',
      backdropFilter: 'blur(8px)',
    }}>
      {zoomPercent}%{rotationLabel}
    </div>
  );
}

function ColorDropIndicator({
  threshold,
  brushColor,
}: {
  threshold: number;
  brushColor: Color;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '6px',
      background: 'rgba(0,0,0,0.4)',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        height: '100%',
        width: `${threshold * 100}%`,
        background: `rgb(${brushColor.r}, ${brushColor.g}, ${brushColor.b})`,
        boxShadow: '0 0 12px rgba(255,255,255,0.4)',
        transition: 'width 0.05s ease-out',
        borderRadius: '0 3px 3px 0',
      }} />
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20,20,25,0.92)',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: '24px',
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.03em',
        boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        Color Fill Threshold: {Math.round(threshold * 100)}%
      </div>
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
    eraserActive: false,
    layerPanelOpen: false,
    colorPickerOpen: false,
    brushLibraryOpen: false,
  });

  // Event subscriptions
  useEffect(() => {
    const subs = [
      eventBus.on('layers:updated', (data: any) => {
        setState((s) => ({
          ...s,
          layers: data.layers,
          activeLayerId: data.activeLayerId,
          soloLayerId: data.soloLayerId ?? null,
          referenceLayerId: data.referenceLayerId ?? null,
          canvasWidth: data.canvasWidth ?? s.canvasWidth,
          canvasHeight: data.canvasHeight ?? s.canvasHeight,
        }));
      }),
      eventBus.on(Events.BRUSH_SIZE_CHANGED, (size: number) => {
        setState((s) => ({ ...s, brushSize: size }));
      }),
      eventBus.on(Events.BRUSH_COLOR_CHANGED, (color: Color) => {
        setState((s) => {
          const key = `${color.r}-${color.g}-${color.b}-${color.a}`;
          const filtered = s.colorHistory.filter((c) => `${c.r}-${c.g}-${c.b}-${c.a}` !== key);
          const history = [color, ...filtered].slice(0, 6);
          return { ...s, brushColor: color, brushOpacity: color.a / 255, colorHistory: history };
        });
      }),
      eventBus.on(Events.BRUSH_OPACITY_CHANGED, (opacity: number) => {
        setState((s) => ({ ...s, brushOpacity: opacity }));
      }),
      eventBus.on(Events.HISTORY_STATE_CHANGED, (data: { canUndo: boolean; canRedo: boolean }) => {
        setState((s) => ({ ...s, canUndo: data.canUndo, canRedo: data.canRedo }));
      }),
      eventBus.on(Events.VIEW_TRANSFORM_CHANGED, (data: { zoom: number; rotation: number }) => {
        setState((s) => ({ ...s, zoomLevel: data.zoom, rotationAngle: data.rotation }));
      }),
      eventBus.on(Events.PROJECT_AUTOSAVE_UPDATED, (data: { available?: boolean; timestamp?: number }) => {
        if (data?.available !== undefined) {
          setState((s) => ({
            ...s,
            hasAutosave: data.available ?? false,
            autosaveTimestamp: typeof data?.timestamp === 'number' ? data.timestamp : s.autosaveTimestamp,
          }));
        }
      }),
      eventBus.on(Events.EYEDROPPER_TOGGLED, (data?: { active?: boolean }) => {
        setState((s) => ({
          ...s,
          eyedropperActive: data?.active !== undefined ? data.active : !s.eyedropperActive,
        }));
      }),
      eventBus.on(Events.PAN_MODE_TOGGLED, (data?: { active?: boolean }) => {
        setState((s) => ({
          ...s,
          panModeActive: data?.active !== undefined ? data.active : !s.panModeActive,
        }));
      }),
      eventBus.on(Events.VIEW_ROTATION_SNAP_TOGGLED, (snap?: boolean) => {
        setState((s) => ({ ...s, rotationSnap: snap !== undefined ? snap : !s.rotationSnap }));
      }),
      eventBus.on(Events.TIMELAPSE_STATUS_CHANGED, (data: { recording?: boolean; supported?: boolean }) => {
        setState((s) => ({
          ...s,
          timelapseRecording: data.recording ?? s.timelapseRecording,
          timelapseSupported: data.supported ?? s.timelapseSupported,
        }));
      }),
      eventBus.on(Events.COLOR_DROP_TOGGLED, (data?: { active?: boolean }) => {
        // Only update state if we have an explicit active value
        // This prevents double-toggling when main.ts re-emits the event
        const active = data?.active;
        if (typeof active === 'boolean') {
          setState((s) => ({ ...s, colorDropActive: active }));
        }
      }),
      eventBus.on(Events.COLOR_DROP_THRESHOLD_CHANGED, (value: number) => {
        if (Number.isFinite(value)) {
          setState((s) => ({ ...s, colorDropThreshold: Math.max(0, Math.min(1, value)) }));
        }
      }),
      eventBus.on(Events.COLOR_DROP_DRAGGING_CHANGED, (value: boolean) => {
        setState((s) => ({ ...s, colorDropDragging: value }));
      }),
      eventBus.on(Events.LASSO_TOGGLED, (data?: { active?: boolean }) => {
        // Only update state if we have an explicit active value
        // This prevents double-toggling when main.ts re-emits the event
        const active = data?.active;
        if (typeof active === 'boolean') {
          setState((s) => ({ ...s, lassoActive: active }));
        }
      }),
      eventBus.on(Events.SELECTION_UPDATED, (data?: { active?: boolean }) => {
        if (data?.active !== undefined) {
          setState((s) => ({ ...s, selectionActive: data.active ?? false }));
        }
      }),
      eventBus.on(Events.UI_TOGGLED, () => {
        setState((s) => {
          const next = !s.uiHidden;
          try {
            window.localStorage.setItem('opencanvas:ui-hidden', JSON.stringify(next));
          } catch (error) {
            console.warn('Failed to persist UI state', error);
          }
          return { ...s, uiHidden: next };
        });
      }),
      eventBus.on(Events.READONLY_TOGGLED, (data?: { readonly?: boolean }) => {
        setState((s) => ({ ...s, isReadOnly: data?.readonly ?? !s.isReadOnly }));
      }),
      eventBus.on(Events.ERASER_TOGGLED, (data?: { active?: boolean }) => {
        // Only update state if we have an explicit active value
        // This prevents double-toggling when main.ts re-emits the event
        const active = data?.active;
        if (typeof active === 'boolean') {
          setState((s) => ({ ...s, eraserActive: active }));
        }
      }),

    ];

    // Load initial canvas state
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

    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  // Load persisted settings
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('opencanvas:ui-hidden');
      if (stored) {
        const hidden = JSON.parse(stored);
        if (typeof hidden === 'boolean') {
          setState((s) => ({ ...s, uiHidden: hidden }));
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

  // Persist color history
  useEffect(() => {
    try {
      window.localStorage.setItem('opencanvas:palette', JSON.stringify(state.colorHistory));
    } catch (error) {
      console.warn('Failed to persist palette', error);
    }
  }, [state.colorHistory]);

  // Handlers
  const handleUndo = () => eventBus.emit(Events.UNDO_REQUESTED, null);
  const handleRedo = () => eventBus.emit(Events.REDO_REQUESTED, null);
  const handleExportProject = () => eventBus.emit(Events.PROJECT_EXPORT_REQUESTED, null);
  const handleImportProject = () => fileInputRef.current?.click();
  const handleRecoverProject = () => eventBus.emit(Events.PROJECT_RECOVER_REQUESTED, null);
  const handleCanvasSizeToggle = () => setState((s) => ({ ...s, showCanvasSize: !s.showCanvasSize }));
  const handleViewFit = () => eventBus.emit(Events.VIEW_FIT_REQUESTED, null);
  const handleRotationSnapToggle = () => eventBus.emit(Events.VIEW_ROTATION_SNAP_TOGGLED, null);
  const handleTimelapseToggle = () => eventBus.emit(Events.TIMELAPSE_TOGGLED, null);

  const handleCanvasWidthChange = (value: number) => {
    if (Number.isFinite(value)) {
      setState((s) => ({ ...s, canvasWidth: Math.max(1, Math.min(8192, value)) }));
    }
  };
  const handleCanvasHeightChange = (value: number) => {
    if (Number.isFinite(value)) {
      setState((s) => ({ ...s, canvasHeight: Math.max(1, Math.min(8192, value)) }));
    }
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

  const toggleLayerPanel = () => setState((s) => ({ ...s, layerPanelOpen: !s.layerPanelOpen }));
  const toggleColorPicker = () => setState((s) => ({ ...s, colorPickerOpen: !s.colorPickerOpen }));
  const toggleBrushLibrary = () => setState((s) => ({ ...s, brushLibraryOpen: !s.brushLibraryOpen }));


  const getActiveTool = (): 'brush' | 'eraser' | 'smudge' | 'colorDrop' | 'lasso' | 'hand' | 'move' => {
    if (state.colorDropActive) return 'colorDrop';
    if (state.lassoActive) return 'lasso';
    if (state.panModeActive) return 'hand';
    if (state.eraserActive) return 'eraser';
    return 'brush';
  };

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
        }}>
          <button
            onClick={() => eventBus.emit(Events.UI_TOGGLED, null)}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(30, 30, 35, 0.9)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
            title="Show UI"
          >
            <Eye size={20} />
          </button>
        </div>
      ) : (
        <>
          {/* Top-left: Editing toolbar */}
          <ProcreateToolbar
            canUndo={state.canUndo}
            canRedo={state.canRedo}
            showCanvasSize={state.showCanvasSize}
            rotationSnap={state.rotationSnap}
            timelapseRecording={state.timelapseRecording}
            timelapseSupported={state.timelapseSupported}
            hasAutosave={state.hasAutosave}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onExportProject={handleExportProject}
            onImportProject={handleImportProject}
            onRecoverProject={handleRecoverProject}
            onCanvasSizeToggle={handleCanvasSizeToggle}
            onViewFit={handleViewFit}
            onRotationSnapToggle={handleRotationSnapToggle}
            onTimelapseToggle={handleTimelapseToggle}
          />

          {/* Top-right: Painting tools */}
          <ProcreateToolsPanel
            activeTool={getActiveTool()}
            brushColor={state.brushColor}
            colorDropActive={state.colorDropActive}
            lassoActive={state.lassoActive}
            panModeActive={state.panModeActive}
            eraserActive={state.eraserActive}
            onColorClick={toggleColorPicker}
            onLayersClick={toggleLayerPanel}
            onBrushLibraryClick={toggleBrushLibrary}
          />


          {/* Left: Size/Opacity sliders */}
          <ProcreateSidebar
            brushSize={state.brushSize}
            brushOpacity={state.brushOpacity}
            eyedropperActive={state.eyedropperActive}
          />

          {/* Floating panels */}
          <ProcreateLayerPanel
            layers={state.layers}
            activeLayerId={state.activeLayerId}
            soloLayerId={state.soloLayerId}
            referenceLayerId={state.referenceLayerId}
            isOpen={state.layerPanelOpen}
            onClose={() => setState((s) => ({ ...s, layerPanelOpen: false }))}
          />

          <ProcreateColorPicker
            color={state.brushColor}
            backgroundColor={state.backgroundColor}
            colorHistory={state.colorHistory}
            isOpen={state.colorPickerOpen}
            onClose={() => setState((s) => ({ ...s, colorPickerOpen: false }))}
          />


          <BrushLibrary
            isOpen={state.brushLibraryOpen}
            onClose={() => setState((s) => ({ ...s, brushLibraryOpen: false }))}
            currentSize={state.brushSize}
            currentOpacity={state.brushOpacity}
          />


          {/* Canvas size panel */}
          {state.showCanvasSize && (
            <CanvasSizePanel
              width={state.canvasWidth}
              height={state.canvasHeight}
              onWidthChange={handleCanvasWidthChange}
              onHeightChange={handleCanvasHeightChange}
              onApply={handleCanvasResizeApply}
              onFit={handleCanvasFit}
              onClose={() => setState((s) => ({ ...s, showCanvasSize: false }))}
            />
          )}

          {/* Bottom center: Status */}
          <StatusIndicator
            zoomLevel={state.zoomLevel}
            rotationAngle={state.rotationAngle}
          />

          {/* Color drop drag indicator */}
          {state.colorDropDragging && (
            <ColorDropIndicator
              threshold={state.colorDropThreshold}
              brushColor={state.brushColor}
            />
          )}

          {/* Read-only indicator */}
          {state.isReadOnly && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(160, 60, 60, 0.9)',
              padding: '6px 16px',
              borderRadius: '16px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              pointerEvents: 'none',
            }}>
              Read-only Mode
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
