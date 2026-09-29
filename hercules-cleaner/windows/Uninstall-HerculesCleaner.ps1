[CmdletBinding()]
param([switch]$RemoveUserData)
$ErrorActionPreference="Stop"
if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$ActivePath=Join-Path $InstallRoot "active.json"

if(Test-Path -LiteralPath $ActivePath){
  $Active=Get-Content -LiteralPath $ActivePath -Raw | ConvertFrom-Json
  $Node=Get-Command node.exe -ErrorAction SilentlyContinue
  $Cli=Join-Path ([string]$Active.versionRoot) "hercules-cleaner\cli.mjs"
  if(-not $Node){throw "Node.js is required to remove Hercules Cleaner startup integration safely."}
  if(-not (Test-Path -LiteralPath $Cli -PathType Leaf)){throw "Active Hercules Cleaner CLI is missing; startup integration cleanup cannot be verified."}
  & $Node.Source $Cli "uninstall-autostart" | Out-Null
  if($LASTEXITCODE -ne 0){throw "Hercules Cleaner startup integration removal failed."}
}

& schtasks.exe /Query /TN "SauceApproved Hercules Cleaner Update" 2>$null | Out-Null
if($LASTEXITCODE -eq 0){
  & schtasks.exe /Delete /F /TN "SauceApproved Hercules Cleaner Update" | Out-Null
  if($LASTEXITCODE -ne 0){throw "Hercules Cleaner update task removal failed."}
}

$Shortcut=Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Hercules Cleaner.lnk"
Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue
if(Test-Path -LiteralPath $InstallRoot){
  Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  if(Test-Path -LiteralPath $InstallRoot){throw "Hercules Cleaner application files could not be fully removed."}
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
