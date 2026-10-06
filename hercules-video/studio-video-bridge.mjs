// Owned Studio gateway to the existing preview execution boundary.
// Caller credentials go only to this fixed project and are never persisted.
const BASE='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-preview-cell/video';
const unavailable=()=>({status:503,body:{ok:false,bridgeConnected:false,productionReady:false,benchmarkRegistered:false,error:'video_bridge_unavailable'}});

async function boundedJson(response){
  if(!response.body)throw new Error('empty_response');
  const reader=response.body.getReader();
  const chunks=[];let size=0;
  try{
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>65536){await reader.cancel();throw new Error('response_too_large');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createStudioVideoBridge({fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('video_bridge_fetch_required');
  return {
    async status(){
      try{
        const response=await fetchImpl(BASE+'/health',{method:'GET',redirect:'error',headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});
        if(!response.ok)return unavailable();
        const body=await boundedJson(response);
        if(body?.ok!==true||body.service!=='hercules-video-bridge'||body.engine!=='hercules-video'||body.executionPolicy!=='fail-closed'||body.orchestrationConnected!==true)return unavailable();
        return {status:200,body:{ok:true,bridgeConnected:true,
          // The deployed production dispatcher is not implemented. A registry
          // capability alone must never unlock Studio start/resume.
          productionReady:false,
          benchmarkRegistered:body.benchmarkRenderAvailable===true,
          productionCapacityReported:body.renderCapacityAvailable===true,
          executionPolicy:'fail-closed'}};
      }catch{return unavailable();}
    },
    async benchmark(request={}){
      const authorization=request.headers?.authorization;
      if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)){
        return {status:401,body:{ok:false,error:'studio_operator_authorization_required'}};
      }
      const raw=request.body;
      if(typeof raw!=='string')return {status:400,body:{ok:false,error:'benchmark_request_invalid'}};
      if(Buffer.byteLength(raw)>16384)return {status:413,body:{ok:false,error:'studio_request_body_too_large'}};
      let body;
      try{body=JSON.parse(raw);}catch{return {status:400,body:{ok:false,error:'benchmark_request_invalid'}};}
      if(!body||typeof body!=='object'||Array.isArray(body)||(body.mode!==undefined&&body.mode!=='benchmark'))return {status:400,body:{ok:false,error:'benchmark_request_invalid'}};
      try{
        const response=await fetchImpl(BASE+'/render',{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),
          headers:{authorization,'content-type':'application/json',accept:'application/json'},
          body:JSON.stringify({...body,mode:'benchmark'})
        });
        if(!response.ok){
          await response.body?.cancel();
          const status=[400,401,403,409,429,503].includes(response.status)?response.status:502;
          return {status,body:{ok:false,error:status===401||status===403?'studio_operator_authorization_required':'benchmark_request_rejected'}};
        }
        const result=await boundedJson(response);
        if(result?.ok!==true||result.benchmarkOnly!==true||result.productionCapacityCertified!==false||!result.job||typeof result.job!=='object')throw new Error('invalid_benchmark_result');
        return {status:200,body:{ok:true,benchmarkOnly:true,productionCapacityCertified:false,reused:result.reused===true,job:result.job}};
      }catch{return {status:502,body:{ok:false,error:'video_bridge_unavailable'}};}
    }
  };
}
