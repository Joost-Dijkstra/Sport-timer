const CACHE_NAME = 'sporttimer-v4';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './timer-core.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo-sporttimer-cool.svg',
  './icon sporttimer.png'
];

self.addEventListener('install',(event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',(event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request,navigationFallback){
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if(response && response.ok && response.type === 'basic'){
      await cache.put(request,response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if(cached) return cached;
    if(navigationFallback) return cache.match('./index.html');
    return Response.error();
  }
}

self.addEventListener('fetch',(event) => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  if(url.pathname.endsWith('/index-cool.html')){
    event.respondWith(Response.redirect(new URL('./index.html',self.registration.scope).href,302));
    return;
  }

  if(event.request.mode === 'navigate'){
    event.respondWith(networkFirst(event.request,true));
    return;
  }

  event.respondWith(networkFirst(event.request,false));
});
