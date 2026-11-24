/**
 * Test de la cola de subida al servidor del club (fase 2, 21/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/colaSubida.test.ts
 *
 * Sin red ni servidor de verdad: un fetch de mentira que se porta como la API
 * v1 (`servidor_partidos/app.py` del repo del club): el primer aparato que sube
 * es el dueño, los demás reciben 409 «no_dueno», If-Match «v<n>», 401 sin
 * llave… y un reloj de mentira para las esperas. Se vigila:
 *   1. Sin conectar no se pide nada; conectado, cada partido nuevo sube.
 *   2. Solo se vuelve a subir lo que cambia, con If-Match de lo último subido.
 *   3. Sin red / servidor caído: pendiente, reintentos con espera creciente
 *      (2, 4, 8 s… hasta 5 min) y «despertar» al volver la red.
 *   4. Rechazos (no es un partido, muy grande): error, sin reintentar a lo
 *      loco; se vuelve a probar cuando el partido cambia.
 *   5. Otro aparato manda: «ajeno», no se sube; tomar el control lo arregla.
 *   6. Llave anulada: se avisa y se para.
 *   7. Lo que no se sube: sin cabecera, el de ejemplo; partidos borrados.
 *   8. Volver a conectar (llave nueva): sus partidos se recuperan solos.
 *   9. Dos pasadas a la vez no suben dos veces; una subida cortada se retoma.
 *  10. La configuración: apagado en los cuatro clubes y la base sin perder nada.
 */
import { readFileSync } from "node:fs";
import type { Partido } from "./db.ts";
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const {
  MotorSubida, veredicto, esperaReintento, hayCambios, iniciarSesion, listarDelClub, bajarPartido,
  ESPERA_MAX_MS, ENTRE_SUBIDAS_MS,
} = await import("./colaSubida.ts");
type FichaSubida = import("./colaSubida.ts").FichaSubida;
type SesionServidor = import("./colaSubida.ts").SesionServidor;

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  const s = JSON.stringify(a) === JSON.stringify(b);
  ok(s, `${msg}${s ? "" : ` (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`}`);
}
const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

// ── Datos inventados (el repositorio es público) ──
const BASE = (): Partido => JSON.parse(leer("../../public/_demo_partido.json"));
function partido(id: string, actualizado: number, extra: Partial<Partido> = {}): Partido {
  return { ...BASE(), id, actualizado, ...extra };
}

// ── Servidor de mentira (API v1) ──
interface PartidoSrv { dueno: string; version: number; cuerpo: string }
class ServidorFalso {
  partidos = new Map<string, PartidoSrv>();
  tokens = new Map<string, { aparato: string; nombre: string }>([["llave-A", { aparato: "a_A", nombre: "iPad A" }]]);
  peticiones: { metodo: string; url: string; cab: Record<string, string>; cuerpo?: string }[] = [];
  /** Lo que se fuerza en la próxima respuesta: "red" (sin conexión), un estado HTTP o nada. */
  forzar: (number | "red")[] = [];
  contrasena = "una frase larga de prueba";

  fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const metodo = (init.method || "GET").toUpperCase();
    const cab = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    this.peticiones.push({ metodo, url, cab, cuerpo: typeof init.body === "string" ? init.body : undefined });
    const f = this.forzar.shift();
    if (f === "red") throw new TypeError("Failed to fetch");
    const json = (estado: number, c: unknown, h: Record<string, string> = {}) =>
      new Response(JSON.stringify(c), { status: estado, headers: { "Content-Type": "application/json", ...h } });
    if (typeof f === "number") return json(f, { error: f === 422 ? "no_partido" : f === 413 ? "grande" : "x" });

