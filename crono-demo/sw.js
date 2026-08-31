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
// El nombre de la caché lleva la VERSIÓN DEL DESPLIEGUE, que el workflow
// sustituye por el SHA del commit al publicar (`249222f2bc17`).
//
// POR QUÉ (30/8/2026): el navegador solo instala un service worker nuevo si
// `sw.js` cambia byte a byte. Como este fichero es fijo y las peticiones de
// assets van a caché primero, un iPad podía seguir sirviendo el crono de hace
// semanas: Arkaitz vio en el partido el cuadro de balones divididos que se
// había quitado el 22/8, con el arreglo desplegado desde entonces. Con el SHA
// dentro, cada despliegue cambia este fichero → se instala el SW nuevo →
// `activate` tira la caché vieja y entra la versión de verdad.
//
// En local (sin sustituir) queda "dev", que no estorba: en localhost no se
// registra el SW.
const VERSION = "249222f2bc17".startsWith("__") ? "dev" : "249222f2bc17";
const CACHE = `inter-crono-${VERSION}`;
// Carpeta donde vive la app: "/pulso/crono" en producción, "" en local.
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/partido/`,
  `${BASE}/nuevo/`,
  `${BASE}/resumen/`,
  `${BASE}/manifest.json`,
];

// Precachea una página HTML Y todos los assets (_next JS/CSS) que referencia.
// Así, cada pantalla (incluido el Resumen, al que se navega desde /partido)
// funciona SIN conexión: antes solo se cacheaba el HTML, pero los chunks de JS
// de esa ruta se pedían por red y offline fallaban ("couldn't load, try again").
async function precachePaginaYAssets(cache, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (!res || !res.ok) return;
    await cache.put(url, res.clone());
    const html = await res.text();
    const urls = new Set();
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const a = m[1];
      if (a.includes("/_next/")) urls.add(a);
    }
    await Promise.allSettled([...urls].map((a) => cache.add(a).catch(() => {})));
  } catch { /* best-effort */ }
}

// ¿Está el app-shell ENTERO cacheado? (las 4 páginas principales).
async function appShellCompleto(cache) {
  const res = await Promise.all(APP_SHELL.map((u) => cache.match(u).then((r) => !!r)));
  return res.every(Boolean);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.add(`${BASE}/manifest.json`).catch(() => {});
      await Promise.allSettled(
        APP_SHELL.filter((u) => !u.endsWith("manifest.json"))
          .map((u) => precachePaginaYAssets(cache, u))
      );
      // SWAP ATÓMICO: solo "comprometemos" el SW nuevo (skipWaiting) si el
      // app-shell entero quedó cacheado. Si la conexión fue intermitente y falta
      // alguna página, NO activamos: el SW viejo y su caché BUENA siguen sirviendo
      // y se reintenta en la próxima visita con conexión. Antes se hacía
      // skipWaiting de entrada y activate borraba la caché buena aunque la nueva
      // quedara a medias → app rota offline (justo el pabellón sin wifi).
      if (await appShellCompleto(cache)) await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Solo borramos cachés viejas si la NUESTRA está completa: si estuviera a
      // medias, conservamos la vieja como red de seguridad offline.
      const cache = await caches.open(CACHE);
      if (await appShellCompleto(cache)) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      }
      await self.clients.claim();
    })()
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
