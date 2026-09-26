export function normalizeRealtimeChannel(value){
  if(typeof value!=="string")throw new TypeError("channel is required");
  const channel=value.trim().toLowerCase();
  if(channel.length<1||channel.length>63||!/^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/.test(channel)){
    throw new TypeError("channel is invalid");
  }
  return channel;
}

export function normalizeRealtimeEvent(value){
  if(typeof value!=="string")throw new TypeError("event is required");
  const event=value.trim();
  if(event.length<1||event.length>96||!/^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,94}[A-Za-z0-9])?$/.test(event)){
    throw new TypeError("event is invalid");
  }
  return event;
}

export function normalizeRealtimeCursor(value,{defaultValue=0}={}){
  if(value===undefined||value===null||value==="")return defaultValue;
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<0){
    throw new TypeError("realtime cursor is invalid");
  }
  return parsed;
}

export function normalizeRealtimeLimit(value,{defaultValue=100,max=200}={}){
  if(value===undefined||value===null||value==="")return defaultValue;
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<1||parsed>max){
    throw new TypeError("realtime limit is invalid");
  }
  return parsed;
}

export function encodeSseEvent({id,event,data}){
  const eventId=normalizeRealtimeCursor(id);
  const eventName=normalizeRealtimeEvent(event);
  return "id: "+eventId+"\n"+
    "event: "+eventName+"\n"+
    "data: "+JSON.stringify(data??null)+"\n\n";
}
