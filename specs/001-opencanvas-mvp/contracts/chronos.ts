/**
 * Chronos Layer - State & History Management Contract
 * Responsible for: Action-led history, undo/redo, checkpoints, serialization
 */

import type {
  HistoryEntry,
  HistoryActionData,
  HistoryActionInverse,
  ActionType,
  Canvas,
} from './types';

// ============================================================================
// Chronos History Interface
// ============================================================================

export interface IChronosHistory {
  /**
   * Record an action in the history stack
   * Clears redo stack (as per constitution requirement)
   *
   * @param action - Complete HistoryEntry with forward and inverse data
   */
  recordAction(action: HistoryEntry): void;

  /**
   * Undo the most recent action
   * Moves action from undo stack to redo stack
   *
   * @returns HistoryEntry to be reversed, or null if undo stack is empty
   */
  undo(): HistoryEntry | null;

  /**
   * Redo the most recently undone action
   * Moves action from redo stack back to undo stack
   *
   * @returns HistoryEntry to be re-applied, or null if redo stack is empty
   */
  redo(): HistoryEntry | null;

  /**
   * Check if undo is available
   *
   * @returns True if undo stack has entries
   */
  canUndo(): boolean;

  /**
   * Check if redo is available
   *
   * @returns True if redo stack has entries
   */
  canRedo(): boolean;

  /**
   * Create checkpoint snapshot of current canvas state
   * Called every 50 actions (constitution requirement)
   * Enables fast recovery after crash or long undo chains
   */
  createCheckpoint(): void;

  /**
   * Serialize canvas state to IndexedDB
   * Runs in background Web Worker to avoid blocking main thread
   *
   * @param callback - Called with Blob when serialization completes
   */
  serialize(callback: (data: Blob) => void): void;

  /**
   * Deserialize canvas state from IndexedDB
   * Restores full canvas from checkpoint + action log replay
   *
   * @param canvasId - UUID of canvas to load
   * @param callback - Called with restored Canvas object
   */
  deserialize(canvasId: string, callback: (canvas: Canvas) => void): void;

  /**
   * Get history statistics (for UI display)
   */
  getStats(): HistoryStats;

  /**
   * Clear all history (irreversible)
   * Used when starting new canvas or resetting state
   */
  clearHistory(): void;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface HistoryStats {
  undoStackSize: number;              // Number of undo-able actions
  redoStackSize: number;              // Number of redo-able actions
  totalActions: number;               // Lifetime action count
  lastCheckpointIndex: number;        // Action index of last checkpoint
  actionsSinceCheckpoint: number;     // Actions since last checkpoint (should be < 50)
  estimatedMemoryMB: number;          // Estimated history memory usage
}

export interface Checkpoint {
  id: string;                         // UUID
  canvasSnapshot: Blob;               // Serialized canvas state (gzipped)
  historyIndex: number;               // Action index at checkpoint time
  timestamp: number;                  // Checkpoint creation time (Unix timestamp ms)
}

// ============================================================================
// Serialization Types
// ============================================================================

export interface SerializationOptions {
  compress: boolean;                  // Use LZ4 compression for tile data?
  includeHistory: boolean;            // Include action log in serialization?
  maxHistoryDepth: number;            // Limit history to last N actions
}

export interface DeserializationResult {
  canvas: Canvas;                     // Restored canvas object
  actionsReplayed: number;            // Number of actions replayed from log
  restoredFrom: 'checkpoint' | 'full'; // Whether checkpoint was used
  timestamp: number;                  // Original save timestamp
}

// ============================================================================
// Background Worker Communication
// ============================================================================

export enum WorkerMessageType {
  Serialize = 'serialize',
  Deserialize = 'deserialize',
  Compress = 'compress',
  Decompress = 'decompress',
}

export interface WorkerMessage {
  type: WorkerMessageType;
  payload: any;
  requestId: string;                  // For matching request/response
}

export interface WorkerResponse {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// IndexedDB Schema
// ============================================================================

export interface CanvasRecord {
  id: string;                         // Canvas UUID (primary key)
  canvas: Canvas;                     // Full canvas state
  thumbnail?: Blob;                   // Preview image (optional)
  createdAt: number;
  updatedAt: number;
}

export interface CheckpointRecord {
  id: string;                         // Checkpoint UUID (primary key)
  canvasId: string;                   // Foreign key to CanvasRecord
  snapshot: Blob;                     // Compressed canvas snapshot
  historyIndex: number;
  timestamp: number;
}

export interface PreferencesRecord {
  key: string;                        // Preference key (primary key)
  value: any;                         // JSON-serializable value
}

export const DB_SCHEMA = {
  name: 'opencanvas_v1',
  version: 1,
  stores: {
    canvases: {
      keyPath: 'id',
      indexes: ['createdAt', 'updatedAt'],
    },
    checkpoints: {
      keyPath: 'id',
      indexes: ['canvasId', 'timestamp'],
    },
    preferences: {
      keyPath: 'key',
    },
  },
};
