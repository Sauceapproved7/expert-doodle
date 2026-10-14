const CACHE_NAME="hercules-browser-shell-v1";
const SHELL=["/","/style.css","/app.js","/manifest.webmanifest","/icon-192.svg","/icon-512.svg"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||url.pathname.startsWith("/api/")||url.pathname==="/health"||url.pathname==="/claim")return;
  event.respondWith(fetch(event.request).then(r=>{
    const copy=r.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(event.request)));
});
