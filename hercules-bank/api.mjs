import http from "node:http";

import {verifyJwtHs256} from "../hercules-base/auth-core.mjs";
import {bankConsoleAsset} from "./console.mjs";
import {buildFinancialReadinessDossier} from "./readiness-dossier.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_ADMIN_ROLES = Object.freeze(["owner", "admin", "staging_admin"]);

function baseHeaders(contentType="application/json; charset=utf-8"){
  return {
    "content-type":contentType,
    "cache-control":"no-store",
    "pragma":"no-cache",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
  };
}

function send(res,status,body,extraHeaders={}){
  res.writeHead(status,{...baseHeaders(),...extraHeaders});
  res.end(JSON.stringify(body));
}

function sendAsset(res,asset){
  res.writeHead(200,{
    ...baseHeaders(asset.type),
    "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(asset.body);
}

async function readBody(req){
  let body="";
  for await(const chunk of req){
    body+=chunk;
    if(Buffer.byteLength(body)>MAX_BODY_BYTES){
      throw Object.assign(new Error("request body too large"),{statusCode:413});
    }
  }
  if(!body)return {};
  try{return JSON.parse(body)}
  catch{throw Object.assign(new Error("invalid JSON body"),{statusCode:400})}
}

function routeParts(url){
  try{return url.pathname.split("/").filter(Boolean).map(decodeURIComponent)}
  catch(error){
    if(error instanceof URIError)throw Object.assign(new Error("malformed path encoding"),{statusCode:400});
    throw error;
  }
}

function bearerClaims(req,{jwtSecret,issuer,audience,nowSeconds}){
  const header=req.headers.authorization??"";
  if(!header.startsWith("Bearer "))throw Object.assign(new Error("unauthorized"),{statusCode:401});
  try{
    return verifyJwtHs256(header.slice(7),jwtSecret,{
      issuer,
      audience,
      nowSeconds:nowSeconds(),
    });
  }catch{
    throw Object.assign(new Error("unauthorized"),{statusCode:401});
  }
}

async function authenticate(req,authOptions,browserSessions){
  const header=req.headers.authorization??"";
  if(header.startsWith("Bearer ")){
    return {claims:bearerClaims(req,authOptions),browserAuth:null};
  }
  if(browserSessions){
    const browserAuth=await browserSessions.authenticate(req);
    return {claims:browserAuth.claims,browserAuth};
  }
  throw Object.assign(new Error("unauthorized"),{statusCode:401});
}

function requireMutationCsrf(req,context,browserSessions){
  if(context.browserAuth)browserSessions.requireCsrf(req,context.browserAuth);
}

function requireAdmin(claims,adminRoles){
  if(!adminRoles.has(claims.role))throw Object.assign(new Error("forbidden"),{statusCode:403});
}

function ownedAccount(runtime,accountId,subject){
  let account;
  try{account=runtime.getAccount(accountId)}
  catch{throw Object.assign(new Error("not_found"),{statusCode:404})}
  if(account.customerId!==subject)throw Object.assign(new Error("not_found"),{statusCode:404});
  return account;
}

function publicAccount(account,{includeCustomerId=true}={}){
  const result={
    id:account.id,
    currency:account.currency,
    status:account.status,
    mode:account.mode,
    balanceMinor:account.balanceMinor,
  };
  if(includeCustomerId)result.customerId=account.customerId;
  return result;
}

function errorStatus(error){
  if(Number.isInteger(error?.statusCode))return error.statusCode;
  if(error instanceof TypeError||error instanceof RangeError)return 400;
  const message=String(error?.message??"");
  if(/unknown customer account|not_found/i.test(message))return 404;
  if(/already exists|idempotency|negative|insufficient|overdraft/i.test(message))return 409;
  return 500;
}

export function createHerculesBankApi({
  runtime,
  jwtSecret,
  issuer="hercules-base",
  audience="hercules-base-api",
  nowSeconds=()=>Math.floor(Date.now()/1000),
  adminRoles=DEFAULT_ADMIN_ROLES,
  browserSessions=null,
  complianceOperations=null,
  productionReadinessInputs={},
  qualificationEvidenceStore=null,
  currentAdapterQualification=null,
}={}){
  if(!runtime||typeof runtime.openCustomerAccount!=="function"){
    throw new TypeError("Hercules Bank runtime is required");
  }
  if(typeof jwtSecret!=="string"||Buffer.byteLength(jwtSecret)<32){
    throw new TypeError("JWT secret must be at least 32 bytes");
  }
  if(typeof issuer!=="string"||!issuer)throw new TypeError("JWT issuer is required");
  if(typeof audience!=="string"||!audience)throw new TypeError("JWT audience is required");
  if(typeof nowSeconds!=="function")throw new TypeError("nowSeconds must be a function");
  if(browserSessions!==null&&(
    typeof browserSessions.signIn!=="function"
    ||typeof browserSessions.authenticate!=="function"
    ||typeof browserSessions.requireCsrf!=="function"
  )){
    throw new TypeError("browserSessions is invalid");
  }
  if(complianceOperations!==null&&(
    typeof complianceOperations.summary!=="function"
    ||typeof complianceOperations.recordEvidence!=="function"
    ||typeof complianceOperations.setProviderProfile!=="function"
    ||typeof complianceOperations.recordReconciliation!=="function"
  )){
    throw new TypeError("complianceOperations is invalid");
  }
  if(qualificationEvidenceStore!==null&&typeof qualificationEvidenceStore.status!=="function"){
    throw new TypeError("qualificationEvidenceStore is invalid");
  }

  const allowedAdminRoles=new Set(adminRoles);
  const authOptions={jwtSecret,issuer,audience,nowSeconds};

  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url??"/","http://hercules-bank.local");
      const route=routeParts(url);

      if(browserSessions&&req.method==="GET"){
        const asset=bankConsoleAsset(url.pathname);
        if(asset)return sendAsset(res,asset);
      }

      if(req.method==="GET"&&url.pathname==="/health"){
        return send(res,200,{
          ok:true,
          service:"hercules-bank",
          version:"1.3",
          mode:runtime.mode,
          currency:runtime.currency,
          externalRails:false,
          browserSessions:Boolean(browserSessions),
        });
      }

      if(browserSessions&&req.method==="POST"&&url.pathname==="/v1/session"){
        const body=await readBody(req);
        let session;
        try{
          session=await browserSessions.signIn({
            email:body.email,
            password:body.password,
          });
        }catch{
          throw Object.assign(new Error("invalid_credentials"),{statusCode:401});
        }
        return send(res,201,{
          user:session.user,
          csrfToken:session.csrfToken,
          mode:runtime.mode,
        },{"set-cookie":session.setCookie});
      }

      if(browserSessions&&req.method==="GET"&&url.pathname==="/v1/session/csrf"){
        const browserAuth=await browserSessions.authenticate(req);
        const csrfToken=browserSessions.rotateCsrf(browserAuth);
        return send(res,200,{
          user:browserAuth.user,
          csrfToken,
          mode:runtime.mode,
        });
      }

      if(browserSessions&&req.method==="DELETE"&&url.pathname==="/v1/session"){
        const browserAuth=await browserSessions.authenticate(req);
        browserSessions.requireCsrf(req,browserAuth);
        const result=await browserSessions.logout(browserAuth);
        return send(res,200,{ok:true},{"set-cookie":result.setCookie});
      }

      const context=await authenticate(req,authOptions,browserSessions);
      const claims=context.claims;

      if(req.method==="GET"&&url.pathname==="/v1/accounts"){
        return send(res,200,{
          accounts:runtime.listAccountsForCustomer(claims.sub).map((account)=>publicAccount(account)),
        });
      }

      if(req.method==="POST"&&url.pathname==="/v1/accounts"){
        requireMutationCsrf(req,context,browserSessions);
        await readBody(req);
        const account=await runtime.openCustomerAccount({customerId:claims.sub});
        return send(res,201,{account:publicAccount(account)});
      }

      if(route[0]==="v1"&&route[1]==="accounts"&&route[2]){
        const accountId=route[2];

        if(req.method==="GET"&&route.length===3){
          return send(res,200,{
            account:publicAccount(ownedAccount(runtime,accountId,claims.sub)),
          });
        }

        if(req.method==="GET"&&route.length===4&&route[3]==="statement"){
          ownedAccount(runtime,accountId,claims.sub);
          return send(res,200,{statement:runtime.statement(accountId)});
        }
      }

      if(req.method==="POST"&&url.pathname==="/v1/transfers"){
        requireMutationCsrf(req,context,browserSessions);
        const body=await readBody(req);
        ownedAccount(runtime,body.fromAccountId,claims.sub);
        const result=await runtime.transfer({
          fromAccountId:body.fromAccountId,
          toAccountId:body.toAccountId,
          amountMinor:body.amountMinor,
          idempotencyKey:body.idempotencyKey,
          reference:body.reference??"sandbox internal transfer",
        });
        return send(res,200,{
          from:publicAccount(result.from),
          to:publicAccount(result.to,{includeCustomerId:false}),
        });
      }

      if(req.method==="GET"&&url.pathname==="/v1/admin/overview"){
        requireAdmin(claims,allowedAdminRoles);
        const metadata=runtime.snapshot().accounts??[];
        const accounts=metadata.map((entry)=>publicAccount(runtime.getAccount(entry.id)));
        let totalCustomerBalanceMinor=0;
        for(const account of accounts){
          totalCustomerBalanceMinor+=account.balanceMinor;
          if(!Number.isSafeInteger(totalCustomerBalanceMinor)){
            throw new RangeError("sandbox liability total exceeds safe integer range");
          }
        }
        return send(res,200,{
          mode:runtime.mode,
          currency:runtime.currency,
          externalRails:false,
          accountCount:accounts.length,
          customerCount:new Set(accounts.map((account)=>account.customerId)).size,
          totalCustomerBalanceMinor,
          accounts,
        });
      }

      if(url.pathname==="/v1/admin/compliance"){
        requireAdmin(claims,allowedAdminRoles);
        if(!complianceOperations)return send(res,503,{error:"compliance_operations_unavailable"});
        if(req.method==="GET"){
          return send(res,200,complianceOperations.summary());
        }
      }

      if(req.method==="GET"&&url.pathname==="/v1/admin/production-readiness"){
        requireAdmin(claims,allowedAdminRoles);
        if(!complianceOperations)return send(res,503,{error:"compliance_operations_unavailable"});
        const now=new Date(nowSeconds()*1000).toISOString();
        const qualificationEvidenceStatus=qualificationEvidenceStore
          ?await qualificationEvidenceStore.status({
            currentQualification:currentAdapterQualification,
            now,
          })
          :null;
        const dossier=buildFinancialReadinessDossier({
          complianceSummary:complianceOperations.summary(),
          productionInputs:productionReadinessInputs,
          qualificationEvidenceStatus,
          now,
        });
        return send(res,200,dossier);
      }

      if(req.method==="POST"&&url.pathname==="/v1/admin/compliance/evidence"){
        requireMutationCsrf(req,context,browserSessions);
        requireAdmin(claims,allowedAdminRoles);
        if(!complianceOperations)return send(res,503,{error:"compliance_operations_unavailable"});
        const body=await readBody(req);
        await complianceOperations.recordEvidence({
          control:body.control,
          status:body.status,
          reference:body.reference,
          reviewedAt:body.reviewedAt,
          actorId:claims.sub,
        });
        return send(res,200,complianceOperations.summary());
      }

      if(req.method==="POST"&&url.pathname==="/v1/admin/compliance/provider"){
        requireMutationCsrf(req,context,browserSessions);
        requireAdmin(claims,allowedAdminRoles);
        if(!complianceOperations)return send(res,503,{error:"compliance_operations_unavailable"});
        const body=await readBody(req);
        await complianceOperations.setProviderProfile({
          id:body.id,
          environment:body.environment,
          endpoint:body.endpoint,
          capabilities:body.capabilities,
          actorId:claims.sub,
        });
        return send(res,200,complianceOperations.summary());
      }

      if(req.method==="POST"&&url.pathname==="/v1/admin/compliance/reconciliation"){
        requireMutationCsrf(req,context,browserSessions);
        requireAdmin(claims,allowedAdminRoles);
        if(!complianceOperations)return send(res,503,{error:"compliance_operations_unavailable"});
        const body=await readBody(req);
        const reconciliation=await complianceOperations.recordReconciliation({
          actorId:claims.sub,
          runId:body.runId,
          internal:body.internal,
          provider:body.provider,
        });
        return send(res,200,{
          reconciliation,
          compliance:complianceOperations.summary(),
        });
      }

      if(req.method==="POST"&&url.pathname==="/v1/admin/fund-sandbox"){
        requireMutationCsrf(req,context,browserSessions);
        requireAdmin(claims,allowedAdminRoles);
        const body=await readBody(req);
        const account=await runtime.fundSandboxAccount({
          accountId:body.accountId,
          amountMinor:body.amountMinor,
          idempotencyKey:body.idempotencyKey,
        });
        return send(res,200,{account:publicAccount(account)});
      }

      if(req.method==="POST"&&url.pathname==="/v1/external-transfers"){
        return send(res,501,{error:"external_rails_disabled",mode:runtime.mode});
      }

      return send(res,404,{error:"not_found"});
    }catch(error){
      const status=errorStatus(error);
      return send(res,status,{
        error:status>=500?"internal_error":error.message,
      });
    }
  });
}
