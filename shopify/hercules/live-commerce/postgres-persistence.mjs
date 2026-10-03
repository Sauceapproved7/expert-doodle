function required(value,name){const v=String(value??"").trim();if(!v)throw new Error(name+"_required");return v;}
function version(value){const v=Number(value);if(!Number.isInteger(v)||v<1)throw new Error("invalid_expected_version");return v;}
function actor(value){return required(value,"actor_id");}
function audit(action,id,actorId,details){return {text:`insert into live_commerce_audit (session_id, action, actor_id, details_json, created_at) values ($1, $2, $3, $4::jsonb, now())`,values:[id,action,actorId,JSON.stringify(details)]};}

export function buildCreateSessionTx({id,shopDomain,title,actorId}={}){
 const sessionId=required(id,"session_id"),shop=required(shopDomain,"shop_domain").toLowerCase(),name=required(title,"title"),who=actor(actorId);
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw new Error("invalid_shop_domain");
 return {statements:[
  {text:`insert into live_commerce_sessions (id, shop_domain, title, state, version, commerce_enabled, created_at, updated_at) values ($1, $2, $3, 'draft', 1, $4, now(), now())`,values:[sessionId,shop,name,false]},
  audit("session.created",sessionId,who,{state:"draft",commerceEnabled:false})
 ]};
}

export function buildTransitionTx({id,from,to,expectedVersion,actorId}={}){
 const sessionId=required(id,"session_id"),source=required(from,"from"),target=required(to,"to"),v=version(expectedVersion),who=actor(actorId);
 return {statements:[
  {text:`update live_commerce_sessions set state = $3, version = version + 1, commerce_enabled = false, updated_at = now() where id = $1 and state = $2 and version = $4 returning version = $5 as expected_previous_version`,values:[sessionId,source,target,v,v]},
  audit("session.transition",sessionId,who,{from:source,to:target,expectedVersion:v,commerceEnabled:false})
 ]};
}

export function buildPinTx({id,variantGid,expectedVersion,actorId,durationSeconds=300}={}){
 const sessionId=required(id,"session_id"),gid=required(variantGid,"variant_gid"),v=version(expectedVersion),who=actor(actorId),duration=Number(durationSeconds);
 if(!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(gid))throw new Error("invalid_shopify_variant_gid");
 if(!Number.isInteger(duration)||duration<1||duration>3600)throw new Error("invalid_pin_duration");
 return {statements:[
  {text:`update live_commerce_sessions set pinned_variant_gid = $2, pin_duration_seconds = $3, version = version + 1, commerce_enabled = false, updated_at = now() where id = $1 and version = $4 returning version`,values:[sessionId,gid,duration,v]},
  audit("product.pinned",sessionId,who,{variantGid:gid,durationSeconds:duration,expectedVersion:v,commerceEnabled:false})
 ]};
}
