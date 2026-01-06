import { IconButton } from '../components/IconButton';
import {
    Paintbrush,
    Eraser,
    Hand,
    PaintBucket,
    Lasso,
    Layers,
    Move,
} from 'lucide-preact';
import { eventBus, Events } from '../../core/events';
import type { Color } from '../../core/types';

type ActiveTool = 'brush' | 'eraser' | 'smudge' | 'colorDrop' | 'lasso' | 'hand' | 'move';

interface ProcreateToolsPanelProps {
    activeTool: ActiveTool;
    brushColor: Color;
    colorDropActive: boolean;
    lassoActive: boolean;
    panModeActive: boolean;
    onColorClick: () => void;
    onLayersClick: () => void;
}

/**
 * Top-right painting tools panel with Brush, Eraser, Color Drop, Lasso, Layers.
 * Matches Procreate's top-right menu bar layout with painting tools.
 */
export function ProcreateToolsPanel({
    activeTool,
    brushColor,
    colorDropActive,
    lassoActive,
    panModeActive,
    onColorClick,
    onLayersClick,
}: ProcreateToolsPanelProps) {
    const handleBrushSelect = () => {
        // If already on brush, could open brush library
        eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        eventBus.emit(Events.LASSO_TOGGLED, { active: false });
        eventBus.emit(Events.PAN_MODE_TOGGLED, { active: false });
    };

    const handleEraserSelect = () => {
        // Toggle eraser mode
        eventBus.emit(Events.ERASER_TOGGLED, null);
        eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        eventBus.emit(Events.LASSO_TOGGLED, { active: false });
    };

    const handleColorDropToggle = () => {
        eventBus.emit(Events.COLOR_DROP_TOGGLED, null);
        eventBus.emit(Events.LASSO_TOGGLED, { active: false });
        eventBus.emit(Events.PAN_MODE_TOGGLED, { active: false });
    };

    const handleLassoToggle = () => {
        eventBus.emit(Events.LASSO_TOGGLED, null);
        eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        eventBus.emit(Events.PAN_MODE_TOGGLED, { active: false });
    };

    const handleHandToggle = () => {
        eventBus.emit(Events.PAN_MODE_TOGGLED, null);
        eventBus.emit(Events.COLOR_DROP_TOGGLED, { active: false });
        eventBus.emit(Events.LASSO_TOGGLED, { active: false });
    };

    const handleMoveToggle = () => {
        eventBus.emit(Events.TRANSFORM_MODE_TOGGLED, null);
    };

    const colorHex = `rgb(${brushColor.r}, ${brushColor.g}, ${brushColor.b})`;

    return (
        <div
            style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
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
                icon={<Paintbrush size={20} strokeWidth={2} />}
                onClick={handleBrushSelect}
                active={activeTool === 'brush' && !colorDropActive && !lassoActive && !panModeActive}
                title="Brush (B)"
            />

            <IconButton
                icon={<Eraser size={20} strokeWidth={2} />}
                onClick={handleEraserSelect}
                active={activeTool === 'eraser'}
                title="Eraser (E)"
            />

            <IconButton
                icon={<PaintBucket size={20} strokeWidth={2} />}
                onClick={handleColorDropToggle}
                active={colorDropActive}
                title="Color Drop (D)"
            />

            <IconButton
                icon={<Lasso size={20} strokeWidth={2} />}
                onClick={handleLassoToggle}
                active={lassoActive}
                title="Lasso Selection (S)"
            />

            <IconButton
                icon={<Hand size={20} strokeWidth={2} />}
                onClick={handleHandToggle}
                active={panModeActive}
                title="Hand Tool (Space)"
            />

            <IconButton
                icon={<Move size={20} strokeWidth={2} />}
                onClick={handleMoveToggle}
                active={activeTool === 'move'}
                title="Move/Transform"
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            {/* Color circle button */}
            <button
                onClick={onColorClick}
                style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.3)',
                    background: colorHex,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                    transition: 'transform 0.1s ease',
                }}
                title="Color"
            />

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 2px' }} />

            <IconButton
                icon={<Layers size={20} strokeWidth={2} />}
                onClick={onLayersClick}
                title="Layers"
            />
        </div>
    );
}