    const ruta = new URL(url).pathname;
    if (ruta === "/v1/sesion" && metodo === "POST") {
      const b = JSON.parse(String(init.body));
      if (b.contrasena !== this.contrasena) return json(401, { error: "credenciales" });
      const token = `llave-${this.tokens.size + 1}`;
      const ap = `a_${this.tokens.size + 1}`;
      this.tokens.set(token, { aparato: ap, nombre: b.aparato });
      return json(200, { token, club: b.club, aparato: { id: ap, nombre: b.aparato }, caduca_dias: 400 });
    }
    const t = this.tokens.get((cab.Authorization || "").replace("Bearer ", ""));
    if (!t) return json(401, { error: "sin_llave" });
    if (ruta === "/v1/partidos" && metodo === "GET") {
      return json(200, { partidos: [...this.partidos.entries()].map(([id, p]) => ({
        id, version: p.version, dueno: { id: p.dueno, nombre: null, soy_yo: p.dueno === t.aparato } })) });
    }
    const m = ruta.match(/^\/v1\/partidos\/([^/]+)(\/tomar-control)?$/);
    if (!m) return json(404, { error: "no_existe" });
    const id = decodeURIComponent(m[1]);
    const actual = this.partidos.get(id);
    if (m[2]) {
      if (!actual) return json(404, { error: "no_existe" });
      actual.dueno = t.aparato;
      return json(200, { id, version: actual.version, dueno: t.aparato });
    }
    if (metodo === "GET") {
      if (!actual) return json(404, { error: "no_existe" });
      return new Response(actual.cuerpo, { status: 200, headers: { ETag: `"v${actual.version}"` } });
    }
    // PUT
    const cuerpo = String(init.body);
    const datos = JSON.parse(cuerpo);
    if (datos?.exportacion?.app !== "pulso-crono") return json(422, { error: "no_partido" });
    if (datos.id !== id) return json(422, { error: "id_distinto" });
    const im = cab["If-Match"];
    if (actual) {
      if (actual.dueno !== t.aparato) return json(409, { error: "no_dueno", version: actual.version, dueno: actual.dueno, dueno_nombre: "iPad A" });
      if (im && im !== `"v${actual.version}"`) return json(409, { error: "version", version: actual.version });
      actual.version += 1; actual.cuerpo = cuerpo;
      return json(200, { id, version: actual.version, nueva: true, creado: false, dueno: t.aparato });
    }
    this.partidos.set(id, { dueno: t.aparato, version: 1, cuerpo });
    return json(201, { id, version: 1, nueva: true, creado: true, dueno: t.aparato });
  };
  puts(id?: string) { return this.peticiones.filter((p) => p.metodo === "PUT" && (!id || p.url.endsWith(`/${id}`))); }
}

// ── Base local de mentira ──
function montar(opts: { sesion?: SesionServidor | null; srv?: ServidorFalso; partidos?: Partido[]; fichas?: Map<string, FichaSubida> } = {}) {
  const srv = opts.srv ?? new ServidorFalso();
  const partidos = new Map<string, Partido>((opts.partidos ?? []).map((p) => [p.id, p]));
  const fichas = opts.fichas ?? new Map<string, FichaSubida>();
  const reloj = { t: 1_763_700_000_000 };
  let sesion: SesionServidor | null = opts.sesion === undefined
    ? { token: "llave-A", club: "pulso", aparato: { id: "a_A", nombre: "iPad A" }, url: "https://srv.test", el: 0 }
    : opts.sesion;
  const perdidas = { n: 0 };
  let avisos = 0;
  const motor = new MotorSubida({
    almacen: {
      claves: async () => [...partidos.values()].map((p) => ({ id: p.id, actualizado: p.actualizado })),
      leerPartido: async (id) => partidos.get(id),
      fichas: async () => [...fichas.values()].map((f) => ({ ...f })),
      guardarFicha: async (f) => { fichas.set(f.id, { ...f }); },
      borrarFicha: async (id) => { fichas.delete(id); },
    },
    fetch: srv.fetch,
    sesion: () => sesion,
    alPerderSesion: () => { perdidas.n += 1; sesion = null; },
    cliente: "pulso",
    version: "abc1234",
    excluir: new Set(["demo_partido_1"]),
    ahora: () => reloj.t,
    azar: () => 0,
    alCambiar: () => { avisos += 1; },
  });
  return {
    srv, partidos, fichas, reloj, motor, perdidas,
    avisos: () => avisos,
    ponerSesion: (s: SesionServidor | null) => { sesion = s; },
    ficha: (id: string) => motor.fichas.get(id),
    pasar: (ms: number) => { reloj.t += ms; },
    tocar: (id: string) => { const p = partidos.get(id)!; reloj.t += 1000; partidos.set(id, { ...p, actualizado: reloj.t, marcador: { ...p.marcador, inter: p.marcador.inter + 1 } }); },
  };
}

