/* Service worker del crono — OFFLINE REAL para el día de partido.
 *
 * Cachea la app (páginas + assets) para que un partido entero funcione SIN
 * conexión y se pueda recargar aunque Safari haya descargado la pestaña.
 * El estado del partido en curso vive aparte en IndexedDB (Dexie), así que
 * offline + recarga = el partido se recupera y se sigue.
 *
 * Estrategia:
 *  - install: pre-cachea el "app shell" (las páginas principales + manifest).
 *  - assets (_next, iconos, css, js): CACHE primero; si no está, red y se
 *    cachea (tras una visita online queda TODO disponible offline).
 *  - navegaciones: RED primero (para tener lo último con conexión) y, si
 *    falla (offline), se sirve de cache.
 *
 * Es un SW escrito a mano a propósito: next-pwa 5.x no soporta Next 16 +
 * app router + output:export, y para una app estática esto es más robusto.
 */
const CACHE = "inter-crono-v2";
// Carpeta donde vive la app: "/arkaitz-2526/crono" en producción, "" en local.
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/partido/`,
  `${BASE}/nuevo/`,
  `${BASE}/resumen/`,
  `${BASE}/manifest.json`,
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // allSettled: que un fallo puntual no aborte la instalación.
      Promise.allSettled(APP_SHELL.map((u) => cache.add(u)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo nuestro origen

  // Navegaciones (abrir / recargar una página): red primero, cae a cache.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (m) =>
                m ||
                caches.match(`${BASE}/partido/`) ||
                caches.match(`${BASE}/`)
            )
        )
    );
    return;
  }

  // Resto de peticiones (assets): cache primero; si no, red y se cachea.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});
