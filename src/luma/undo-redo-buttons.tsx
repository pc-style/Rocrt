import { eventBus, Events } from '../core/events';

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
}

export function UndoRedoButtons({ canUndo, canRedo }: UndoRedoButtonsProps) {
  const handleUndo = () => {
    eventBus.emit(Events.UNDO_REQUESTED, null);
  };

  const handleRedo = () => {
    eventBus.emit(Events.REDO_REQUESTED, null);
  };

  return (
    <div class="undo-redo-buttons" style={{
      display: 'flex',
      gap: '8px',
      padding: '8px',
    }}>
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: canUndo ? '#4a4a4a' : '#2a2a2a',
          color: canUndo ? '#fff' : '#666',
          cursor: canUndo ? 'pointer' : 'not-allowed',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Undo"
      >
        ↩
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          border: 'none',
          background: canRedo ? '#4a4a4a' : '#2a2a2a',
          color: canRedo ? '#fff' : '#666',
          cursor: canRedo ? 'pointer' : 'not-allowed',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Redo"
      >
        ↪
      </button>
    </div>
  );
}
