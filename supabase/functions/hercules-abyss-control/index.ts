const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

Deno.serve(async(req:Request)=>{
  try{
    if(req.method!=="GET"&&req.method!=="POST")return json(405,{error:"method-not-allowed"});
    const base=Deno.env.get("SUPABASE_URL");
    const anon=Deno.env.get("SUPABASE_ANON_KEY");
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ownerId=Deno.env.get("HERCULES_ABYSS_OWNER_USER_ID");
    if(!base||!anon||!service||!ownerId)return json(503,{error:"control-plane-not-configured"});
    const authorization=req.headers.get("authorization")||"";
    if(!/^Bearer\s+\S+$/i.test(authorization))return json(401,{error:"owner-authorization-required"});
    const identity=await fetch(new URL("/auth/v1/user",base),{headers:{apikey:anon,authorization},signal:AbortSignal.timeout(5000)});
    if(!identity.ok)return json(401,{error:"owner-identity-rejected"});
    const user=await identity.json();
    if(user?.id!==ownerId)return json(403,{error:"owner-identity-rejected"});

    const rpc=async(name:string,body:Record<string,unknown>={})=>{
      const result=await fetch(new URL("/rest/v1/rpc/"+name,base),{
        method:"POST",
        headers:{apikey:service,authorization:`Bearer ${service}`,"content-type":"application/json"},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(5000)
      });
      if(!result.ok)throw new Error("control-state-unavailable");
      return result.json();
    };
    if(req.method==="GET"){
      const state=await rpc("hercules_abyss_read_state");
      if(state?.emergency_stop_active!==true&&state?.emergency_stop_active!==false)return json(503,{error:"control-state-invalid"});
      return json(200,{emergencyStopActive:state.emergency_stop_active,identityTrusted:true,auditTrusted:state.audit_trusted===true});
    }
    const input=await req.json();
    if(input?.action!=="stop"&&input?.action!=="resume")return json(400,{error:"unsupported-control-action"});
    const state=await rpc("hercules_abyss_set_stop",{p_action:input.action,p_actor:user.id});
    if(state?.emergency_stop_active!==true&&state?.emergency_stop_active!==false)return json(503,{error:"control-state-invalid"});
    return json(200,{emergencyStopActive:state.emergency_stop_active,identityTrusted:true,auditTrusted:state.audit_trusted===true});
  }catch{
    return json(503,{error:"control-plane-unavailable"});
  }
});
