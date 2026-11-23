/**
 * generar_partido_demo.ts — El partido de ejemplo de la demo, irreconocible (22/11/2026).
 *
 * `public/_demo_partido.json` era un partido REAL del primer equipo (agosto de 2026)
 * con solo los nombres cambiados: mismo resultado, los 236 eventos con su segundo
 * exacto y cada uno con su `timestampReal` (y su id, que lleva la hora dentro).
 * El repo es público, así que cualquiera podía sacar el día y el partido.
 *
 * Este script parte de ese partido (para que la demo siga teniendo la «forma» de
 * un partido de verdad) y lo cambia entero, con semilla fija (sale siempre igual):
 *   · otra fecha y otra hora; TODAS las marcas de tiempo y los ids, rehechos;
 *   · otro rival (inventado) y otro resultado (5-3 en vez de 4-2);
 *   · los minutos, deformados en cada parte (±1-3 min en el centro, sin salirse
 *     de la parte y SIN cambiar el orden: los cambios se mueven con los eventos,
 *     así que siempre hay portero + 4 en pista);
 *   · los jugadores, repartidos de nuevo entre la plantilla demo;
 *   · disparos, pérdidas, robos, cortes y faltas: ±15-25 % (se quitan unos y se
 *     añaden otros, con un jugador que estuviera en pista en ese momento);
 *   · los dorsales de la plantilla demo (`src/lib/roster.ts`), barajados.
 * Los agregados (marcador, faltas por parte, acciones, disparos del rival,
 * minutos) NO se tocan a mano: salen de los eventos con `reconstruirAgregados` y
 * `recomputarMinutos`, lo mismo que usa el editor post-partido.
 *
 * Uso (el partido original NO está en el repo; se le pasa la ruta):
 *   node scripts/generar_partido_demo.ts --origen /ruta/partido_original.json
 * Sin --origen lo saca de git, del commit en que entró (5bfb580), mientras exista.
 * Después:  node scripts/verificar_partido_demo.ts --origen <la misma ruta>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { registerHooks } from "node:module";
import type { Partido, Evento, ParteId } from "../src/lib/db";

// Los módulos de la app importan sin extensión (así lo quiere el build).
registerHooks({
  resolve(esp, ctx, sig) {
    if (esp.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(esp)) {
      try { return sig(`${esp}.ts`, ctx); } catch { /* tal cual */ }
    }
    return sig(esp, ctx);
  },
});
const { reconstruirAgregados, recomputarMinutos } = await import("../src/lib/reconstruir.ts");
const { ROSTER_DEMO } = await import("../src/lib/roster.ts");

const RAIZ = new URL("..", import.meta.url).pathname;
const SEMILLA = 20261122;
const COMMIT_ORIGEN = "5bfb580";

// ── Lo nuevo de la cabecera ────────────────────────────────────────────────
const FECHA = "2026-10-24";          // sábado
const HORA = "17:30";
const RIVAL = "CD SERENO";
const RESULTADO = { inter: 5, rival: 3 };

// ── Azar con semilla (mulberry32) ──────────────────────────────────────────
let estado = SEMILLA >>> 0;
function azar(): number {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + (b - a) * azar();
const entero = (a: number, b: number) => Math.floor(entre(a, b + 1));
const elige = <T,>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)];
function baraja<T>(xs: readonly T[]): T[] {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const signo = () => (azar() < 0.5 ? -1 : 1);

// ── Origen ─────────────────────────────────────────────────────────────────
function leerOrigen(): Partido {
  const i = process.argv.indexOf("--origen");
  const txt = i > 0
    ? readFileSync(process.argv[i + 1], "utf8")
    : execSync(`git -C "${RAIZ}" show ${COMMIT_ORIGEN}:public/_demo_partido.json`, { encoding: "utf8" });
  return JSON.parse(txt) as Partido;
}
const orig = leerOrigen();
const T: Record<ParteId, number> = { ...orig.config!.duracionParte };
const PARTES: ParteId[] = ["1T", "2T"];

// ── 1. Dorsales nuevos para la plantilla demo (roster.ts) ──────────────────
function dorsalesNuevos(): Record<string, string> {
  const porteros = ROSTER_DEMO.filter((j) => j.posicion === "PORTERO");
  const campo = ROSTER_DEMO.filter((j) => j.posicion === "CAMPO");
  const numPorteros = baraja([1, 13, 25, 30, 26, 35]).slice(0, porteros.length);
  const libres = baraja(Array.from({ length: 40 }, (_, i) => i + 2).filter((n) => !numPorteros.includes(n)));
  const out: Record<string, string> = {};
  porteros.forEach((j, i) => { out[j.nombre] = String(numPorteros[i]); });
  campo.forEach((j, i) => { out[j.nombre] = String(libres[i]); });
  return out;
}
const DORSALES = dorsalesNuevos();
{
  const ruta = `${RAIZ}src/lib/roster.ts`;
  const src = readFileSync(ruta, "utf8");
  const ini = src.indexOf("export const ROSTER_DEMO");
  const fin = src.indexOf("];", ini);
  const bloque = src.slice(ini, fin).replace(
    /\{ dorsal: "\d+", nombre: "([^"]+)"/g,
    (_m, nombre: string) => `{ dorsal: "${DORSALES[nombre]}", nombre: "${nombre}"`,
  );
  writeFileSync(ruta, src.slice(0, ini) + bloque + src.slice(fin));
}

