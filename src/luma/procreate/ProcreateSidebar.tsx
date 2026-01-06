import { VerticalSlider } from '../components/VerticalSlider';
import { IconButton } from '../components/IconButton';
import { Pipette } from 'lucide-preact';
import { eventBus, Events } from '../../core/events';
import { BRUSH_DEFAULTS } from '../../core/config';

interface ProcreateSidebarProps {
    brushSize: number;
    brushOpacity: number;
    eyedropperActive: boolean;
}

/**
 * Left sidebar with vertical sliders for brush size and opacity,
 * matching Procreate's layout. Also includes the Modify button (eyedropper).
 */
export function ProcreateSidebar({
    brushSize,
    brushOpacity,
    eyedropperActive,
}: ProcreateSidebarProps) {
    const handleSizeChange = (value: number) => {
        const clamped = Math.max(BRUSH_DEFAULTS.minSize, Math.min(BRUSH_DEFAULTS.maxSize, value));
        eventBus.emit(Events.BRUSH_SIZE_CHANGED, clamped);
    };

    const handleOpacityChange = (value: number) => {
        const clamped = Math.max(0, Math.min(100, value)) / 100;
        eventBus.emit(Events.BRUSH_OPACITY_CHANGED, clamped);
    };

    const handleEyedropperToggle = () => {
        eventBus.emit(Events.EYEDROPPER_TOGGLED, null);
    };

    const opacityPercent = Math.round(brushOpacity * 100);

    return (
        <div
            style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                pointerEvents: 'auto',
            }}
        >
            <VerticalSlider
                value={brushSize}
                min={BRUSH_DEFAULTS.minSize}
                max={BRUSH_DEFAULTS.maxSize}
                onChange={handleSizeChange}
                formatValue={(v) => `${Math.round(v)}px`}
                height={160}
                width={32}
                fillColor="rgba(120, 130, 160, 0.9)"
            />

            <VerticalSlider
                value={opacityPercent}
                min={0}
                max={100}
                onChange={handleOpacityChange}
                formatValue={(v) => `${Math.round(v)}%`}
                height={160}
                width={32}
                fillColor="rgba(100, 120, 150, 0.9)"
            />

            <IconButton
                icon={<Pipette size={20} strokeWidth={2} />}
                onClick={handleEyedropperToggle}
                active={eyedropperActive}
                title="Eyedropper (I)"
                size={40}
            />
        </div>
    );
}
