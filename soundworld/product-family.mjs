const OWNERSHIP=Object.freeze({implementationOwner:"SauceApproved enterprise LLC",herculesOwned:true,outsidePlatformAllowed:false});
const hardware=(id,name,purpose,extra={})=>Object.freeze({id,name,type:"hardware",purpose,...OWNERSHIP,gates:Object.freeze(["industrial-design-freeze","acoustic-validation","electrical-safety","battery-and-thermal-validation","rf-emc-compliance-plan","prototype-validation","manufacturing-dfm","quality-control-plan"]),productionClaimAllowed:false,...extra});
export function createSoundWorldFamily(){
 const products=[
  hardware("computer-pro","SoundWorld Computer Pro","Three-path over-ear computer headset",{connectivity:["usb-c","bluetooth","3.5mm"],microphone:"detachable-or-hidden",wiredPassivePath:true,features:["multipoint","low-latency-mode","call-mode","hardware-mute","replaceable-earpads"],tests:["frequency-response","mic-call-quality","latency","battery-runtime","long-session-comfort","hinge-cycle","cable-cycle"]}),
  hardware("pods","SoundWorld Pods","True-wireless everyday earbuds",{connectivity:["bluetooth","usb-c-case"],features:["multipoint","transparency-mode","call-mics","find-device-ready"],tests:["fit-retention","call-quality","battery-runtime","case-cycle"]}),
  hardware("max","SoundWorld Max","Premium wireless over-ear listening headphones",{connectivity:["bluetooth","usb-c","3.5mm"],wiredPassivePath:true,features:["multipoint","travel-mode","replaceable-earpads"],tests:["frequency-response","comfort","battery-runtime","hinge-cycle"]}),
  hardware("portable","SoundWorld Portable","Portable room and outdoor speaker",{connectivity:["bluetooth","usb-c"],features:["stereo-pair-ready","speakerphone-ready"],tests:["output-level","battery-runtime","drop-test","splash-plan"]}),
  hardware("desk","SoundWorld Desk","Compact powered desktop monitor pair",{connectivity:["usb-c","bluetooth","3.5mm"],features:["left-right-pair","nearfield-mode"],tests:["frequency-response","channel-match","idle-noise","thermal"]}),
  hardware("mic","SoundWorld Mic","USB-C creator and call microphone",{connectivity:["usb-c","3.5mm-monitor"],features:["hardware-mute","direct-monitor","gain-control"],tests:["self-noise","speech-intelligibility","plosive-handling","latency"]}),
  hardware("creator-headset","SoundWorld Creator Headset","Closed-back zero-latency monitoring headset",{connectivity:["3.5mm","usb-c"],wiredPassivePath:true,features:["replaceable-cable","replaceable-earpads","flat-reference-preset"],tests:["frequency-response","isolation","comfort","cable-cycle"]}),
  hardware("mini","SoundWorld Mini","Small clip-ready portable speaker",{connectivity:["bluetooth","usb-c"],features:["clip-mount","speakerphone-ready"],tests:["drop-test","battery-runtime","output-level"]}),
  hardware("bar","SoundWorld Bar","Monitor and TV desktop soundbar",{connectivity:["usb-c","bluetooth","3.5mm"],features:["voice-mode","desk-mode"],tests:["dialog-intelligibility","channel-balance","idle-noise"]}),
  hardware("hub","SoundWorld Hub","Desktop audio and device control dock",{connectivity:["usb-c-host","usb-c-device","3.5mm-headphone","3.5mm-mic"],features:["device-switching","hardware-volume","hardware-mute"],tests:["usb-compatibility","latency","power-budget","device-switching"]}),
  Object.freeze({id:"control",name:"SoundWorld Control",type:"software",...OWNERSHIP,purpose:"Device EQ, microphone control, routing, diagnostics and signed firmware workflow",features:Object.freeze(["eq","mic-controls","device-switching","hearing-safe-volume-information","presets","diagnostics","firmware-status"]),autonomousFirmwareMutation:false,credentialCollectionAllowed:false}),
  Object.freeze({id:"studio-bridge",name:"SoundWorld Studio Bridge",type:"software",...OWNERSHIP,purpose:"Carry SoundWorld device identity and audio settings into SauceApproved Studio projects",proofSpine:true,providerConnectionVerified:false,silentBrandMutationAllowed:false,features:Object.freeze(["studio-input-identity","project-audio-profile","proof-spine-handoff","control-preset-handoff"])})
 ];
 return Object.freeze({schema:"sauceapproved.soundworld.product-family/v2",brand:"SoundWorld",owner:"SauceApproved enterprise LLC",implementationOwner:"SauceApproved enterprise LLC",buildMode:"hercules-owned",externalPlatforms:Object.freeze([]),thirdPartyHostedRuntimeAllowed:false,thirdPartyProductSubstitutionAllowed:false,standardsPolicy:"interoperate-with-open-or-device-standards-without-outsourcing-the-product",principles:Object.freeze(["listen-record-edit-mix-export","fail-closed-production-claims","serviceable-where-practical","proof-spine-audio-provenance"]),products:Object.freeze(products)});
}
export function validateSoundWorldFamily(family){
 const ids=new Set(family?.products?.map(p=>p.id)||[]);
 const expected=["computer-pro","pods","max","portable","desk","mic","creator-headset","mini","bar","hub","control","studio-bridge"];
 const catalogReady=expected.every(id=>ids.has(id));
 const bridge=family?.products?.find(p=>p.id==="studio-bridge");
 const hardwareReady=(family?.products||[]).filter(p=>p.type==="hardware").every(p=>p.productionClaimAllowed===true);
 const blockers=[];
 if(!hardwareReady)blockers.push("physical-prototype-validation-required");
 if(bridge?.providerConnectionVerified!==true)blockers.push("studio-bridge-runtime-proof-required");
 return Object.freeze({catalogReady,productionReady:catalogReady&&blockers.length===0,blockers:Object.freeze(blockers)});
}