// ── 2. Jugadores repartidos de nuevo ───────────────────────────────────────
const posicion = new Map(ROSTER_DEMO.map((j) => [j.nombre, j.posicion]));
const esPortero = (n: string) => posicion.get(n) === "PORTERO";
const conv = orig.config!.convocados;
const convPorteros = conv.filter(esPortero);
const convCampo = conv.filter((n) => !esPortero(n));
const destinoPorteros = baraja(ROSTER_DEMO.filter((j) => j.posicion === "PORTERO").map((j) => j.nombre));
const destinoCampo = baraja(ROSTER_DEMO.filter((j) => j.posicion === "CAMPO").map((j) => j.nombre));
const NOMBRE = new Map<string, string>();
convPorteros.forEach((n, i) => NOMBRE.set(n, destinoPorteros[i]));
convCampo.forEach((n, i) => NOMBRE.set(n, destinoCampo[i]));
const nom = (n: string | undefined) => (n ? NOMBRE.get(n) ?? n : n);

// ── 3. Los minutos, deformados (función creciente de [0,T] en [0,T]) ───────
// d(t) = A1·sen(πt/T) + A2·sen(2πt/T), con (A1+2·A2)·π/T < 1 → nunca cambia el orden.
type Deform = (t: number) => number;
function deformacion(Tp: number): { f: Deform; A1: number; A2: number } {
  const A1 = signo() * entre(120, 165);
  const A2 = signo() * entre(30, 60);
  return { f: (t) => t + A1 * Math.sin((Math.PI * t) / Tp) + A2 * Math.sin((2 * Math.PI * t) / Tp), A1, A2 };
}
// Se repite hasta que los goles que se quedan se mueven entre 1 y 3 minutos.
const golesOrig = orig.eventos.filter((e) => e.tipo === "gol");
const minuto = (e: { parte: ParteId; segundosParte: number }) => `${e.parte} ${Math.floor(e.segundosParte / 60)}`;
const MINUTOS_GOL_ORIG = new Set(golesOrig.map(minuto));
const GOLES_QUE_QUEDAN = { INTER: 2, RIVAL: 1 };
let DEF: Record<string, Deform> = {};
let quedan: Set<string> = new Set();
for (let intento = 0; ; intento++) {
  if (intento > 500) throw new Error("no encuentro una deformación que mueva bastante los goles");
  const d1 = deformacion(T["1T"]), d2 = deformacion(T["2T"]);
  DEF = { "1T": d1.f, "2T": d2.f };
  const mueve = (e: Evento) => Math.abs(DEF[e.parte](e.segundosParte) - e.segundosParte);
  const buenos = golesOrig.filter((g) => mueve(g) >= 70 && mueve(g) <= 180
    && !MINUTOS_GOL_ORIG.has(minuto({ parte: g.parte, segundosParte: DEF[g.parte](g.segundosParte) })));
  const inter = baraja(buenos.filter((g) => g.tipo === "gol" && g.equipo === "INTER")).slice(0, GOLES_QUE_QUEDAN.INTER);
  const rival = baraja(buenos.filter((g) => g.tipo === "gol" && g.equipo === "RIVAL")).slice(0, GOLES_QUE_QUEDAN.RIVAL);
  if (inter.length === GOLES_QUE_QUEDAN.INTER && rival.length === GOLES_QUE_QUEDAN.RIVAL) {
    quedan = new Set([...inter, ...rival].map((g) => g.id));
    break;
  }
}

