# Procreate Clone: Architecture & Implementation Plan

This architecture focuses on maximizing GPU utilization and minimizing CPU-to-GPU memory transfer to achieve the "Procreate Feel."

## 1. Rendering Pipeline (The Valkyrie Engine)
*   **Tile-Based Rasterization**: Divide the canvas into 256x256 or 512x512 tiles. Only modified tiles are updated and re-uploaded to the GPU.
*   **Sparse GPU Texture Management**: Use a texture atlas or array to store only active tiles, saving memory on large canvases.
*   **16-bit Linear Blending**: Perform all brush blending in linear light space (16-bit per channel) to prevent banding and "dirty" color mixing.
*   **GPU Compositor**: A final shader that composites all layers in real-time with their respective blend modes (Multiply, Screen, etc.).

## 2. Input & Gesture System (Sensory Layer)
*   **High-Rate Sampling (FSM)**: A Finite State Machine that distinguishes between:
    *   `DRAWING_STATE` (Stylus/Single finger)
    *   `GESTURE_STATE` (Multi-touch)
*   **Predictive Stroke Algorithm**: Calculate the likely trajectory of the stylus for the next 1-2 frames to mask input latency.
*   **Bezier Smoothing**: Convert raw points into cubic Bezier segments on-the-fly for the stabilization engine.

## 3. Brush Logic (The Alchemy System)
*   **Procedural Stamp Plotting**: Brushes are not just images; they are procedural shaders that calculate `Shape * Grain * Dynamics` at every stamp point.
*   **Offscreen Preview Engine**: A lightweight, isolated instance of the renderer to power the real-time brush preview in the settings menu.

## 4. State & Persistence (Chronos Layer)
*   **Action-Led History**: Store a list of `StrokeAction` objects. Each object contains its brush settings, path data, and affected tile IDs.
*   **Checkpoint Snapshots**: Every 50 actions, serialize a full canvas snapshot to a background worker thread to ensure fast recovery and stable time-lapses.
*   **Non-Destructive Stack**: Layers and adjustment layers (Curves, Hue/Sat) are stored as metadata and applied by the GPU compositor.

## 5. UI Implementation (Luma Layer)
*   **Decoupled UI Thread**: React/Vue/Svelte handles the UI overlays, while the drawing engine runs in a `requestAnimationFrame` loop or a WebWorker.
*   **Spatial Hit-Testing**: Determine UI interactions based on proximity rather than exact pixel hits for better thumb reachability.
