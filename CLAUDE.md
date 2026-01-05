# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Overview
--------
This repository is an application-sized Procreate-inspired drawing app. The codebase is organized around five primary layers described in architecture.md: the rendering engine (Valkyrie), input/gesture system (Sensory), brush/shader system (Alchemy), UI (Luma), and state/persistence (Chronos). The project is mostly a design and specification repo with architecture documents, feature lists, style guides and a prioritized task list rather than a conventional package-based application.

Development commands
--------------------
This repository contains design docs and task artefacts only. There is no package.json, build scripts, tests, or linters present in the repository root. Common commands you would expect in a typical JS/TS repo are not applicable here. If you add code that uses a package manager, prefer bun for Node workflows and `uv` for Python as a project convention (see your global CLAUDE.md preferences).

If you add tools or code:
- Add a top-level package.json or equivalent and document npm/bun scripts in this CLAUDE.md
- Prefer bun for installs and running scripts (bun install, bun test, bun run build)
- Document any test commands (how to run a single test) and lint commands here

High-level architecture
-----------------------
The repository is organized by conceptual layers (see architecture.md). Use these guidelines when adding or refactoring code:

- Valkyrie (Rendering pipeline): Tile-based rasterization, sparse GPU texture management, 16-bit linear blending, GPU compositor shaders.
- Sensory (Input & Gestures): High-rate sampling FSM for input, predictive stroke algorithm, Bezier smoothing.
- Alchemy (Brush logic): Procedural stamp plotting, shape+grain brush model, offscreen preview engine.
- Chronos (State & Persistence): Action-led history (stroke actions), checkpoint snapshots and background serialization, time-lapse recording, auto-save to IndexedDB.
- Luma (UI): Minimalist "canvas first" UI pattern, floating sliders, top-bar modal popovers, gesture-driven interactions.

Where to look first
-------------------
- architecture.md — system architecture and implementation notes
- features.md — prioritized feature list and UX expectations
- style.md — design rules and UI principles
- todo.md — current work split into parallel agents/tasks

Conventions and preferences
---------------------------
- Follow the UI and interaction rules from style.md for all front-end work.
- When adding a JS/TS project prefer bun and add scripts for build/test/lint in package.json.
- If you add multi-file changes that alter behavior, include a short architecture note in the PR describing how the change interacts with the five layers.

Cursor / Copilot rules
----------------------
There are no cursor rules (.cursor/rules or similar) or GitHub Copilot instructions checked into this repository. If you add them, document the key constraints here.

Maintainer notes
----------------
- This repo currently contains mostly design and planning material; before doing code-level work confirm which implementation targets (web, native, electron) the team wants to prioritize and document that choice in the repo root.

Questions or missing pieces
---------------------------
If you need to add a test/build system or linters, ask the maintainers and document the choices in this file so future Claude Code runs don’t have to guess defaults.

Subagents & Specialized Workflows
---------------------------------
This project uses specialized subagents for different architectural layers. Invoke them by name when working on their specific domains:

- `valkyrie-engine`: Rendering pipeline (WebGL/WebGPU).
- `sensory-interaction`: Input & Gestures.
- `alchemy-brush`: Brush logic & Physics.
- `chronos-state`: State & History.
- `luma-ui`: UI Overlay.

**Gemini Analysis:**
For deep codebase analysis, architectural mapping, or large refactors, use the `gemini-analyzer` subagent. It wraps the Gemini CLI to process the entire codebase effectively.
Example: "Ask gemini-analyzer to find all usages of the shared GL context."

## Active Technologies
- TypeScript 5.x with ES2020+ targe (001-opencanvas-mvp)
- IndexedDB for canvas state persistence (future auto-save) (001-opencanvas-mvp)

## Recent Changes
- 001-opencanvas-mvp: Added TypeScript 5.x with ES2020+ targe
