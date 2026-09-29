[CmdletBinding()]
param([switch]$RemoveUserData)
$ErrorActionPreference="Stop"
if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$ActivePath=Join-Path $InstallRoot "active.json"

if(Test-Path -LiteralPath $ActivePath){
  try{
    $Active=Get-Content -LiteralPath $ActivePath -Raw | ConvertFrom-Json
    $Node=Get-Command node.exe -ErrorAction SilentlyContinue
    $Cli=Join-Path ([string]$Active.versionRoot) "hercules-cleaner\cli.mjs"
    if($Node -and (Test-Path -LiteralPath $Cli)){& $Node.Source $Cli "uninstall-autostart" | Out-Null}
  }catch{}
}
& schtasks.exe /Delete /F /TN "SauceApproved Hercules Cleaner Update" 2>$null | Out-Null
$Shortcut=Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Hercules Cleaner.lnk"
Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $InstallRoot -Recurse -Force -ErrorAction SilentlyContinue

$StateRoot=Join-Path $HOME ".hercules-cleaner"
if($RemoveUserData){
  Remove-Item -LiteralPath $StateRoot -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Hercules Cleaner and local user data removed."
}else{
  Write-Host "Hercules Cleaner removed. Recovery Capsules and local Cleaner state were preserved at $StateRoot."
  Write-Host "Run uninstall again with -RemoveUserData only if you deliberately want that data removed."
}
exit 0
