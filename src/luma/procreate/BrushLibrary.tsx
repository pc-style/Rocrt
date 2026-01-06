import { useState, useCallback } from 'preact/hooks';
import { X, Palette, Paintbrush2, Pen, PenLine, Wind } from 'lucide-preact';
import { IconButton } from '../components/IconButton';
import { eventBus, Events } from '../../core/events';

interface BrushPreset {
    id: string;
    name: string;
    category: string;
    size: number;
    opacity: number;
    spacing: number;
    icon: 'brush' | 'pen' | 'pencil' | 'airbrush' | 'marker';
}

const BRUSH_PRESETS: BrushPreset[] = [
    // Sketching
    { id: 'pencil-hb', name: 'HB Pencil', category: 'Sketching', size: 4, opacity: 0.85, spacing: 0.05, icon: 'pencil' },
    { id: 'pencil-6b', name: '6B Pencil', category: 'Sketching', size: 8, opacity: 0.9, spacing: 0.08, icon: 'pencil' },
    { id: 'technical-pen', name: 'Technical Pen', category: 'Sketching', size: 2, opacity: 1.0, spacing: 0.02, icon: 'pen' },
    // Inking
    { id: 'studio-pen', name: 'Studio Pen', category: 'Inking', size: 6, opacity: 1.0, spacing: 0.03, icon: 'pen' },
    { id: 'syrup', name: 'Syrup', category: 'Inking', size: 10, opacity: 1.0, spacing: 0.05, icon: 'brush' },
    { id: 'dry-ink', name: 'Dry Ink', category: 'Inking', size: 8, opacity: 0.95, spacing: 0.1, icon: 'pen' },
    // Painting
    { id: 'round-brush', name: 'Round Brush', category: 'Painting', size: 20, opacity: 0.8, spacing: 0.15, icon: 'brush' },
    { id: 'flat-brush', name: 'Flat Brush', category: 'Painting', size: 30, opacity: 0.75, spacing: 0.12, icon: 'brush' },
    { id: 'gouache', name: 'Gouache', category: 'Painting', size: 24, opacity: 0.9, spacing: 0.1, icon: 'brush' },
    // Airbrushing
    { id: 'soft-airbrush', name: 'Soft Airbrush', category: 'Airbrushing', size: 80, opacity: 0.3, spacing: 0.25, icon: 'airbrush' },
    { id: 'hard-airbrush', name: 'Hard Airbrush', category: 'Airbrushing', size: 40, opacity: 0.5, spacing: 0.15, icon: 'airbrush' },
    { id: 'spray-paint', name: 'Spray Paint', category: 'Airbrushing', size: 60, opacity: 0.4, spacing: 0.2, icon: 'airbrush' },
    // Calligraphy
    { id: 'mono-line', name: 'Monoline', category: 'Calligraphy', size: 5, opacity: 1.0, spacing: 0.02, icon: 'marker' },
    { id: 'brush-pen', name: 'Brush Pen', category: 'Calligraphy', size: 12, opacity: 1.0, spacing: 0.05, icon: 'pen' },
    { id: 'chalk', name: 'Chalk', category: 'Calligraphy', size: 15, opacity: 0.8, spacing: 0.08, icon: 'pencil' },
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
        eventBus.emit(Events.BRUSH_SIZE_CHANGED, brush.size);
        eventBus.emit(Events.BRUSH_OPACITY_CHANGED, brush.opacity);
        // Could also emit spacing if we add brush spacing support
    }, []);

    if (!isOpen) return null;

    const brushesInCategory = BRUSH_PRESETS.filter((b) => b.category === selectedCategory);

    return (
        <div
            style={{
                position: 'absolute',
                top: '80px',
                left: '80px',
                width: '320px',
                maxHeight: '500px',
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
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            color: selectedCategory === cat ? '#fff' : '#888',
                            fontSize: '12px',
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
                                padding: '12px',
                                background: isSelected ? 'rgba(100, 120, 180, 0.3)' : 'transparent',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.1s ease',
                            }}
                        >
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'rgba(60, 70, 90, 0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isSelected ? '#8aafff' : '#aaa',
                                }}
                            >
                                {getBrushIcon(brush.icon, 22)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>
                                    {brush.name}
                                </div>
                                <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
                                    Size: {brush.size}px · Opacity: {Math.round(brush.opacity * 100)}%
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Current brush info */}
            <div
                style={{
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(20, 20, 25, 0.5)',
                }}
            >
                <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>Current Settings</div>
                <div style={{ color: '#ddd', fontSize: '12px' }}>
                    Size: {Math.round(currentSize)}px · Opacity: {Math.round(currentOpacity * 100)}%
                </div>
            </div>
        </div>
    );
}
