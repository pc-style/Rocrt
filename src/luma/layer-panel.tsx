import { useState } from 'preact/hooks';
import type { Layer } from '../core/types';
import { BlendMode } from '../core/types';
import { eventBus, Events } from '../core/events';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
}

export function LayerPanel({ layers, activeLayerId }: LayerPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLayerSelect = (layerId: string) => {
    eventBus.emit(Events.LAYER_SELECTED, layerId);
  };

  const handleVisibilityToggle = (layerId: string, e: Event) => {
    e.stopPropagation();
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      eventBus.emit(Events.LAYER_VISIBILITY_TOGGLED, { layerId, visible: !layer.visible });
    }
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    eventBus.emit(Events.LAYER_OPACITY_CHANGED, { layerId, opacity });
  };

  const handleBlendModeChange = (layerId: string, blendMode: BlendMode) => {
    eventBus.emit(Events.LAYER_BLEND_MODE_CHANGED, { layerId, blendMode });
  };

  const handleAddLayer = () => {
    eventBus.emit(Events.LAYER_ADDED, null);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length > 1) {
      eventBus.emit(Events.LAYER_DELETED, layerId);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute',
          right: '16px',
          top: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: '#4a4a4a',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '14px',
        }}
        title="Layers"
      >
        ☰
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: '16px',
        top: '16px',
        width: '240px',
        background: 'rgba(40, 40, 40, 0.95)',
        borderRadius: '12px',
        padding: '12px',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontWeight: 'bold' }}>Layers</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => handleLayerSelect(layer.id)}
            style={{
              padding: '8px',
              marginBottom: '4px',
              borderRadius: '6px',
              background: layer.id === activeLayerId ? '#5a5a5a' : '#3a3a3a',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <button
                onClick={(e) => handleVisibilityToggle(layer.id, e)}
                style={{
                  width: '24px',
                  height: '24px',
                  border: 'none',
                  borderRadius: '4px',
                  background: layer.visible ? '#6a6' : '#444',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {layer.visible ? '👁' : '○'}
              </button>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {layer.name}
              </span>
              {layers.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLayer(layer.id);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#a44',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#aaa', width: '50px' }}>Opacity</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(layer.opacity * 100)}
                onInput={(e) => handleOpacityChange(layer.id, parseInt((e.target as HTMLInputElement).value, 10) / 100)}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, height: '4px' }}
              />
              <span style={{ fontSize: '11px', width: '30px' }}>{Math.round(layer.opacity * 100)}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: '#aaa', width: '50px' }}>Blend</span>
              <select
                value={layer.blendMode}
                onChange={(e) => handleBlendModeChange(layer.id, (e.target as HTMLSelectElement).value as BlendMode)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  background: '#2a2a2a',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '2px 4px',
                  fontSize: '11px',
                }}
              >
                <option value={BlendMode.Normal}>Normal</option>
                <option value={BlendMode.Multiply}>Multiply</option>
                <option value={BlendMode.Screen}>Screen</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddLayer}
        style={{
          width: '100%',
          marginTop: '8px',
          padding: '8px',
          border: 'none',
          borderRadius: '6px',
          background: '#5a5',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        + Add Layer
      </button>
    </div>
  );
}
