$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$StateFile = Join-Path $Root "temp\processes.json"

& (Join-Path $PSScriptRoot "start.ps1")
Write-Host "MeowPower development services started." -ForegroundColor Green
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://127.0.0.1:5173"
Write-Host "Stop both services with scripts\stop.ps1"
