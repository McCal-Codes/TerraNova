@echo off
cd /d "%~dp0"

echo Starting Vite dev server...
start "TerraNova Vite" cmd /k "pnpm dev"

echo Waiting for dev server on port 1420...
:wait
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 1420); $c.Close(); exit 0 } catch { exit 1 }" 2>nul
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

echo Dev server ready. Starting Tauri...
pnpm tauri dev
