const sandboxIds=new Set(["red-team","adversarial-twin","chaos-engine","betrayal-tests","nightmare-tests","deception-lab"]);
const ids=["owner-sovereign","mission-mode","self-diagnostic","builder-mode","command-center","recovery-mode","vault-brain","security-sentinel","ghost-operator","red-team","predator-debugger","nightmare-tests","deception-lab","adversarial-twin","chaos-engine","betrayal-tests","canary-vault","forensic-memory","containment-cells","mutiny-protocol","resurrection-protocol","shadow-hercules","assume-breach","dead-credentials","tripwire-city","execution-coffins","predator-vs-predator","memory-of-the-dead","blackout-protocol","burn-and-rebuild","evil-bot-vs-evil-bot"];
export function createAbyssPolicy(){
 return Object.freeze({
  name:"Evil Bot Abyss Stack",ownerSovereignty:true,emergencyStopExternal:true,productionAdversarialMutation:false,
  capabilities:ids.map(id=>Object.freeze({id,selfGrant:false,environment:sandboxIds.has(id)?"sandbox":"policy-controlled"})),
  blackout:({identityTrusted,auditTrusted})=>({mutation:identityTrusted&&auditTrusted?"policy":"deny",diagnostics:"read-only"}),
  mutiny:Object.freeze({controls:["revoke-identities","kill-sessions","quarantine-workers","freeze-deployments","preserve-evidence"],botCanOverride:false}),
  recovery:Object.freeze({requireSignedArtifact:true,trustRunningCompromisedState:false}),
 });
}