// Eventos con el nombre cambiado y el minuto deformado (los ids y las horas, al final).
type Ev = Evento & { _orden: number };
const clonar = <X,>(x: X): X => JSON.parse(JSON.stringify(x));
let eventos: Ev[] = orig.eventos
  .map((e0, i) => {
    const e = clonar(e0) as Ev & Record<string, unknown>;
    e._orden = i;
    const s = Math.min(T[e.parte] - 0.5, Math.max(0.5, DEF[e.parte](e.segundosParte)));
    e.segundosParte = Math.round(s * 1000) / 1000;
    e.segundosPartido = e.segundosParte;
    for (const k of ["jugador", "goleador", "asistente", "portero", "tirador", "sale", "entra"]) {
      if (typeof e[k] === "string") e[k] = nom(e[k] as string);
    }
    if (Array.isArray(e.cuarteto)) e.cuarteto = (e.cuarteto as string[]).map((n) => nom(n)!);
    return e as Ev;
  });

// ── Quién está en pista en cada momento (desde la pista inicial + cambios) ─
const pistaInicial = (() => {
  const pi = orig.config!.pista_inicial;
  return [pi.portero, pi.pista1, pi.pista2, pi.pista3, pi.pista4].map((n) => nom(n)!);
})();
function ordenar(xs: Ev[]): Ev[] {
  return [...xs].sort((a, b) =>
    a.parte !== b.parte ? (a.parte === "1T" ? -1 : 1)
      : a.segundosParte !== b.segundosParte ? a.segundosParte - b.segundosParte
        : a._orden - b._orden);
}
function enPistaEn(parte: ParteId, seg: number): string[] {
  let pista = [...pistaInicial];
  for (const e of ordenar(eventos)) {
    if (e.parte === "2T" && parte === "1T") break;
    if (e.parte === parte && e.segundosParte >= seg) break;
    if (e.tipo !== "cambio") continue;
    if (e.entra === "") pista = pista.filter((n) => n !== e.sale);
    else if (e.sale === "") pista = [...pista, e.entra];
    else pista = pista.map((n) => (n === e.sale ? e.entra : n));
  }
  return pista;
}
const campoEnPista = (p: ParteId, s: number) => enPistaEn(p, s).filter((n) => !esPortero(n));
const porteroEnPista = (p: ParteId, s: number) => enPistaEn(p, s).find(esPortero) ?? "";
/** Un instante libre (sin otro evento en el mismo segundo) dentro de la parte. */
function instanteLibre(parte: ParteId, desde = 15, hasta = T[parte] - 15): number {
  for (;;) {
    const s = Math.round(entre(desde, hasta) * 1000) / 1000;
    if (!eventos.some((e) => e.parte === parte && Math.abs(e.segundosParte - s) < 2)) return s;
  }
}
let siguienteOrden = 10_000;
const nuevoOrden = () => siguienteOrden++;

// ── 4. El resultado: 5-3 ───────────────────────────────────────────────────
const GOL_INTER_ACCIONES = ["Ataque posicional", "Contraataque", "Robo zona alta", "Córner", "2ª jugada", "Banda", "1x1 banda"];
const GOL_RIVAL_ACCIONES = ["Contraataque", "Ataque posicional", "Córner", "Pérdida en salida de presión", "Falta"];
const ZONAS_PORTERIA = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"];
const ZONAS_REMATE = ["A2", "A4", "A5", "A5", "A4", "A8"];

