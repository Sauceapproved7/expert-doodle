import http from 'node:http';
import {proxyRequest} from './proxy.mjs';

const port=Number(process.env.PORT||10000);

function requestHeaders(input){
  const headers=new Headers();
  for(const [key,value] of Object.entries(input)){
    if(Array.isArray(value)){for(const item of value)headers.append(key,item);}
    else if(typeof value==='string')headers.set(key,value);
  }
  return headers;
}

async function requestBody(req){
  if(req.method==='GET'||req.method==='HEAD')return undefined;
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

http.createServer(async(req,res)=>{
  try{
    const headers=requestHeaders(req.headers);
    const protocol=headers.get('x-forwarded-proto')||'https';
    const host=headers.get('host')||'localhost';
    const body=await requestBody(req);
    const request=new Request(protocol+'://'+host+(req.url||'/'),{method:req.method||'GET',headers,body});
    const response=await proxyRequest(request);
    const responseHeaders={};
    for(const [key,value] of response.headers.entries())responseHeaders[key]=value;
    res.writeHead(response.status,responseHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    console.error('domain_agent_proxy_error',error);
    res.writeHead(502,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify({ok:false,error:'upstream_unavailable'}));
  }
}).listen(port,'0.0.0.0',()=>console.log('Hercules Domain Agent proxy listening on port '+port));
