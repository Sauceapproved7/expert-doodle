// The real confirmation endpoint is not active. Never read, store or submit
// a hash-fragment token before an owner-authorized HTTPS verifier is deployed.
if(typeof window!=='undefined' && window.location.hash) {
 window.history.replaceState(null,'',window.location.pathname+window.location.search);
}
