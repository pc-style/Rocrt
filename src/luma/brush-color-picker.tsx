import type { Color } from '../core/types';
import { eventBus, Events } from '../core/events';

interface BrushColorPickerProps {
  color: Color;
}

function colorToHex(color: Color): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToColor(hex: string): Color {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0, a: 255 };
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
    a: 255,
  };
}

export function BrushColorPicker({ color }: BrushColorPickerProps) {
  const handleColorChange = (hex: string) => {
    eventBus.emit(Events.BRUSH_COLOR_CHANGED, hexToColor(hex));
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
      <span style={{ color: '#aaa', fontSize: '12px', minWidth: '32px' }}>Color</span>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        background: colorToHex(color),
        border: '2px solid #555',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <input
          type="color"
          value={colorToHex(color)}
          onInput={(e) => handleColorChange((e.target as HTMLInputElement).value)}
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
      <span style={{ color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}>
        {colorToHex(color).toUpperCase()}
      </span>
    </div>
  );
}
