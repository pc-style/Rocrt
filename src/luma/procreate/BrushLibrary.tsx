import { useState, useCallback } from 'preact/hooks';
import { X, Palette, Paintbrush2, Pen, PenLine, Wind, Droplets } from 'lucide-preact';
import { IconButton } from '../components/IconButton';
import { eventBus, Events } from '../../core/events';

// Advanced brush preset with all the new properties
interface BrushPreset {
    id: string;
    name: string;
    category: string;
    icon: 'brush' | 'pen' | 'pencil' | 'airbrush' | 'marker' | 'splatter';
    description: string;
    // Basic
    size: number;
    opacity: number;
    spacing: number;
    // Advanced
    scatter: number;
    scatterBoth: boolean;
    rotation: number;
    rotationJitter: number;
    rotateToStroke: boolean;
    sizeJitter: number;
    count: number;
    flow: number;
    roundness: number;
    hardness: number;
}

// Default values to reduce duplication
const defaults = {
    scatter: 0,
    scatterBoth: true,
    rotation: 0,
    rotationJitter: 0,
    rotateToStroke: false,
    sizeJitter: 0,
    count: 1,
    flow: 1,
    roundness: 1,
    hardness: 1,
};

const BRUSH_PRESETS: BrushPreset[] = [
    // === SKETCHING ===
    {
        id: 'pencil-hb', name: 'HB Pencil', category: 'Sketching', icon: 'pencil',
        description: 'Clean technical pencil',
        size: 4, opacity: 0.85, spacing: 0.05,
        ...defaults, sizeJitter: 0.1, hardness: 0.85
    },
    {
        id: 'pencil-6b', name: '6B Pencil', category: 'Sketching', icon: 'pencil',
        description: 'Soft dark pencil with texture',
        size: 8, opacity: 0.9, spacing: 0.08,
        ...defaults, sizeJitter: 0.15, hardness: 0.7, scatter: 0.05
    },
    {
        id: 'technical-pen', name: 'Technical Pen', category: 'Sketching', icon: 'pen',
        description: 'Precise uniform line',
        size: 2, opacity: 1.0, spacing: 0.02,
        ...defaults
    },
    {
        id: 'charcoal-sketch', name: 'Charcoal Sketch', category: 'Sketching', icon: 'pencil',
        description: 'Rough charcoal texture',
        size: 12, opacity: 0.7, spacing: 0.1,
        ...defaults, scatter: 0.15, sizeJitter: 0.25, rotationJitter: 30, hardness: 0.5
    },

    // === INKING ===
    {
        id: 'studio-pen', name: 'Studio Pen', category: 'Inking', icon: 'pen',
        description: 'Smooth pressure-sensitive ink',
        size: 6, opacity: 1.0, spacing: 0.03,
        ...defaults
    },
    {
        id: 'dry-ink', name: 'Dry Ink', category: 'Inking', icon: 'pen',
        description: 'Textured ink with gaps',
        size: 8, opacity: 0.95, spacing: 0.1,
        ...defaults, scatter: 0.1, sizeJitter: 0.2, hardness: 0.9
    },
    {
        id: 'comic-ink', name: 'Comic Ink', category: 'Inking', icon: 'pen',
        description: 'Bold comic-style line',
        size: 9, opacity: 1.0, spacing: 0.05,
        ...defaults, hardness: 1.0
    },
    {
        id: 'brush-marker', name: 'Brush Marker', category: 'Inking', icon: 'marker',
        description: 'Flat chisel marker',
        size: 14, opacity: 1.0, spacing: 0.06,
        ...defaults, roundness: 0.4, rotateToStroke: true
    },

    // === PAINTING ===
    {
        id: 'round-brush', name: 'Round Brush', category: 'Painting', icon: 'brush',
        description: 'Classic round brush',
        size: 20, opacity: 0.8, spacing: 0.15,
        ...defaults, hardness: 0.7
    },
    {
        id: 'flat-brush', name: 'Flat Brush', category: 'Painting', icon: 'brush',
        description: 'Rectangular brush strokes',
        size: 30, opacity: 0.75, spacing: 0.12,
        ...defaults, roundness: 0.3, rotateToStroke: true, hardness: 0.8
    },
    {
        id: 'watercolor', name: 'Watercolor', category: 'Painting', icon: 'brush',
        description: 'Soft wet edges, low flow',
        size: 40, opacity: 0.5, spacing: 0.18,
        ...defaults, hardness: 0.15, flow: 0.6, scatter: 0.08, sizeJitter: 0.15
    },
    {
        id: 'oil-paint', name: 'Oil Paint', category: 'Painting', icon: 'brush',
        description: 'Thick impasto texture',
        size: 35, opacity: 0.9, spacing: 0.15,
        ...defaults, sizeJitter: 0.1, rotationJitter: 15, hardness: 0.85
    },
    {
        id: 'gouache', name: 'Gouache', category: 'Painting', icon: 'brush',
        description: 'Opaque matte paint',
        size: 24, opacity: 0.95, spacing: 0.1,
        ...defaults, hardness: 0.6
    },

    // === SPRAY / AIRBRUSH ===
    {
        id: 'soft-airbrush', name: 'Soft Airbrush', category: 'Spray', icon: 'airbrush',
        description: 'Very soft gradients',
        size: 80, opacity: 0.2, spacing: 0.25,
        ...defaults, hardness: 0.1, flow: 0.3
    },
    {
        id: 'hard-airbrush', name: 'Hard Airbrush', category: 'Spray', icon: 'airbrush',
        description: 'Defined airbrush edge',
        size: 40, opacity: 0.4, spacing: 0.15,
        ...defaults, hardness: 0.5, flow: 0.5
    },
    {
        id: 'spray-paint', name: 'Spray Paint', category: 'Spray', icon: 'splatter',
        description: 'Scattered paint dots',
        size: 50, opacity: 0.6, spacing: 0.15,
        ...defaults, scatter: 0.6, count: 8, sizeJitter: 0.5, rotationJitter: 360, hardness: 0.9
    },
    {
        id: 'mist', name: 'Mist', category: 'Spray', icon: 'airbrush',
        description: 'Fine scattered particles',
        size: 60, opacity: 0.3, spacing: 0.2,
        ...defaults, scatter: 0.7, count: 12, sizeJitter: 0.6, hardness: 0.3
    },

    // === SPLATTER / ORGANIC ===
    {
        id: 'splatter', name: 'Splatter', category: 'Splatter', icon: 'splatter',
        description: 'Random paint drops',
        size: 30, opacity: 0.8, spacing: 0.3,
        ...defaults, scatter: 0.9, count: 6, sizeJitter: 0.7, rotationJitter: 360, hardness: 1.0
    },
    {
        id: 'ink-splatter', name: 'Ink Splatter', category: 'Splatter', icon: 'splatter',
        description: 'Wet ink splashes',
        size: 25, opacity: 0.9, spacing: 0.25,
        ...defaults, scatter: 0.8, count: 5, sizeJitter: 0.6, rotationJitter: 180, hardness: 0.7
    },
    {
        id: 'stipple', name: 'Stipple', category: 'Splatter', icon: 'brush',
        description: 'Dot pattern shading',
        size: 8, opacity: 0.95, spacing: 0.5,
        ...defaults, scatter: 0.3, count: 4, hardness: 1.0
    },
    {
        id: 'noise-brush', name: 'Noise Brush', category: 'Splatter', icon: 'airbrush',
        description: 'Grainy texture',
        size: 30, opacity: 0.4, spacing: 0.2,
        ...defaults, scatter: 0.5, count: 10, sizeJitter: 0.8, hardness: 0.6
    },
    {
        id: 'confetti', name: 'Confetti', category: 'Splatter', icon: 'splatter',
        description: 'Scattered shapes',
        size: 12, opacity: 1.0, spacing: 0.4,
        ...defaults, scatter: 1.0, count: 3, sizeJitter: 0.5, rotationJitter: 360, roundness: 0.6
    },

    // === TEXTURE ===
    {
        id: 'charcoal', name: 'Charcoal', category: 'Texture', icon: 'pencil',
        description: 'Grainy charcoal stick',
        size: 20, opacity: 0.7, spacing: 0.12,
        ...defaults, scatter: 0.2, sizeJitter: 0.3, rotationJitter: 45, hardness: 0.4
    },
    {
        id: 'pastel', name: 'Pastel', category: 'Texture', icon: 'brush',
        description: 'Soft chalky strokes',
        size: 25, opacity: 0.65, spacing: 0.14,
        ...defaults, scatter: 0.15, sizeJitter: 0.2, hardness: 0.3, roundness: 0.8
    },
    {
        id: 'crayon', name: 'Crayon', category: 'Texture', icon: 'pencil',
        description: 'Waxy texture',
        size: 18, opacity: 0.75, spacing: 0.1,
        ...defaults, scatter: 0.1, sizeJitter: 0.15, hardness: 0.6
    },
    {
        id: 'grain', name: 'Grain', category: 'Texture', icon: 'brush',
        description: 'Film grain effect',
        size: 40, opacity: 0.3, spacing: 0.25,
        ...defaults, scatter: 0.4, count: 6, sizeJitter: 0.5, hardness: 0.8
    },
];

