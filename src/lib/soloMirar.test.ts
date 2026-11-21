/**
 * Test de «solo mirar» y «seguir en directo» (servidor de partidos, fase 3,
 * 21/11/2026). Ejecutar:  node --experimental-strip-types src/lib/soloMirar.test.ts
 *
 * Sin red: un fetch de mentira que responde como `GET /v1/partidos/{id}` del
 * servidor (ETag "v<n>", 304 con If-None-Match, X-Pulso-Dueno). Se vigila:
 *   1. Quién solo mira: la ficha «ajeno»; sin ficha (servidor apagado o sin
 *      conectar) se apunta como siempre.
 *   2. Seguir: 304 = nada nuevo; 200 = la versión nueva con su ETag y su dueño;
 *      sin red / llave anulada = fallo con su código.
 *   3. Solo se pregunta mientras se mira un partido EN CURSO con la app a la vista.
 *   4. El candado del store: con «solo mirar» ninguna acción cambia nada.
 *   5. La pantalla: inerte + la franja fuera; sin ventana de fin para el que mira.
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const { seguirPartido, soloMirar, hayQueSeguir, INTERVALO_SEGUIR_MS } = await import("./colaSubida.ts");
const { conCandado } = await import("./candado.ts");
type FichaSubida = import("./colaSubida.ts").FichaSubida;
type SesionServidor = import("./colaSubida.ts").SesionServidor;

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

const SES: SesionServidor = { token: "llave-B", club: "pulso", aparato: { id: "a_B", nombre: "Mac" }, url: "https://srv.test", el: 0 };
const ficha = (estado: FichaSubida["estado"], version = 1): FichaSubida =>
  ({ id: "p_1", estado, version, intentos: 0, proximoIntento: 0 });

// Servidor de mentira: un partido con versión y dueño.
const srv = { version: 3, dueno: "a_A", red: true, llave: true, pedidas: [] as Record<string, string>[] };
const fetchFalso = async (_url: string, init: RequestInit = {}): Promise<Response> => {
  const cab = (init.headers ?? {}) as Record<string, string>;
  srv.pedidas.push(cab);
  if (!srv.red) throw new TypeError("Failed to fetch");
  if (!srv.llave) return new Response(JSON.stringify({ error: "sin_llave" }), { status: 401 });
  const etag = `"v${srv.version}"`;
  const h = { ETag: etag, "X-Pulso-Dueno": srv.dueno };
  if (cab["If-None-Match"] === etag) return new Response(null, { status: 304, headers: h });
  return new Response(JSON.stringify({ id: "p_1", marcador: { inter: srv.version, rival: 0 } }), { status: 200, headers: h });
};

console.log("── 1 · Quién solo mira ──");
ok(soloMirar(ficha("ajeno")), "lo apunta otro aparato → solo mirar");
for (const e of ["subido", "pendiente", "subiendo", "error", "omitido"] as const) {
  ok(!soloMirar(ficha(e)), `«${e}» → se apunta como siempre`);
}
ok(!soloMirar(undefined), "sin ficha (servidor apagado / sin conectar) → como siempre");

console.log("── 2 · Seguir con ETag ──");
{
  const a = await seguirPartido(fetchFalso, SES, "p_1", null);
  ok(a.tipo === "nuevo" && a.version === 3 && a.etag === '"v3"' && a.dueno === "a_A", "la primera vez: la versión entera, con ETag y dueño");
  ok(srv.pedidas.at(-1)?.["If-None-Match"] === undefined, "la primera vez sin If-None-Match");
  const b = await seguirPartido(fetchFalso, SES, "p_1", '"v3"');
  ok(b.tipo === "igual", "con el mismo ETag → 304 → «igual» (nada que bajar)");
  ok(srv.pedidas.at(-1)?.["If-None-Match"] === '"v3"', "manda If-None-Match");
  ok(srv.pedidas.at(-1)?.Authorization === "Bearer llave-B", "con la llave del aparato");
  srv.version = 4;
  const c = await seguirPartido(fetchFalso, SES, "p_1", '"v3"');
  ok(c.tipo === "nuevo" && c.version === 4 && JSON.parse(c.texto).marcador.inter === 4, "versión nueva → «nuevo» con el texto");
  srv.red = false;
  const d = await seguirPartido(fetchFalso, SES, "p_1", '"v4"');
  ok(d.tipo === "fallo" && d.codigo === "red", "sin red → fallo «red»");
  srv.red = true; srv.llave = false;
  const e = await seguirPartido(fetchFalso, SES, "p_1", '"v4"');
  ok(e.tipo === "fallo" && e.codigo === "sin_llave", "llave anulada → fallo «sin_llave»");
  srv.llave = true;
}

console.log("── 3 · Cuándo se pregunta ──");
ok(INTERVALO_SEGUIR_MS >= 5_000 && INTERVALO_SEGUIR_MS <= 10_000, `cada ${INTERVALO_SEGUIR_MS / 1000} s (entre 5 y 10)`);
ok(hayQueSeguir(ficha("ajeno"), "en_curso", true), "mirando, en curso y a la vista → sí");
ok(!hayQueSeguir(ficha("ajeno"), "en_curso", false), "app en segundo plano → no");
ok(!hayQueSeguir(ficha("ajeno"), "finalizado", true), "finalizado → no");
ok(!hayQueSeguir(ficha("subido"), "en_curso", true), "lo apunta este aparato → no");

console.log("── 4 · El candado del store ──");
{
  let bloqueado = false;
  const hechas: string[] = [];
  const acc = conCandado({
    registrarEvento: (x: string) => { hechas.push(x); return 1; },
    play: () => { hechas.push("play"); },
    valor: 5,
  }, () => bloqueado);
  ok(acc.registrarEvento("gol") === 1 && hechas.join() === "gol", "sin candado, cada acción hace lo suyo");
  bloqueado = true;
  acc.registrarEvento("falta"); acc.play();
  ok(hechas.join() === "gol", "con «solo mirar», ninguna acción cambia nada");
  ok(acc.valor === 5, "lo que no es función pasa tal cual");
  bloqueado = false;
  acc.play();
  ok(hechas.join() === "gol,play", "al tomar el control vuelven a funcionar");

  const st = leer("./store.ts");
  ok(/conCandado\(crudas, \(\) => soloLectura\.current\)/.test(st), "store: TODAS las acciones pasan por el candado");
  ok(/if \(soloLectura\.current\) return;\s*guardado\.current!\.programar/.test(st), "store: mirando, no se guarda en la base");
  ok(/if \(saltarGuardado\.current\) \{ saltarGuardado\.current = false; return; \}/.test(st),
    "store: lo recién leído del servidor no se vuelve a guardar (no parece que haya algo que subir)");
}

console.log("── 5 · La pantalla del partido ──");
{
  const pg = leer("../app/partido/page.tsx");
  ok(pg.includes("setSoloLectura(mirar.activo)"), "la pantalla pone el candado según la ficha");
  ok(/inert=\{mirar\.activo \|\| undefined\}/.test(pg), "mirando, el contenedor queda inerte (nada se toca)");
  ok(/\{mirar\.activo && \(\s*<BannerSoloMirar/.test(pg), "la franja «Lo está llevando…» va fuera del contenedor inerte");
  ok(/&& !hayOtraVentana && !mirar\.activo;/.test(pg), "al que mira no le sale la ventana de fin de partido");
  ok(pg.includes("useSeguirEnDirecto(partido.id, partido.estado, recargar)"), "sigue en directo y vuelve a leer al llegar algo nuevo");
  const css = leer("../app/globals.css");
  ok(/\[data-solo-mirar\], \[data-solo-mirar\] \* \{ pointer-events: none !important; \}/.test(css),
    "red para Safari sin `inert`: nada recibe toques");
  const sc = leer("../components/ServidorClub.tsx");
  ok(/tomarControlDe\(props\.id, false\)/.test(sc), "«Tomar el control» desde la franja trae SIEMPRE la última del servidor");
  ok(/confirm\(t\("sv_tomar_confirm"/.test(sc), "y pide confirmación");
  const sv = leer("./servidor.ts");
  ok(/if \(!SERVIDOR_ACTIVO \|\| !s \|\| !soloMirar\(f\)\) return "no";/.test(sv), "apagado, sin conectar o si manda este aparato: no se pregunta nada");
  ok(/if \(r\.dueno && r\.dueno === s\.aparato\.id\) return "no";/.test(sv), "nunca pisa un partido que manda este aparato");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
process.exit(fallos ? 1 : 0);
