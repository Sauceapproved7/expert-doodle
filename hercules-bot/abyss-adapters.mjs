const cred=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role"]);
function clean(x={}){for(const k of Object.keys(x))if(cred.has(k))throw new Error("credential field rejected");return structuredClone(x)}
function need(fn,name){if(typeof fn!=="function")throw new Error(name+" adapter unavailable");return fn}
export function createHerculesAbyssAdapters(d={}){
 return Object.freeze({
  async browser(x){x=clean(x);if(!["navigate","scrape","screenshot","interact","close_session"].includes(x.action))throw new Error("browser action denied");return need(d.browser,"browser")(x)},
  async vault(x){x=clean(x);if(x.action!=="search")throw new Error("vault action denied");return need(d.vault,"vault")(x)},
  async forge(x){x=clean(x);if(x.action!=="build"||x.preview!==true)throw new Error("preview required");return need(d.forge,"forge")(x)},
  async deploy(x){x=clean(x);if(x.action!=="status")throw new Error("deploy mutation denied");return need(d.deploy,"deploy")(x)},
  async contain(x){x=clean(x);if(!["revoke-identities","kill-sessions","quarantine-workers","freeze-deployments","preserve-evidence"].includes(x.action))throw new Error("containment action denied");return need(d.containment,"containment")(x)},
  async recover(x){x=clean(x);if(x.signed!==true||x.knownGood!==true)throw new Error("signed known-good artifact required");return need(d.recovery,"recovery")(x)}
 });
}
