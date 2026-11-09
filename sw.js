/* FisioSimula — Service Worker del acceso directo (PWA)
   Guarda en caché la propia app (página, manifest, iconos y recursos de
   assets/) para que abra rápido y muestre su pantalla de ingreso aunque
   falle la conexión. NUNCA guarda llamadas a la nube (Supabase): el ingreso
   sigue necesitando internet y la app lo avisa; este archivo no crea
   ningún modo sin conexión para entrar. */
var CACHE = "fisiosimula-pwa-2026-11-08";
var CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/lucide.min.js",
  "./assets/hatch-maps.css",
  "./assets/hatch-maps.js",
  "./assets/map_helpers.js",
  "./assets/student-hero.webp",
  "./assets/spine.webp"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCloud(url) {
  return url.hostname.indexOf("supabase.co") !== -1 ||
    url.hostname.indexOf("supabase.in") !== -1;
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  /* La nube va siempre a la red, sin caché ni respuesta guardada. */
  if (isCloud(url)) return;
  /* Solo se atiende lo del mismo origen (la app y sus assets). */
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    /* Página: primero la red (para recibir la versión nueva); si no hay
       conexión, la copia guardada muestra la pantalla de ingreso. */
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put("./index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("./index.html", { ignoreSearch: true });
      })
    );
    return;
  }

  /* Recursos de la app: primero la caché y se refrescan en segundo plano. */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