console.log("── 0 · Piezas sueltas ──");
{
  igual([1, 2, 3, 4, 5].map((n) => esperaReintento(n)), [2000, 4000, 8000, 16000, 32000], "espera creciente: 2, 4, 8, 16, 32 s");
  igual(esperaReintento(30), ESPERA_MAX_MS, "con muchos fallos, tope de 5 min");
  ok(esperaReintento(1, 1) === 2400, "el azar añade como mucho un 20 %");
  ok(hayCambios(5, undefined) && hayCambios(6, { id: "x", estado: "subido", subidoActualizado: 5, intentos: 0, proximoIntento: 0 })
     && !hayCambios(5, { id: "x", estado: "subido", subidoActualizado: 5, intentos: 0, proximoIntento: 0 }),
     "hay cambios = el `actualizado` no es el que se subió");
  igual(veredicto(201, { version: 1 }).tipo, "ok", "201 → subido");
  igual(veredicto(0, null).tipo, "reintentar", "sin respuesta (sin red) → reintentar");
  igual(veredicto(503, {}).tipo, "reintentar", "503 (servidor caído) → reintentar");
  igual(veredicto(429, { error: "x" }).tipo, "reintentar", "429 → reintentar");
  igual(veredicto(401, { error: "sin_llave" }).tipo, "sin_llave", "401 → llave perdida");
  igual(veredicto(409, { error: "no_dueno", dueno: "a_B", dueno_nombre: "iPad B" }),
    { tipo: "ajeno", dueno: { id: "a_B", nombre: "iPad B" }, version: undefined }, "409 no_dueno → ajeno, con el dueño");
  igual(veredicto(409, { error: "version" }), { tipo: "rechazado", codigo: "version" }, "409 version → rechazado");
  igual(veredicto(422, { error: "no_partido" }), { tipo: "rechazado", codigo: "no_partido" }, "422 → rechazado");
  igual(veredicto(413, { error: "grande" }), { tipo: "rechazado", codigo: "grande" }, "413 → rechazado");
  igual(veredicto(200, { nada: 1 }).tipo, "reintentar", "200 sin versión (un proxy raro) → reintentar, no dar por subido");
}

console.log("── 1 · Sin conectar no se pide nada; conectado, sube ──");
{
  const m = montar({ sesion: null, partidos: [partido("p_1", 1000)] });
  const r = await m.motor.pasada();
  ok(r.sinSesion === true && m.srv.peticiones.length === 0, "sin llave: ni una petición");
  m.ponerSesion({ token: "llave-A", club: "pulso", aparato: { id: "a_A", nombre: "iPad A" }, url: "https://srv.test", el: 0 });
  const r2 = await m.motor.pasada();
  igual(r2.subidos, ["p_1"], "con llave: el partido sube");
  const put = m.srv.puts("p_1")[0];
  ok(put?.url === "https://srv.test/v1/partidos/p_1", "a /v1/partidos/<id>");
  ok(put?.cab.Authorization === "Bearer llave-A" && put?.cab["Content-Type"] === "application/json", "con la llave y como JSON");
  ok(!put?.cab["If-Match"], "la primera vez sin If-Match");
  const cuerpo = JSON.parse(put!.cuerpo!);
  igual([cuerpo.exportacion.app, cuerpo.exportacion.cliente, cuerpo.exportacion.version, cuerpo.id],
    ["pulso-crono", "pulso", "abc1234", "p_1"], "el cuerpo = lo de «Exportar JSON» (etiqueta con club y versión)");
  igual(cuerpo.eventos.length, BASE().eventos.length, "con todas las acciones");
  const f = m.ficha("p_1")!;
  igual([f.estado, f.version, f.subidoActualizado, f.dueno?.id, f.subidoPor], ["subido", 1, 1000, "a_A", "a_A"], "ficha: subido, v1, dueño este aparato");
  ok(m.fichas.get("p_1")?.estado === "subido", "y la ficha queda guardada en la base");
  ok(m.avisos() > 0, "la pantalla se entera");
}

