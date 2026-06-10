# Contributing to TerraNova

Thank you for helping improve TerraNova. This project edits **real Hytale World Generation V2** JSON — accuracy matters more than feature count.

## Prerequisites

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | 22.x (matches CI) |
| [pnpm](https://pnpm.io/) | 10.x (`packageManager` in `package.json`) |
| [Rust](https://rustup.rs/) | 1.77+ stable |

**Windows:** Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) for Tauri.

## Development

```bash
pnpm install
pnpm tauri dev
```

`pnpm dev` starts Vite only (no desktop shell). Use `pnpm tauri dev` for the full app.

For block icons and validation against real game data: **Settings → Assets** → point at your Hytale **release** install (`...\install\release\package\game\latest` or `Assets.zip`) and sync. See [Importing from Hytale assets](src/docs/guides/world/environments-and-weather.md#importing-from-hytale-assets).

## Verification (before a PR)

Run the full gate locally:

```bash
pnpm validate
```

That runs: `lint`, `build`, `vitest`, `cargo fmt --check`, and `cargo test`.

**Also run when you change:**

| Change | Extra check |
|--------|-------------|
| Tauri shell, IPC, filesystem, updater | `pnpm tauri build --no-sign` |
| UI/runtime behavior | Manual smoke in `pnpm tauri dev` |
| Hytale import/export | `pnpm exec vitest run src/utils/__tests__/biomeRoundTrip.test.ts src/utils/__tests__/endToEndExport.test.ts` |

CI (`.github/workflows/ci.yml`) runs lint, build, vitest, docs integrity, `cargo fmt --check`, and `cargo test` on every PR to `main`/`master`.

## Hytale fidelity guidelines

- Align import, export, asset sync, and validation with the user's **release** game install unless a task explicitly targets pre-release.
- Material **Constant** nodes use **block IDs** (e.g. `Rock_Stone`, `Soil_Grass`) from synced assets — not invented `hytale:` URIs or a separate materials tree.
- Export biomes with **Export Asset Pack** (`Ctrl+Shift+E`) as `{Group}.{Name}/Server/HytaleGenerator/...`, not loose JSON dropped into `mods/`.
- Preview is approximate for some node types (yellow badge); in-game testing remains the source of truth.
- Preserve `$NodeEditorMetadata` (`$WorkspaceID`, `$Links`, `$FloatingNodes`, comments, frames) on round-trip.

## Commits and planning docs

- Do not commit `tsconfig.tsbuildinfo` or local Cursor hook state unless intentional.
- `AGENTS.md`, `docs/planning/`, `docs/AI_TRANSPARENCY.md`, and `.planning/` are **local-only** (gitignored). Keep them on your machine for agent workflows; do not add them to public PRs unless a maintainer explicitly asks.

## Documentation

In-app docs live under `src/docs/`. After editing guides, run:

```bash
pnpm docs:check
```

Root `docs/` is planning and release notes; user-facing tutorials are under `src/docs/walkthroughs/` and `src/docs/guides/`.