const CATEGORIES = [...new Set(BRUSH_PRESETS.map((b) => b.category))];

interface BrushLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    currentSize: number;
    currentOpacity: number;
}

function getBrushIcon(icon: BrushPreset['icon'], size = 18) {
    switch (icon) {
        case 'pen': return <Pen size={size} strokeWidth={2} />;
        case 'pencil': return <PenLine size={size} strokeWidth={2} />;
        case 'airbrush': return <Wind size={size} strokeWidth={2} />;
        case 'marker': return <Palette size={size} strokeWidth={2} />;
        case 'splatter': return <Droplets size={size} strokeWidth={2} />;
        default: return <Paintbrush2 size={size} strokeWidth={2} />;
    }
}

export function BrushLibrary({
    isOpen,
    onClose,
    currentSize,
    currentOpacity,
}: BrushLibraryProps) {
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [selectedBrush, setSelectedBrush] = useState<string | null>(null);

    const handleBrushSelect = useCallback((brush: BrushPreset) => {
        setSelectedBrush(brush.id);

        // Emit size and opacity for backward compatibility
        eventBus.emit(Events.BRUSH_SIZE_CHANGED, brush.size);
        eventBus.emit(Events.BRUSH_OPACITY_CHANGED, brush.opacity);

        // Emit full brush preset for advanced properties
        eventBus.emit('brush:preset-changed', {
            size: brush.size,
            opacity: brush.opacity,
            spacing: brush.spacing,
            scatter: brush.scatter,
            scatterBoth: brush.scatterBoth,
            rotation: brush.rotation,
            rotationJitter: brush.rotationJitter,
            rotateToStroke: brush.rotateToStroke,
            sizeJitter: brush.sizeJitter,
            count: brush.count,
            flow: brush.flow,
            roundness: brush.roundness,
            hardness: brush.hardness,
        });
    }, []);

    if (!isOpen) return null;

    const brushesInCategory = BRUSH_PRESETS.filter((b) => b.category === selectedCategory);

    return (
        <div
            style={{
                position: 'absolute',
                top: '80px',
                left: '80px',
                width: '340px',
                maxHeight: '520px',
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
                <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>Brush Library</span>
                <IconButton
                    icon={<X size={18} strokeWidth={2} />}
                    onClick={onClose}
                    size={32}
                    variant="ghost"
                    title="Close"
                />
            </div>

            {/* Category tabs */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    overflowX: 'auto',
                    padding: '0 8px',
                }}
            >
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                            padding: '10px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: selectedCategory === cat ? '#fff' : '#888',
                            fontSize: '11px',
                            fontWeight: selectedCategory === cat ? 600 : 400,
                            cursor: 'pointer',
                            borderBottom: selectedCategory === cat ? '2px solid #6b8aff' : '2px solid transparent',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Brush list */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px',
                }}
            >
                {brushesInCategory.map((brush) => {
                    const isSelected = selectedBrush === brush.id;
                    return (
                        <button
                            key={brush.id}
                            onClick={() => handleBrushSelect(brush)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '10px 12px',
                                background: isSelected ? 'rgba(100, 120, 180, 0.3)' : 'transparent',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.1s ease',
                                marginBottom: '2px',
                            }}
                        >
                            <div
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(60, 70, 90, 0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isSelected ? '#8aafff' : '#aaa',
                                }}
                            >
                                {getBrushIcon(brush.icon, 18)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>
                                    {brush.name}
                                </div>
                                <div style={{
                                    color: '#777',
                                    fontSize: '10px',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {brush.description}
                                </div>
                            </div>
                            {/* Advanced indicator */}
                            {(brush.scatter > 0 || brush.count > 1 || brush.hardness < 0.8) && (
                                <div style={{
                                    fontSize: '9px',
                                    color: '#6b8aff',
                                    background: 'rgba(100, 120, 180, 0.2)',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                }}>
                                    {brush.count > 1 ? `×${brush.count}` : brush.scatter > 0.3 ? 'scatter' : 'soft'}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Current settings footer */}
            <div
                style={{
                    padding: '10px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(20, 20, 25, 0.5)',
                    fontSize: '11px',
                    color: '#888',
                }}
            >
                Current: {Math.round(currentSize)}px · {Math.round(currentOpacity * 100)}%
            </div>
        </div>
    );
}