// Los goles que no se quedan pasan a ser disparos a puerta (parados): el total
// de disparos a puerta no cambia por esto.
eventos = eventos.map((e) => {
  if (e.tipo !== "gol" || quedan.has(orig.eventos[e._orden].id)) return e;
  const base = { id: e.id, parte: e.parte, segundosParte: e.segundosParte, segundosPartido: e.segundosPartido,
    timestampReal: e.timestampReal, marcador: e.marcador, _orden: e._orden };
  if (e.equipo === "INTER") {
    return { ...base, tipo: "disparo", equipo: "INTER", jugador: e.goleador, resultado: "PUERTA",
      zonaCampo: e.zonaCampo, zonaPorteria: e.zonaPorteria } as Ev;
  }
  return { ...base, tipo: "disparo", equipo: "RIVAL", resultado: "PUERTA",
    portero: porteroEnPista(e.parte, e.segundosParte), zonaCampo: e.zonaCampo, zonaPorteria: e.zonaPorteria } as Ev;
});
/** Convierte n disparos a puerta (del equipo) en gol. */
function disparosAGol(equipo: "INTER" | "RIVAL", n: number) {
  const candidatos = baraja(eventos.filter((e) => e.tipo === "disparo" && e.equipo === equipo
    && e.resultado === "PUERTA" && e._orden < 10_000 && !orig.eventos.some((o) => o.tipo === "gol" && o.id === e.id)
    && !MINUTOS_GOL_ORIG.has(minuto(e))));
  for (const d of candidatos.slice(0, n)) {
    const i = eventos.indexOf(d);
    const base = { id: d.id, parte: d.parte, segundosParte: d.segundosParte, segundosPartido: d.segundosPartido,
      timestampReal: d.timestampReal, marcador: d.marcador, _orden: d._orden };
    const pista = enPistaEn(d.parte, d.segundosParte);
    if (equipo === "INTER" && d.tipo === "disparo") {
      const goleador = d.jugador!;
      const otros = pista.filter((x) => x !== goleador);
      const asistente = azar() < 0.6 ? elige(otros.filter((x) => !esPortero(x))) : undefined;
      eventos[i] = { ...base, tipo: "gol", equipo: "INTER", goleador, cuarteto: otros,
        accion: elige(GOL_INTER_ACCIONES), zonaCampo: d.zonaCampo ?? elige(ZONAS_REMATE),
        zonaPorteria: d.zonaPorteria ?? elige(ZONAS_PORTERIA),
        ...(asistente ? { asistente, zonaAsistencia: elige(["A7", "A8", "A9", "D8", "A6"]) } : {}) } as Ev;
    } else {
      eventos[i] = { ...base, tipo: "gol", equipo: "RIVAL", accion: elige(GOL_RIVAL_ACCIONES),
        zonaCampo: d.zonaCampo ?? elige(ZONAS_REMATE), zonaPorteria: d.zonaPorteria ?? elige(ZONAS_PORTERIA) } as unknown as Ev;
    }
  }
}
disparosAGol("INTER", RESULTADO.inter - GOLES_QUE_QUEDAN.INTER);
disparosAGol("RIVAL", RESULTADO.rival - GOLES_QUE_QUEDAN.RIVAL);

