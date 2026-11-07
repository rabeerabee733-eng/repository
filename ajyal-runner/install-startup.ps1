$ErrorActionPreference = 'Stop'
$appPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$shell = New-Object -ComObject WScript.Shell
$startupPath = [Environment]::GetFolderPath('Startup')
$shortcut = $shell.CreateShortcut((Join-Path $startupPath 'Altahdir Ajyal Worker.lnk'))
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $appPath 'start-worker.ps1') + '"'
$shortcut.WorkingDirectory = $appPath
$shortcut.WindowStyle = 7
$shortcut.Description = 'Karam Ajyal assessment worker'
$shortcut.Save()
Write-Output 'STARTUP_INSTALLED'
