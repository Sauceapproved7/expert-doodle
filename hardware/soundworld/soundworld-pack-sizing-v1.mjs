export function designPack({series,parallel,cellV,cellAh}={}){
 for(const v of [series,parallel,cellV,cellAh])if(!Number.isFinite(v)||v<=0)throw new Error('positive finite pack inputs required');
 const nominalV=series*cellV,capacityAh=parallel*cellAh,energyWh=nominalV*capacityAh;
 return {series,parallel,cellCount:series*parallel,nominalV,capacityAh,energyWh:Number(energyWh.toFixed(2)),evtOnly:true,transportEvidenceRequired:true,productionReady:false,claimReady:false};
}