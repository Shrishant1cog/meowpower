$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$StateFile = Join-Path $Root "temp\processes.json"

function Get-ProcessTree([int]$RootPid) {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    $pending = [System.Collections.Generic.Queue[int]]::new()
    $pending.Enqueue($RootPid)
    $tree = [System.Collections.Generic.List[int]]::new()
    while ($pending.Count -gt 0) {
        $parent = $pending.Dequeue()
        $tree.Add($parent)
        foreach ($child in @($processes | Where-Object { $_.ParentProcessId -eq $parent })) {
            $pending.Enqueue([int]$child.ProcessId)
        }
    }
    return $tree
}

function Test-ProcessMatchesStartTime([int]$ProcessId, [string]$ExpectedStartTime) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return $false }
    if (-not $ExpectedStartTime) { return $true }
    try {
        $expected = [datetime]::Parse($ExpectedStartTime).ToUniversalTime()
        $actual = $process.StartTime.ToUniversalTime()
        return [math]::Abs(($actual - $expected).TotalSeconds) -lt 1
    } catch {
        return $false
    }
}

if (-not (Test-Path $StateFile)) {
    Write-Host "No MeowPower process state file found; nothing to stop."
    exit 0
}

$state = Get-Content $StateFile -Raw | ConvertFrom-Json
$rootPids = @()
foreach ($property in @("backend_pid", "frontend_pid")) {
    $processId = [int]$state.$property
    if ($processId -le 0) { continue }
    $startProperty = if ($property -eq "backend_pid") { "backend_started_at" } else { "frontend_started_at" }
    $expectedStart = [string]$state.$startProperty
    if (-not (Test-ProcessMatchesStartTime $processId $expectedStart)) {
        Write-Warning "Skipped $property process $processId because it is absent or its identity changed."
        continue
    }
    $rootPids += $processId
}

$processIds = [System.Collections.Generic.HashSet[int]]::new()
foreach ($rootPid in $rootPids) {
    foreach ($processId in @(Get-ProcessTree $rootPid)) {
        [void]$processIds.Add([int]$processId)
    }
}

foreach ($processId in @($processIds | Sort-Object -Descending)) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped process $processId."
    }
}

$deadline = (Get-Date).AddSeconds(10)
do {
    $listeners = @(
        Get-NetTCPConnection -State Listen -LocalPort 8000, 5173 -ErrorAction SilentlyContinue
    )
    if ($listeners.Count -eq 0) { break }
    Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $deadline)

if ($listeners.Count -gt 0) {
    $ports = @($listeners | Select-Object -ExpandProperty LocalPort -Unique)
    throw "MeowPower stopped its tracked processes, but port(s) remain in use: $($ports -join ', ')."
}

Remove-Item $StateFile -Force -ErrorAction SilentlyContinue
Write-Host "MeowPower services stopped and ports 8000/5173 are free." -ForegroundColor Green
