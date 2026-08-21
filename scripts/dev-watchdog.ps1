# Dev server watchdog — checks that the local backend (8787) and frontend
# (5173) dev servers are actually up, and restarts whichever one isn't.
# Registered as a Windows Scheduled Task (every few minutes) so the dev
# environment self-heals even if nobody's actively running Claude Code —
# "server band nahi hona chahiye, cron job laga do" per the project owner.
#
# Safe to run repeatedly: if a server's already listening, it does nothing
# for that server. Logs each check to dev-watchdog.log next to this script.

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Item $PSScriptRoot).Parent.FullName }
$logFile = Join-Path $PSScriptRoot "dev-watchdog.log"

function Write-Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $logFile -Value $line
}

function Test-PortListening($port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
  } catch {
    return $false
  }
}

function Start-DevServer($name, $folder, $port) {
  Write-Log "$name (port $port) is DOWN - restarting"
  $workDir = Join-Path $root $folder
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") -WorkingDirectory $workDir -WindowStyle Hidden
  Write-Log "$name restart command issued"
}

if (-not (Test-PortListening 8787)) {
  Start-DevServer "backend" "backend" 8787
} else {
  Write-Log "backend (port 8787) OK"
}

if (-not (Test-PortListening 5173)) {
  Start-DevServer "frontend" "frontend" 5173
} else {
  Write-Log "frontend (port 5173) OK"
}
