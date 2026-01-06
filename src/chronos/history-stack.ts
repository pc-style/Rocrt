import type { IChronosHistory } from '../core/contracts';
import type { HistoryEntry } from '../core/types';
import { HISTORY_CONFIG } from '../core/config';
import { eventBus, Events } from '../core/events';

export class HistoryStack implements IChronosHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private actionsSinceCheckpoint: number = 0;

  recordAction(action: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
    const entry: HistoryEntry = {
      ...action,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.undoStack.push(entry);
    this.redoStack = [];

    if (this.undoStack.length > HISTORY_CONFIG.maxUndoSteps) {
      this.undoStack.shift();
    }

    this.actionsSinceCheckpoint++;
    if (this.actionsSinceCheckpoint >= HISTORY_CONFIG.checkpointInterval) {
      this.createCheckpoint();
    }

    eventBus.emit(Events.ACTION_RECORDED, entry);
    this.emitState();
  }

  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    this.redoStack.push(entry);
    eventBus.emit(Events.UNDO_EXECUTED, entry);
    this.emitState();
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    this.undoStack.push(entry);
    eventBus.emit(Events.REDO_EXECUTED, entry);
    this.emitState();
    return entry;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  createCheckpoint(): void {
    this.actionsSinceCheckpoint = 0;
    // TODO: Implement checkpoint snapshot in Phase 4
  }

  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  emitState(): void {
    eventBus.emit(Events.HISTORY_STATE_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
