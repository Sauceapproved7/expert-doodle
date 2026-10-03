const ALLOWED_SCOPES=new Set(["public","owner","team"]);
const ALLOWED_TRUST=new Set(["owned","reviewed","observed","unknown"]);
const ALLOWED_KINDS=new Set([
  "internal-module",
  "library",
  "security-control",
  "documentation",
  "workflow",
  "service",
  "tool",
]);

function requiredText(value,label,{max=240}={}){
  if(typeof value!=="string")throw new TypeError(label+" is required");
  const text=value.trim();
  if(!text)throw new TypeError(label+" is required");
  if(text.length>max)throw new TypeError(label+" is too long");
  return text;
}

function stringList(values,label,{maxItems=32,maxLength=80,allowEmpty=true}={}){
  if(values===undefined)return [];
  if(!Array.isArray(values))throw new TypeError(label+" must be an array");
  if(!allowEmpty&&values.length===0)throw new TypeError(label+" must not be empty");
  if(values.length>maxItems)throw new TypeError(label+" has too many items");
  const output=[];
  for(const value of values){
    if(typeof value!=="string")throw new TypeError(label+" contains an invalid value");
    const text=value.trim().toLowerCase();
    if(!text)throw new TypeError(label+" contains an empty value");
    if(text.length>maxLength)throw new TypeError(label+" contains a value that is too long");
    output.push(text);
  }
  return [...new Set(output)].sort();
}

function normalizeLimit(value){
  if(value===undefined)return 5;
  if(!Number.isInteger(value)||value<1||value>20){
    throw new TypeError("limit must be an integer from 1 to 20");
  }
  return value;
}

export function normalizeRecommendationRequest(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input)){
    throw new TypeError("recommendation request must be an object");
  }

  const query=requiredText(input.query,"query",{max:500});
  const signals=stringList(input.signals,"signals",{maxItems:32,maxLength:80});
  const allowedScopes=stringList(input.allowedScopes,"allowed scopes",{
    maxItems:3,
    maxLength:20,
    allowEmpty:false,
  });

  for(const scope of allowedScopes){
    if(!ALLOWED_SCOPES.has(scope))throw new TypeError("scope is unsupported");
  }

  const alreadyKnown=stringList(input.alreadyKnown,"already known resource ids",{
    maxItems:200,
    maxLength:160,
  });

  return Object.freeze({
    query,
    queryTerms:Object.freeze(tokenize(query)),
    signals:Object.freeze(signals),
    allowedScopes:Object.freeze(allowedScopes),
    alreadyKnown:Object.freeze(alreadyKnown),
    limit:normalizeLimit(input.limit),
  });
}

function tokenize(value){
  return [...new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/)
      .map((part)=>part.trim())
      .filter((part)=>part.length>=2)
  )].sort();
}

function normalizeResource(input){
  if(!input||typeof input!=="object"||Array.isArray(input)){
    throw new TypeError("resource must be an object");
  }

  const id=requiredText(input.id,"resource id",{max:160});
  const title=requiredText(input.title,"resource title",{max:240});
  const kind=requiredText(input.kind,"resource kind",{max:40}).toLowerCase();
  const scope=requiredText(input.scope,"resource scope",{max:20}).toLowerCase();
  const trust=(input.trust??"unknown");
  if(typeof trust!=="string")throw new TypeError("resource trust is invalid");
  const normalizedTrust=trust.trim().toLowerCase();

  if(!ALLOWED_KINDS.has(kind))throw new TypeError("resource kind is unsupported");
  if(!ALLOWED_SCOPES.has(scope))throw new TypeError("resource scope is unsupported");
  if(!ALLOWED_TRUST.has(normalizedTrust))throw new TypeError("resource trust is unsupported");

  return Object.freeze({
    id,
    title,
    kind,
    scope,
    trust:normalizedTrust,
    tags:Object.freeze(stringList(input.tags,"resource tags",{maxItems:32,maxLength:80})),
    capabilities:Object.freeze(stringList(
      input.capabilities,
      "resource capabilities",
      {maxItems:32,maxLength:80},
    )),
  });
}

function trustScore(trust){
  if(trust==="owned")return 6;
  if(trust==="reviewed")return 4;
  if(trust==="observed")return 1;
  return 0;
}

function scoreResource(request,resource){
  const signals=new Set(request.signals);
  const queryTerms=new Set(request.queryTerms);
  const tags=new Set(resource.tags);
  const capabilities=new Set(resource.capabilities);
  const matchedSignals=[];
  const matchedQuery=[];

  for(const signal of signals){
    if(tags.has(signal)||capabilities.has(signal))matchedSignals.push(signal);
  }

  for(const term of queryTerms){
    if(tags.has(term)||capabilities.has(term))matchedQuery.push(term);
  }

  matchedSignals.sort();
  matchedQuery.sort();

  const score=
    matchedSignals.length*20+
    matchedQuery.length*8+
    trustScore(resource.trust);

  const reasons=[];
  if(matchedSignals.length){
    reasons.push("signals: "+matchedSignals.join(", "));
  }
  if(matchedQuery.length){
    const extras=matchedQuery.filter((term)=>!matchedSignals.includes(term));
    if(extras.length)reasons.push("query: "+extras.join(", "));
  }
  reasons.push("trust: "+resource.trust);

  return {
    score,
    reason:reasons.join("; "),
  };
}

export function recommendResources(requestInput,resourceInputs){
  const request=normalizeRecommendationRequest(requestInput);
  if(!Array.isArray(resourceInputs))throw new TypeError("resources must be an array");
  if(resourceInputs.length>500)throw new TypeError("resources has too many items");

  const allowedScopes=new Set(request.allowedScopes);
  const known=new Set(request.alreadyKnown);
  const seenIds=new Set();
  const ranked=[];

  for(const input of resourceInputs){
    const resource=normalizeResource(input);

    if(seenIds.has(resource.id))throw new TypeError("resource ids must be unique");
    seenIds.add(resource.id);

    if(!allowedScopes.has(resource.scope))continue;
    if(known.has(resource.id.toLowerCase())||known.has(resource.id))continue;

    const scored=scoreResource(request,resource);
    ranked.push({
      id:resource.id,
      title:resource.title,
      kind:resource.kind,
      score:scored.score,
      reason:scored.reason,
    });
  }

  ranked.sort((left,right)=>
    right.score-left.score||
    left.id.localeCompare(right.id)
  );

  return ranked.slice(0,request.limit).map((item)=>Object.freeze({...item}));
}
