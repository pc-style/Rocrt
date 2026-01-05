/**
 * Sensory Layer - Input & Gesture System Contract
 * Responsible for: High-frequency input sampling, gesture recognition, palm rejection
 */

import type {
  InputPoint,
  GestureType,
  GestureData,
} from './types';

// ============================================================================
// Sensory Input Interface
// ============================================================================

export interface ISensoryInput {
  /**
   * Start sampling input events
   * Attaches PointerEvent listeners to canvas, begins 120Hz polling
   */
  startSampling(): void;

  /**
   * Stop sampling input events
   * Removes event listeners, stops polling loop
   */
  stopSampling(): void;

  /**
   * Register callback for stroke begin event (pointerdown)
   *
   * @param callback - Function called with initial InputPoint
   */
  onStrokeBegin(callback: (point: InputPoint) => void): void;

  /**
   * Register callback for stroke move event (pointermove)
   * Called at high frequency (120Hz+) during active stroke
   *
   * @param callback - Function called with each sampled InputPoint
   */
  onStrokeMove(callback: (point: InputPoint) => void): void;

  /**
   * Register callback for stroke end event (pointerup/pointercancel)
   *
   * @param callback - Function called when stroke completes
   */
  onStrokeEnd(callback: () => void): void;

  /**
   * Register callback for gesture recognition
   * Gestures are recognized via FSM (Finite State Machine)
   *
   * @param type - Gesture type to listen for
   * @param callback - Function called with GestureData when gesture detected
   */
  onGesture(type: GestureType, callback: (data: GestureData) => void): void;

  /**
   * Calibrate pressure sensitivity for current device
   * Applies device-specific curve adjustments
   *
   * @param deviceType - 'wacom' | 'applePencil' | 'other'
   */
  calibratePressure(deviceType: string): void;

  /**
   * Enable/disable palm rejection
   * When enabled, touch events are filtered during stylus drawing
   *
   * @param enabled - True to enable palm rejection
   */
  setPalmRejection(enabled: boolean): void;

  /**
   * Get current input state (for debugging)
   */
  getState(): InputState;
}

// ============================================================================
// Helper Types
// ============================================================================

export enum InputStateType {
  Idle = 'idle',                      // No active input
  Drawing = 'drawing',                // Stylus drawing in progress
  Gesture = 'gesture',                // Multi-touch gesture in progress
  PalmRejecting = 'palmRejecting',    // Palm detected, ignoring input
}

export interface InputState {
  state: InputStateType;
  activePointers: number;             // Number of active pointer contacts
  primaryPointerId: number | null;    // Stylus/primary pointer ID
  lastSampleTime: number;             // Last input sample timestamp (ms)
  samplingRateHz: number;             // Current sampling frequency
}

export interface GestureFSMState {
  currentState: InputStateType;
  pointerCount: number;
  touchStartTime: number;
  touchStartPositions: Map<number, { x: number; y: number }>;
  gestureInProgress: GestureType | null;
}

// ============================================================================
// Calibration Types
// ============================================================================

export interface PressureCalibration {
  deviceType: string;                 // 'wacom' | 'applePencil' | 'other'
  curve: (rawPressure: number) => number; // Calibration function
  minPressure: number;                // Deadzone threshold (0-1)
  maxPressure: number;                // Saturation threshold (0-1)
}

export const DEFAULT_CALIBRATIONS: Record<string, PressureCalibration> = {
  wacom: {
    deviceType: 'wacom',
    curve: (p) => p,                  // Linear (no adjustment)
    minPressure: 0.0,
    maxPressure: 1.0,
  },
  applePencil: {
    deviceType: 'applePencil',
    curve: (p) => {
      // Slight S-curve to compensate for Apple Pencil sensitivity
      return p < 0.5
        ? 2 * p * p
        : 1 - 2 * (1 - p) * (1 - p);
    },
    minPressure: 0.02,                // Deadzone
    maxPressure: 0.98,                // Saturation
  },
  other: {
    deviceType: 'other',
    curve: (p) => p,                  // Linear
    minPressure: 0.0,
    maxPressure: 1.0,
  },
};
