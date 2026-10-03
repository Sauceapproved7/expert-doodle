export function evaluateFinalPeripheralParts(x={}){
 const partReasons=[];
 if(x.typeCPortProtection!=='TPD4S201')partReasons.push('type_c_port_protection_not_frozen');
 if(x.boardTempSensor!=='TMP117')partReasons.push('board_temp_sensor_not_frozen');
 if(!(Number.isInteger(x.batteryTempChannels)&&x.batteryTempChannels>=2))partReasons.push('battery_temperature_channels_missing');
 for(const k of ['keyedBatteryConnectorQualified','speakerConnectorsQualified'])if(x[k]!==true)partReasons.push(k+'_required');
 const partsFrozen=partReasons.length===0;
 const reviewReasons=[];for(const k of ['ercPassed','rfReviewPassed','thermalReviewPassed'])if(x[k]!==true)reviewReasons.push(k+'_required');
 return {partsFrozen,partReasons,pcbRelease:partsFrozen&&reviewReasons.length===0,reviewReasons,pcbFabAuthorized:false,productionReady:false};
}