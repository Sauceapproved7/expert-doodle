[CmdletBinding()]
param(
  [string]$ManifestUrl="https://raw.githubusercontent.com/Sauceapproved7/expert-doodle/main/releases/hercules-cleaner-v1.0.0/windows/update-channel.json"
)
$ErrorActionPreference="Stop"
if(-not $env:LOCALAPPDATA){throw "LOCALAPPDATA is required."}
$InstallRoot=Join-Path $env:LOCALAPPDATA "SauceApproved\Hercules Cleaner"
$ActivePath=Join-Path $InstallRoot "active.json"
if(-not (Test-Path -LiteralPath $ActivePath)){throw "Hercules Cleaner is not installed."}
if(-not $ManifestUrl.StartsWith("https://",[StringComparison]::OrdinalIgnoreCase)){throw "Update manifest must use HTTPS."}

$Active=Get-Content -LiteralPath $ActivePath -Raw | ConvertFrom-Json
$Node=Get-Command node.exe -ErrorAction Stop
$InstallerModule=Join-Path ([string]$Active.versionRoot) "hercules-cleaner\installer.mjs"
if(-not (Test-Path -LiteralPath $InstallerModule)){throw "Active Hercules Cleaner installer core is missing."}

$Temp=Join-Path $env:TEMP ("hercules-cleaner-update-"+[guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Temp -Force | Out-Null
try{
  $ManifestPath=Join-Path $Temp "update-channel.json"
  Invoke-WebRequest -UseBasicParsing -Uri $ManifestUrl -OutFile $ManifestPath
  $DecisionJson=& $Node.Source $InstallerModule "decision" "--current" ([string]$Active.version) "--manifest" $ManifestPath
  if($LASTEXITCODE -ne 0){throw "Update channel validation failed."}
  $Decision=$DecisionJson | ConvertFrom-Json
  if([string]$Decision.action -ne "update"){
    Write-Host ("Hercules Cleaner update held: "+[string]$Decision.reason)
    exit 0
  }

  $Archive=Join-Path $Temp "hercules-cleaner-update.zip"
  Invoke-WebRequest -UseBasicParsing -Uri ([string]$Decision.artifactUrl) -OutFile $Archive
  $ActualHash=(Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if($ActualHash -ne ([string]$Decision.artifactSha256).ToLowerInvariant()){throw "Downloaded update SHA256 does not match the update channel."}

  $ListPath=Join-Path $Temp "archive-entries.txt"
  & tar.exe -tf $Archive | Set-Content -LiteralPath $ListPath -Encoding UTF8
  if($LASTEXITCODE -ne 0){throw "Unable to inspect the update archive."}
  & $Node.Source $InstallerModule "validate-archive" "--list-file" $ListPath
  if($LASTEXITCODE -ne 0){throw "Update archive contains an unsafe path."}

  $Extract=Join-Path $Temp "extracted"
  New-Item -ItemType Directory -Path $Extract -Force | Out-Null
  & tar.exe -xf $Archive -C $Extract
  if($LASTEXITCODE -ne 0){throw "Unable to extract the Hercules Cleaner update."}
  $NextInstaller=Join-Path $Extract "Install-HerculesCleaner.ps1"
  if(-not (Test-Path -LiteralPath $NextInstaller)){throw "Update bundle installer is missing."}

  & $NextInstaller -BundleRoot $Extract -ArtifactSha256 ([string]$Decision.artifactSha256) -NoUpdateTask
  if($LASTEXITCODE -ne 0){throw "Hercules Cleaner update activation failed."}
  Write-Host ("Hercules Cleaner updated to "+[string]$Decision.version+".")
}finally{
  Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
