# TerraNova closed alpha / beta testing

This guide is for testers installing **0.1.8-alpha.4** (closed alpha) from [McCal-Codes/TerraNova Releases](https://github.com/McCal-Codes/TerraNova/releases). You do not need Node.js or Rust unless you are building from source.

## Prerequisites

- A Hytale **release** install (default tooling path: `%APPDATA%\Hytale\install\release\package\game\latest` on Windows, with `Assets.zip` or extracted assets)
- TerraNova installer or portable artifact from the latest **prerelease** on GitHub

## Platform matrix

| OS | Download | Notes |
|----|----------|-------|
| **Windows** | `.msi` or `.exe` (NSIS) | Standard installer; WebView2 is bundled by Tauri |
| **macOS** | `.dmg` (Apple Silicon and Intel builds when published) | App is not Apple-notarized yet — see [Gatekeeper](#macos-gatekeeper) |
| **Linux** | `.AppImage` (x86_64) | `chmod +x TerraNova_*.AppImage`; FUSE may be required on some distros |

**Updates:** `v0.1.8-alpha.1`+ ships signed updater metadata. In-app update works once you install from a **published** (not draft) prerelease on [Releases](https://github.com/McCal-Codes/TerraNova/releases) — the app checks `releases/latest/download/latest.json`. With **Auto-check for updates** on (default), a new build downloads in the background ~3s after launch; click **Restart to update** in the status bar when ready. Manual check: Settings → General → **Check for updates**.

## First-run checklist

1. Install and launch TerraNova **0.1.8-alpha.4** (or update from alpha.3 in-app).
2. Complete **onboarding** (four steps):
   - Step 3: enable Hytale asset sync, confirm release path, run **Sync now** (progress modal appears).
   - Step 4: open **Getting Started** from the doc links (optional); note **F1** for in-editor docs.
3. Read the **What to test** modal (alpha checklist) and work through its focus areas — especially **session restore**, **Atmosphere tint**, **preview fidelity callouts**, and **voxel legend toggles** (new in alpha.4).
4. Settings → About: confirm **License** and **Notice** open readable modals.
5. On the home screen, try **Create Pack** (Simple or Advanced).
6. Open a project and smoke the preview panel: expand **Settings** on the preview toolbar (or the edge chevron in split view), then **2D** → **3D** → **Voxel** on a terrain biome; try **Legend visibility** checkboxes in Voxel settings.
7. On a biome with Simplex tint, edit **Atmosphere → Tint** (Seed/Scale/delimiters) without opening the Tint graph.
8. **File → Export Asset Pack** and confirm output under `{Group}.{Name}/Server/HytaleGenerator/`.
9. **Export** your pack and test in a Hytale save (Bridge is **not** in scope for the closed alpha).

### Alpha cadence and support

- **Weekly alpha builds** are planned when possible — install new prereleases from [Releases](https://github.com/McCal-Codes/TerraNova/releases).
- **Bridge** (live server sync) needs more work and is **not** part of the first closed-alpha test plan.
- **Serious bugs or data-loss issues:** reach **@mcc_cal** on Discord in addition to the in-app bug reporter.

## Pack backup (closed alpha)

When you **open an existing pack** (File → Open, Recent, or Bridge → Open in editor), TerraNova asks whether to back up first:

- **Back up & open** — full copy of the pack folder to `.terranova-backups/{PackName}-{timestamp}` next to the pack (or a folder you choose).
- **Open without backup** — proceed immediately (not recommended for live save mods).
- **Don't ask again for this pack** — remembers your choice for that pack path only.

Restore a backup by copying the backup folder back over the mod folder while Hytale/TerraNova are closed.

## Bug reports

Use the in-app reporter (no developer mode required):

- **Editor:** Settings → **File a Bug Report**, or Settings → About → **Report a bug**
- **Home screen:** Settings → About → **Report a bug**

Steps:

1. Choose an **area** (Preview, Export, Bridge, Onboarding, etc.).
2. Fill **Steps to reproduce**, **Expected**, and **Actual** when you can.
3. Click **Copy report** — header + structured JSON (paths redacted where possible).
4. Click **Open GitHub issue** — version, OS, area, title, and steps are prefilled; paste JSON into **Session snapshot**.

Issues are public; local paths in the bundle may include your username.

**Not a crash?** Use the [Alpha feedback](https://github.com/McCal-Codes/TerraNova/issues/new?template=ALPHA_FEEDBACK.yml) template for “confusing”, “missing”, or “works great” notes.

## macOS Gatekeeper

If macOS blocks the app (“unverified developer”):

1. Right-click the app → **Open** → confirm **Open** again, or
2. System Settings → Privacy & Security → **Open Anyway** for TerraNova.

## Linux AppImage

```bash
chmod +x TerraNova_*.AppImage
./TerraNova_*.AppImage
```

If the AppImage fails to mount, install FUSE (`libfuse2` on Ubuntu/Debian) or extract with `--appimage-extract` and run `squashfs-root/AppRun`.

### Maintainer: history rewrite

To strip **unknown** author identities from git while **keeping** the five human GitHub contributors:

```powershell
# Requires: pip install git-filter-repo
./scripts/rewrite-history-mccal.ps1
git push origin main --force
git push origin --force --tags
```

Preserved emails: McCal, nmang004, ZenithDevHQ, LeoWherle, derrickmehaffy (see `scripts/filter-repo-commit-callback.py`). Everything else is re-attributed to McCal.

Re-publish release artifacts after rewrite if tags moved to new SHAs.

### Maintainer: announce to testers (copy/paste)

```text
TerraNova 0.1.8-alpha.4 is up (closed alpha prerelease).

Install: https://github.com/McCal-Codes/TerraNova/releases — pick v0.1.8-alpha.4, or update in-app from alpha.3.
Windows: .msi/.exe · macOS: .dmg (Right-click → Open first time) · Linux: .AppImage

First run: onboarding → Step 3 asset sync → read expanded “What to test” checklist (session restore, Atmosphere tint, fidelity callouts, voxel legend).
Please use in-app bug reporter (screenshots help) or Alpha feedback on GitHub.
Bridge/live sync is NOT in scope for this cut — export your pack and test in-game.
```

### Maintainer: alpha packaging workflow

Manual closed-alpha builds: **GitHub → Actions → Alpha → Run workflow**

1. Ensure `pnpm validate` passes and `docs/CHANGELOG.md` Unreleased is populated
2. Enter version (e.g. `0.1.8-alpha.2`); start with `publish: false` to verify builds
3. Re-run with `publish: true` for a draft prerelease; release body is auto-generated from `docs/CHANGELOG.md` via `scripts/release-notes.mjs`

Tag-based releases still work via `git tag v0.1.8-alpha.N` push (see `.github/workflows/release.yml`).

### Maintainer: updater signing

```bash
pnpm tauri signer generate -w ~/.tauri/terranova-mccal.key --ci
pnpm setup:signing-secrets   # uploads full .key file + password to McCal-Codes/TerraNova secrets
```

1. `TAURI_SIGNING_PRIVATE_KEY` must be the **entire** private key file (including the untrusted comment line). Partial keys fail CI with `Missing comment in secret key`.
2. `plugins.updater.pubkey` in `tauri.conf.json` must match the generated `.pub` file.
3. Alpha/Release workflows with `sign=true` emit `latest.json` + signed artifacts for in-app updates.

Local key (never commit): `%USERPROFILE%\.tauri\terranova-mccal.key`
