export function evaluateChargerMigration(x={}){
 const migrationSelected=x.from==='BQ25792'&&x.to==='BQ25798'&&x.cells===4&&x.packagePins===29&&x.packageMm==='4x4'&&x.tps25751Supported===true&&x.referenceEvm===true&&x.i2c===true&&x.inputMaxV===24&&x.chargeCurrentMaxA===5;
 const captureFreezeReady=migrationSelected&&x.pinMapVerified===true&&x.registerMapVerified===true&&x.referenceNetworkCaptured===true;
 return {migrationSelected,dropInAuthorized:captureFreezeReady,captureFreezeReady,lifecycleHold:!captureFreezeReady,ercReleaseReady:false,fabricationReady:false,purchaseAuthorized:false,productionReady:false};
}