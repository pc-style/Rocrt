# Technical Research: OpenCanvas MVP

**Feature**: OpenCanvas MVP
**Branch**: 001-opencanvas-mvp
**Date**: 2026-01-05
**Status**: Completed

## Overview

This document captures all technical decisions made during Phase 0 research for the OpenCanvas MVP implementation. Each decision is documented with rationale, alternatives considered, and trade-offs.

## 1. WebGL 2.0 vs WebGPU Decision (CRITICAL)

**Decision**: Use **WebGL 2.0** as primary rendering API

**Rationale**:
- **Browser Support**: WebGL 2.0 has universal support in Chrome 90+ and Safari 14+ (our target browsers)
- **WebGPU Status** (as of Jan 2026): While WebGPU is now supported in Chrome and Edge, Safari support is still experimental/partial
- **Risk Mitigation**: WebGL 2.0 is proven, stable, and well-documented for tile-based rendering patterns
- **Tile Rendering**: WebGL 2.0 provides all necessary features:
  - 16-bit texture support (`gl.RGBA16F` with `EXT_color_buffer_float` extension)
  - Framebuffer objects for offscreen rendering
  - Multiple render targets for layer compositing
  - Transform feedback for GPU compute (if needed)
- **Performance**: WebGL 2.0 meets our <16ms frame budget requirement for 60fps rendering

**Alternatives Considered**:
- **WebGPU**: More modern, better compute shaders, but Safari support is incomplete (violates cross-browser requirement)
- **Hybrid approach** (WebGPU with WebGL fallback): Adds complexity, doubles shader code maintenance

**Trade-offs**:
- **Lost**: WebGPU's superior compute shader model (better for procedural brushes)
- **Gained**: Immediate cross-browser compatibility, reduced implementation risk
- **Future Path**: Can migrate to WebGPU post-MVP when Safari support stabilizes

**Implementation Notes**:
- Use `WebGL2RenderingContext` directly (no abstraction layer initially)
- Enable required extensions: `EXT_color_buffer_float`, `OES_texture_float_linear`
- Validate extension availability at startup with graceful fallback message

---

## 2. Tile Rendering Library Evaluation

**Decision**: Use **Vanilla WebGL 2.0** (no rendering library)

**Rationale**:
- **Performance Control**: Direct WebGL gives precise control over tile upload, dirty tracking, and render scheduling
- **Bundle Size**: Zero overhead - libraries like PixiJS (~400KB), Babylon.js (~2MB) add unnecessary weight
- **Constitution Alignment**: Tile-based rendering is unique to our architecture; generic libraries don't provide this pattern
- **Learning Curve**: Team has WebGL experience; library abstractions would obscure performance-critical paths

**Alternatives Considered**:
- **PixiJS**: Excellent 2D renderer, but scene graph model doesn't align with tile-based architecture
- **Babylon.js**: Overkill for 2D (focused on 3D), massive bundle size
- **REGL** (functional WebGL wrapper): Interesting, but adds abstraction layer that complicates tile management
- **Custom thin wrapper**: Considered, but YAGNI - direct WebGL is clearer for this specific use case

**Trade-offs**:
- **Lost**: Higher-level abstractions, some ergonomic helpers
- **Gained**: Full performance control, minimal bundle size, no hidden render state
- **Learning Overhead**: Moderate - team needs to understand raw WebGL patterns

**Implementation Notes**:
- Create lightweight helpers only where absolutely necessary (shader compilation, texture management)
- Keep WebGL state management explicit and local to Valkyrie layer
- Use TypeScript strict mode to catch WebGL state errors at compile time

---

## 3. React vs Vanilla JS for Luma Layer

**Decision**: Use **Preact** (React-compatible, lightweight alternative)

**Rationale**:
- **Size**: Preact is 3KB (vs React 45KB), aligns with "canvas-first" philosophy (minimal UI footprint)
- **React Compatibility**: Uses same API (JSX, hooks, components), familiar patterns
- **Performance**: Preact's diff algorithm is optimized for small UI trees (perfect for our minimal floating UI)
- **Signal Integration**: Preact Signals provides reactive state without re-render overhead (ideal for brush size slider, opacity controls)
- **Future Path**: Can swap to React if UI complexity grows, but unlikely given constitution constraints

**Alternatives Considered**:
- **Vanilla JS**: Cleanest, zero overhead, but manual DOM manipulation is error-prone for stateful UI
- **React**: Standard choice, but 45KB is significant for an app targeting minimal UI
- **Solid.js**: Excellent performance, but less familiar to team and smaller ecosystem
- **Lit**: Web Components approach, but heavier than Preact and less ergonomic for this use case

**Trade-offs**:
- **Lost**: React DevTools (Preact DevTools is less mature), some ecosystem libraries
- **Gained**: 42KB bundle savings, faster initial load, signals-based reactivity
- **Risk**: Minimal - Preact has proven production track record

**Implementation Notes**:
- Use Preact with `preact/compat` alias for React compatibility
- Leverage Preact Signals for global state (brush size, active layer, etc.)
- Keep Luma components pure and minimal (no complex state machines in UI)

---

