import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async req=>{
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  };
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  return new Response(JSON.stringify({ok:false,error:'promotion_withdrawn',promotion:'hercules-soundworld-launch-gift-v1',claimsEnabled:false}),{status:410,headers});
});
