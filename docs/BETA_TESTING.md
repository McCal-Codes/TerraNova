# TerraNova closed beta testing

This guide is for testers installing TerraNova from [McCal-Codes/TerraNova Releases](https://github.com/McCal-Codes/TerraNova/releases). You do not need Node.js or Rust unless you are building from source.

## Prerequisites

- A Hytale **release** install (default tooling path: `%APPDATA%\Hytale\install\release\package\game\latest` on Windows, with `Assets.zip` or extracted assets)
- TerraNova installer or portable artifact from the latest **prerelease** on GitHub

## Platform matrix

| OS | Download | Notes |
|----|----------|-------|
| **Windows** | `.msi` or `.exe` (NSIS) | Standard installer; WebView2 is bundled by Tauri |
| **macOS** | `.dmg` (Apple Silicon and Intel builds when published) | App is not Apple-notarized yet — see [Gatekeeper](#macos-gatekeeper) |
| **Linux** | `.AppImage` (x86_64) | `chmod +x TerraNova_*.AppImage`; FUSE may be required on some distros |

Until the first **signed** McCal-Codes release ships, in-app auto-update may not work — download new builds manually from Releases.

## First-run checklist

1. Install and launch TerraNova.
2. Complete **onboarding** (four steps):
   - Step 3: enable Hytale asset sync, confirm release path, run **Sync now** (progress modal appears).
   - Step 4: open a walkthrough from **Read guide** links (optional).
3. On the home screen, try **Create Pack** (Simple or Advanced).
4. Open a project and smoke the preview panel: **2D** → **3D** → **Voxel** on a terrain biome.
5. **File → Export Asset Pack** and confirm output under `{Group}.{Name}/Server/HytaleGenerator/`.
6. Optional: **Bridge** (`Ctrl+B`) with a local Hytale save and server mod folder.

## Bug reports

Use the in-app reporter (no developer mode required):

- **Editor:** Settings → **File a Bug Report**, or Settings → About → **Report a bug**
- **Home screen:** Settings → About → **Report a bug**

Steps:

1. Choose an **area** (Preview, Export, Bridge, etc.) and optional short summary.
2. Click **Copy debug bundle** — JSON with version, OS, settings, open file, and validation hints.
3. Click **Open GitHub issue** — paste the bundle into the **Session snapshot** field on the issue form.

Issues are public; local paths in the bundle may include your username.

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

## Maintainers: updater signing (before first beta tag)

Auto-update requires a McCal-Codes signing keypair and matching pubkey in `src-tauri/tauri.conf.json`:

```bash
pnpm tauri signer generate -w ~/.tauri/terranova-mccal.key
```

1. Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to **McCal-Codes/TerraNova** repository secrets (see `.github/workflows/release.yml`).
2. Replace `plugins.updater.pubkey` in `tauri.conf.json` with the generated public key.
3. Tag a prerelease (e.g. `v0.1.7-beta.1`) and publish `latest.json` + signed artifacts from the release workflow.

Until that is done, document **manual download** for testers (see platform matrix above).
