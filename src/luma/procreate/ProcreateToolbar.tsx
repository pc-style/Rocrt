import { IconButton } from '../components/IconButton';
import {
    ArrowLeft,
    Undo2,
    Redo2,
    Download,
    Upload,
    Settings,
    Maximize2,
    RotateCcw,
    Maximize,
    Trash2,
    CircleDot,
    X,
} from 'lucide-preact';
import { eventBus, Events } from '../../core/events';

interface ProcreateToolbarProps {
    canUndo: boolean;
    canRedo: boolean;
    showCanvasSize: boolean;
    rotationSnap: boolean;
    timelapseRecording: boolean;
    timelapseSupported: boolean;
    hasAutosave: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onExportProject: () => void;
    onImportProject: () => void;
    onRecoverProject: () => void;
    onCanvasSizeToggle: () => void;
    onViewFit: () => void;
    onRotationSnapToggle: () => void;
    onTimelapseToggle: () => void;
}

/**
 * Top-left editing toolbar with Gallery, Undo/Redo, Export/Import, Canvas controls.
 * Matches Procreate's top-left menu bar layout.
 */
export function ProcreateToolbar({
    canUndo,
    canRedo,
    showCanvasSize,
    rotationSnap,
    timelapseRecording,
    timelapseSupported,
    hasAutosave,
    onUndo,
    onRedo,
    onExportProject,
    onImportProject,
    onRecoverProject,
    onCanvasSizeToggle,
    onViewFit,
    onRotationSnapToggle,
    onTimelapseToggle,
}: ProcreateToolbarProps) {
    const handleGallery = () => {
        eventBus.emit('app:navigate-gallery', null);
    };

    const handleResetView = () => {
        eventBus.emit(Events.VIEW_RESET_REQUESTED, null);
    };

    const handleClearCanvas = () => {
        eventBus.emit(Events.CANVAS_CLEAR_REQUESTED, null);
    };

    const handleHideUI = () => {
        eventBus.emit(Events.UI_TOGGLED, null);
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                display: 'flex',
                gap: '6px',
                background: 'rgba(30, 30, 35, 0.92)',
                padding: '8px',
                borderRadius: '14px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                pointerEvents: 'auto',
            }}
        >
            <IconButton
                icon={<ArrowLeft size={20} strokeWidth={2} />}
                onClick={handleGallery}
                title="Gallery"
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            <IconButton
                icon={<Undo2 size={18} strokeWidth={2} />}
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
            />
            <IconButton
                icon={<Redo2 size={18} strokeWidth={2} />}
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            <IconButton
                icon={<Download size={18} strokeWidth={2} />}
                onClick={onExportProject}
                title="Save Project"
            />
            <IconButton
                icon={<Upload size={18} strokeWidth={2} />}
                onClick={onImportProject}
                title="Load Project"
            />
            <IconButton
                icon={<Settings size={18} strokeWidth={2} />}
                onClick={onRecoverProject}
                disabled={!hasAutosave}
                active={hasAutosave}
                title={hasAutosave ? 'Recover Autosave' : 'No autosave'}
                variant="ghost"
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            <IconButton
                icon={<Maximize2 size={18} strokeWidth={2} />}
                onClick={onCanvasSizeToggle}
                active={showCanvasSize}
                title="Canvas Size"
            />
            <IconButton
                icon={<Maximize size={18} strokeWidth={2} />}
                onClick={onViewFit}
                title="Fit View (F)"
            />
            <IconButton
                icon={<RotateCcw size={18} strokeWidth={2} />}
                onClick={handleResetView}
                title="Reset View"
            />
            <IconButton
                icon={<CircleDot size={18} strokeWidth={2} />}
                onClick={onRotationSnapToggle}
                active={rotationSnap}
                title={rotationSnap ? 'Rotation Snap On' : 'Rotation Snap Off'}
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            <IconButton
                icon={<CircleDot size={16} strokeWidth={2.5} fill={timelapseRecording ? '#ff4444' : 'none'} />}
                onClick={onTimelapseToggle}
                disabled={!timelapseSupported}
                active={timelapseRecording}
                title={timelapseRecording ? 'Stop Timelapse' : 'Start Timelapse'}
                variant={timelapseRecording ? 'danger' : 'default'}
            />

            <IconButton
                icon={<Trash2 size={18} strokeWidth={2} />}
                onClick={handleClearCanvas}
                title="Clear Canvas"
                variant="danger"
            />

            <IconButton
                icon={<X size={18} strokeWidth={2} />}
                onClick={handleHideUI}
                title="Hide UI"
                variant="ghost"
            />
        </div>
    );
}
