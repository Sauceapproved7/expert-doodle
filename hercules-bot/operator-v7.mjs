export function createBodyTransport({driver=null}={}) {
 let connected=false,armed=false,emergencyStop=true;
 return Object.freeze({
  async status(){return {connected,armed,emergencyStop};},
  async connect(){
   if(!driver||driver.reviewed!==true||typeof driver.connect!=="function") return {connected:false,reason:"reviewed-hardware-driver-required"};
   await driver.connect(); connected=true; emergencyStop=true; armed=false; return {connected:true,armed:false,emergencyStop:true};
  },
  async arm(ownerApproved=false){
   if(!ownerApproved)return {armed:false,reason:"owner-approval-required"};
   if(!connected)return {armed:false,reason:"hardware-not-connected"};
   emergencyStop=false; armed=true; return {armed:true,emergencyStop:false};
  },
  async stop(){armed=false;emergencyStop=true;if(driver?.stop)await driver.stop();return {armed:false,emergencyStop:true};}
 });
}

export function createVoiceBridge({transcribe,speak}={}) {
 if(typeof transcribe!=="function"||typeof speak!=="function") throw new TypeError("voice adapters required");
 return Object.freeze({listen:()=>transcribe(),say:(text)=>speak(text)});
}

export function createOwnerDashboard({body,session}={}) {
 return Object.freeze({async snapshot(){
  return Object.freeze({
   body:await body.status(),
   pending:typeof session?.pending==="function"?session.pending():null,
   ownerControl:true,
   actions:["approve","emergency-stop","resume"]
  });
 }});
}
