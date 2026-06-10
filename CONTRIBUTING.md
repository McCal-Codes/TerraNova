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

That runs: `lint`, `build`, `vitest`, `docs:check`, `changelog:check`, `cargo fmt --check`, and `cargo test`.

**Also run when you change:**

| Change | Extra check |
|--------|-------------|
| Tauri shell, IPC, filesystem, updater | `pnpm tauri build --no-sign` |
| UI/runtime behavior | Manual smoke in `pnpm tauri dev` |
| Hytale import/export | `pnpm exec vitest run src/utils/__tests__/biomeRoundTrip.test.ts src/utils/__tests__/endToEndExport.test.ts` |
| User-facing features or fixes | Add bullets under `## Unreleased` in [docs/CHANGELOG.md](docs/CHANGELOG.md) |

CI (`.github/workflows/ci.yml`) runs `pnpm validate` plus a bridge-plugin jar build on every PR to `main`/`master`.

## Commits

- **Only McCal** creates new commits on this repo: `McCal <business@mcc-cal.com>`
- **AI/agents must never run `git commit` or `git push`** — they prepare diffs; you review and commit locally
- One-time hook setup: `pnpm setup:hooks` (`.githooks/prepare-commit-msg` strips agent `Co-authored-by` lines; `commit-msg` enforces McCal-only author/committer)

### History hygiene (optional)

`scripts/rewrite-history-mccal.ps1` rewrites **unknown or agent** author/committer lines to McCal while **preserving** these human contributors (by email):

| GitHub | Email |
|--------|-------|
| McCal-Codes | `business@mcc-cal.com` |
| nmang004 | `nmang004@gmail.com` |
| ZenithDevHQ | `scrubc1ty4ever@gmail.com`, `ZenithDevHQ@users.noreply.github.com` |
| LeoWherle | `leo.v.rentmeister@gmail.com` |
| derrickmehaffy | `derrickmehaffy@gmail.com` |

You run the script and force-push; agents must not force-push.

## Changelog

- Canonical file: [docs/CHANGELOG.md](docs/CHANGELOG.md) (also in-app via Home → Learn → Changelog)
- Add user-facing changes under `## Unreleased` as you work
- Before an alpha cut: rename Unreleased to `## [x.y.z-alpha.N] — date`, paste sections into the GitHub Release body, bump `fetchReleases` bundled fallback if needed
- Gate: `pnpm changelog:check` (included in `pnpm validate`)

## Releases and tags (GitHub + semver)

Follow [GitHub tagging guidance](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository):

| Kind | Tag example | GitHub release |
|------|-------------|----------------|
| Closed alpha | `v0.1.8-alpha.1` | **Prerelease**, **not** Latest |
| Beta / RC | `v0.2.0-beta.3`, `v1.0.0-rc.1` | Prerelease, not Latest |
| Stable | `v1.0.0` | Latest (when you publish the draft) |

Rules:

- Always prefix tags with **`v`** (`v1.0.0`, not `1.0.0`)
- Non-production builds use a **prerelease suffix** after the patch: `-alpha.N`, `-beta.N`, `-rc.N`
- Tag must match `package.json` version with the `v` prefix
- Annotated tags: `git tag -a v0.1.8-alpha.1 -m "TerraNova 0.1.8-alpha.1 closed alpha"`
- Push tag to trigger **Release** workflow: `git push origin v0.1.8-alpha.1`
- CI sets `prerelease=true` and **`latest=false`** for alpha/beta/rc so stable `v0.1.5` stays Latest

## Alpha packaging

Manual closed-alpha builds: **Actions → Alpha → Run workflow**

1. Ensure `pnpm validate` passes and Unreleased is populated
2. Enter version (e.g. `0.1.8-alpha.2`) — workflow tag becomes `v0.1.8-alpha.2`
3. Start with `publish: false` to verify builds; re-run with `publish: true` for a draft prerelease

## Hytale fidelity guidelines

- Align import, export, asset sync, and validation with the user's **release** game install unless a task explicitly targets pre-release.
- Material **Constant** nodes use **block IDs** (e.g. `Rock_Stone`, `Soil_Grass`) from synced assets — not invented `hytale:` URIs or a separate materials tree.
- Export biomes with **Export Asset Pack** (`Ctrl+Shift+E`) as `{Group}.{Name}/Server/HytaleGenerator/...`, not loose JSON dropped into `mods/`.
- Preview is approximate for some node types (yellow badge); in-game testing remains the source of truth.
- Preserve `$NodeEditorMetadata` (`$WorkspaceID`, `$Links`, `$FloatingNodes`, comments, frames) on round-trip.

## Planning docs (local-only)

- Do not commit `tsconfig.tsbuildinfo` or local Cursor hook state unless intentional.
- `AGENTS.md`, `docs/planning/`, `docs/AI_TRANSPARENCY.md`, and `.planning/` are **local-only** (gitignored). Keep them on your machine for agent workflows; do not add them to public PRs unless a maintainer explicitly asks.

## Documentation

In-app docs live under `src/docs/`. After editing guides, run:

```bash
pnpm docs:check
```

Root `docs/` is planning and release notes; user-facing tutorials are under `src/docs/walkthroughs/` and `src/docs/guides/`.
