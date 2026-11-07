// Mon QG : garde une copie des pages pour que l'appli s'ouvre même sans réseau.
// Réseau d'abord (pour toujours avoir la dernière version), copie en secours.
const CACHE = "mon-qg-v5";
// La tour 3D (tour-3d*, 650 Ko) n'est pas mise de côté à l'installation : elle l'est à sa première ouverture
const SHELL = ["index.html", "mangatheque.html", "jeux.html", "streams.html", "pc.html", "app.js", "mangatheque.js", "jeux.js", "streams.js", "pc.js", "guard.js", "view.js", "sync.js","manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // Firebase, Twitch, YouTube… : jamais mis en cache
  // « no-cache » : on redemande toujours au site s'il y a une nouvelle version (sinon le navigateur garde l'ancienne jusqu'à 10 min)
  e.respondWith(
    fetch(new Request(url.href, { cache: "no-cache", credentials: "same-origin" }))
      .then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? caches.match("index.html") : undefined))
  );
});
