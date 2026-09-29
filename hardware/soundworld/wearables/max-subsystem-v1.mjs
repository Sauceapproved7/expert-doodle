export function evaluateMaxSubsystem(x={}){
 const ok=x.audioPlatform==='QCC7226'&&x.driverClass==='large-dynamic'&&x.hybridAnc===true&&x.beamforming===true&&x.serviceBattery===true&&x.usbC===true&&x.wiredFallback===true&&x.thermalProtection===true&&x.signedFirmware===true;
 return {architectureFrozen:ok,evtReady:false,productionReady:false,claimReady:false,needs:['measured-driver-MPN','measured-MEMS-array','qualified-battery','wired-interface','antenna-study','head-fixture-data']};
}