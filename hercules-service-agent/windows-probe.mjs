import {execFile as nodeExecFile} from "node:child_process";
import {promisify} from "node:util";

const defaultExecFile=promisify(nodeExecFile);
const SCRIPT=[
  "$ErrorActionPreference='Stop'",
  "$os=Get-CimInstance Win32_OperatingSystem",
  "$disk=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='$env:SystemDrive'\"",
  "$free=if($disk.Size -gt 0){[math]::Round(($disk.FreeSpace/$disk.Size)*100,2)}else{$null}",
  "$mem=if($os.TotalVisibleMemorySize -gt 0){[math]::Round((1-($os.FreePhysicalMemory/$os.TotalVisibleMemorySize))*100,2)}else{$null}",
  "$reboot=(Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired')",
  "$failed=@(Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-WindowsUpdateClient';Level=2;StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue).Count",
  "[pscustomobject]@{freeDiskPercent=$free;memoryPressurePercent=$mem;pendingReboot=[bool]$reboot;failedUpdates=$failed;startupImpact='unknown'}|ConvertTo-Json -Compress"
].join(";");

export function createWindowsProbe({platform=process.platform,execFileImpl=defaultExecFile}={}){
  return async function probe(){
    if(platform!=="win32") throw new Error("Windows host required");
    const {stdout}=await execFileImpl("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-Command",SCRIPT],{
      windowsHide:true,timeout:15000,maxBuffer:64*1024,encoding:"utf8"
    });
    const parsed=JSON.parse(String(stdout).trim());
    return Object.freeze({
      platform:"win32",
      freeDiskPercent:Number(parsed.freeDiskPercent),
      memoryPressurePercent:Number(parsed.memoryPressurePercent),
      pendingReboot:parsed.pendingReboot===true,
      failedUpdates:Math.max(0,Number(parsed.failedUpdates)||0),
      startupImpact:["low","medium","high"].includes(parsed.startupImpact)?parsed.startupImpact:"unknown"
    });
  };
}