console.log("── 2 · Solo se sube lo que cambia ──");
{
  const m = montar({ partidos: [partido("p_1", 1000), partido("p_2", 2000)] });
  await m.motor.pasada();
  igual(m.srv.puts().length, 2, "dos partidos, dos subidas");
  m.pasar(ENTRE_SUBIDAS_MS + 1);
  await m.motor.pasada();
  igual(m.srv.puts().length, 2, "sin cambios: ninguna más");
  m.tocar("p_2");
  await m.motor.pasada();
  igual(m.srv.puts().map((p) => p.url.split("/").pop()), ["p_1", "p_2", "p_2"], "cambia uno: sube solo ese");
}
{
  const m = montar({ partidos: [partido("p_1", 1000)] });
  await m.motor.pasada();
  m.tocar("p_1");
  await m.motor.pasada();
  igual(m.srv.puts().length, 1, "un cambio a los 1 s de subir: espera (como mucho una versión cada 10 s)");
  igual(m.ficha("p_1")?.estado, "pendiente", "…y queda pendiente");
  m.pasar(ENTRE_SUBIDAS_MS);
  await m.motor.pasada();
  igual(m.srv.puts().length, 2, "pasados los 10 s, sube");
  igual(m.srv.puts()[1].cab["If-Match"], '"v1"', "con If-Match de lo último subido (v1)");
  igual([m.ficha("p_1")?.estado, m.ficha("p_1")?.version], ["subido", 2], "y queda en v2");
  igual(m.srv.partidos.get("p_1")?.version, 2, "el servidor tiene la v2");
}

console.log("── 3 · Sin red: pendiente y reintentos con espera creciente ──");
{
  const m = montar({ partidos: [partido("p_1", 1000)] });
  m.srv.forzar = ["red"];
  const r = await m.motor.pasada();
  igual(r.fallidos, ["p_1"], "sin red: falla");
  const f = m.ficha("p_1")!;
  igual([f.estado, f.intentos, f.codigo, f.proximoIntento - m.reloj.t], ["pendiente", 1, "red", 2000], "pendiente, 1 intento, reintento en 2 s");
  await m.motor.pasada();
  igual(m.srv.puts().length, 1, "antes de los 2 s no se vuelve a intentar (el intervalo de 10 s no machaca)");
  m.srv.forzar = ["red", 503, "red"];
  for (const esperado of [4000, 8000, 16000]) {
    m.pasar(ESPERA_MAX_MS);
    await m.motor.pasada();
    igual(m.ficha("p_1")!.proximoIntento - m.reloj.t, esperado, `siguiente fallo: espera ${esperado / 1000} s`);
  }
  igual(m.ficha("p_1")?.codigo, "red", "el último fallo, apuntado (para el texto)");
  // Vuelve la red: «despertar» y sube ya, sin esperar los 16 s.
  m.motor.despertar();
  await m.motor.pasada();
  igual([m.ficha("p_1")?.estado, m.ficha("p_1")?.intentos], ["subido", 0], "al volver la red (online) sube en el acto y se pone a cero");
}
{
  // Una petición que se queda colgada no bloquea: se corta por tiempo.
  const { peticion } = await import("./colaSubida.ts");
  const colgado = (_u: string, i?: RequestInit) => new Promise<Response>((_, rej) => {
    i?.signal?.addEventListener("abort", () => rej(new DOMException("abort", "AbortError")));
  });
  const r = await peticion(colgado, "https://srv.test/x", {}, 50);
  igual(r.estado, 0, "petición colgada: se corta por tiempo y cuenta como sin red");
}

