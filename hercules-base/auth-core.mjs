import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import {promisify} from "node:util";

const scrypt=promisify(nodeScrypt);
const encoder=new TextEncoder();

function base64url(value){
  return Buffer.from(value).toString("base64url");
}

function parseBase64Json(value,label){
  try{
    return JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
  }catch{
    throw new Error("invalid "+label);
  }
}

function requiredSecret(secret){
  if(typeof secret!=="string"||Buffer.byteLength(secret)<32){
    throw new TypeError("JWT secret must be at least 32 bytes");
  }
  return secret;
}

export async function hashPassword(password,{
  randomBytes=nodeRandomBytes,
  cost=16384,
  blockSize=8,
  parallelization=1,
  keyLength=32,
}={}){
  if(typeof password!=="string"||password.length<12||password.length>256){
    throw new TypeError("password length is invalid");
  }
  const salt=Buffer.from(randomBytes(16));
  const digest=await scrypt(password,salt,keyLength,{
    N:cost,
    r:blockSize,
    p:parallelization,
    maxmem:64*1024*1024,
  });
  return Object.freeze({
    algorithm:"scrypt",
    salt:salt.toString("base64url"),
    digest:Buffer.from(digest).toString("base64url"),
    params:Object.freeze({
      algorithm:"scrypt",
      cost,
      blockSize,
      parallelization,
      keyLength,
    }),
  });
}

export async function verifyPassword(password,record){
  if(typeof password!=="string"||!record||record.algorithm!=="scrypt")return false;
  const params=record.params||{};
  const keyLength=Number(params.keyLength)||32;
  let expected;
  let salt;
  try{
    expected=Buffer.from(record.digest,"base64url");
    salt=Buffer.from(record.salt,"base64url");
  }catch{
    return false;
  }
  if(expected.length!==keyLength||salt.length<16)return false;

  let actual;
  try{
    actual=Buffer.from(await scrypt(password,salt,keyLength,{
      N:Number(params.cost)||16384,
      r:Number(params.blockSize)||8,
      p:Number(params.parallelization)||1,
      maxmem:64*1024*1024,
    }));
  }catch{
    return false;
  }
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export function signJwtHs256({
  sub,
  role,
  issuer,
  audience,
  ttlSeconds=900,
  nowSeconds=Math.floor(Date.now()/1000),
},secret){
  requiredSecret(secret);
  if(typeof sub!=="string"||!sub)throw new TypeError("JWT subject is required");
  if(typeof role!=="string"||!role)throw new TypeError("JWT role is required");
  if(typeof issuer!=="string"||!issuer)throw new TypeError("JWT issuer is required");
  if(typeof audience!=="string"||!audience)throw new TypeError("JWT audience is required");
  if(!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>3600){
    throw new TypeError("JWT ttl is invalid");
  }

  const header={alg:"HS256",typ:"JWT"};
  const payload={
    sub,
    role,
    iss:issuer,
    aud:audience,
    iat:nowSeconds,
    exp:nowSeconds+ttlSeconds,
  };
  const signingInput=base64url(JSON.stringify(header))+"."+base64url(JSON.stringify(payload));
  const signature=createHmac("sha256",secret).update(signingInput).digest("base64url");
  return signingInput+"."+signature;
}

export function verifyJwtHs256(token,secret,{
  issuer,
  audience,
  nowSeconds=Math.floor(Date.now()/1000),
}={}){
  requiredSecret(secret);
  if(typeof token!=="string")throw new Error("invalid token");
  const parts=token.split(".");
  if(parts.length!==3)throw new Error("invalid token");

  const header=parseBase64Json(parts[0],"JWT header");
  if(header.alg!=="HS256"||header.typ!=="JWT")throw new Error("invalid JWT algorithm");

  const expected=createHmac("sha256",secret)
    .update(parts[0]+"."+parts[1])
    .digest();
  let actual;
  try{actual=Buffer.from(parts[2],"base64url");}catch{throw new Error("invalid JWT signature");}
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){
    throw new Error("invalid JWT signature");
  }

  const claims=parseBase64Json(parts[1],"JWT payload");
  if(issuer!==undefined&&claims.iss!==issuer)throw new Error("invalid JWT issuer");
  if(audience!==undefined&&claims.aud!==audience)throw new Error("invalid JWT audience");
  if(!Number.isInteger(claims.exp)||claims.exp<nowSeconds)throw new Error("JWT expired");
  if(!Number.isInteger(claims.iat)||claims.iat>nowSeconds+60)throw new Error("invalid JWT issued-at");
  if(typeof claims.sub!=="string"||typeof claims.role!=="string")throw new Error("invalid JWT claims");
  return claims;
}

export function createRefreshToken({randomBytes=nodeRandomBytes}={}){
  return Buffer.from(randomBytes(32)).toString("base64url");
}

export function hashRefreshToken(token){
  if(typeof token!=="string"||token.length<40||token.length>256){
    throw new TypeError("refresh token is invalid");
  }
  return createHash("sha256").update(encoder.encode(token)).digest("hex");
}
