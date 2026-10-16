import http from 'node:http';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {preflightCloudDeployment} from './preflight.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const assets=new Map([
 ['/','index.html','text/html; charset=utf-8'],
 ['/styles.css','styles.css','text/css; charset=utf-8'],
 ['/app.mjs','app.mjs','text/javascript; charset=utf-8']
].map(([path,file,type])=>[path,{file,type}]));
const headers={
 'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'referrer-policy':'no-referrer',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function reply(res,status,payload,type='application/json; charset=utf-8'){
 const text=typeof payload==='string'?payload:JSON.stringify(payload);
 res.writeHead(status,{...headers,'content-type':type});
 res.end(text);
}
function compareToken(a,b){
 const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));
 return x.length===y.length&&timingSafeEqual(x,y);
}
async function parseRequest(req){
 if(req.headers['content-type']?.split(';')[0]!=='application/json')
  throw Object.assign(new Error('json_only'),{status:415});
 let raw='',size=0;
 for await(const piece of req){
   size+=piece.length;
   if(size>32768)throw Object.assign(new Error('payload_too_large'),{status:413});
   raw+=piece;
 }
 try{
   const o=JSON.parse(raw);
   if(!o||typeof o!=='object'||Array.isArray(o))throw Error('invalid_body');
   return o;
 }catch{throw Object.assign(new Error('invalid_body'),{status:400})}
}
function sameOrigin(req){
 if(!req.headers.origin)return true;
 try{
  const origin=new URL(req.headers.origin);
  return origin.host===req.headers.host && ['https:','http:'].includes(origin.protocol);
 }catch{return false}
}

export function createHerculesCloudServer({ownerToken=process.env.HERCULES_CLOUD_OWNER_TOKEN||'',targets=[]}={}){
 const token=String(ownerToken);
 if(token&&token.length<32)throw new TypeError('owner token must be at least 32 characters');
 return http.createServer(async(req,res)=>{
   const method=req.method||'GET';
   let path;
   try{path=new URL(req.url||'/','http://localhost').pathname}catch{return reply(res,400,{error:'invalid_path'})}
   if(method==='GET'&&assets.has(path)){
    const {file,type}=assets.get(path);
    return reply(res,200,readFileSync(join(here,file),'utf8'),type);
   }
   if(method==='GET'&&path==='/health'){
    return reply(res,200,{service:'hercules-cloud',mode:'isolated-preflight',ok:true,
      executionAuthorized:false,productionAuthorized:false,authenticationConfigured:token.length>=32});
   }
   if(path==='/api/capabilities'||path==='/api/preflight'){
     if(!token)return reply(res,503,{error:'owner_authority_not_configured'});
     if(!compareToken(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'',token))
       return reply(res,401,{error:'owner_authority_required'});
     if(path==='/api/capabilities'&&method==='GET')
       return reply(res,200,{mode:'isolated-preflight',registeredTargets:targets.length,
        shadowPlanning:true,costShield:true,evidenceDigest:true,productionDeploy:false,
        shellExecution:false,providerMutation:false});
     if(path==='/api/preflight'&&method==='POST'){
       if(!sameOrigin(req))return reply(res,403,{error:'origin_rejected'});
       try{
         const data=await parseRequest(req);
         return reply(res,200,preflightCloudDeployment(data,{targets}));
       }catch(e){
         const status=e.status||400;
         return reply(res,status,{error:status===400?'invalid_preflight_request':e.message});
       }
     }
     return reply(res,405,{error:'method_not_allowed'});
   }
   return reply(res,404,{error:'not_found'});
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||8898);
 createHerculesCloudServer().listen(port,'0.0.0.0',
  ()=>process.stdout.write('Hercules Cloud isolated preflight listening on '+port+'\n'));
}
