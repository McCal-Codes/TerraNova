# Getting Started with TerraNova

This page covers everything you need to know to go from launching the app to having a working world.

If you are new, do these three things first:
1. Open [Quickstart: Build Your First Pack](./walkthroughs/quickstart.md).
2. Make one terrain edit and watch the preview change.
3. Come back here when you need the editor layout or shortcut reference.

---

## Launching the App

- **Desktop:** Open the TerraNova application directly.
- **From source:** Run `pnpm tauri dev` with Vite on port **1420** (Tauri does not start Vite automatically). Easiest on Windows: `dev.bat` from the repo root, or run `pnpm dev` in one terminal and `pnpm tauri dev` in another.

---

## The Editor Layout

When a world is open, the workspace is split into three panels:

| Panel | Location | What it does |
|-------|----------|-------------|
| **Left sidebar** | Left edge | Node palette, bookmarks, history, validation |
| **Node canvas** | Centre | Your density/material node graph — this is where you build |
| **Right panel** | Right edge | Properties for the selected node, or Docs (this panel) |

Toggle panels with **Ctrl+[** (left) and **Ctrl+]** (right). Maximise just the canvas with **Ctrl+\\**.

The toolbar above the canvas controls the preview mode. Click **P** to cycle between graph-only, preview-only, and split view.

---

## Opening or Creating a World

- **New world:** `Ctrl+N` or **File → New World**. Choose blank or a starter template.
- **Open existing:** `Ctrl+O` or **File → Open Asset Pack** to open a folder with `manifest.json` and `Server/HytaleGenerator/`.
- **Save:** `Ctrl+S`. Save a copy with `Ctrl+Shift+S`.

---

## The Node Canvas

The canvas is where you build your world generation graph. Every node takes inputs and produces an output — chain them together to define terrain shape, materials, and props.

**Navigating the canvas:**
- **Pan** — middle-mouse drag, or hold Space and drag
- **Zoom** — scroll wheel
- **Fit view** — `Ctrl+1`
- **Reset zoom** — `Ctrl+0`

**Adding nodes:**
- Press **Tab** or **Shift+A** to open Quick Add — type a node name and press Enter
- Right-click the canvas for the context menu
- Drag from the left panel's node palette
- In Quick Add / Palette, use **Worldgen References** for curated Desert/Skyreach-style starter blocks ([details](../reference/worldgen-references-live-preview.md); [community pack study notes](../reference/community-pack-references.md))

**Selecting and editing:**
- Click a node to select it — its properties appear in the right panel
- **Ctrl+A** selects all nodes
- **Ctrl+D** duplicates the selection
- **Ctrl+Z** / **Ctrl+Shift+Z** to undo / redo
- **L** auto-layouts all nodes. **Shift+L** layouts only selected nodes.

**Connecting nodes:**
- Drag from an output pin (right side of a node) to an input pin (left side of another)
- Hover a pin to see its name and expected type
- Press **?** to toggle help mode — shows field descriptions on every node

---

## The Preview Panel

Switch to preview mode (**P**) to see what your graph produces. Preview types in the toolbar:

| Mode | What it shows |
|------|-------------|
| **2D heatmap** | Top-down density map; **Topo** chip for USGS-style contours and cave plan slices at **Y level** |
| **3D terrain** | Heightfield from the Y slice; **Underground view** shows cave volume mesh |
| **Voxel** | Full 3D volume with interior cave walls, material colors, and **Cutaway** plane |
| **World** | Real blocks from a connected Hytale save via Bridge (saved chunks only until live server bytes ship) |

Nodes with a **yellow** eval badge use a simplified preview (not identical to in-game generation). Nodes marked unsupported are not previewed. Always validate exported packs on a Hytale server.

Use **Evaluate now** in the preview toolbar, or enable **Auto-refresh** to update as you edit. When tuning a selected node in Properties, keep **Live preview** on to reapply field edits automatically.

Toggle inline node previews — small thumbnails on each node — with **T**.

