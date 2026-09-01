@echo off
REM TerraNova development launcher (Windows double-click wrapper).
REM
REM Deliberately minimal: scripts/dev-launcher.mjs owns every check and process.
REM The previous version started `pnpm dev` in its own window AND then ran
REM `pnpm tauri dev`, whose beforeDevCommand starts `pnpm dev` again — two Vite
REM servers competing for port 1420. Tauri is the only owner of Vite now.
REM
REM Pass --lab to open straight into Dev Lab, or --web for browser-only.

cd /d "%~dp0"
call pnpm start %*

if errorlevel 1 (
  echo.
  echo TerraNova failed to start. For a diagnosis run:
  echo     pnpm dev:doctor
  pause
)
