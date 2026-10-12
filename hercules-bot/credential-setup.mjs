const ORIGIN='https://smallz-hercules.onrender.com';
const BACKEND='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge';
const headers={
 'content-type':'text/html; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
function error(status,message){return {status,headers,body:'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules secure setup</title></head><body><h1>Hercules secure setup</h1><p>'+message+'</p><p><a href="/app">Return to Smallz</a></p></body></html>'}}

export async function credentialSetup(req,{fetchUpstream=fetch}={}){
 const url=new URL(req.url,ORIGIN),tokens=url.searchParams.getAll('handoff_token');
 if(tokens.length!==1||!/^[a-f0-9]{64}$/.test(tokens[0]))return error(400,'This setup link is missing or invalid. Use your current secure handoff link.');
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return error(405,'This request method is not supported.');
 const options={method,redirect:'error',signal:AbortSignal.timeout(15000)};
 let values=[];
 if(method==='POST'){
  if(req.origin&&req.origin!==ORIGIN)return error(403,'Submit this form from the Smallz setup page.');
  if(!String(req.contentType||'').toLowerCase().startsWith('application/x-www-form-urlencoded'))return error(400,'Submit the secure setup form.');
  if(typeof req.body!=='string'||req.body.length>8192)return error(400,'The form request is invalid or too large.');
  const form=new URLSearchParams(req.body),keys=[...form.keys()];
  if(keys.length!==2||form.getAll('api_key').length!==1||form.getAll('api_secret').length!==1)return error(400,'Supply exactly one API key and one API secret.');
  const key=form.get('api_key').trim(),secret=form.get('api_secret').trim();
  if(!key||!secret||key.length>512||secret.length>1024)return error(400,'Both credential fields are required.');
  values=[key,secret];options.headers={'content-type':'application/x-www-form-urlencoded'};
  options.body=new URLSearchParams({api_key:key,api_secret:secret}).toString();
 }
 try{
  const response=await fetchUpstream(BACKEND+'?spaceship_credentials=1&handoff_token='+tokens[0],options);
  if(![200,400].includes(response.status))return error(502,'The connection service is temporarily unavailable. Your authorization has not been completed.');
  const html=await response.text();
  if(html.length>65536||!html.startsWith('<!doctype html>')||!html.includes('<h1>Spaceship DNS secure setup</h1>')||values.some(value=>html.includes(value)))return error(502,'The connection service returned an invalid setup page.');
  return {status:response.status,headers,body:html};
 }catch{return error(502,'The connection service could not be reached. No connection success is claimed. Retry your current setup link.')}
 finally{values=[];delete options.body}
}
