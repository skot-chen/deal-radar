# Stops the background collector started for the trial.
$pidFile = Join-Path $PSScriptRoot 'runs\collector.pid'
if (-not (Test-Path $pidFile)) { 'No collector.pid — nothing running.'; exit }
$id = [int](Get-Content $pidFile)
$p = Get-Process -Id $id -ErrorAction SilentlyContinue
if ($p -and $p.ProcessName -eq 'node') { Stop-Process -Id $id; "Stopped collector (pid $id)." } else { "Collector (pid $id) is not running." }