console.log("── 4 · Rechazos: error, sin reintentar a lo loco ──");
{
  const m = montar({ partidos: [partido("p_1", 1000)] });
  m.srv.forzar = [422];
  await m.motor.pasada();
  igual([m.ficha("p_1")?.estado, m.ficha("p_1")?.codigo], ["error", "no_partido"], "422: error con su código");
  m.pasar(ESPERA_MAX_MS);
  await m.motor.pasada();
  igual(m.srv.puts().length, 1, "no se vuelve a mandar lo mismo");
  m.tocar("p_1");
  m.pasar(ENTRE_SUBIDAS_MS);
  await m.motor.pasada();
  igual([m.srv.puts().length, m.ficha("p_1")?.estado], [2, "subido"], "cuando el partido cambia, se vuelve a probar (y entra)");
  m.srv.forzar = [413];
  m.tocar("p_1"); m.pasar(ENTRE_SUBIDAS_MS);
  await m.motor.pasada();
  igual(m.ficha("p_1")?.codigo, "grande", "413: «grande»");
  await m.motor.reintentar("p_1");
  await m.motor.pasada();
  igual(m.ficha("p_1")?.estado, "subido", "«Reintentar» a mano lo vuelve a poner en la cola");
}

console.log("── 5 · Otro aparato manda: solo se mira ──");
{
  const srv = new ServidorFalso();
  const a = montar({ srv, partidos: [partido("p_1", 1000)] });
  await a.motor.pasada();
  srv.tokens.set("llave-B", { aparato: "a_B", nombre: "iPad B" });
  const b = montar({ srv, partidos: [partido("p_1", 1000)],
    sesion: { token: "llave-B", club: "pulso", aparato: { id: "a_B", nombre: "iPad B" }, url: "https://srv.test", el: 0 } });
  await b.motor.pasada();
  const f = b.ficha("p_1")!;
  igual([f.estado, f.dueno?.id, f.dueno?.nombre], ["ajeno", "a_A", "iPad A"], "el segundo aparato: «ajeno», con quién manda");
  b.tocar("p_1"); b.pasar(ESPERA_MAX_MS);
  await b.motor.pasada();
  igual(srv.puts().filter((p) => p.cab.Authorization === "Bearer llave-B").length, 1, "aunque se toque aquí, no insiste");
  igual(srv.partidos.get("p_1")?.version, 1, "y el del dueño no se pisa");
  // Tomar el control (lo hace la pantalla: POST + marcarDueno).
  const { tomarControl } = await import("./colaSubida.ts");
  const tc = await tomarControl(srv.fetch, { token: "llave-B", club: "pulso", aparato: { id: "a_B", nombre: "iPad B" }, url: "https://srv.test", el: 0 }, "p_1");
  ok(tc.ok && tc.datos.dueno === "a_B", "tomar el control: el servidor dice que ahora manda B");
  if (tc.ok) await b.motor.marcarDueno("p_1", tc.datos.version, { id: "a_B", nombre: "iPad B" });
  igual(b.ficha("p_1")?.estado, "pendiente", "lo tocado en B, a la cola");
  await b.motor.pasada();
  igual([b.ficha("p_1")?.estado, srv.partidos.get("p_1")?.version], ["subido", 2], "B sube su versión (v2)");
  // Y A, que ya no manda, no pisa: su próximo cambio se queda en «ajeno».
  a.tocar("p_1"); a.pasar(ENTRE_SUBIDAS_MS);
  await a.motor.pasada();
  igual([a.ficha("p_1")?.estado, srv.partidos.get("p_1")?.version], ["ajeno", 2], "A ya no manda: «ajeno» y la v2 de B intacta");
}
{
  // Abierto desde el servidor en un aparato que no manda: nada que subir.
  const m = montar({ partidos: [partido("p_9", 5000)] });
  await m.motor.marcarBajado("p_9", 5000, 3, { id: "a_Z", nombre: "Mac" }, false);
  await m.motor.pasada();
  igual([m.srv.puts().length, m.ficha("p_9")?.estado], [0, "ajeno"], "abierto para mirar: no sube nada");
  const m2 = montar({ partidos: [partido("p_9", 5000)] });
  await m2.motor.marcarBajado("p_9", 5000, 3, { id: "a_A", nombre: "iPad A" }, true);
  await m2.motor.pasada();
  igual([m2.srv.puts().length, m2.ficha("p_9")?.estado, m2.ficha("p_9")?.version], [0, "subido", 3], "abierto siendo el dueño: al día, sin subir");
}
{
  // Tomar el control sin poder traer la última: lo viejo de aquí NO se sube encima.
  const m = montar({ partidos: [partido("p_8", 5000)] });
  await m.motor.marcarBajado("p_8", 5000, 2, { id: "a_Z", nombre: "Mac" }, false);
  m.tocar("p_8");                                         // tocado aquí mientras era ajeno
  await m.motor.marcarDueno("p_8", 4, { id: "a_A", nombre: "iPad A" }, false);
  await m.motor.pasada();
  igual([m.srv.puts().length, m.ficha("p_8")?.estado, m.ficha("p_8")?.version], [0, "subido", 4],
    "tomar el control sin traer la última: lo de aquí no se sube por encima");
  m.tocar("p_8"); m.pasar(ENTRE_SUBIDAS_MS);
  m.srv.partidos.set("p_8", { dueno: "a_A", version: 4, cuerpo: "{}" });
  await m.motor.pasada();
  igual([m.srv.puts().length, m.srv.puts()[0]?.cab["If-Match"], m.ficha("p_8")?.version], [1, '"v4"', 5],
    "lo que se apunte después, sí (If-Match de la del servidor)");
}