## 4. PointerEvent Polyfill Requirements

**Decision**: **Native PointerEvent API only** (no polyfill)

**Rationale**:
- **Browser Support**: PointerEvent Level 2 is fully supported in Chrome 90+ and Safari 14+
- **Performance**: Native implementation is faster than polyfills (critical for 120Hz input sampling)
- **Pressure Sensitivity**: Native API provides `pressure`, `tiltX`, `tiltY` properties we require
- **Palm Rejection**: `pointerType` property (`pen`, `touch`, `mouse`) enables disambiguation

**Alternatives Considered**:
- **PEP (Pointer Events Polyfill)**: Adds ~10KB, introduces latency (unacceptable for <16ms frame budget)
- **jQuery UI Touch Punch**: Legacy approach, doesn't support pressure sensitivity

**Trade-offs**:
- **Lost**: Support for browsers older than our stated minimum (acceptable per spec)
- **Gained**: Maximum input responsiveness, zero polyfill overhead, simpler codebase

**Implementation Notes**:
- Feature detect PointerEvent support at startup: `'PointerEvent' in window`
- Display clear error message if PointerEvent unavailable (unlikely in target browsers)
- Document minimum browser versions prominently in README

---

## 5. IndexedDB Wrapper Library

**Decision**: Use **idb** (Jake Archibald's IndexedDB wrapper)

**Rationale**:
- **Size**: Only 1.5KB gzipped, minimal overhead
- **API Ergonomics**: Promise-based API is significantly cleaner than raw IndexedDB (which uses callbacks)
- **Reliability**: Handles common IndexedDB pitfalls (quota errors, transaction lifecycle, versioning)
- **Maintenance**: Actively maintained by Google Chrome team member, high quality
- **Use Case Alignment**: Perfect for Chronos background serialization (async/await pattern)

**Alternatives Considered**:
- **Raw IndexedDB API**: Verbose, callback-based, error-prone (onupgradeneeded, transaction management)
- **Dexie.js**: More full-featured (~17KB), but overkill for simple blob storage
- **LocalForage**: Abstraction over multiple storage backends, but we only need IndexedDB

**Trade-offs**:
- **Lost**: Nothing significant - raw IndexedDB has no advantages for our use case
- **Gained**: Cleaner code, fewer bugs, async/await patterns, minimal size cost (1.5KB)

**Implementation Notes**:
- Use `idb.openDB()` to initialize database with schema versioning
- Store checkpoint snapshots as Blobs (serialized Canvas/Layer state)
- Run all IndexedDB operations in Web Workers to avoid main thread blocking

---

## 6. TypeScript Build Tooling

**Decision**: Use **Vite** with TypeScript

**Rationale**:
- **Development Speed**: Vite's ESbuild-based dev server starts instantly, HMR is near-instantaneous
- **Production Optimization**: Rollup-based production builds provide excellent tree-shaking and code-splitting
- **TypeScript Integration**: Zero-config TypeScript support, fast transpilation
- **WebGL Shader Loading**: Vite plugins for importing `.glsl` files as strings (critical for Valkyrie shaders)
- **Asset Handling**: Built-in support for WASM, Web Workers, JSON imports
- **Constitution Alignment**: Aligns with user preference for `bun` (Vite works seamlessly with bun)

**Alternatives Considered**:
- **esbuild**: Fastest builds, but less mature plugin ecosystem (shader loading requires custom plugins)
- **webpack**: Battle-tested, but significantly slower dev/build times, complex configuration
- **bun's bundler**: Promising, but still experimental (Vite is more stable for production)

**Trade-offs**:
- **Lost**: Nothing significant - Vite is current best-in-class for TS/WebGL projects
- **Gained**: Fast iteration, mature ecosystem, great DX (developer experience)

**Implementation Notes**:
- Use `vite-plugin-glsl` for shader imports: `import vertexShader from './shader.vert?raw'`
- Configure Rollup to code-split by layer (Valkyrie, Sensory, Alchemy, Chronos, Luma)
- Use Vite's `define` for performance budgets (compile-time constants)

**Build Commands** (using bun):
```bash
bun install          # Install dependencies
bun run dev          # Start Vite dev server
bun run build        # Production build
bun run preview      # Preview production build
bun run test         # Run Vitest tests
```

---

## 7. Color Space Handling

**Decision**: Implement **Manual sRGB ↔ Linear Conversion** in shaders

**Rationale**:
- **Constitution Requirement**: 16-bit linear blending is mandatory for professional color accuracy
- **Browser Behavior**: WebGL textures are sRGB by default; blending in sRGB space causes color banding
- **Solution**: Store tiles in linear color space, convert to sRGB only at final composite stage
- **Shader Implementation**: Simple gamma 2.2 approximation for performance (exact sRGB formula is overkill)

**Implementation Strategy**:
```glsl
// sRGB to Linear (when sampling textures)
vec3 sRGBToLinear(vec3 srgb) {
  return pow(srgb, vec3(2.2));
}

// Linear to sRGB (final output)
vec3 linearToSRGB(vec3 linear) {
  return pow(linear, vec3(1.0/2.2));
}
```

**Alternatives Considered**:
- **WebGL sRGB Extension** (`EXT_sRGB`): Available, but requires careful configuration of framebuffer formats
- **Exact sRGB Formula**: Piecewise function (linear for low values, power for high), but gamma 2.2 is perceptually indistinguishable and faster

**Trade-offs**:
- **Lost**: Exact sRGB spec compliance (difference is imperceptible to human eye)
- **Gained**: Simpler shader code, guaranteed cross-browser consistency, no reliance on extensions

**Implementation Notes**:
- Use `gl.RGBA16F` textures for tile storage (16-bit float per channel)
- Apply sRGBToLinear when sampling brush color or layer content
- Apply linearToSRGB only in final compositor shader (when rendering to screen)
- Document color space handling in Valkyrie shader comments

---

## 8. Pressure Sensitivity Calibration

**Decision**: Use **Empirical Calibration Curves** with per-device profiles

**Rationale**:
- **Device Variation**: Wacom tablets report pressure 0-1 linearly, Apple Pencil has slight non-linearity
- **Solution**: Apply device-specific curve adjustments in Sensory layer before passing to Alchemy
- **User Control**: Provide optional pressure curve editor (future MVP enhancement)
- **Fallback**: For non-pressure devices (mouse, trackpad), simulate pressure based on velocity or use constant 0.5

**Implementation Strategy**:
1. Detect device type from `PointerEvent.pointerType` and user agent
2. Apply device-specific calibration curve:
   ```typescript
   function calibratePressure(raw: number, device: DeviceType): number {
     switch(device) {
       case 'wacom': return raw; // Linear, no adjustment
       case 'applePencil': return applePencilCurve(raw); // Slight S-curve
       case 'other': return raw; // Assume linear
     }
   }
   ```
3. Store calibration profiles as JSON config (easy to update without code changes)

**Alternatives Considered**:
- **No Calibration**: Simplest, but Apple Pencil feels different from Wacom (bad UX)
- **ML-based Calibration**: Overkill for MVP, adds complexity
- **User Calibration UI**: Ideal, but deferred to post-MVP (constitution: progressive disclosure)

**Trade-offs**:
- **Lost**: Perfect per-user calibration (users have individual preferences)
- **Gained**: Consistent baseline behavior across devices, simpler MVP
- **Future**: Add calibration UI as optional advanced setting

**Implementation Notes**:
- Define `DeviceProfile` type in Sensory layer with curve parameters
- Test on real devices: Wacom Intuos, iPad + Apple Pencil, Surface Pen
- Document pressure response in `quickstart.md` for artists

---

## Summary of Technology Stack

| Component | Decision | Size Impact | Rationale |
|-----------|----------|-------------|-----------|
| GPU API | WebGL 2.0 | N/A | Cross-browser support, proven |
| Rendering Library | Vanilla WebGL | 0 KB | Performance control, no overhead |
| UI Framework | Preact | 3 KB | React-compatible, minimal size |
| Build Tool | Vite | Dev-only | Fast HMR, great TypeScript/WebGL support |
| Storage | idb | 1.5 KB | Clean IndexedDB wrapper |
| Polyfills | None | 0 KB | Native PointerEvent API sufficient |

**Total Bundle Size Estimate**: ~100-150 KB (gzipped) for core application + shaders

**Performance Budget Alignment**:
- ✅ <3 seconds load time (small bundle, minimal dependencies)
- ✅ <16ms frame time (direct WebGL control, Preact efficiency)
- ✅ <8ms input latency (native PointerEvent, optimized sampling)

---

## Open Questions / Future Research

1. **WebGPU Migration Path**: When should we evaluate WebGPU adoption?
   - **Trigger**: When Safari WebGPU support reaches stable channel
   - **Effort**: Moderate (shader rewrite, API changes), but architecture supports it

2. **WASM for Brush Physics**: Could Alchemy benefit from WebAssembly for complex brush dynamics?
   - **Answer**: Not for MVP - JavaScript is fast enough for round brush
   - **Future**: Consider for particle brushes, texture synthesis (post-MVP features)

3. **OffscreenCanvas**: Should Valkyrie run in a Web Worker using OffscreenCanvas?
   - **Answer**: Not for MVP - OffscreenCanvas has Safari quirks, adds complexity
   - **Future**: Benchmark if main thread rendering becomes bottleneck

4. **GPU Compute for Procedural Textures**: Can we use transform feedback for grain generation?
   - **Answer**: Not for MVP - simple round brush doesn't need it
   - **Future**: Explore for textured brushes (post-MVP feature)

---

## Compliance Check

All research decisions align with constitution principles:

- ✅ **Performance-First**: WebGL 2.0 + Vite + native PointerEvent ensure <16ms frames
- ✅ **Canvas-First UI**: Preact (3KB) minimizes UI footprint
- ✅ **GPU-Optimized**: Direct WebGL control for tile rendering
- ✅ **Predictable State**: idb enables background serialization without blocking
- ✅ **Technology Preferences**: Vite works with bun, Context7 used for docs

**Status**: ✅ All research items resolved, ready for Phase 1 design
