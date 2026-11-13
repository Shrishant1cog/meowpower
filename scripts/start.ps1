$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$StateFile = Join-Path $Root "temp\processes.json"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Frontend = Join-Path $Root "frontend"
$Temp = Join-Path $Root "temp"

if (-not (Test-Path $Python)) { throw "Run scripts\setup.ps1 before starting MeowPower." }
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) { throw "Frontend dependencies are missing." }
New-Item -ItemType Directory -Force -Path $Temp | Out-Null

function Test-PortInUse([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Stop-ProcessTree([int]$RootPid) {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    $pending = [System.Collections.Generic.Queue[int]]::new()
    $pending.Enqueue($RootPid)
    $descendants = [System.Collections.Generic.List[int]]::new()
    while ($pending.Count -gt 0) {
        $parent = $pending.Dequeue()
        foreach ($child in @($processes | Where-Object { $_.ParentProcessId -eq $parent })) {
            $descendants.Add([int]$child.ProcessId)
            $pending.Enqueue([int]$child.ProcessId)
        }
    }
    foreach ($processId in @($descendants | Sort-Object -Descending)) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

function Wait-HttpReady([string]$Uri, [int]$TimeoutSeconds, [int]$ProcessId) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            throw "Process $ProcessId exited before $Uri became ready."
        }
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 200
        }
    }
    throw "Timed out waiting for $Uri."
}

if (Test-Path $StateFile) {
    try {
        $existing = Get-Content $StateFile -Raw | ConvertFrom-Json
        $existingRunning = @($existing.backend_pid, $existing.frontend_pid) | Where-Object {
            $_ -and (Get-Process -Id $_ -ErrorAction SilentlyContinue)
        }
        if ($existingRunning.Count -gt 0) {
            throw "MeowPower already has running service processes. Run scripts\stop.ps1 first."
        }
    } catch {
        if ($_.Exception.Message -notlike "MeowPower already*") {
            Write-Warning "Ignoring an unreadable MeowPower process state file."
        } else {
            throw
        }
    }
    Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(8000, 5173)) {
    if (Test-PortInUse $port) {
        throw "Port $port is already in use. MeowPower did not start."
    }
}

$backend = Start-Process `
    -FilePath $Python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
    -WorkingDirectory (Join-Path $Root "backend") `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Temp "backend.stdout.log") `
    -RedirectStandardError (Join-Path $Temp "backend.stderr.log") `
    -PassThru

$frontend = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $Frontend `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $Temp "frontend.stdout.log") `
    -RedirectStandardError (Join-Path $Temp "frontend.stderr.log") `
    -PassThru

$state = @{
    backend_pid = $backend.Id
    frontend_pid = $frontend.Id
    backend_started_at = $backend.StartTime.ToUniversalTime().ToString("o")
    frontend_started_at = $frontend.StartTime.ToUniversalTime().ToString("o")
    started_at = (Get-Date).ToUniversalTime().ToString("o")
}
$state | ConvertTo-Json | Set-Content -Encoding UTF8 $StateFile

try {
    Wait-HttpReady "http://127.0.0.1:8000/api/v1/health" 30 $backend.Id
    Wait-HttpReady "http://127.0.0.1:5173" 30 $frontend.Id

    foreach ($port in @(8000, 5173)) {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
        if ($listeners.Count -eq 0) {
            throw "Port $port did not enter the listening state."
        }
        if (@($listeners | Where-Object { $_.LocalAddress -notin @("127.0.0.1", "::1") }).Count -gt 0) {
            throw "Port $port is listening on a non-loopback address."
        }
    }
} catch {
    Stop-ProcessTree $frontend.Id
    Stop-ProcessTree $backend.Id
    Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
    throw
}

Write-Host "MeowPower backend is ready at http://127.0.0.1:8000." -ForegroundColor Green
Write-Host "MeowPower frontend is ready at http://127.0.0.1:5173." -ForegroundColor Green
Write-Host "Process state saved to $StateFile."