// ── 5. Más o menos disparos, pérdidas, robos y cortes (±15-25 %) ───────────
function objetivo(n: number): number {
  if (n <= 1) return n + 1;
  if (n <= 4) return n + signo();
  for (;;) {
    const m = Math.round(n * (1 + signo() * entre(0.15, 0.25)));
    if (m !== n) return m;
  }
}
function ajustar(filtro: (e: Ev) => boolean, crear: (parte: ParteId, s: number, molde: Ev | undefined) => Ev | null,
  metaFija?: number) {
  const grupo = eventos.filter(filtro);
  const meta = metaFija ?? objetivo(grupo.length);
  if (meta < grupo.length) {
    const fuera = new Set(baraja(grupo).slice(0, grupo.length - meta));
    eventos = eventos.filter((e) => !fuera.has(e));
  } else {
    let puestos = 0;
    while (puestos < meta - grupo.length) {
      const molde = elige(grupo);
      const parte = elige(PARTES);
      const s = instanteLibre(parte);
      const nuevo = crear(parte, s, molde);
      if (nuevo) { eventos.push(nuevo); puestos++; }
    }
  }
}
const base0 = (parte: ParteId, s: number) => ({
  id: "", parte, segundosParte: s, segundosPartido: s, timestampReal: 0,
  marcador: { inter: 0, rival: 0 }, _orden: nuevoOrden(),
});
// Disparos: el total de cada equipo (los nuevos copian el resultado y las zonas de uno de verdad).
// La meta es sobre TODOS los tiros del original (un gol también es un tiro a puerta).
const tirosOrig = (eq: "INTER" | "RIVAL") => orig.eventos.filter((e) => (e.tipo === "disparo" || e.tipo === "gol") && e.equipo === eq).length;
ajustar((e) => e.tipo === "disparo" && e.equipo === "INTER", (p, s, m) => {
  if (m?.tipo !== "disparo") return null;
  return { ...base0(p, s), tipo: "disparo", equipo: "INTER", jugador: elige(campoEnPista(p, s)), resultado: m.resultado,
    ...(m.zonaCampo ? { zonaCampo: m.zonaCampo } : {}), ...(m.zonaPorteria ? { zonaPorteria: m.zonaPorteria } : {}) } as Ev;
}, objetivo(tirosOrig("INTER")) - RESULTADO.inter);
ajustar((e) => e.tipo === "disparo" && e.equipo === "RIVAL", (p, s, m) => {
  if (m?.tipo !== "disparo") return null;
  return { ...base0(p, s), tipo: "disparo", equipo: "RIVAL", resultado: m.resultado, portero: porteroEnPista(p, s),
    ...(m.zonaCampo ? { zonaCampo: m.zonaCampo } : {}), ...(m.zonaPorteria ? { zonaPorteria: m.zonaPorteria } : {}) } as Ev;
}, objetivo(tirosOrig("RIVAL")) - RESULTADO.rival);
for (const acciones of [["pf", "pnf"], ["robos"], ["cortes"]] as const) {
  ajustar((e) => e.tipo === "accion_individual" && (acciones as readonly string[]).includes(e.accion), (p, s, m) => {
    if (m?.tipo !== "accion_individual") return null;
    const jugador = elige(campoEnPista(p, s));
    return { ...base0(p, s), tipo: "accion_individual", jugador, accion: m.accion,
      ...(m?.tipo === "accion_individual" && m.zonaCampo ? { zonaCampo: m!.zonaCampo } : {}) } as Ev;
  });
}

// ── 6. Faltas: INTER 6 (+ el 10 m del rival tras la 6.ª) y 5; RIVAL 4 y 4 ─
const faltas = (eq: "INTER" | "RIVAL", p: ParteId) =>
  ordenar(eventos.filter((e) => e.tipo === "falta" && e.equipo === eq && e.parte === p));
function nuevaFalta(eq: "INTER" | "RIVAL", p: ParteId, desde?: number, hasta?: number): Ev {
  const s = instanteLibre(p, desde, hasta);
  return { ...base0(p, s), tipo: "falta", equipo: eq, jugador: elige(campoEnPista(p, s)),
    zonaCampo: eq === "INTER" ? elige(["A7", "A8", "D5", "D4", "A5"]) : elige(["D4", "D9", "D5", "A5", "D8"]) } as Ev;
}
function dejarFaltas(eq: "INTER" | "RIVAL", p: ParteId, meta: number, antesDe?: number) {
  let fs = faltas(eq, p).filter((f) => antesDe === undefined || f.segundosParte < antesDe);
  // Se cambia al menos una (fuera una, dentro otra) para que no calque el reparto.
  if (fs.length > 0) {
    const fuera = elige(fs);
    eventos = eventos.filter((e) => e !== fuera);
    fs = fs.filter((f) => f !== fuera);
  }
  while (fs.length > meta) { const f = elige(fs); eventos = eventos.filter((e) => e !== f); fs = fs.filter((x) => x !== f); }
  while (fs.length < meta) { const f = nuevaFalta(eq, p, 15, antesDe ?? T[p] - 15); eventos.push(f); fs.push(f); }
}
{
  // INTER 1T: la 6.ª falta (la que trae el 10 m) se queda; las 5 de antes se rehacen.
  const sexta = faltas("INTER", "1T")[5];
  const diezm = eventos.find((e) => e.tipo === "diezm");
  if (!sexta || !diezm || diezm.segundosParte < sexta.segundosParte) throw new Error("esperaba la 6.ª falta con su 10 m en la 1.ª parte");
  dejarFaltas("INTER", "1T", 5, sexta.segundosParte);
  if (faltas("INTER", "1T").length !== 6) throw new Error("INTER 1T: no quedan 6 faltas");
  dejarFaltas("INTER", "2T", 5);
  dejarFaltas("RIVAL", "1T", 4);
  dejarFaltas("RIVAL", "2T", 4);
  // Un tiempo muerto nuestro en la 2.ª parte.
  const s = instanteLibre("2T", 500, 900);
  eventos.push({ ...base0("2T", s), tipo: "tiempo_muerto", equipo: "INTER" } as Ev);
}

