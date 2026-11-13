$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "MeowPower environment check" -ForegroundColor Green
Write-Host "Project: $Root"

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Warning "Project virtual environment is missing. Run scripts\setup.ps1 first."
    $PythonCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($PythonCommand) { & py -3.12 --version } else { Write-Warning "Python 3.12+ was not found." }
} else {
    & $Python --version
    & $Python -c "import fastapi, sqlalchemy, aiosqlite, alembic, keyring; print('Backend dependencies: OK')"
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
    & node --version
} else {
    Write-Warning "Node.js was not found."
}
$Npm = Get-Command npm -ErrorAction SilentlyContinue
if ($Npm) {
    & npm --version
} else {
    Write-Warning "npm was not found."
}

if (Test-Path (Join-Path $Root "frontend\node_modules")) {
    Write-Host "Frontend dependencies: OK"
} else {
    Write-Warning "frontend\node_modules is missing."
}

$Ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($Ffmpeg) {
    & ffmpeg -version | Select-Object -First 1
    Write-Host "FFmpeg: available (required starting Phase 4)"
} else {
    Write-Host "FFmpeg: not installed (Phase 1 does not require it)"
}

Write-Host "Backend target: http://127.0.0.1:8000"
Write-Host "Frontend target: http://127.0.0.1:5173"
