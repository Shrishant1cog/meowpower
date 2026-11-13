$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Database = Join-Path $Root "storage\database\meowpower.db"
$BackupDirectory = Join-Path $Root "storage\database\backups"
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Database)) { throw "MeowPower database does not exist yet." }
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Destination = Join-Path $BackupDirectory "meowpower-$Timestamp.db"

& $Python -c "import sqlite3, sys; source=sqlite3.connect(sys.argv[1]); target=sqlite3.connect(sys.argv[2]); source.backup(target); target.close(); source.close()" $Database $Destination
if ($LASTEXITCODE -ne 0) { throw "SQLite backup failed." }
Write-Host "Database backup created: $Destination" -ForegroundColor Green