// Quien hace algo tiene que estar en pista: el vídeo a veces apunta el cambio
// un instante tarde y, con los minutos movidos, se notaría. Se le da a otro.
eventos = eventos.map((e) => {
  if ((e.tipo === "accion_individual" || e.tipo === "falta" || (e.tipo === "disparo" && e.equipo === "INTER"))
    && e.jugador && !e.jugador.startsWith("#") && !enPistaEn(e.parte, e.segundosParte).includes(e.jugador)) {
    return { ...e, jugador: elige(campoEnPista(e.parte, e.segundosParte)) } as Ev;
  }
  if (e.tipo === "disparo" && e.equipo === "RIVAL" && e.portero) return { ...e, portero: porteroEnPista(e.parte, e.segundosParte) } as Ev;
  return e;
});

// ── 7. Horas e ids nuevos ──────────────────────────────────────────────────
// Saque a la hora de la cabecera (Madrid, CEST el 24/10). El reloj de pared
// corre más que el de partido (paradas): ×1,45 en la 1.ª y 15′ de descanso.
const SAQUE = Date.parse(`${FECHA}T${HORA}:00+02:00`) + entero(40, 160) * 1000;
const FACTOR_PARED = 1.45;
const finPared1T = SAQUE + T["1T"] * 1000 * FACTOR_PARED;
const SAQUE_2T = finPared1T + (15 * 60 + entero(0, 120)) * 1000;
const letras = "abcdefghijklmnopqrstuvwxyz0123456789";
const idNuevo = (ts: number) => Array.from({ length: 8 }, () => letras[Math.floor(azar() * 36)]).join("") + ts.toString(36);
let anterior = 0;
eventos = ordenar(eventos).map((e) => {
  const k = e.parte === "1T" ? SAQUE : SAQUE_2T;
  let ts = Math.round(k + e.segundosParte * 1000 * FACTOR_PARED + entero(0, 900));
  if (ts <= anterior + 400) ts = anterior + entero(400, 2500);
  anterior = ts;
  return { ...e, timestampReal: ts, id: idNuevo(ts) };
});
const FIN = anterior + entero(60, 240) * 1000;

// ── 8. Montar el partido y sacar los agregados de los eventos ──────────────
const cfg = clonar(orig.config!);
cfg.rival = RIVAL;
cfg.fecha = FECHA;
cfg.hora = HORA;
cfg.convocados = conv.map((n) => nom(n)!);
cfg.pista_inicial = { portero: pistaInicial[0], pista1: pistaInicial[1], pista2: pistaInicial[2],
  pista3: pistaInicial[3], pista4: pistaInicial[4] };
cfg.direccionInter1T = orig.config!.direccionInter1T === "der" ? "izq" : "der";

let partido: Partido = {
  ...clonar(orig),
  config: cfg,
  eventos: eventos.map(({ _orden, ...e }) => e as Evento),
  cronometro: { ...orig.cronometro, segundosParte: 0, ultimoStart: null,
    segundosGuardadosPorParte: { "1T": T["1T"], "2T": T["2T"], PR1: 0, PR2: 0 } },
  actualizado: FIN,
};
partido = reconstruirAgregados(partido, esPortero);
partido.tiempos = recomputarMinutos(partido);
partido.enPista = enPistaEn("2T", T["2T"] + 1);

if (partido.marcador.inter !== RESULTADO.inter || partido.marcador.rival !== RESULTADO.rival) {
  throw new Error(`el marcador salió ${partido.marcador.inter}-${partido.marcador.rival}`);
}
// Las claves en el orden del original (el JSON se lee igual).
const ordenado = Object.fromEntries(Object.keys(orig).map((k) => [k, (partido as unknown as Record<string, unknown>)[k]]));
writeFileSync(`${RAIZ}public/_demo_partido.json`, JSON.stringify(ordenado, null, 2) + "\n");

console.log(`Partido demo: ${cfg.fecha} ${cfg.hora} vs ${cfg.rival} → ${partido.marcador.inter}-${partido.marcador.rival}, ${partido.eventos.length} eventos.`);
console.log("Dorsales:", Object.entries(DORSALES).map(([n, d]) => `${n} ${d}`).join(", "));
