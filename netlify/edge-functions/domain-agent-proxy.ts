const UPSTREAM='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge';

function upstreamFor(req:Request){
  const url=new URL(req.url);
  if(url.pathname==='/.well-known/hercules-agent.json'){
    return UPSTREAM+'?domain_agent=discovery';
  }
  if(url.pathname==='/health'){
    return UPSTREAM+'?domain_agent=health';
  }
  if(url.pathname.startsWith('/v1/')){
    return UPSTREAM;
  }
  return null;
}

export default async (req:Request)=>{
  const target=upstreamFor(req);
  if(!target)return new Response('Not found',{status:404});

  const headers=new Headers(req.headers);
  headers.delete('host');
  headers.delete('x-hercules-internal-key');
  headers.set('x-hercules-front-door','agent.sauceapproved.com');

  const init:RequestInit={
    method:req.method,
    headers,
    redirect:'manual'
  };
  if(req.method!=='GET'&&req.method!=='HEAD'){
    init.body=await req.arrayBuffer();
  }

  const response=await fetch(target,init);
  const outHeaders=new Headers(response.headers);
  outHeaders.set('cache-control','no-store');
  outHeaders.set('x-content-type-options','nosniff');
  outHeaders.set('referrer-policy','no-referrer');
  outHeaders.delete('set-cookie');

  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers:outHeaders
  });
};

export const config={
  path:[
    '/.well-known/hercules-agent.json',
    '/health',
    '/v1/*'
  ]
};