console.log("── 6 · Llave anulada ──");
{
  const m = montar({ partidos: [partido("p_1", 1000), partido("p_2", 1000)],
    sesion: { token: "llave-vieja", club: "pulso", aparato: { id: "a_X", nombre: "iPad" }, url: "https://srv.test", el: 0 } });
  const r = await m.motor.pasada();
  ok(r.sinSesion === true && m.perdidas.n === 1, "401: se avisa UNA vez de que hay que volver a conectar");
  igual(m.srv.puts().length, 1, "y se para (no prueba el resto con una llave que no vale)");
  ok(["p_1", "p_2"].every((id) => m.ficha(id)?.estado === "pendiente"), "lo que había sigue pendiente para cuando se conecte");
}

console.log("── 7 · Lo que no se sube ──");
{
  const m = montar({ partidos: [partido("current", 1000, { config: null, estado: "configurando" }), partido("demo_partido_1", 1000), partido("p/raro", 1000), partido("p_1", 1000)] });
  await m.motor.pasada();
  igual(m.srv.puts().map((p) => p.url.split("/").pop()), ["p_1"], "solo el partido de verdad (ni el vacío, ni el de ejemplo, ni un id raro)");
  igual([m.ficha("current")?.estado, m.ficha("demo_partido_1")?.estado, m.ficha("p/raro")?.estado], ["omitido", "omitido", "error"], "omitidos y el id raro como error");
  m.pasar(ESPERA_MAX_MS);
  await m.motor.pasada();
  igual(m.srv.puts().length, 1, "y no se vuelven a mirar en cada pasada");
  // El vacío se rellena (se empieza a apuntar) → entonces sí.
  const vacio = m.partidos.get("current")!;
  m.partidos.set("current", { ...partido("current", m.reloj.t + 1), estado: "en_curso" });
  void vacio;
  await m.motor.pasada();
  igual(m.srv.puts().length, 2, "cuando ya tiene cabecera, sube");
  // Borrado en el aparato: se olvida su ficha (en el servidor se queda).
  m.partidos.delete("p_1");
  await m.motor.pasada();
  ok(!m.ficha("p_1") && !m.fichas.has("p_1"), "borrado aquí: su ficha fuera");
  ok(m.srv.partidos.has("p_1"), "…pero en el servidor sigue (ninguna versión se borra)");
}

