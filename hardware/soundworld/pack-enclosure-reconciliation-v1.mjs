export function reconcilePackEnclosure({series,parallel,cellDiameterMm,cellHeightMm,cellMassG,mechanicalAllowanceMm=6}={}){
 for(const v of [series,parallel,cellDiameterMm,cellHeightMm,cellMassG])if(!Number.isFinite(v)||v<=0)throw new Error('positive finite inputs required');
 if(!Number.isFinite(mechanicalAllowanceMm)||mechanicalAllowanceMm<0)throw new Error('nonnegative allowance required');
 const cellCount=series*parallel,rawCellMassG=cellCount*cellMassG;
 const raw={lengthMm:series*cellDiameterMm,widthMm:parallel*cellDiameterMm,heightMm:cellHeightMm};
 return {cellCount,rawCellMassG,rawCellBlock:raw,minimumCassetteEnvelope:{lengthMm:raw.lengthMm+2*mechanicalAllowanceMm,widthMm:raw.widthMm+2*mechanicalAllowanceMm,heightMm:raw.heightMm+2*mechanicalAllowanceMm},cadRefreezeRequired:true,acousticVolumeRevalidationRequired:true,thermalRevalidationRequired:true,productionReady:false};
}