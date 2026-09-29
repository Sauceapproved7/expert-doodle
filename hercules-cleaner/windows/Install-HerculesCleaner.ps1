[CmdletBinding()]
param(
  [string]$BundleRoot="",
  [string]$ArtifactSha256="",
  [string]$ExpectedIdentityPath="",
  [switch]$NoAutostart,
  [switch]$NoUpdateTask
)
$ErrorActionPreference="Stop"

if(-not $BundleRoot){$BundleRoot=$PSScriptRoot}
$BundleRoot=(Resolve-Path -LiteralPath $BundleRoot).Path
$ManifestPath=Join-Path $BundleRoot "bundle-manifest.json"
if(-not (Test-Path -LiteralPath $ManifestPath)){throw "Hercules Cleaner bundle manifest is missing."}
$Manifest=Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if([string]$Manifest.schema -ne "sauceapproved.hercules-cleaner.windows-bundle"){throw "Invalid Hercules Cleaner Windows bundle schema."}
if([string]$Manifest.version -notmatch '^\d+\.\d+\.\d+$'){throw "Invalid Hercules Cleaner bundle version."}
if(-not $ExpectedIdentityPath){$ExpectedIdentityPath=Join-Path $BundleRoot "expected-install-identity.json"}
if(-not (Test-Path -LiteralPath $ExpectedIdentityPath -PathType Leaf)){throw "Expected Hercules Cleaner install identity is missing."}
$ExpectedIdentityPath=(Resolve-Path -LiteralPath $ExpectedIdentityPath).Path

$Node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $Node){throw "Node.js 22 or newer is required before installing Hercules Cleaner."}
$NodeVersion=(& $Node.Source --version).Trim()
if($NodeVersion -notmatch '^v(\d+)\.'){throw "Unable to verify Node.js 22 runtime."}
if([int]$Matches[1] -lt 22){throw "Node.js 22 or newer is required before installing Hercules Cleaner."}
$BundleInstaller=Join-Path $BundleRoot "app\hercules-cleaner\installer.mjs"
if(-not (Test-Path -LiteralPath $BundleInstaller -PathType Leaf)){throw "Cleaner installer core is missing from bundle."}
& $Node.Source $BundleInstaller "install-identity" "--manifest" $ManifestPath "--expected" $ExpectedIdentityPath | Out-Null
if($LASTEXITCODE -ne 0){throw "Hercules Cleaner install identity verification failed."}