console.log("── 8 · Volver a conectar: los partidos de este aparato se recuperan ──");
{
  const srv = new ServidorFalso();
  const m = montar({ srv, partidos: [partido("p_1", 1000)] });
  await m.motor.pasada();
  // Se desconecta y vuelve a entrar: el servidor le da OTRO id de aparato.
  const r = await iniciarSesion(srv.fetch, "https://srv.test", "pulso", srv.contrasena, "iPad A");
  ok(r.ok, "volver a entrar con la contraseña del club");
  if (r.ok) m.ponerSesion(r.sesion);
  m.tocar("p_1"); m.pasar(ENTRE_SUBIDAS_MS);
  await m.motor.pasada();
  const f = m.ficha("p_1")!;
  igual([f.estado, srv.partidos.get("p_1")?.version, srv.partidos.get("p_1")?.dueno], ["subido", 2, r.ok ? r.sesion.aparato.id : "?"],
    "su partido, subido con la llave vieja, se recupera solo (toma el control y sube)");
}

console.log("── 9 · Dos pasadas a la vez; subida cortada ──");
{
  const m = montar({ partidos: [partido("p_1", 1000)] });
  await Promise.all([m.motor.pasada(), m.motor.pasada(), m.motor.pasada()]);
  igual(m.srv.puts().length, 1, "tres disparos a la vez (online + visible + intervalo): una sola subida");
  // La app se cerró con una subida en camino: al abrir, vuelve a la cola.
  const fichas = new Map<string, FichaSubida>([["p_2", { id: "p_2", estado: "subiendo", intentos: 0, proximoIntento: 0 }]]);
  const m2 = montar({ partidos: [partido("p_2", 1000)], fichas });
  await m2.motor.cargar();
  igual(m2.ficha("p_2")?.estado, "pendiente", "una «subiendo» de antes de cerrar → pendiente");
  await m2.motor.pasada();
  igual(m2.ficha("p_2")?.estado, "subido", "y sube");
  // Lo apuntado se conserva entre aperturas: otro motor con la misma base no resube.
  const m3 = montar({ srv: m2.srv, partidos: [partido("p_2", 1000)], fichas: m2.fichas });
  m3.reloj.t += ENTRE_SUBIDAS_MS;
  await m3.motor.pasada();
  igual(m2.srv.puts().length, 1, "al volver a abrir el crono no se sube otra vez lo ya subido");
}

