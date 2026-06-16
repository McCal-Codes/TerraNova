# Changelog

All notable changes to [TerraNova](https://github.com/McCal-Codes/TerraNova) are documented in this file.

## Unreleased

_Next alpha cycle — add bullets here as features land._

## [0.1.8-alpha.3] — 2026-06-15 — Closed alpha

Third **McCal-Codes** closed-alpha build. **Install:** [Releases](https://github.com/McCal-Codes/TerraNova/releases) — tag `v0.1.8-alpha.3`.  
**Updates:** Users on `v0.1.8-alpha.2` receive this build via the in-app updater (~3s after launch when auto-check is on).

### Highlights

- **Pre-release node layer** — Cube, Axis, and Angle density nodes are now available when the pre-release Hytale asset channel is selected in Settings → Hytale Assets. They show a teal **PRE** badge in the palette and on the canvas, export correct Hytale JSON, and generate proper density previews
- **Smarter property sliders** — Drag the field label to scrub values; rate scales with the field range so fast and fine moves feel natural. Shift+drag for 10× finer control. Scroll wheel on the number input. Click a number to select-all for quick replacement
- **Validation fixes** — Pre-release nodes used on the wrong channel now show a **Remove node** quick-fix in the Validation panel. OffsetConstant `Input` connections now round-trip correctly through Hytale JSON export/import

### Pre-release nodes

- `Cube`, `Axis`, and `Angle` hidden from palette on release channel; visible with **PRE** badge on pre-release channel
- `isPrereleaseTypeKey` check wired into palette filter, `BaseNode` badge renderer, and `analyzeGraph` diagnostics
- `Axis` SDF evaluator: perpendicular distance to infinite line via cross product
- `OffsetConstant` added to `DENSITY_NAMED_TO_ARRAY` and `HYTALE_ARRAY_TO_NAMED` — `Input` connection no longer dropped on export
- `Axis` vector field converted to Hytale `Point3D` format on export (was exporting lowercase `{x,y,z}`)
- Verification test suite (`prereleaseNodeExport.test.ts`) prints full Hytale JSON for manual schema comparison

### Property panel

- Slider label drag-to-scrub: 200px spans the full `[min, max]` range; Shift = 10× finer; `setPointerCapture` keeps tracking outside the element
- Scroll wheel on number inputs (Shift for fine step)
- Click number input to select-all for fast overwrite
- Empty state shown in `CurvePointList` when no points exist

### Auto layout

- Default node spacing increased: `nodesep` 50 → 80, `ranksep` 80 → 140 for the default preset; comfortable preset raised proportionally
- `tidyUp` grid snaps at 40px steps (was 20px) so manually placed nodes breathe more after a tidy

### Community mods foundation

- Rust command module (`community.rs`) with `CommunityMod` and `ModIndex` types and two stub commands: `fetch_community_mod_index` and `list_installed_community_mods`
- TypeScript IPC wrappers in `src/utils/communityMods.ts` — ready to wire into a future UI panel
- No UI yet; groundwork only

### QoL & accessibility

- Drag handle hit area widened to 5px with a 1px visual indicator on hover/active
- Toast durations per type: errors linger 8s, warnings 6s, success/info 4s; max 6 toasts before oldest is evicted
- `DropdownField` label now properly associated with its `<select>` via `useId`
- `ToggleField` uses `role="switch"` + `aria-checked`; decorative thumb is `aria-hidden`
- `SyncProgressModal` progress bar has `role="progressbar"` with `aria-valuenow/min/max`
- Toasts use `role="alert"` for errors/warnings and `role="status"` for success/info

### Performance

- **Voxel mesh rebuild** — `hexToRGB` is now cached per unique color string inside `buildWorldMeshes`; previously called once per exposed face vertex, re-parsing the same ~40 hex values tens of thousands of times per rebuild
- **EditorCanvas re-renders** — Reduced from 11 independent Zustand subscriptions to 2 grouped `useShallow` selectors; store updates no longer trigger up to 11 separate re-render checks on the component that owns the entire flow canvas
- **PreviewPanel re-renders** — Collapsed 18 individual `usePreviewStore` subscriptions into 2 `useShallow` groups; parent re-renders no longer cascade into Three.js and canvas children unnecessarily
- **ThresholdedHeatmap** — Consolidated 16 individual store subscriptions into one `useShallow` call and wrapped with `React.memo`; heavy canvas redraws now only happen when relevant state actually changes
- **Preview3D** — Wrapped with `React.memo`; loading-state changes in PreviewPanel no longer reconcile the entire Three.js `<Canvas>` tree
- **NodePalette** — `visibleDefaults`, `grouped`, `sortedCategoryOrder`, and `groupedSnippets` are now memoized with `useMemo`; previously recomputed on every node selection
- **Heatmap2D / ThresholdedHeatmap** — Converted from eager imports to `React.lazy()`; their code (plus `contourLines.ts`, `topoMapStyle.ts`, colormaps, and shape overlay utils) no longer loads at startup — only when the 2D preview tab is first opened
- **CurveCanvas drag** — Canvas `.width` / `.height` assignments (which clear the canvas and force GPU texture reallocation) are now guarded behind a size-change check; previously triggered on every mouse-move event during curve drags
- **Build output** — Added explicit `minify: "esbuild"` + `cssMinify: true`; React, React DOM, and Zustand extracted into a stable `vendor` chunk so the WebView cache survives app updates that don't touch core dependencies

### TypeScript hygiene

- Replaced `any` types across `voxelMeshBuilder.ts`, `splashProgress.ts`, `CameraPresets.tsx`, `projectHealth.ts`, `stores/slices/types.ts`, and several test files with proper narrowed types
- Remaining unavoidable `any` annotations suppressed with targeted `eslint-disable-next-line` comments



Second **McCal-Codes** closed-alpha build. **Install:** [Releases](https://github.com/McCal-Codes/TerraNova/releases) — tag `v0.1.8-alpha.2`.  
**Updates:** Users on `v0.1.8-alpha.1` receive this build via the in-app updater (~3s after launch when auto-check is on).

### Highlights

- **Invalid JSON read-only mode** — Corrupt generator JSON opens in a raw text editor instead of failing silently; graph editing and save/export are blocked until the file is fixed and reopened
- **Project Health** — Title-bar scan surfaces pack validation errors/warnings with one-click open-in-editor
- **localStorage hardening** — Safer settings/session persistence with quota recovery (prunes large undo blobs) and path sanitization
- **Auto-download updates** — When auto-check is enabled, available builds download in the background; restart from the status bar to apply

### Invalid JSON & editor safety

- Rust `read_asset_file_text` returns raw text for broken JSON; parsed `read_asset_file` still errors with a clear message
- **InvalidJson** editing context shows read-only CodeMirror with the parse error; toolbar graph actions disabled
- Save, instant save, export, and atmosphere saves blocked with a single toast message
- Status bar shows **Read-only** while invalid JSON is open

### Project health & diagnostics

- **Project Health** panel (title bar) runs `validate_asset_pack` and lists issues by severity
- Open affected file or reveal in folder from the panel

### Persistence & QoL

- `safeLocalStorage` helpers used across settings, recent projects, pack wizard prefs, and session restore
- `strictJsonParse` for file loads; clipboard and layout picker use sanitized paths
- Graph sanitize-on-save strips invalid React Flow nodes/edges from biome sections before write

## [0.1.8-alpha.1] — 2026-06-10 — Closed alpha

First **McCal-Codes** closed-alpha build for Windows, macOS, and Linux testers.

**Install:** [Releases](https://github.com/McCal-Codes/TerraNova/releases) — tag `v0.1.8-alpha.1` (prerelease, not Latest).  
**Tester guide:** [docs/BETA_TESTING.md](BETA_TESTING.md) (platform matrix, first-run checklist, pack backup, bug reports).

### Highlights

- Four-step **onboarding** with in-wizard Hytale **release** asset sync and walkthrough links
- **Create Pack** wizard with visual prefab picker (no 7k-item wall) and bundled biome/world templates
- **Pack backup** prompt before opening existing projects; settings for default backup location
- **Preview settings sidebar**, diagnostics navigation, and **Issues** clipboard export
- **Bug reporter v2** with screenshots, file attachments, and McCal-Codes GitHub issue prefills
- **Per-user Bridge save discovery** — no hardcoded developer save/mod paths
- Signed updater artifacts on `v0.1.8-alpha.1` (in-app update when the prerelease is published)

### Onboarding & first run

- **OnboardingDialog** (home screen, four steps):
  - Step 1–2: welcome and workspace orientation
  - Step 3: Hytale asset sync — same flow as **Settings → Assets**; pre-fills **release** install path and **Common** overlay when Hytale is installed; **Browse** + **Sync now** in the wizard
  - Step 4: links to in-app walkthroughs and docs for pack/world building
- **What to test modal** — After onboarding, shows a closed-alpha checklist (onboarding, Create Pack, preview, export, pack backup, bug reporter); dismiss once per `0.1.8-alpha.1` build via `AlphaWhatToTestDialog`
- **Hytale asset sync fixes:**
  - Common overlay auto-resolves from release `Assets.zip` or source folder when enabled but path was empty (fixes Step 3 “Choose a Common asset overlay path” failure)
  - `SyncProgressModal` closes on `hytale-sync-error` so a failed sync does not trap the UI behind a black backdrop
- **Startup hardening** — Top-level `ErrorBoundary` and splash failsafe so a render error does not leave a blank window

### Create Pack & templates

- **Simple mode** — Hytale-style Pack Group/Name, biome template picker, auto-paired world structure
- **Advanced mode** — Atmosphere import, **StarterPropPicker** / **PrefabPickerPanel** with filter + side-by-side 3D preview, reference biomes from `templates/references/`
- **Prefab picker QoL** — Quick-pick suggestions, category/subfolder browse dropdowns, search and category chips; Review step confirms selection
- Bundled starters: forest-hills, shattered-archipelago, tropical-pirate-islands, eldritch-spirelands, void (+ inline Simple Hills `basic` template)

### Editor & properties

- **Structured property fields** — Dedicated editors for curves (`BareManualCurveField`, `FunctionForYField`), switch cases, nested constants/colors, imported refs, and array items (replaces opaque JSON for common node shapes)
- **Color pickers** — Atmosphere-style pickers including top-level **Color** on `Tint:Constant` nodes
- **Node palette memory** — Remembers expanded categories and density subcategories; auto-expands the category matching the current editing context
- **Frame nodes** — Click-through body so nodes inside frames stay selectable; title bar for select/drag/resize; frames annotate only (`$Groups` on export, not editor collapse groups)
- **Docs panel** — Reflow and wrapping in the narrow sidebar, consistent with Properties
- **Density import** — Section nodes and import category resolution improvements for nested material/density ports

### Preview & diagnostics

- **PreviewControlsSidebar** — Collapsible settings rail in split view (**Settings** toolbar button or edge chevron); restores labeled access vs. gear-only drawer
- **Diagnostics navigation** — Click an issue to jump to the node/field; severity styling shared across Validation panel and preview strip
- **Issues panel** — Project-wide legacy section auto-expands when the canvas is clean but other files have hits; **Copy all issues** to clipboard; filter applies to project-wide legacy hits
- **Compare view** — 3D panes lazy-load `Preview3D` to avoid mounting WebGL until needed
- **Preview HUD** — Material legend and performance overlay drag correctly when anchored from right/bottom

### Export, assets & Hytale fidelity

- **Export Asset Pack** (`Ctrl+Shift+E`) — `{Group}.{Name}/Server/HytaleGenerator/...` layout; material constants export as `{ Solid, Fluid: "", SolidBottomUp: false }`
- **Hytale release alignment** — Asset sync, block icons, and validation target the user's **release** install (`Assets.zip` / `latest`) unless pre-release is explicitly chosen
- **Environment lookup** — Custom pack environments under `Server/HytaleGenerator/Environments/` resolve correctly (fewer false unknown-environment warnings)
- **Legacy scanner** — Project-wide deprecated node hits (amber file-tree dots, Issues badge, field-aware replace in other files)

### Bridge (experimental — not in first alpha test plan)

- **Per-user save discovery** — `save_roots` / `hytaleSavePaths` discover `UserData/Saves` via `bridge-active-save.txt`, activity heuristics, or newest save — **no** hardcoded Worldgen V1 / developer mod defaults
- Bridge dialog lists `mods/` packs under the resolved save; export/browse defaults via `resolveDefaultExportModsRoot()`
- Loopback sidecar (`127.0.0.1:7854`), JVM plugin, live player/world discovery, region chunk read path (see in-app Bridge docs)
- **Alpha scope:** Bridge needs more polish; [BETA_TESTING.md](BETA_TESTING.md) focuses on export + in-game testing for this cut

### Pack backup & safety

- **AlphaPackBackupDialog** — Prompt when opening an existing pack (Open, Recent, guarded open paths)
- Full folder copy to `.terranova-backups/{PackName}-{timestamp}` beside the pack, or a custom location
- **Don't ask again for this pack** — Per-pack skip remembered in settings
- **Settings → General** — Toggle prompt, default backup parent folder, **Back up open project now**, reset skip list

### Bug reports & support

- **BugReportDialog** — Title bar, About, and `ErrorBoundary` entry points
- **Debug bundle (schema v2)** — Project/graph context, area hints, steps/expected/actual, redacted local paths, session snapshot JSON copied before opening GitHub
- **Attachments** — Capture preview screenshot; attach files; paths listed in bundle for drag-and-drop onto GitHub issues
- **GitHub** — Issue templates (bug, feature, alpha feedback, docs, question) on [McCal-Codes/TerraNova](https://github.com/McCal-Codes/TerraNova); Windows issue URL preserves query parameters

### Features carried forward (since 0.1.7)

- **Atmosphere stack** — Simple/Advanced weather and environment editors, shared preview hour, biome atmosphere tab
- **Preview evaluation** — 2D/3D/Voxel/world modes, shape SDF preview, cave cutaway + section profile, adaptive DPR
- **Pack wizard** foundation — Simple + Advanced modes, bundled templates, atmosphere import
- **CI** — GitHub Actions mirror `pnpm validate`; bridge-save, terranova-bridge, and bridge-plugin jobs

### Bug fixes

- **Material:Constant** — Prefixed material nodes use the block ID editor (not Tint Constant)
- **CurveMapper export** — Single-input density types map **Input** → Hytale **`Inputs[]`**
- **Curve validation** — Wired **Curve** port or inline curve satisfies required field
- **BaseHeight & CurveMapper preview** — Terrain anchor vs curve remap copy; inline `Curve` respected; no misleading remapper thumbnails
- **Diagnostics counts** — Context strip and Issues badge use consistent severity normalization
- **Frame diagnostics** — Frames/comments no longer flagged as false “unreachable (dead node)” warnings
- **Biome validation** — Fewer false positives for custom environment references in atmosphere providers
- **Graph import** — Annotation routing, frame scaling, and density section node handling improvements

### Performance

- **Diagnostics** — `useShallow` store subscriptions reduce spurious graph analysis re-runs
- **Build** — Vite manual chunks for lazy-loaded dialogs and preview modules
- **Compare view** — Deferred WebGL mount for secondary 3D panes

### Documentation & packaging

- **docs/BETA_TESTING.md** — Closed-alpha tester guide (platform matrix, first-run, pack backup, signing)
- **CONTRIBUTING.md** — Verification gate, semver tag conventions (`v0.1.8-alpha.N`), McCal-only commit hooks
- **In-app docs** — Bridge reference, cave preview, CurveMapper/BaseHeight copy, 2D topo context guide
- **Release automation** — `v*` annotated tags, draft prerelease, CHANGELOG-driven release notes, signed updater on McCal-Codes

### Known alpha limitations

- **Prerelease tag** — `v0.1.8-alpha.1` is marked prerelease and not “Latest”; stable `v0.1.5` remains Latest until a stable cut
- **macOS Gatekeeper** — App is not Apple-notarized; use Right-click → Open on first launch
- **Bridge** — Not in the first closed-alpha test plan; export and test in-game first
- **Bug reports** — Public on GitHub; bundles include redacted paths — review before attaching extra files

## [0.1.7-pre.2] — 2026-03-18

### Features

- **Resizable frames and comments** — Frame and comment nodes can now be resized by dragging their edges; size is saved with the node
- **Custom node labels** — You can now give any node a custom name from the properties panel; the original type shows as a subtitle underneath
- **Node lock** — Lock a node in place from the properties panel or right-click menu so it can't be accidentally moved; shows a `●` in the node header when locked

### Quality of Life

- **Align / Distribute menu** — Right-click menu now has a proper Align / Distribute submenu with an icon grid for all 6 align and 2 distribute actions
- **Select Same Type** — New right-click option to select all nodes of the same type at once
- **Cleaner context menu for frames and comments** — Graph-only options like Group, Select Upstream, and Set as Root are hidden for annotation nodes since they don't apply
- **Note field** — Nodes with a `_comment` field now show it as a readable and editable amber note block in the properties panel
- **Properties panel improvements**
  - Node type name now has a colour strip on the left matching its category
  - Custom label input is now visibly styled as an editable field
  - Node ID row has a subtle pill background
  - Fields are spaced tighter for a cleaner look
- **Field improvements**
  - Vector X/Y/Z axis labels are now colour coded red, green, blue
  - Colour picker no longer shows a redundant swatch next to itself
  - Toggle switch fixed to the correct size and animation

### Bug Fixes

- Fixed a stale closure bug in field change handling where the debounce timer could call an old version of the commit function
- Fixed wheel event listener not cleaning up correctly on the editor canvas
- Fixed material field trying to update state after the component unmounts
- Fixed context menu event listeners re-attaching on every render instead of once
- Fixed snippet placement not showing an error if something went wrong
- Fixed several unhandled promise rejections in clipboard writes and node deletion

## [0.1.7-pre.0] — 2026-03-16

### Documentation

- **New terrain guide series** — Three new guides covering terrain by outcome rather than by node type: basic types (12 recipes), advanced techniques (8 recipes), and expert topics including optimization, graph cost modelling, and a preview vs. runtime gap reference
- **Preview gap warnings** — Added callouts throughout the guides for nodes that return `0.0` in the preview evaluator (`GradientWarp`, `VectorWarp`, `BaseHeight`, `CellWallDistance`, `Terrain`, `Imported`) so users know to test them in-game
- **Troubleshooting section** — New preview vs. runtime table in `troubleshooting.md` with per-node workarounds for all six zero-returning nodes
- **Reference corrections** — Fixed missing material provider types, added full `MaterialProvider.Context` field table, block rotation reference, and reorganized Prop Types into Core / Compositional / Legacy
- **Biome system corrections** — Fixed wrong JSON field names (`Frequency` → `Scale`), added missing `FloatingFunctionNodes` and Export/Import sections, fixed provider type names, and added prop runtime stage ordering
- **Cross-references** — Wired all new guides into the existing `README`, `node-combinations`, `terrain-and-caves`, and `troubleshooting` pages

---

## [1.5.9] — 2026-03-14 — McCal's QoL

### Features

- **Hytale-accurate tint workflow** — DensityDelimited tint bands now preserve Hytale-style Range values, write `Tint.Type: "Constant"` on export, and inject a valid default density node when missing
- **Dedicated weather editor** — Weather JSON files open into a preview-driven editor with save support, sampled track summaries, and collapsible preview drawers
- **Dedicated environment editor** — Environment JSON files open into a forecast-focused editor with current-hour controls, hourly weather editing, and direct links to linked weather files
- **Simple Controls and In-Depth Controls** — Editors default to a simpler control layer for quick edits while keeping advanced track/tag/raw-field tooling behind an explicit in-depth toggle
- **Collapsible preview drawers** — The preview stack is split into collapsible drawers (24h strip, track preview, sampled values, asset breakdown) so the main scene preview remains visible

### Quality of life

- **Clickable asset file paths** — Environment and weather file references in Atmosphere workflows now open directly in the editor
- **Cleaner editor chrome** — Section headers, simple control cards, and header actions share stronger icon-forward styling for improved clarity
- **Biome browser & validation** — Biome search, richer template entries, material autocomplete, and one-click validation fixes
- **Issue log and tips toggles** — Issue logs and tips can be shown or hidden from compact detail-panel controls

### Bug fixes

- **Environment inheritance handling** — Files that inherit forecasts from parents are no longer treated as broken
- **Guard against update-depth loops** — Asset graph bridge no longer triggers maximum update depth crashes
- **Stable hook order on empty loads** — Editors preserve hook order when loading from empty state to avoid render crashes
- **Tint export stability** — Edited tint bands now round-trip with stable delimiter IDs and consistent export fields

### Known Limitations

- **Graph mode disabled** — Weather/environment graph routes (Hytale-native provider graph) remain disabled in this release
- **Dev HMR adjustments** — React Fast Refresh was temporarily disabled in development to avoid HMR issues; hot-reload behavior may differ until refactors are applied
- **Large asset cache** — Hytale asset cache can reach multiple GB; ensure disk space before syncing and monitor in the Sync modal
- **Dev warnings** — Some TypeScript/dev-only warnings and edge cases may still appear; run the full typecheck (pnpm exec tsc --noEmit) during release validation

## [0.1.5] — 2026-02-16

### Added

- **Node Interjection** — Drag nodes from the palette or canvas onto existing wires to insert them in-between. Wires highlight with an animated turquoise dashed stroke on hover, nodes snap to the midpoint between source and target, and downstream nodes automatically push apart to maintain proper spacing. Works in both LR and RL flow directions as a single undo step (Closes [#20])
- **Angle Density Evaluator** — New Angle density node that computes the angle (0–180°) between the sample position and a reference vector using dot product, with IsAxis flag for bidirectional symmetry mirroring ([#36])
- **Manual Curve Interactive Sliders** — Range sliders beneath Manual Curve point In/Out number inputs with default [-2, 2] range while number inputs accept any value for manual override beyond slider bounds ([#42])
- **FieldFunction Delimiter Nodes** — Standalone FieldFunction MaterialProviders with Delimiters are now fully supported in the import/export pipeline and rendered as dedicated graph nodes with editable From/To delimiter ranges and add/remove controls ([#37], Closes [#30])
- **Manual Curve Static Bounds** — Preview bounds are computed once on initial data load instead of recomputing on every point change. Compact mode continues to auto-fit, presets reset bounds to [0,1], and switching nodes forces a remount so bounds recompute ([#41], Closes [#22])
- **AI Transparency Documentation** — Added AI transparency disclaimer with development workflow details, and security disclaimer to `docs/AI_TRANSPARENCY.md`

### Fixed

- **3D Point Node Display** — Vector:Constant nodes imported from Hytale Point3D format now display correctly as "3D Point" instead of "Constant" in node headers, PropertyPanel, and NodePalette search ([#32], Resolves [#29])
- **RangeDouble Property Fields** — RangeDouble fields are now editable in the property panel instead of displaying as read-only ([#31])
- **Angle Density Input Ports** — Added missing Vector input port to the Angle density node with meaningful defaults and correct round-trip export ([#34], Closes [#28])
- **Manual Curve PositionsCellNoise Import** — Manual curves now import correctly for PositionsCellNoise nodes by normalizing both Hytale format variants into a unified internal field ([#35])
- **Graph Flow Direction Edges** — Replaced `setTimeout` with double `requestAnimationFrame` for handle position updates when changing graph flow direction, ensuring edges route to correct connection points ([#47], Fixes [#44])
- **Hardware Detection** — Removed hardcoded 16 GB RAM cap so the slider respects actual system memory, added native GPU detection via Tauri command with platform-specific implementations (nvidia-smi/sysfs/lspci on Linux, PowerShell/registry on Windows, system_profiler on macOS), and fixed incorrect VRAM estimates for RX 7700 XT, RX 7600, RTX 4060, and RTX 4090 ([#46], Closes [#21], [#25])
- **Density Evaluator Bugs** — Fixed Anchor (evaluates at origin), CellWallDistance (returns 0 fallback), YSampled (reads YProvider handle), SwitchState (returns State field), and Shell (computes SDF from InnerRadius/OuterRadius). Also fixed VectorWarp handle registry name and added GradientWarp WarpScale default

## [0.1.4] — 2026-02-15

### Added

- **Evaluator Overhaul & Schema-Driven Nodes** — Major evaluator rewrite with fixed Shell/YSampled nodes, new MultiMix node, and ingestion of 210+ node definitions from `terranova-bundle.json`. Cross-category connection validation via a 14×14 compatibility matrix, bridge node dual-color headers, drag-target glow/dim suggestions, port tooltips, and fidelity scoring badge
- **Adaptive Voxel Preview** — Auto-fit Y bounds that detect the terrain surface band after the coarse evaluation pass, a "Fit to Content" button that probes the full volume at low resolution, and graph-aware default bounds based on static node type analysis
- **Configuration Dialog** — New Settings > Configuration panel with CPU, GPU, and RAM budget sliders, hardware auto-detection via `sysinfo` crate + WebGL probing, and per-subsystem advanced overrides ([#12])
- **Compound Inputs & Backward Wire Dragging** — Dynamic handle expansion for multi-input nodes (Sum, Product, Min, Max, etc.), backward wire dragging from input ports to QuickAdd dialog, and smart label hiding for generic port names ([#10])
- **Knife Tool** — Cut one or many wires by holding Ctrl+Shift (Cmd+Shift on macOS) and dragging through them, matching Blender/Unreal-style node editor UX ([#17])
- **SVG Export** — Export node graphs as clean, zoomable SVG files via File menu or Ctrl+Shift+G, with scope selection, grid toggle, and presentation/debug modes
- **Accordion Sidebar** — Optional accordion layout as an alternative to the tab bar (Settings > Sidebar), with collapsible drag-to-reorder sections and badge counts

### Fixed

- **Compound Inputs Evaluator** — Fixed density preview producing incorrect terrain values after the compound inputs refactor. The evaluator was hardcoded to read only 2 inputs (`Inputs[0]` and `Inputs[1]`) for Sum, Product, WeightedSum, SmoothMin, SmoothMax, MinFunction, MaxFunction, and AverageFunction nodes — any inputs beyond the first two were silently ignored. All eight compound types now dynamically iterate over all connected inputs
- **CubeMath Type Mismatch** — Fixed the evaluator's `Cube` case targeting the wrong node type; the math cube operation is `CubeMath` in the schema (`Cube` is a shape SDF)
- **Sum Export Path** — Fixed Hytale JSON export producing malformed output for Sum nodes using the new compound handles `Inputs[]` format. The export path now correctly handles both legacy `InputA`/`InputB` and new `Inputs[]` array formats
- **Evaluator Type Coverage** — Added `VectorWarp` and `Shell` to the approximated types set so `getEvalStatus` correctly reports their fidelity instead of claiming full support
- **Windows Preview Worker Compatibility** — Fixed density/volume preview showing flat terrain on Windows and production builds. Configured Vite to emit ES module workers matching the `{ type: "module" }` constructor, added `blob:` and `worker-src` CSP directives for WebView2 compatibility, and added worker error handling with automatic main-thread fallback and 30-second timeout
- **Auto-Updater Relaunch** — Overhauled platform-specific relaunch logic with macOS bundle re-signing, Linux execute permission fix, and update loop prevention via localStorage version check
- **SVG 1.1 Compliance** — Replaced rgba(), feDropShadow, 8-digit hex colors, and duplicate XML attributes in exported SVGs for strict parser compatibility (macOS Preview, Inkscape)
- **Undo History Noise** — Node move operations removed from undo history; slider drags now produce exactly one entry on blur instead of spamming during drag

### Changed

- Default world height updated from 256 to 320 to match Hytale's actual limit
- Voxel resolution slider extended to 256 with free typing beyond
- SliderField supports overflow input values beyond the slider range

## [0.1.3] — 2026-02-14

### Added

- **Auto-Updater** — App checks GitHub Releases on launch, notifies in the StatusBar, and applies updates on restart ([#7])
- **Updates Section in Settings** — Current version display, manual "Check for updates" button with feedback toast, and persistent auto-check toggle
- **Dynamic Version Display** — StatusBar now shows live version via `getVersion()` instead of hardcoded `v0.1.0`
- **GitHub Templates** — Issue templates (bug report, feature request) and pull request template
- **Code of Conduct** — `CODE_OF_CONDUCT.md` added to the repository
- **Design System Reference** — `docs/planning/DESIGN_SYSTEMS.md` documenting the app's visual design system

### Fixed

- **Material Tab Crash** — Opening a blank/void template project no longer crashes the Material tab; guard added against missing material sections ([#6])
- **SimplexNoise2D Settings** — Noise parameters (frequency, amplitude, etc.) now properly propagate to the evaluator and preview ([#8])
- **CI Version Sync** — App version now syncs from the git tag during CI release builds (was always `0.1.0` regardless of release tag)
- **BiomeRangeEditor Redesign** — Overhauled with improved UX, better range management, and cleaner layout

### Changed

- **README.md Overhauled** — Updated screenshots, installation guide, and corrected license to LGPL-2.1
- **Tauri Dependencies Updated** — All `@tauri-apps` npm packages bumped to latest versions
- **Docs Consolidated** — Roadmap and planning documents consolidated and updated; changelog moved to `docs/`

## [0.1.2] — 2026-02-13

Patch release fixing render crashes when opening biome files containing node fields with object values.

### Fixed

- **React Error #31 Crash** — Opening biome files with noise or other nodes containing object-typed field values (e.g. `{x, y, z}` coordinates) caused the editor to crash with "Objects are not valid as a React child" ([#3])
  - Added `safeDisplay` utility that safely converts any field value to a renderable string, applied across all 20 node component files
  - Object values are now JSON-stringified; scalars (numbers, strings) render as before

### Added

- **Node-Level Error Boundary** — `NodeBodyBoundary` inside `BaseNode` catches render errors at the individual node level
  - A single node with bad data now shows an inline error message instead of crashing the entire editor

## [0.1.1] — 2026-02-13

Bug fix release addressing a critical Windows issue where opening biome files caused the entire app to go gray/blank.

### Fixed

- **Windows Biome Gray Screen** — Opening a biome JSON file from the sidebar caused the entire UI to crash to a blank gray screen on Windows ([#2])
  - `isBiomeFile()` path fallback now checks both `/biomes/` and `\biomes\` separators
  - WorldStructure sibling path construction now normalizes backslashes to forward slashes before building the path

### Added

- **Error Boundary** — React `ErrorBoundary` wrapping the main editor panel (`PanelLayout`)
  - If a component throws during render, the crash is contained to the editor area — toolbar and status bar remain visible
  - Displays the error message with a "Try Again" button to recover without restarting the app
- **Blank Project Template** — New project dialog now includes a Blank Project option that scaffolds a minimal `HytaleGenerator` directory structure ([#1])

## [0.1.0] — 2026-02-13

Initial public release. Visual biome editor and terrain designer for Hytale World Generation V2.

Built over 85 commits (Feb 6–13, 2026) in the private TerraNovaDev repository before open-sourcing.

### Core Architecture

- Tauri v2 + React + TypeScript desktop application
- React Flow–based node graph engine with custom node rendering
- Zustand state management with persistent undo/redo history
- File I/O with Tauri filesystem APIs, project save/load, and file caching
- Unsaved changes confirmation dialog with Tauri close guard

### Node System

- 50+ Hytale V2 node types across all categories:
  - **Density** — Noise generators (SimplexNoise, CellNoise2D/3D, etc.), math operations (Add, Multiply, Clamp, Blend, Abs, Negate, etc.), shape SDFs
  - **Curve** — Manual editable curves, computed curve types (SquareBump, InverseLerp, etc.)
  - **Material** — Material assignment, layer stacks, SpaceAndDepth specifications
  - **Pattern** — Stripe, checker, gradient patterns
  - **Position** — Position providers, CellNoise-based placement, Point3D/vector nodes
  - **Prop** — Prop placement rules, model references
  - **Scanner** — Column scanner, surface scanner nodes
  - **Vector** — Vector math operations
  - **Environment** — Sky, lighting, fog configuration
  - **Assignment** — Biome assignment and output designation
- Subcategory coloring and palette grouping for density nodes
- Root graph node system with visual dock indicator

### Biome Editor

- Multi-section tabbed editing for biome files (terrain, materials, props, environment)
- NoiseRange editor for biome boundary configuration
- Biome range management supporting 5+ biome entries
- Rich dashboard with material layers overview and prop summary

### Curve Editor

- Interactive canvas for Manual curve types with drag-to-edit control points
- Read-only computed curve previews for all built-in types
- Float precision fixes, crosshair overlay, snap-to-grid, interpolation modes, presets
- Mini curve previews in node bodies and property panel
- Editable curve point list with manual coordinate entry

### Material System

- Interactive material layer stack editor
- Full V2 SpaceAndDepth specification support
- Material graph evaluator for density-based material assignment

### Preview Engine

- Density evaluator supporting the full node graph
- Live 2D preview with configurable colormaps and user-controlled bounds
- 3D voxel preview engine with GPU resource management
- Per-node inline density thumbnails
- Diagnostics overlay and image export
- Prop placement visualizer — 2D canvas preview for position providers

### Property Panel

- Slider, toggle, vector, and array field editors
- Input validation and constraint enforcement
- Field descriptions and inline documentation
- Help mode with expanded tips for every field
- Status badges for evaluator completeness

### Import & Export

- Bidirectional Hytale JSON translation layer — import real biome files and export back
- Prefab import/export fidelity with position provider visualization
- Round-trip support preserving all fields through import → edit → export
- CLI export script for batch processing

### Templates

- **Forest Hills** — Starter biome with documented V2 format findings
- **Eldritch Spirelands** — Complex multi-layer biome with full translation layer
- **Shattered Archipelago** — Island terrain with CLI export integration
- **Blank Project** — Empty project with minimal HytaleGenerator structure
- **Quick Start** — Responsive template cards on the home screen
- Snippet templates for common node patterns
- Templates bundled as resources for production builds

### Home Screen

- Recent projects list with quick reopen
- Template browser with visual cards
- Close project to return to home
- Visual polish and responsive layout

### Graph Features

- Auto-layout with dagre algorithm, toolbar buttons, and optional layout on file open
- Configurable graph flow direction (left-to-right / right-to-left)
- Bidirectional wire path highlighting with edge hover and input port tracing
- Copy/paste nodes across the graph
- Root node designation with visual feedback
- Centralized keybinding system with configurable shortcuts
- Multi-node selection with context menu actions
- Cursor-tracking quick-add search panel
- Snap-to-grid and alignment tools
- Extended zoom range with scroll-to-zoom
- Replace-on-connect behavior for single-input ports
- Connection validation and cycle detection
- Node visual overhaul — handle positioning, depth styling, edge routing

### UX & Visual Design

- Complete visual redesign with earth/terrain color theme
- Custom app icon
- Per-tab bookmarks and per-file bookmark persistence
- Descriptive history labels with per-section undo history
- Floating view switcher and collapsible preview controls
- Context menus throughout the application
- Toast notifications for user feedback
- Minimap navigation

### Settings

- Worldgen `Settings.json` editor with full editing support
- Keyboard shortcuts dialog
- Configurable editor preferences and layout defaults

### CI/CD

- GitHub Actions release workflow
- Windows NSIS installer build
- macOS DMG builds (Apple Silicon + Intel)
- Linux builds (`.deb` + `.AppImage` + `.rpm`)
- pnpm lockfile for reproducible CI installs

### Testing

- 298+ tests covering:
  - Import/export round-trip fidelity
  - Node validation and constraint enforcement
  - Language system end-to-end
  - BiomeRangeEditor and NoiseRange components
  - BlendCurve round-trip accuracy

### Performance

- Comprehensive optimization audit across rendering, state management, bundle size, and preview systems
- GPU resource leak prevention in voxel preview
- Debounced undo history to reduce state churn

---

[0.1.7-pre.3]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.7-pre.3
[0.1.7-pre.2]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.7-pre.2
[0.1.7-pre.0]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.7-pre.0
[1.5.9]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v1.5.9
[0.1.5]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.5
[0.1.4]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.4
[0.1.3]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.3
[0.1.2]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.2
[0.1.1]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.1
[0.1.0]: https://github.com/HyperSystems-Development/TerraNova/releases/tag/v0.1.0
[#1]: https://github.com/HyperSystems-Development/TerraNova/pull/1
[#2]: https://github.com/HyperSystems-Development/TerraNova/pull/2
[#3]: https://github.com/HyperSystems-Development/TerraNova/pull/3
[#6]: https://github.com/HyperSystems-Development/TerraNova/pull/6
[#7]: https://github.com/HyperSystems-Development/TerraNova/pull/7
[#8]: https://github.com/HyperSystems-Development/TerraNova/pull/8
[#10]: https://github.com/HyperSystems-Development/TerraNova/pull/10
[#12]: https://github.com/HyperSystems-Development/TerraNova/pull/12