foreach($File in @($Manifest.files)){
  $Relative=[string]$File.path
  if(-not $Relative -or $Relative.Contains("..") -or [IO.Path]::IsPathRooted($Relative)){throw "Unsafe bundle manifest path."}
  $Path=Join-Path $BundleRoot $Relative
  if(-not (Test-Path -LiteralPath $Path -PathType Leaf)){throw "Bundle file missing: $Relative"}
  $Actual=(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if($Actual -ne ([string]$File.sha256).ToLowerInvariant()){throw "Bundle integrity check failed: $Relative"}
}

if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required for the per-user Hercules Cleaner install."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$VersionsRoot=Join-Path $InstallRoot "versions"
$Version=[string]$Manifest.version
$VersionRoot=Join-Path $VersionsRoot $Version
$StageRoot=Join-Path $InstallRoot ("_staging\"+$Version+"-"+[guid]::NewGuid().ToString("N"))
$AppSource=Join-Path $BundleRoot "app"
if(-not (Test-Path -LiteralPath (Join-Path $AppSource "hercules-cleaner\cli.mjs"))){throw "Cleaner runtime missing from bundle."}
if(Test-Path -LiteralPath $VersionRoot){throw "Hercules Cleaner version $Version is already installed."}

New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null
try{
  Copy-Item -Path (Join-Path $AppSource "*") -Destination $StageRoot -Recurse -Force
}catch{
  Remove-Item -LiteralPath $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
  throw
}
New-Item -ItemType Directory -Path $VersionsRoot -Force | Out-Null
Move-Item -LiteralPath $StageRoot -Destination $VersionRoot

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
foreach($Name in @("Launch-HerculesCleaner.ps1","Update-HerculesCleaner.ps1","Uninstall-HerculesCleaner.ps1","HerculesCleaner.cmd")){
  Copy-Item -LiteralPath (Join-Path $BundleRoot $Name) -Destination (Join-Path $InstallRoot $Name) -Force
}
Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $InstallRoot ("bundle-manifest-"+$Version+".json")) -Force

$InstallerModule=Join-Path $VersionRoot "hercules-cleaner\installer.mjs"
$StateRoot=Join-Path $HOME ".hercules-cleaner"
$ActivateArgs=@(
  $InstallerModule,"activate",
  "--install-root",$InstallRoot,
  "--version",$Version,
  "--node",$Node.Source,
  "--state-root",$StateRoot,
  "--source-commit",[string]$Manifest.sourceCommit
)
if($ArtifactSha256){$ActivateArgs+=@("--artifact-sha256",$ArtifactSha256)}
& $Node.Source @ActivateArgs
if($LASTEXITCODE -ne 0){
  Remove-Item -LiteralPath $VersionRoot -Recurse -Force -ErrorAction SilentlyContinue
  throw "Hercules Cleaner activation health check failed. Previous active version was preserved."
}

$Cli=Join-Path $VersionRoot "hercules-cleaner\cli.mjs"
if(-not $NoAutostart){
  & $Node.Source $Cli "install-autostart"
  if($LASTEXITCODE -ne 0){Write-Warning "Cleaner installed, but user-logon startup registration did not complete."}
}

try{
  $Launcher=Join-Path $InstallRoot "HerculesCleaner.cmd"
  $Programs=Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
  New-Item -ItemType Directory -Path $Programs -Force | Out-Null
  $ShortcutPath=Join-Path $Programs "Hercules Cleaner.lnk"
  $Shell=New-Object -ComObject WScript.Shell
  $Shortcut=$Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath=$Launcher
  $Shortcut.Arguments="dashboard"
  $Shortcut.WorkingDirectory=$InstallRoot
  $Shortcut.Description="Hercules Cleaner dashboard"
  $Shortcut.Save()
}catch{Write-Warning "Cleaner installed, but Start Menu shortcut creation did not complete."}

if(-not $NoUpdateTask){
  $UpdateScript=Join-Path $InstallRoot "Update-HerculesCleaner.ps1"
  $TaskCommand="powershell.exe -NoProfile -File `"$UpdateScript`""
  & schtasks.exe /Create /F /SC DAILY /ST "03:00" /TN "SauceApproved Hercules Cleaner Update" /TR $TaskCommand | Out-Null
  if($LASTEXITCODE -ne 0){Write-Warning "Cleaner installed, but automatic update scheduling did not complete."}
}

Write-Host "Hercules Cleaner $Version installed for the current Windows user."
Write-Host "User data remains in $StateRoot and is separate from versioned application files."
){throw "Invalid Hercules Cleaner bundle version."}
if(-not $ExpectedIdentityPath){$ExpectedIdentityPath=Join-Path $BundleRoot "expected-install-identity.json"}
if(-not (Test-Path -LiteralPath $ExpectedIdentityPath -PathType Leaf)){throw "Expected Hercules Cleaner install identity is missing."}
$ExpectedIdentityPath=(Resolve-Path -LiteralPath $ExpectedIdentityPath).Path

$Node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $Node){throw "Node.js 22 or newer is required before installing Hercules Cleaner."}
$NodeVersion=(& $Node.Source --version).Trim()
if($NodeVersion -notmatch '^v(\d+)\.'){throw "Unable to verify Node.js 22 runtime."}
if([int]$Matches[1] -lt 22){throw "Node.js 22 or newer is required before installing Hercules Cleaner."}

foreach($File in @($Manifest.files)){
  $Relative=[string]$File.path
  if(-not $Relative -or $Relative.Contains("..") -or [IO.Path]::IsPathRooted($Relative)){throw "Unsafe bundle manifest path."}
  $Path=Join-Path $BundleRoot $Relative
  if(-not (Test-Path -LiteralPath $Path -PathType Leaf)){throw "Bundle file missing: $Relative"}
  $Actual=(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if($Actual -ne ([string]$File.sha256).ToLowerInvariant()){throw "Bundle integrity check failed: $Relative"}
}

if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required for the per-user Hercules Cleaner install."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$VersionsRoot=Join-Path $InstallRoot "versions"
$Version=[string]$Manifest.version
$VersionRoot=Join-Path $VersionsRoot $Version
$StageRoot=Join-Path $InstallRoot ("_staging\"+$Version+"-"+[guid]::NewGuid().ToString("N"))
$AppSource=Join-Path $BundleRoot "app"
if(-not (Test-Path -LiteralPath (Join-Path $AppSource "hercules-cleaner\cli.mjs"))){throw "Cleaner runtime missing from bundle."}
if(Test-Path -LiteralPath $VersionRoot){throw "Hercules Cleaner version $Version is already installed."}

New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null
try{
  Copy-Item -Path (Join-Path $AppSource "*") -Destination $StageRoot -Recurse -Force
}catch{
  Remove-Item -LiteralPath $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
  throw
}
New-Item -ItemType Directory -Path $VersionsRoot -Force | Out-Null
Move-Item -LiteralPath $StageRoot -Destination $VersionRoot

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
foreach($Name in @("Launch-HerculesCleaner.ps1","Update-HerculesCleaner.ps1","Uninstall-HerculesCleaner.ps1","HerculesCleaner.cmd")){
  Copy-Item -LiteralPath (Join-Path $BundleRoot $Name) -Destination (Join-Path $InstallRoot $Name) -Force
}
Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $InstallRoot ("bundle-manifest-"+$Version+".json")) -Force

$InstallerModule=Join-Path $VersionRoot "hercules-cleaner\installer.mjs"
$StateRoot=Join-Path $HOME ".hercules-cleaner"
$ActivateArgs=@(
  $InstallerModule,"activate",
  "--install-root",$InstallRoot,
  "--version",$Version,
  "--node",$Node.Source,
  "--state-root",$StateRoot,
  "--source-commit",[string]$Manifest.sourceCommit
)
if($ArtifactSha256){$ActivateArgs+=@("--artifact-sha256",$ArtifactSha256)}
& $Node.Source @ActivateArgs
if($LASTEXITCODE -ne 0){
  Remove-Item -LiteralPath $VersionRoot -Recurse -Force -ErrorAction SilentlyContinue
  throw "Hercules Cleaner activation health check failed. Previous active version was preserved."
}

$Cli=Join-Path $VersionRoot "hercules-cleaner\cli.mjs"
if(-not $NoAutostart){
  & $Node.Source $Cli "install-autostart"
  if($LASTEXITCODE -ne 0){Write-Warning "Cleaner installed, but user-logon startup registration did not complete."}
}

try{
  $Launcher=Join-Path $InstallRoot "HerculesCleaner.cmd"
  $Programs=Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
  New-Item -ItemType Directory -Path $Programs -Force | Out-Null
  $ShortcutPath=Join-Path $Programs "Hercules Cleaner.lnk"
  $Shell=New-Object -ComObject WScript.Shell
  $Shortcut=$Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath=$Launcher
  $Shortcut.Arguments="dashboard"
  $Shortcut.WorkingDirectory=$InstallRoot
  $Shortcut.Description="Hercules Cleaner dashboard"
  $Shortcut.Save()
}catch{Write-Warning "Cleaner installed, but Start Menu shortcut creation did not complete."}

if(-not $NoUpdateTask){
  $UpdateScript=Join-Path $InstallRoot "Update-HerculesCleaner.ps1"
  $TaskCommand="powershell.exe -NoProfile -File `"$UpdateScript`""
  & schtasks.exe /Create /F /SC DAILY /ST "03:00" /TN "SauceApproved Hercules Cleaner Update" /TR $TaskCommand | Out-Null
  if($LASTEXITCODE -ne 0){Write-Warning "Cleaner installed, but automatic update scheduling did not complete."}
}

Write-Host "Hercules Cleaner $Version installed for the current Windows user."
Write-Host "User data remains in $StateRoot and is separate from versioned application files."
