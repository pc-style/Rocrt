import { useRef, useCallback } from 'preact/hooks';
import { JSX } from 'preact';

interface VerticalSliderProps {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    label?: string;
    showValue?: boolean;
    formatValue?: (v: number) => string;
    height?: number;
    width?: number;
    trackColor?: string;
    fillColor?: string;
    style?: JSX.CSSProperties;
}

export function VerticalSlider({
    value,
    min,
    max,
    onChange,
    label,
    showValue = true,
    formatValue = (v) => String(Math.round(v)),
    height = 180,
    width = 36,
    trackColor = 'rgba(40, 40, 45, 0.9)',
    fillColor = 'rgba(100, 110, 130, 0.9)',
    style,
}: VerticalSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const updateValue = useCallback(
        (clientY: number) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const y = clientY - rect.top;
            const ratio = 1 - Math.max(0, Math.min(1, y / rect.height));
            const newValue = min + ratio * (max - min);
            onChange(Math.round(newValue));
        },
        [min, max, onChange]
    );

    const handlePointerDown = useCallback(
        (e: PointerEvent) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            updateValue(e.clientY);
        },
        [updateValue]
    );

    const handlePointerMove = useCallback(
        (e: PointerEvent) => {
            if (!dragging.current) return;
            updateValue(e.clientY);
        },
        [updateValue]
    );

    const handlePointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    const fillRatio = (value - min) / (max - min);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                ...style,
            }}
        >
            {showValue && (
                <div
                    style={{
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 500,
                        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                        minWidth: '40px',
                        textAlign: 'center',
                    }}
                >
                    {formatValue(value)}
                </div>
            )}
            <div
                ref={trackRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    borderRadius: `${width / 2}px`,
                    background: trackColor,
                    position: 'relative',
                    cursor: 'pointer',
                    touchAction: 'none',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${fillRatio * 100}%`,
                        background: fillColor,
                        borderRadius: `${width / 2}px`,
                        transition: dragging.current ? 'none' : 'height 0.08s ease-out',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: `calc(${fillRatio * 100}% - 6px)`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: `${width - 8}px`,
                        height: '12px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.95)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    }}
                />
            </div>
            {label && (
                <div
                    style={{
                        color: 'rgba(180,180,190,1)',
                        fontSize: '10px',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}
                >
                    {label}
                </div>
            )}
        </div>
    );
}
