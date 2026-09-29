[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$CleanerArgs
)
$ErrorActionPreference="Stop"
$InstallRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$ActivePath=Join-Path $InstallRoot "active.json"
if(-not (Test-Path -LiteralPath $ActivePath)){throw "Hercules Cleaner is not installed."}
$Active=Get-Content -LiteralPath $ActivePath -Raw | ConvertFrom-Json
$Cli=Join-Path ([string]$Active.versionRoot) "hercules-cleaner\cli.mjs"
if(-not (Test-Path -LiteralPath $Cli)){throw "The active Hercules Cleaner runtime is missing."}
$Node=Get-Command node.exe -ErrorAction Stop
& $Node.Source $Cli @CleanerArgs
exit $LASTEXITCODE
