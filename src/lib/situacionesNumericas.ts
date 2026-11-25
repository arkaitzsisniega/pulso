/**
 * situacionesNumericas.ts — Los disparos de cada SITUACIÓN ESPECIAL (24/11/2026).
 *
 * Lo pidió Arkaitz el 24/11/2026: «cuando nosotros saquemos portero-jugador o
 * cuando hay una expulsión a favor o en contra, queremos saber el número de
 * disparos a favor y en contra de esa situación en especial». Y un botón para
 * marcar cuándo ELLOS sacan el portero-jugador, que se pueda activar y
 * desactivar (sus cambios no se registran, así que no hay otra forma).
 *
 * LAS CUATRO SITUACIONES — cada una es una lista de TRAMOS [desde, hasta] en
 * segundos ABSOLUTOS de partido (el 2T empieza donde acabó el 1T):
 *
 *   pj_nuestro        Nuestro portero-jugador: los ratos en que NO tenemos
 *                     portero en pista. Sale de los `cambio` (el portero se
 *                     sienta y entra uno de campo), así que es el tiempo
 *                     EFECTIVO: si el portero vuelve a entrar para defender,
 *                     ese rato no cuenta. Si el quinteto inicial no trae
 *                     portero, no se calcula (sería todo el partido).
 *   pj_rival          Su portero-jugador: de un `portero_jugador` RIVAL
 *                     «inicio» a su «fin». Un «inicio» sin «fin» se cierra al
 *                     acabar ESA parte: el portero-jugador no sobrevive al
 *                     descanso, y así un botón olvidado encendido no se come
 *                     la 2.ª parte entera. Es lo que marca el botón nuevo.
 *   expulsion_nuestra Nosotros con uno menos: cada roja nuestra (no la del
 *                     cuerpo técnico, «#CT») abre 2 minutos de juego, que se
 *                     cortan antes si el rival marca. Cada gol suyo libera la
 *                     expulsión MÁS ANTIGUA aún viva. Es la MISMA regla del
 *                     banner rojo de la pantalla del partido
 *                     (`calcularCronosActivos` en app/partido/page.tsx), para
 *                     que el informe diga lo mismo que vio el banquillo. Los
 *                     2 minutos siguen corriendo si cambia la parte.
 *   expulsion_rival   Ellos con uno menos: lo mismo con sus rojas y nuestros
 *                     goles (el banner verde).
 *
 * Pueden COINCIDIR (nuestro portero-jugador con un expulsado suyo): un disparo
 * en ese rato cuenta en las dos filas. Por eso hay una fila más, `resto`, con
 * lo que no cae en ninguna: las filas especiales + `resto` suman el total solo
 * si no hubo solapes, y el informe lo avisa cuando los hay.
 *
 * QUÉ ES UN DISPARO — exactamente lo que cuenta el informe en «Disparos»: los
 * `disparo` (sin los enlazados a un gol, que ya cuenta su gol), los `gol`, y
 * los penaltis / 10 m / FSB (el convertido sin gol enlazado es el gol). A
 * puerta = PUERTA, gol o lanzamiento parado.
 *
 * Partido viejo sin rojas, sin portero-jugador y sin marcar el suyo → `null`:
 * el informe no pinta nada, como antes.
 *
 * El club hace las mismas cuentas en `src/situaciones_partido.py` (repo del
 * club) para la hoja EST_SITUACIONES, el PDF y la web: si se toca una regla
 * aquí, se toca allí.
 *
 * Sin React ni Dexie:
 *   node --experimental-strip-types src/lib/situacionesNumericas.test.ts
 */
import type { Evento, ParteId, Partido } from "./db";
import { esLanzamiento } from "./lanzamientos";
import { offsetsDeParte, reconstruirPista } from "./informeCompleto";

export const SITUACIONES_ESPECIALES = [
  "pj_nuestro", "pj_rival", "expulsion_nuestra", "expulsion_rival",
] as const;
export type SituacionEspecial = typeof SITUACIONES_ESPECIALES[number];

/** Clave de i18n del nombre de cada fila (`resto` incluida). */
export const CLAVE_SITUACION: Record<SituacionEspecial | "resto", string> = {
  pj_nuestro: "sit_pj_nuestro", pj_rival: "sit_pj_rival",
  expulsion_nuestra: "sit_exp_nuestra", expulsion_rival: "sit_exp_rival",
  resto: "sit_resto",
};

/** Lo que dura la inferioridad por una expulsión (reglas de fútbol sala). */
export const SEG_EXPULSION = 120;

export interface Tramo { desde: number; hasta: number }

export interface Lado { disparos: number; aPuerta: number; goles: number }

export interface FilaSituacion {
  clave: SituacionEspecial | "resto";
  tramos: Tramo[];
  segundos: number;
  favor: Lado;
  contra: Lado;
}

