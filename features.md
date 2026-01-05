# Procreate Clone: Crucial Features

Inspired by the Procreate philosophy of "disappearing UI" and "physical learning," these features are the non-negotiable core of the clone.

## 1. The Interaction Layer (Gestures)
*   **Two-Finger Tap**: Global Undo with haptic/visual feedback.
*   **Three-Finger Tap**: Global Redo.
*   **Three-Finger Scrub**: Quick-clear active layer.
*   **Pinch and Twist**: Zero-latency canvas zoom and rotation.
*   **QuickShape (Hold & Snap)**: Draw any line or basic shape (circle, triangle, quad) and hold at the end to snap it into perfect geometric forms.

## 2. The Painting Engine
*   **Low-Latency Brush Flow**: Continuous 120Hz-240Hz input sampling to ensure strokes follow the stylus without "lag-behind."
*   **Dual-Texture Brush Model**: Brushes composed of a **Shape** (the stamp) and a **Grain** (the texture).
*   **Stabilization (StreamLine)**: Real-time path smoothing that averages jittery input into professional curves.
*   **Alpha Lock**: Restrict drawing to existing pixel boundaries on a layer.

## 3. Advanced Selection & Fill
*   **ColourDrop & Threshold**: Drag the color circle into an area. Slide left/right while holding to adjust the fill threshold (leak handling).
*   **Reference Layers**: Designate a line-art layer as "Reference" so ColourDrop on a different layer respects those boundaries.
*   **Lasso Selection**: Freehand selection with instant transformation (Move, Scale, Rotate).

## 4. Minimalist UI (Style-Compliant)
*   **Floating Sliders**: Two vertical sliders on the screen edge (Brush Size and Opacity).
*   **Hidden Chrome**: Top bar containing only 5-9 high-contrast monochrome icons.
*   **Panel Pop-overs**: Brushes, Layers, and Colors open in small non-intrusive pop-overs, not sidebars that resize the canvas.

## 5. System Utilities
*   **Action-Oriented Undo**: Record high-level actions (strokes) rather than pixel diffs for infinite-style history.
*   **Time-lapse Recording**: Silently capture every stroke to export a video of the creative process.
*   **3D Painting**: Support for importing `.obj` or `.usdz` models to paint directly on textures.
