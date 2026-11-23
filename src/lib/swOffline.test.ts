/**
 * Test del service worker SIN CONEXIÓN: cada botón abre SU pantalla (23/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/swOffline.test.ts
 *
 * Por qué existe: el 23/11/2026, tras el Inter–Palma, Arkaitz dio a «📄 Informe
 * PDF» en el resumen y el iPad le devolvió a la pantalla del partido. En el
 * pabellón no había red y el service worker publicado entonces (main) solo
 * guardaba /informe/ en la demo y el juvenil: en el Inter la navegación a
 * /informe/?imprimir=1 fallaba y caía en el «plan B», que es /partido/. Ya
 * estaba arreglado en la rama del rediseño (cc0274e, 18/11) sin publicar.
 *
 * Este test no mira el texto del fichero: EJECUTA public/sw.js con una caché
 * y una red de mentira, lo instala con red, corta la red y navega. Si alguien
 * vuelve a sacar una página de la lista de lo que se guarda, o quita el
 * `ignoreSearch` (el botón añade ?imprimir=1), sale en rojo.
 */
import { readFileSync } from "node:fs";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const raiz = new URL("../../", import.meta.url);
const codigoSW = readFileSync(new URL("public/sw.js", raiz), "utf8");

const ORIGEN = "https://arkaitzsisniega.github.io";
type Resp = { ok: boolean; pagina: string; clone(): Resp; text(): Promise<string> };
const resp = (pagina: string): Resp => ({
  ok: true, pagina, clone() { return this; }, text: async () => `<html>${pagina}</html>`,
});
const clave = (x: string | { url: string }) => {
  const u = new URL(typeof x === "string" ? x : x.url, ORIGEN);
  return u.pathname + u.search;
};
const sinBusqueda = (k: string) => k.replace(/\?.*$/, "");

/** Instala el SW de un cliente con red y devuelve cómo responde sin ella. */
async function swDe(base: string) {
  const almacen = new Map<string, Resp>();
  const cache = {
    put: async (k: string | { url: string }, r: Resp) => { almacen.set(clave(k), r); },
    add: async (k: string) => { almacen.set(clave(k), resp(clave(k))); },
    match: async (k: string | { url: string }) => almacen.get(clave(k)),
    keys: async () => [...almacen.keys()].map((url) => ({ url })),
  };
  const caches = {
    open: async () => cache,
    keys: async () => ["unica"],
    delete: async () => true,
    match: async (k: string | { url: string }, o?: { ignoreSearch?: boolean }) => {
      const c = clave(k);
      if (almacen.has(c)) return almacen.get(c);
      if (o?.ignoreSearch) return almacen.get(sinBusqueda(c));
      return undefined;
    },
  };
  let hayRed = true;
  const fetch = async (k: string | { url: string }) => {
    if (!hayRed) throw new TypeError("Failed to fetch");
    return resp(sinBusqueda(clave(k)));
  };
  const manejadores: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { pathname: `${base}/sw.js`, origin: ORIGEN },
    addEventListener: (tipo: string, fn: (e: unknown) => void) => { manejadores[tipo] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function("self", "caches", "fetch", codigoSW)(self, caches, fetch);

  let instalado: Promise<unknown> = Promise.resolve();
  manejadores.install({ waitUntil: (p: Promise<unknown>) => { instalado = p; } });
  await instalado;
  hayRed = false;

  return async (ruta: string) => {
    let r: Promise<Resp | undefined> = Promise.resolve(undefined);
    manejadores.fetch({
      request: { method: "GET", mode: "navigate", url: ORIGEN + base + ruta },
      respondWith: (p: Promise<Resp | undefined>) => { r = p; },
    });
    return (await r)?.pagina ?? "(nada)";
  };
}

for (const base of ["/pulso/crono", "/pulso/crono-filial", "/pulso/crono-juvenil", "/pulso/crono-demo"]) {
  console.log(`Sin conexión en ${base}:`);
  const navegar = await swDe(base);
  for (const [ruta, debe] of [
    ["/informe/?imprimir=1", "/informe/"],   // el botón «📄 Informe PDF» del resumen
    ["/informe/", "/informe/"],
    ["/resumen/", "/resumen/"],
    ["/totales/", "/totales/"],
    ["/partido/", "/partido/"],
  ]) {
    const sale = await navegar(ruta);
    ok(sale === base + debe, `${ruta} abre ${debe} (sale ${sale.replace(base, "")})`);
  }
}

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log("\nTodo en verde");
