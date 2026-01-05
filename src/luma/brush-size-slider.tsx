import { eventBus, Events } from '../core/events';
import { BRUSH_DEFAULTS } from '../core/config';

interface BrushSizeSliderProps {
  size: number;
}

export function BrushSizeSlider({ size }: BrushSizeSliderProps) {
  const handleSizeChange = (newSize: number) => {
    eventBus.emit(Events.BRUSH_SIZE_CHANGED, newSize);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(40, 40, 40, 0.9)',
      borderRadius: '8px',
    }}>
      <span style={{ color: '#aaa', fontSize: '12px', minWidth: '32px' }}>Size</span>
      <input
        type="range"
        min={BRUSH_DEFAULTS.minSize}
        max={BRUSH_DEFAULTS.maxSize}
        value={size}
        onInput={(e) => handleSizeChange(parseInt((e.target as HTMLInputElement).value, 10))}
        style={{ flex: 1, height: '4px' }}
      />
      <span style={{ color: '#fff', fontSize: '12px', minWidth: '40px', textAlign: 'right' }}>
        {size}px
      </span>
    </div>
  );
}