export interface CuadroSituaciones {
  /** Solo las situaciones que se dieron (con tiempo o con algún disparo). */
  filas: FilaSituacion[];
  resto: FilaSituacion;
  /** Algún disparo cayó en dos situaciones a la vez. */
  haySolape: boolean;
  duracion: number;
}

const ORDEN: Record<string, number> = { "1T": 0, "2T": 1, PR1: 2, PR2: 3 };
const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function up(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

function finDeParte(p: Partido, parte: string): number {
  const d = n((p.config?.duracionParte as Record<string, number> | undefined)?.[parte]);
  if (d > 0) return d;
  let m = 0;
  for (const e of p.eventos ?? []) if (e.parte === parte) m = Math.max(m, n(e.segundosParte));
  return m;
}

/** Junta tramos que se tocan o se pisan y quita los de duración cero. */
export function unirTramos(ts: Tramo[]): Tramo[] {
  const orden = ts.filter((x) => x.hasta > x.desde + 1e-6)
    .slice().sort((a, b) => a.desde - b.desde);
  const out: Tramo[] = [];
  for (const x of orden) {
    const ult = out[out.length - 1];
    if (ult && x.desde <= ult.hasta + 1e-6) ult.hasta = Math.max(ult.hasta, x.hasta);
    else out.push({ ...x });
  }
  return out;
}

const dura = (ts: Tramo[]) => ts.reduce((s, x) => s + (x.hasta - x.desde), 0);
const dentro = (ts: Tramo[], t: number) =>
  ts.some((x) => x.desde - 1e-6 <= t && t <= x.hasta + 1e-6);

/** Las expulsiones de un equipo como tramos: 2 min o hasta gol del contrario
 *  (cada gol libera la más antigua aún viva). Misma regla que los banners. */
function tramosExpulsion(eventos: Evento[], equipo: "INTER" | "RIVAL",
                         abs: (e: Evento) => number, fin: number): Tramo[] {
  const rojas = eventos
    .filter((e) => e.tipo === "roja" && e.equipo === equipo && up(e.jugador) !== "#CT")
    .map((e) => ({ desde: abs(e), hasta: Math.min(abs(e) + SEG_EXPULSION, fin) }))
    .sort((a, b) => a.desde - b.desde);
  const otro = equipo === "INTER" ? "RIVAL" : "INTER";
  const goles = eventos
    .filter((e) => equipoDelGol(e) === otro).map(abs).sort((a, b) => a - b);
  for (const g of goles) {
    const viva = rojas.find((r) => r.desde < g && g < r.hasta);
    if (viva) viva.hasta = g;
  }
  return rojas;
}

function equipoDelGol(e: Evento): "INTER" | "RIVAL" | null {
  if (e.tipo === "gol") return e.equipo === "INTER" ? "INTER" : "RIVAL";
  if (esLanzamiento(e) && e.resultado === "GOL" && !e.golId) {
    return e.equipo === "INTER" ? "INTER" : "RIVAL";
  }
  return null;
}

/** Los tramos de las cuatro situaciones, en segundos absolutos de partido. */
export function tramosSituaciones(p: Partido, porteros: Set<string>):
  Record<SituacionEspecial, Tramo[]> {
  const eventos = (p.eventos ?? []) as Evento[];
  const off = offsetsDeParte(p);
  const abs = (e: { parte: string; segundosParte: number }) =>
    n(off[e.parte]) + n(e.segundosParte);
  const jugadas = PARTES.filter((pt) => eventos.some((e) => e.parte === pt));
  const ultima = jugadas[jugadas.length - 1] ?? "1T";
  const finPartido = n(off[ultima]) + finDeParte(p, ultima);

  // (a) Nuestro portero-jugador, tramo a tramo de pista.
  const pj: Tramo[] = [];
  const piPortero = up((p.config?.pista_inicial as unknown as Record<string, string>)?.portero);
  const P = new Set([...porteros].map(up));
  if (piPortero && P.has(piPortero)) {
    for (const s of reconstruirPista(p).segmentos) {
      const hayPortero = [...s.enPista].some((x) => P.has(up(x)));
      if (!hayPortero && s.enPista.size > 0) {
        pj.push({ desde: n(off[s.parte]) + s.ini, hasta: n(off[s.parte]) + s.fin });
      }
    }
  }

  // (b) Su portero-jugador: el botón. Se cierra, como tarde, al acabar la parte.
  const pjr: Tramo[] = [];
  let abierto: { parte: string; desde: number } | null = null;
  const marcas = eventos
    .filter((e): e is Extract<Evento, { tipo: "portero_jugador" }> =>
      e.tipo === "portero_jugador" && e.equipo === "RIVAL")
    .slice().sort((a, b) => (ORDEN[a.parte] - ORDEN[b.parte])
      || (n(a.segundosParte) - n(b.segundosParte)));
  const cerrar = (hasta: number) => {
    if (abierto) pjr.push({ desde: abierto.desde, hasta });
    abierto = null;
  };
  for (const m of marcas) {
    if (abierto && abierto.parte !== m.parte) {
      cerrar(n(off[abierto.parte]) + finDeParte(p, abierto.parte));
    }
    if (m.estado === "inicio" && !abierto) abierto = { parte: m.parte, desde: abs(m) };
    else if (m.estado === "fin" && abierto) cerrar(abs(m));
  }
  if (abierto) {
    const a = abierto as { parte: string; desde: number };
    cerrar(n(off[a.parte]) + finDeParte(p, a.parte));
  }

  return {
    pj_nuestro: unirTramos(pj),
    pj_rival: unirTramos(pjr),
    expulsion_nuestra: unirTramos(tramosExpulsion(eventos, "INTER", abs, finPartido)),
    expulsion_rival: unirTramos(tramosExpulsion(eventos, "RIVAL", abs, finPartido)),
  };
}

/** Un disparo para estas cuentas: equipo, momento, a puerta y si fue gol. */
export interface Tiro { equipo: "INTER" | "RIVAL"; t: number; aPuerta: boolean; gol: boolean }

export function tiros(p: Partido): Tiro[] {
  const off = offsetsDeParte(p);
  const out: Tiro[] = [];
  for (const ev of (p.eventos ?? []) as Evento[]) {
    const t = n(off[ev.parte]) + n(ev.segundosParte);
    let aPuerta: boolean | null = null;
    let gol = false;
    if (ev.tipo === "disparo") {
      if (ev.golId) continue;                         // ya lo cuenta su gol
      aPuerta = up(ev.resultado) === "PUERTA";
    } else if (ev.tipo === "gol") {
      aPuerta = true; gol = true;
    } else if (esLanzamiento(ev)) {
      if (ev.resultado === "GOL") {
        if (ev.golId) continue;
        aPuerta = true; gol = true;
      } else {
        aPuerta = ev.resultado === "PARADA";
      }
    }
    if (aPuerta === null) continue;
    const equipo = (ev as { equipo?: string }).equipo === "INTER" ? "INTER" : "RIVAL";
    out.push({ equipo, t, aPuerta, gol });
  }
  return out;
}

const ladoVacio = (): Lado => ({ disparos: 0, aPuerta: 0, goles: 0 });

/** El cuadro «Disparos por situación», o `null` si no se dio ninguna. */
export function disparosPorSituacion(p: Partido, porteros: Set<string>):
  CuadroSituaciones | null {
  if (!p?.config) return null;
  const tr = tramosSituaciones(p, porteros);
  const lista = tiros(p);
  const filas: FilaSituacion[] = SITUACIONES_ESPECIALES.map((clave) => ({
    clave, tramos: tr[clave], segundos: dura(tr[clave]),
    favor: ladoVacio(), contra: ladoVacio(),
  }));
  const off = offsetsDeParte(p);
  const eventos = p.eventos ?? [];
  const jugadas = PARTES.filter((pt) => eventos.some((e) => e.parte === pt));
  const ultima = jugadas[jugadas.length - 1] ?? "1T";
  const duracion = n(off[ultima]) + finDeParte(p, ultima);
  const resto: FilaSituacion = {
    clave: "resto", tramos: [],
    segundos: Math.max(0, duracion - dura(unirTramos(filas.flatMap((f) => f.tramos)))),
    favor: ladoVacio(), contra: ladoVacio(),
  };
  let haySolape = false;
  const sumar = (l: Lado, x: Tiro) => {
    l.disparos += 1;
    if (x.aPuerta) l.aPuerta += 1;
    if (x.gol) l.goles += 1;
  };
  for (const x of lista) {
    let cuantas = 0;
    for (const f of filas) {
      if (!dentro(f.tramos, x.t)) continue;
      cuantas += 1;
      sumar(x.equipo === "INTER" ? f.favor : f.contra, x);
    }
    if (cuantas === 0) sumar(x.equipo === "INTER" ? resto.favor : resto.contra, x);
    if (cuantas > 1) haySolape = true;
  }
  const dadas = filas.filter((f) => f.segundos > 0 || f.favor.disparos || f.contra.disparos);
  if (!dadas.length) return null;
  return { filas: dadas, resto, haySolape, duracion };
}

/** «3:05» para la columna de tiempo. */
export function minutosSituacion(seg: number): string {
  const s = Math.round(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** ¿Está ahora encendido el portero-jugador del rival? Mira solo la parte en
 *  curso, por la misma regla de arriba: no sobrevive al descanso. */
export function pjRivalActivo(eventos: Evento[], parte: ParteId):
  { desde: number } | null {
  let activo: { desde: number } | null = null;
  for (const e of eventos) {
    if (e.tipo !== "portero_jugador" || e.equipo !== "RIVAL" || e.parte !== parte) continue;
    activo = e.estado === "inicio" ? { desde: n(e.segundosParte) } : null;
  }
  return activo;
}
