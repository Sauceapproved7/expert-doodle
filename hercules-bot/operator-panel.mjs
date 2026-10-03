export function operatorPanelModel({status={},capabilities=[]}={}) {
  return Object.freeze({
    title:"HERCULES OPERATOR",
    ownerControl:true,
    hardwareConnected:status.hardwareConnected===true,
    emergencyStop:status.emergencyStop!==false,
    armed:status.armed===true,
    capabilities,
    controls:Object.freeze([
      {id:"estop",label:"EMERGENCY STOP",requiresApproval:false},
      {id:"arm",label:"ARM BODY",requiresApproval:true},
      {id:"status",label:"SYSTEM STATUS",requiresApproval:false}
    ])
  });
}
