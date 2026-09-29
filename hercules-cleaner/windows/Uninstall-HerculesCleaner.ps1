[CmdletBinding()]
param([switch]$RemoveUserData)
$ErrorActionPreference="Stop"
if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$ActivePath=Join-Path $InstallRoot "active.json"

function Remove-HerculesScheduledTaskStrict {
  param([Parameter(Mandatory=$true)][string]$TaskName)
  $QueryOutput=& schtasks.exe /Query /TN $TaskName 2>&1
  $QueryCode=$LASTEXITCODE
  if($QueryCode -eq 0){
    & schtasks.exe /Delete /F /TN $TaskName 2>&1 | Out-Null
    if($LASTEXITCODE -ne 0){throw "scheduled task cleanup failed: $TaskName"}
    return
  }
  $Message=($QueryOutput | Out-String)
  if($Message -notmatch '(?i)cannot find|does not exist|not exist'){
    throw "scheduled task cleanup failed: $TaskName"
  }
}

# Remove integration before deleting any app/runtime files. If Task Scheduler is
# unavailable or a task exists but cannot be removed, fail closed and leave the
# installed application intact so the user is not left with a dangling task.
Remove-HerculesScheduledTaskStrict -TaskName "SauceApproved Hercules Cleaner"
Remove-HerculesScheduledTaskStrict -TaskName "SauceApproved Hercules Cleaner Update"

$Shortcut=Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Hercules Cleaner.lnk"
Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue

if(Test-Path -LiteralPath $InstallRoot){
  Remove-Item -LiteralPath $InstallRoot -Recurse -Force
}

$StateRoot=Join-Path $HOME ".hercules-cleaner"
if($RemoveUserData){
  Remove-Item -LiteralPath $StateRoot -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Hercules Cleaner and local user data removed."
}else{
  Write-Host "Hercules Cleaner removed. Recovery Capsules and local Cleaner state were preserved at $StateRoot."
  Write-Host "Run uninstall again with -RemoveUserData only if you deliberately want that data removed."
}
exit 0
