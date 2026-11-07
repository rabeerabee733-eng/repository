$ErrorActionPreference = 'Stop'
$appPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$workerPath = Join-Path $appPath 'local-worker.mjs'
$existing = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($workerPath) }
if ($existing) { exit 0 }
if (!(Test-Path (Join-Path $appPath 'worker-token.dpapi'))) { throw 'WORKER_NOT_PAIRED' }
Start-Process -FilePath $nodePath -ArgumentList ('"' + $workerPath + '"') -WorkingDirectory $appPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appPath 'worker-status.log') -RedirectStandardError (Join-Path $appPath 'worker-error.log')
