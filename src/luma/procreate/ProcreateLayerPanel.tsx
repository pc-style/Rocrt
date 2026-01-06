import { IconButton } from '../components/IconButton';
import {
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Plus,
    Trash2,
    Copy,
    ChevronUp,
    ChevronDown,
    Merge,
    X,
} from 'lucide-preact';
import { eventBus, Events } from '../../core/events';
import type { Layer } from '../../core/types';
import { BlendMode } from '../../core/types';

interface ProcreateLayerPanelProps {
    layers: Layer[];
    activeLayerId: string;
    soloLayerId: string | null;
    referenceLayerId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Floating layer panel matching Procreate's layers interface.
 * Shows list of layers with visibility, lock, opacity, and blend mode controls.
 */
export function ProcreateLayerPanel({
    layers,
    activeLayerId,
    soloLayerId,
    referenceLayerId,
    isOpen,
    onClose,
}: ProcreateLayerPanelProps) {
    if (!isOpen) return null;

    const canDelete = layers.length > 1;
    const topLayerId = layers[layers.length - 1]?.id ?? '';
    const bottomLayerId = layers[0]?.id ?? '';

    const handleAddLayer = () => eventBus.emit(Events.LAYER_ADDED, null);
    const handleDeleteLayer = (id: string) => canDelete && eventBus.emit(Events.LAYER_DELETED, id);
    const handleSelectLayer = (id: string) => eventBus.emit(Events.LAYER_SELECTED, id);
    const handleToggleVisibility = (id: string, visible: boolean) =>
        eventBus.emit(Events.LAYER_VISIBILITY_TOGGLED, { layerId: id, visible });
    const handleToggleLock = (id: string, locked: boolean) =>
        eventBus.emit(Events.LAYER_LOCK_TOGGLED, { layerId: id, locked });
    const handleOpacityChange = (id: string, opacity: number) =>
        eventBus.emit(Events.LAYER_OPACITY_CHANGED, { layerId: id, opacity });
    const handleBlendModeChange = (id: string, blendMode: BlendMode) =>
        eventBus.emit(Events.LAYER_BLEND_MODE_CHANGED, { layerId: id, blendMode });
    const handleDuplicate = (id: string) => eventBus.emit(Events.LAYER_DUPLICATED, id);
    const handleMergeDown = (id: string) => eventBus.emit(Events.LAYER_MERGED_DOWN, id);
    const handleMoveUp = (id: string) => eventBus.emit(Events.LAYER_MOVED_UP, id);
    const handleMoveDown = (id: string) => eventBus.emit(Events.LAYER_MOVED_DOWN, id);

    return (
        <div
            style={{
                position: 'absolute',
                top: '80px',
                right: '16px',
                width: '280px',
                maxHeight: '450px',
                background: 'rgba(28, 28, 32, 0.96)',
                borderRadius: '16px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                pointerEvents: 'auto',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>Layers</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <IconButton
                        icon={<Plus size={18} strokeWidth={2} />}
                        onClick={handleAddLayer}
                        size={32}
                        title="Add Layer"
                        variant="primary"
                    />
                    <IconButton
                        icon={<X size={18} strokeWidth={2} />}
                        onClick={onClose}
                        size={32}
                        title="Close"
                        variant="ghost"
                    />
                </div>
            </div>

            {/* Layer list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {[...layers].reverse().map((layer) => {
                    const isActive = layer.id === activeLayerId;
                    const isSolo = layer.id === soloLayerId;
                    const isRef = layer.id === referenceLayerId;
                    const isTop = layer.id === topLayerId;
                    const isBottom = layer.id === bottomLayerId;

                    return (
                        <div
                            key={layer.id}
                            onClick={() => handleSelectLayer(layer.id)}
                            style={{
                                background: isActive ? 'rgba(80, 90, 120, 0.5)' : 'rgba(50, 50, 60, 0.4)',
                                borderRadius: '10px',
                                padding: '10px',
                                marginBottom: '6px',
                                cursor: 'pointer',
                                border: isActive ? '1px solid rgba(120, 140, 180, 0.4)' : '1px solid transparent',
                                transition: 'background 0.15s ease',
                            }}
                        >
                            {/* Layer row 1: visibility, name, quick actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(layer.id, !layer.visible); }}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: layer.visible ? 'rgba(80, 100, 130, 0.7)' : 'rgba(50, 50, 55, 0.7)',
                                        color: layer.visible ? '#fff' : '#666',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    title={layer.visible ? 'Hide' : 'Show'}
                                >
                                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleLock(layer.id, !layer.locked); }}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: layer.locked ? 'rgba(140, 110, 60, 0.7)' : 'rgba(50, 50, 55, 0.7)',
                                        color: layer.locked ? '#ffe7a1' : '#666',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    title={layer.locked ? 'Unlock' : 'Lock'}
                                >
                                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>

                                <span
                                    style={{
                                        flex: 1,
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: isActive ? 500 : 400,
                                        opacity: layer.visible ? 1 : 0.5,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {layer.name}
                                    {isSolo && <span style={{ color: '#8af', marginLeft: '6px', fontSize: '10px' }}>SOLO</span>}
                                    {isRef && <span style={{ color: '#8fa', marginLeft: '6px', fontSize: '10px' }}>REF</span>}
                                </span>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDuplicate(layer.id); }}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        background: 'rgba(60, 60, 70, 0.6)',
                                        color: '#aaa',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    title="Duplicate"
                                >
                                    <Copy size={12} />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }}
                                    disabled={!canDelete}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        background: canDelete ? 'rgba(100, 50, 50, 0.6)' : 'rgba(40, 40, 45, 0.4)',
                                        color: canDelete ? '#f99' : '#555',
                                        cursor: canDelete ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    title="Delete"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>

                            {/* Layer row 2: opacity slider, blend mode, reorder */}
                            {isActive && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                    <span style={{ color: '#888', fontSize: '11px', width: '45px' }}>Opacity</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={Math.round(layer.opacity * 100)}
                                        onInput={(e) => handleOpacityChange(layer.id, parseInt((e.target as HTMLInputElement).value, 10) / 100)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ flex: 1, height: '4px' }}
                                    />
                                    <span style={{ color: '#fff', fontSize: '11px', width: '30px', textAlign: 'right' }}>
                                        {Math.round(layer.opacity * 100)}%
                                    </span>
                                </div>
                            )}

                            {isActive && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                    <span style={{ color: '#888', fontSize: '11px', width: '45px' }}>Blend</span>
                                    <select
                                        value={layer.blendMode}
                                        onChange={(e) => handleBlendModeChange(layer.id, (e.target as HTMLSelectElement).value as BlendMode)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(40, 40, 50, 0.8)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                        }}
                                    >
                                        <option value={BlendMode.Normal}>Normal</option>
                                        <option value={BlendMode.Multiply}>Multiply</option>
                                        <option value={BlendMode.Screen}>Screen</option>
                                    </select>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveUp(layer.id); }}
                                        disabled={isTop}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '5px',
                                            border: 'none',
                                            background: isTop ? 'rgba(40, 40, 45, 0.4)' : 'rgba(60, 60, 70, 0.6)',
                                            color: isTop ? '#555' : '#aaa',
                                            cursor: isTop ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        title="Move Up"
                                    >
                                        <ChevronUp size={14} />
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveDown(layer.id); }}
                                        disabled={isBottom}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '5px',
                                            border: 'none',
                                            background: isBottom ? 'rgba(40, 40, 45, 0.4)' : 'rgba(60, 60, 70, 0.6)',
                                            color: isBottom ? '#555' : '#aaa',
                                            cursor: isBottom ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        title="Move Down"
                                    >
                                        <ChevronDown size={14} />
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMergeDown(layer.id); }}
                                        disabled={isBottom}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '5px',
                                            border: 'none',
                                            background: isBottom ? 'rgba(40, 40, 45, 0.4)' : 'rgba(60, 60, 70, 0.6)',
                                            color: isBottom ? '#555' : '#aaa',
                                            cursor: isBottom ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        title="Merge Down"
                                    >
                                        <Merge size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