---

## Keyboard Shortcuts Reference

### Canvas
| Shortcut | Action |
|----------|--------|
| `Tab` or `Shift+A` | Quick Add node |
| `Ctrl+F` | Search nodes |
| `Ctrl+A` | Select all |
| `Ctrl+T` | Toggle root node |
| `Ctrl+PageUp` | Select upstream nodes |
| `Ctrl+PageDown` | Select downstream nodes |

### Edit
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+X / C / V` | Cut / Copy / Paste |
| `Ctrl+D` | Duplicate |
| `Ctrl+G` | Group selected |
| `L` | Auto-layout all |
| `Shift+L` | Auto-layout selected |
| `Ctrl+Shift+L` | Tidy up |

### File
| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New project |
| `Ctrl+O` | Open asset pack |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+W` | Close project |
| `Ctrl+E` | Export current JSON |
| `Ctrl+Shift+E` | Export asset pack |
| `Ctrl+Shift+G` | Export Graph |

### View
| Shortcut | Action |
|----------|--------|
| `P` | Cycle view mode |
| `T` | Toggle inline previews |
| `V` | Toggle split direction |
| `G` | Toggle grid |
| `Shift+G` | Toggle snap |
| `Ctrl+0` | Reset zoom |
| `Ctrl+1` | Fit view |
| `Ctrl+2` | Zoom to selection |
| `Ctrl+[` | Toggle left panel |
| `Ctrl+]` | Toggle right panel |
| `Ctrl+\\` | Maximize editor |
| `Ctrl+B` | Bridge (live Hytale connection) |
| `Ctrl+,` | Preferences |
| `?` | Toggle help mode |

### Bookmarks
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+1–9` | Save current viewport to bookmark slot |
| `Alt+1–9` | Jump to bookmark slot |

Bookmarks save your current canvas position and zoom level into one of nine numbered slots. They're per-file and persist across sessions — useful when your graph is large and you keep switching between the noise source area, the terrain shaping section, and the output node. The Bookmarks panel in the left sidebar lets you see, rename, and delete any saved slot.

---

## Hytale Asset Channel

TerraNova supports two asset channels: **release** and **pre-release**. You set this in **Settings → Assets**.

The channel controls which Hytale asset cache is synced (release and pre-release builds ship different blocks, prefabs, and textures) and which nodes show up in the palette. A few density nodes — `Cube`, `Axis`, `Angle` — are pre-release only and are hidden from the palette on the release channel. If you switch channels, TerraNova clears the old cache before syncing to avoid mixing assets from different builds.

**Patchline isolation (Update 6+):** Release and pre-release also use **separate saves, mods, and settings**. Release data lives under `%APPDATA%\Hytale\UserData\`; pre-release lives under `%APPDATA%\Hytale\data\pre-release\UserData\`. Bridge **Deploy Plugin** and export paths follow the channel selected in Settings → Assets.

If you see a **PRE** badge on a node in the canvas, that node needs a pre-release Hytale build to run in-game.

---

## Next Steps

- **[Walkthrough: Create a World](./walkthroughs/create-a-world.md)** — build your first world step by step
- **[Walkthrough: Terrain and Caves](./walkthroughs/terrain-and-caves.md)** — shape hills, mountains, and carve cave systems
- **[Guide: Cave Preview](./guides/preview/cave-preview.md)** — 2D topo, section profile, voxel, and underground 3D modes
- **[Worldgen References (live preview)](./reference/worldgen-references-live-preview.md)** — curated starter blocks in Quick Add
- **[Guide: Understanding Basic Terrain](./guides/understanding-basic-terrain-generation.md)** — how density and noise work together
- **[Glossary](./glossary/README.md)** — definitions for every node type and term
- **[Exporting](./reference/exporting.md)** — deploy to Hytale, export SVG diagrams, and understand the node-to-JSON type mapping
- **[Bridge](./reference/bridge.md)** — sync the open file to a running server via TerraNovaBridge
