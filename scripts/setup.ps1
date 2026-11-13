$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Cache = Join-Path $Root "cache\pip"
New-Item -ItemType Directory -Force -Path $Cache | Out-Null
$env:PIP_CACHE_DIR = $Cache
$env:HF_HOME = Join-Path $Root "models\huggingface"
$env:TORCH_HOME = Join-Path $Root "models\torch"
$env:XDG_CACHE_HOME = Join-Path $Root "cache"
$env:NUMBA_CACHE_DIR = Join-Path $Root "cache\numba"

Write-Host "Creating project-local Python environment..."
& py -3.12 -m venv (Join-Path $Root ".venv")
$Python = Join-Path $Root ".venv\Scripts\python.exe"
& $Python -m pip install --upgrade pip --cache-dir $Cache
& $Python -m pip install -r (Join-Path $Root "backend\requirements.txt") -r (Join-Path $Root "backend\requirements-dev.txt") --cache-dir $Cache

Write-Host "Installing frontend dependencies..."
Push-Location (Join-Path $Root "frontend")
try {
    & npm install --cache (Join-Path $Root "cache\npm")
} finally {
    Pop-Location
}

Write-Host "Running database migrations..."
Push-Location (Join-Path $Root "backend")
try {
    & $Python -m alembic upgrade head
} finally {
    Pop-Location
}

Write-Host "MeowPower setup complete." -ForegroundColor Green