console.log("── 10 · Sesión y «Partidos del club» ──");
{
  const srv = new ServidorFalso();
  const mal = await iniciarSesion(srv.fetch, "https://srv.test/", "pulso", "no es", "iPad");
  igual(mal, { ok: false, codigo: "credenciales" }, "contraseña mala → «credenciales»");
  srv.forzar = ["red"];
  igual(await iniciarSesion(srv.fetch, "https://srv.test", "pulso", "x", "iPad"), { ok: false, codigo: "red" }, "sin red → «red»");
  srv.forzar = [429];
  ok((await iniciarSesion(srv.fetch, "https://srv.test", "pulso", "x", "iPad") as { codigo: string }).codigo === "demasiados_intentos", "429 → «demasiados_intentos»");
  const r = await iniciarSesion(srv.fetch, "https://srv.test/", "pulso", srv.contrasena, "iPad banquillo", 42);
  ok(r.ok && r.sesion.token.startsWith("llave-") && r.sesion.aparato.nombre === "iPad banquillo" && r.sesion.el === 42, "buena → llave del aparato con su nombre");
  ok(srv.peticiones.at(-1)?.url === "https://srv.test/v1/sesion", "la barra final de la dirección no se duplica");
  if (r.ok) {
    const m = montar({ srv, sesion: r.sesion, partidos: [partido("p_1", 1000)] });
    await m.motor.pasada();
    const l = await listarDelClub(srv.fetch, r.sesion);
    ok(l.ok && l.datos.length === 1 && l.datos[0].dueno.soy_yo, "la lista del club trae el partido, y dice que manda este aparato");
    const b = await bajarPartido(srv.fetch, r.sesion, "p_1");
    ok(b.ok && b.datos.version === 1 && JSON.parse(b.datos.texto).id === "p_1", "bajar: el texto exportado y la versión (del ETag)");
    const no = await bajarPartido(srv.fetch, r.sesion, "no_hay");
    ok(!no.ok && no.codigo === "no_existe", "uno que no existe → «no_existe»");
    const sin = await listarDelClub(srv.fetch, { ...r.sesion, token: "nada" });
    ok(!sin.ok && sin.codigo === "sin_llave", "con una llave que no vale → «sin_llave»");
  }
}

console.log("── 11 · Configuración: solo la demo encendida y la base sin perder nada ──");
{
  const cl = leer("./clientes.ts");
  // Cada club con su línea `servidor:`. Desde el 25/11/2026 la demo (`pulso`)
  // sube al servidor; Inter, filial y juvenil siguen como siempre.
  const servidorDe = (id: string): string | null => {
    const m = cl.match(new RegExp(`\\n  ${id}: \\{[\\s\\S]*?\\n  \\},`));
    const v = m?.[0].match(/servidor: (true|false),/);
    return v ? v[1] : null;
  };
  for (const id of ["inter", "filial", "juvenil"]) igual(servidorDe(id), "false", `${id}: servidor apagado`);
  igual(servidorDe("pulso"), "true", "la demo (pulso): servidor encendido");
  igual((cl.match(/servidor: (true|false),/g) ?? []).length, 4, "los cuatro clubes declaran `servidor`");
  igual((cl.match(/servidor: true/g) ?? []).length, 1, "solo uno encendido");
  ok(cl.includes('"https://datos.pulso-futsal.com"'), "la dirección del servidor: https://datos.pulso-futsal.com");
  const db = leer("./db.ts");
  ok(/version\(1\)\.stores\(\{\s*partidos: "id, estado, actualizado",\s*\}\)/.test(db), "la versión 1 sigue tal cual");
  ok(/version\(2\)\.stores\(\{\s*partidos: "id, estado, actualizado",\s*subidas: "id, estado",\s*\}\)/.test(db),
    "la versión 2 deja `partidos` igual y solo añade `subidas` (sin .upgrade que toque partidos)");
  ok(!/\.upgrade\(/.test(db), "sin migración que reescriba partidos");
  const sv = leer("./servidor.ts");
  ok(/if \(!SERVIDOR_ACTIVO[^)]*\) return \(\) => \{\};/.test(sv), "apagado: la sincronización ni arranca");
  ok(/if \(!SERVIDOR_ACTIVO \|\| !estado\.sesion\) return;/.test(sv), "apagado o sin conectar: ninguna subida");
  const lay = leer("../app/layout.tsx");
  ok(lay.includes("<SincronizadorServidor />"), "la subida va en todas las pantallas (layout)");
  for (const f of ["../app/page.tsx", "../components/InicioNuevo.tsx"]) {
    const s = leer(f);
    ok(s.includes("SERVIDOR_ACTIVO") || s.includes("servidorActivo"), `${f.split("/").pop()}: lo del servidor solo con el interruptor`);
    ok(s.includes("IconoSubida"), `${f.split("/").pop()}: el estado de cada partido (subido / pendiente / error)`);
  }
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
process.exit(fallos ? 1 : 0);
