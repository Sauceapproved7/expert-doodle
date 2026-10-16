const CACHE_NAME="hercules-browser-shell-v6";
const SHELL=["/style.css","/app.js","/search-intent.mjs","/manifest.webmanifest","/icon-192.svg","/icon-512.svg"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL.map(path=>new Request(new URL(path,location.origin),{credentials:"omit"})))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||event.request.mode==="navigate"||url.origin!==location.origin||url.search||event.request.headers?.has("Authorization")||event.request.credentials!=="omit"||!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(r=>{
    if(r.ok) {
      const copy=r.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{}));
    }
    return r;
  }).catch(()=>caches.match(event.request)));
});
