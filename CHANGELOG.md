# Changelog

All notable changes to TerraNova will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-02-13

### Fixed

- **React Error #31 Crash** - Opening biome files with noise or other nodes containing object-typed field values (e.g. `{x, y, z}` coordinates) caused the editor to crash with "Objects are not valid as a React child"
  - Added `safeDisplay` utility that safely converts any field value to a renderable string, applied across all 20 node component files
  - Object values are now JSON-stringified; scalars (numbers, strings) render as before

### Added

- **Node-Level Error Boundary** - `NodeBodyBoundary` inside `BaseNode` catches render errors at the individual node level
  - A single node with bad data now shows an inline error message instead of crashing the entire editor

## [0.1.1] - 2026-02-13

### Fixed

- **Windows Biome Gray Screen** - Opening a biome JSON file from the sidebar caused the entire UI to crash to a blank gray screen on Windows
  - `isBiomeFile()` path fallback now checks both `/biomes/` and `\biomes\` separators
  - WorldStructure sibling path construction now normalizes backslashes to forward slashes

### Added

- **Error Boundary** - React `ErrorBoundary` wrapping the main editor panel (`PanelLayout`)
  - Crash is contained to the editor area; toolbar and status bar remain visible
  - Displays error message with a "Try Again" button to recover without restarting

## [0.1.0] - 2026-02-13

### Added

- Initial release - Visual biome editor and terrain designer for Hytale World Generation V2
- Node-based editor for density functions, material providers, curves, patterns, positions, props, scanners, vectors
- Live 2D heatmap preview with contour lines, cross-sections, and position overlays
- 3D voxel heightfield preview with SSAO post-processing
- Full V2 coverage: 68 density types, 14 material providers, 19 curves
- Multi-section biome editing (Terrain, Material, Pattern, Position, Prop) with per-section undo history
- Asset pack management with multi-file tab support
- Template system with bundled templates (Void, Forest, Forest Hills, Desert, Mountains, Floating Islands, Eldritch Spirelands, Shattered Archipelago, Tropical Pirate Islands)
- Comparison view for side-by-side before/after preview
- Schema validation with instant diagnostics
- Bookmarks and descriptive undo/redo history with persistent storage
- Cross-platform support: Windows, macOS (Apple Silicon + Intel), Linux
