import { useRef, useCallback } from 'preact/hooks';
import { X } from 'lucide-preact';
import { IconButton } from '../components/IconButton';
import { eventBus, Events } from '../../core/events';
import type { Color } from '../../core/types';

interface ProcreateColorPickerProps {
    color: Color;
    backgroundColor: Color;
    colorHistory: Color[];
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Color picker popup with HSV controls and color history swatches.
 */
export function ProcreateColorPicker({
    color,
    backgroundColor,
    colorHistory,
    isOpen,
    onClose,
}: ProcreateColorPickerProps) {
    const colorInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);

    const handleColorChange = useCallback((e: Event) => {
        const hex = (e.target as HTMLInputElement).value.replace('#', '');
        if (hex.length !== 6) return;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        eventBus.emit(Events.BRUSH_COLOR_CHANGED, { r, g, b, a: 255 });
    }, []);

    const handleSwatchClick = (c: Color) => {
        eventBus.emit(Events.BRUSH_COLOR_CHANGED, c);
    };

    const handleOpenNative = () => {
        colorInputRef.current?.click();
    };

    const handleBackgroundChange = useCallback((e: Event) => {
        const hex = (e.target as HTMLInputElement).value.replace('#', '');
        if (hex.length !== 6) return;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        eventBus.emit(Events.BACKGROUND_COLOR_CHANGED, { r, g, b, a: 255 });
    }, []);

    const handleOpenBgPicker = () => {
        bgInputRef.current?.click();
    };

    if (!isOpen) return null;

    const colorHex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;

    return (
        <div
            style={{
                position: 'absolute',
                top: '80px',
                right: '80px',
                width: '260px',
                background: 'rgba(28, 28, 32, 0.96)',
                borderRadius: '16px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                pointerEvents: 'auto',
                overflow: 'hidden',
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
                <span style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>Color</span>
                <IconButton
                    icon={<X size={18} strokeWidth={2} />}
                    onClick={onClose}
                    size={32}
                    variant="ghost"
                    title="Close"
                />
            </div>

            {/* Color preview and input */}
            <div style={{ padding: '16px' }}>
                {/* Current color preview */}
                <div
                    onClick={handleOpenNative}
                    style={{
                        width: '100%',
                        height: '60px',
                        borderRadius: '12px',
                        background: colorHex,
                        cursor: 'pointer',
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                        marginBottom: '16px',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <input
                        ref={colorInputRef}
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
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                        }}
                    >
                        {colorHex.toUpperCase()}
                    </div>
                </div>

                {/* Color history swatches */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recent Colors
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {colorHistory.map((c, i) => {
                            const swatchHex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
                            const isSelected = c.r === color.r && c.g === color.g && c.b === color.b;
                            return (
                                <button
                                    key={`${swatchHex}-${i}`}
                                    onClick={() => handleSwatchClick(c)}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: isSelected ? '2px solid #fff' : '2px solid transparent',
                                        background: swatchHex,
                                        cursor: 'pointer',
                                        boxShadow: isSelected ? '0 0 8px rgba(255,255,255,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
                                        transition: 'transform 0.1s ease',
                                    }}
                                    title={swatchHex}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Quick color presets */}
                <div>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Quick Colors
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {[
                            { r: 255, g: 255, b: 255, a: 255 },
                            { r: 0, g: 0, b: 0, a: 255 },
                            { r: 255, g: 59, b: 48, a: 255 },
                            { r: 255, g: 149, b: 0, a: 255 },
                            { r: 255, g: 204, b: 0, a: 255 },
                            { r: 52, g: 199, b: 89, a: 255 },
                            { r: 0, g: 199, b: 190, a: 255 },
                            { r: 48, g: 176, b: 199, a: 255 },
                            { r: 50, g: 173, b: 230, a: 255 },
                            { r: 0, g: 122, b: 255, a: 255 },
                            { r: 88, g: 86, b: 214, a: 255 },
                            { r: 175, g: 82, b: 222, a: 255 },
                            { r: 255, g: 45, b: 85, a: 255 },
                            { r: 162, g: 132, b: 94, a: 255 },
                        ].map((c, i) => {
                            const hex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
                            return (
                                <button
                                    key={`quick-${i}`}
                                    onClick={() => handleSwatchClick(c)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: hex,
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                    title={hex}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Background color */}
                <div style={{ marginTop: '16px' }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Canvas Background
                    </div>
                    <div
                        onClick={handleOpenBgPicker}
                        style={{
                            width: '100%',
                            height: '40px',
                            borderRadius: '10px',
                            background: `rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`,
                            cursor: 'pointer',
                            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)',
                            position: 'relative',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        <input
                            ref={bgInputRef}
                            type="color"
                            value={`#${backgroundColor.r.toString(16).padStart(2, '0')}${backgroundColor.g.toString(16).padStart(2, '0')}${backgroundColor.b.toString(16).padStart(2, '0')}`}
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
                </div>
            </div>
        </div>
    );
}
