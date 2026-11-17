/* Géant CS – instant open from cache, update in background, tell the page when a new version arrives */
const CACHE="geant-cs-v19";
const SCOPE=self.registration.scope;
const INDEX=new URL("index.html",SCOPE).href;
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>fetch(INDEX,{cache:"reload"}).then(r=>r.ok&&c.put(INDEX,r)).catch(()=>{})));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function sig(res){
  const b=await res.clone().arrayBuffer();
  const h=await crypto.subtle.digest("SHA-1",b);
  return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function swr(e,req,isIdx){
  const c=await caches.open(CACHE);
  const key=isIdx?INDEX:req.url;
  const hit=await c.match(key);
  const net=fetch(key,{cache:"no-cache"}).then(async res=>{
    if(!res||!res.ok)return res;
    let changed=false;
    if(isIdx&&hit){try{changed=(await sig(hit))!==(await sig(res))}catch(x){}}
    await c.put(key,res.clone());
    if(changed){const cs=await self.clients.matchAll({type:"window"});cs.forEach(w=>w.postMessage({t:"upd"}))}
    return res;
  }).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  const res=await net;
  return res||new Response("Offline",{status:503,headers:{"Content-Type":"text/plain"}});
}
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return;               // Firebase, fonts, etc. go straight to the network
  if(u.pathname.endsWith("/sw.js"))return;
  const dir=new URL(SCOPE).pathname;
  const isIdx=r.mode==="navigate"||u.pathname===dir||u.pathname.endsWith("/index.html");
  e.respondWith(swr(e,r,isIdx));
});
