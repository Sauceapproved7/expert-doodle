export function evaluateChargerMigration(x={}){
 const migrationSelected=x.from==='BQ25792RQMR'&&x.to==='BQ25798RQMR'&&x.cells===4&&x.package==='RQM-29 4x4mm VQFN-HR'&&x.tps25751Supported===true&&x.referenceEvm===true&&x.i2c===true&&x.inputMinV===3.6&&x.inputMaxV===24&&x.chargeCurrentMaxA===5;
 const captureFreezeReady=migrationSelected&&x.pinMapReviewed===true&&x.registerMapReviewed===true&&x.pdConfigReviewed===true&&x.referenceNetworkReviewed===true;
 return {migrationSelected,productionChargerFrozen:captureFreezeReady,dropInAuthorized:false,captureFreezeReady,lifecycleHold:!captureFreezeReady,ercReleaseReady:false,fabricationReady:false,purchaseAuthorized:false,productionReady:false};
}