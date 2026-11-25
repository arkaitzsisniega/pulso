/**
 * totalesJugador.ts — Los TOTALES AMPLIADOS de la temporada, jugador a jugador
 * (petición del entrenador, 25/11/2026: «disparos de todos los tipos, faltas,
 * +/- goles, valoraciones… todo lo posible. Media de minutos también»).
 *
 * Qué hace: coge los partidos que entran en Totales (los finalizados, sin el
 * directo que ya tiene su vídeo, y con el filtro de competiciones/partidos de
 * lib/filtroTotales.ts ya aplicado) y suma, por jugador, TODO lo que guarda el
 * crono de cada partido.
 *
 * DE DÓNDE SALE CADA NÚMERO — sin fórmulas nuevas:
 *   · Lo que ya enseña el informe de cada partido (minutos, goles,
 *     asistencias, disparos por resultado, robos, cortes, pérdidas F/NF,
 *     divididos, faltas, tarjetas, paradas, encajados, el ± y la VALORACIÓN)
 *     sale del MISMO informe que ve ese cliente al acabar el partido:
 *     `informe.ts` (Inter, filial, juvenil) o `informeCompleto.ts` (PULSO). Así
 *     la suma de la temporada es exactamente la suma de los informes.
 *   · Lo que el informe no da por jugador se cuenta aquí de los eventos:
 *       - titular: está en el quinteto inicial (`pista_inicial`);
 *       - faltas RECIBIDAS: faltas del rival con el jugador nuestro apuntado
 *         (es como lo guarda el crono; la misma cuenta que «FR» del informe
 *         completo);
 *       - penaltis, 10 m y FSB lanzados y metidos (por tirador) y, para el
 *         portero, los que le tiraron y paró;
 *       - disparos a favor y en contra CON ÉL EN PISTA (los mismos disparos
 *         que «Disparos por situación»: lib/situacionesNumericas.ts → tiros);
 *       - las situaciones especiales (nuestro portero-jugador, el suyo,
 *         nosotros con uno menos, ellos con uno menos): sus minutos en pista
 *         en cada una y los disparos y goles a favor y en contra en ese rato.
 *         Los tramos son los de lib/situacionesNumericas.ts.
 *   · Medias: «por partido» = entre los partidos que JUGÓ (PJ), no los que fue
 *     convocado; «por 40′» = el total × 40 minutos / sus minutos en pista. Por
 *     40′ no se calcula con menos de 2′ jugados (como el ritmo del informe): con
 *     30 segundos sale un disparate.
 *
 * Un partido en directo y en vídeo cuenta UNA vez (el de vídeo): lo garantiza
 * `partidosDeTotales`, que es la misma selección que usa lib/totales.ts.
 *
 * Sin React ni Dexie:
 *   node --experimental-strip-types src/lib/totalesJugador.test.ts
 */
import type { Partido } from "./db";
import { quitarDuplicadosVideo } from "./duplicadosVideo";
import { ordenarPartidos } from "./ordenPartidos";
import { construirInforme, valorar, type JugadorRoster } from "./informe";
import { construirInformeCompleto, offsetsDeParte, reconstruirPista } from "./informeCompleto";
import { esLanzamiento } from "./lanzamientos";
import {
  SITUACIONES_ESPECIALES, tiros, tramosSituaciones, unirTramos,
  type SituacionEspecial, type Tramo,
} from "./situacionesNumericas";

/** Acciones de equipo y tarjetas al cuerpo técnico: nunca son un convocado. */
const NO_SON_JUGADORES = new Set(["#EQUIPO", "#CT"]);

/** Menos de esto en pista y el «por 40′» no se da (MIN_PARA_RITMO del informe). */
export const MIN_SEG_POR40 = 120;
/** Portería a cero: solo si la defendió 20′ (la regla del bonus del informe). */
export const SEG_PORTERIA_CERO = 20 * 60;

/** Lo que se mira en cada situación especial, con el jugador EN PISTA. */
export interface EnSituacion {
  seg: number;
  /** Disparos a favor (todos), a puerta y goles. */
  df: number; dfPuerta: number; gf: number;
  /** Disparos en contra, a puerta y goles. */
  dc: number; dcPuerta: number; gc: number;
}

export interface FilaTemporada {
  nombre: string;
  dorsal: string;
  portero: boolean;
  convocado: number;
  jugados: number;
  titular: number;
  segundos: number;
  // Ataque
  goles: number; asistencias: number;
  aPuerta: number; fuera: number; palo: number; bloqueados: number;
  penL: number; penG: number; diezL: number; diezG: number; fsbL: number; fsbG: number;
  // Defensa
  robos: number; cortes: number; pf: number; pnf: number; bdg: number; bdp: number;
  // Disciplina
  faltas: number; faltasRecibidas: number; amarillas: number; rojas: number;
  // Con él en pista
  gfPista: number; gcPista: number;
  dfPista: number; dfPuertaPista: number; dcPista: number; dcPuertaPista: number;
  // Porteros
  paradas: number; golesEncajados: number; porteriasCero: number;
  lanzRecibidos: number; lanzParados: number;
  // Valoración (la del informe del cliente, partido a partido, sumada)
  valoracion: number; partidosValorados: number;
  /** Métricas que solo se apuntan revisando el vídeo (1x1, duelos…), sumadas. */
  video: Record<string, number>;
  sit: Record<SituacionEspecial, EnSituacion>;
}

export interface TotalesAmpliados {
  jugadores: FilaTemporada[];
  /** La fila del EQUIPO, con la misma forma para que cada columna sepa
   *  sacarse sola: minutos = lo que duraron los partidos, PJ = partidos, ± =
   *  goles a favor menos en contra, disparos en pista = todos los disparos. */
  equipo: FilaTemporada;
  partidos: number;
  /** ¿Hay algo de vídeo? Sin vídeo, esas columnas no se enseñan: un cero que
   *  en realidad es «nadie lo contó» engaña. */
  hayVideo: boolean;
  /** ¿Se dio alguna situación especial en algún partido? */
  haySituaciones: boolean;
}

export interface ContextoTotales {
  nombreCorto: string;
  nombreLargo?: string;
  roster: (JugadorRoster & { equipo?: string })[];
  /** true = el cliente usa el informe completo (PULSO); false = `informe.ts`. */
  completo: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function up(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

const enSitVacia = (): EnSituacion => ({ seg: 0, df: 0, dfPuerta: 0, gf: 0, dc: 0, dcPuerta: 0, gc: 0 });
function sitVacia(): Record<SituacionEspecial, EnSituacion> {
  return Object.fromEntries(SITUACIONES_ESPECIALES.map((s) => [s, enSitVacia()])) as Record<SituacionEspecial, EnSituacion>;
}

export function filaVacia(nombre: string, dorsal = "", portero = false): FilaTemporada {
  return {
    nombre, dorsal, portero, convocado: 0, jugados: 0, titular: 0, segundos: 0,
    goles: 0, asistencias: 0, aPuerta: 0, fuera: 0, palo: 0, bloqueados: 0,
    penL: 0, penG: 0, diezL: 0, diezG: 0, fsbL: 0, fsbG: 0,
    robos: 0, cortes: 0, pf: 0, pnf: 0, bdg: 0, bdp: 0,
    faltas: 0, faltasRecibidas: 0, amarillas: 0, rojas: 0,
    gfPista: 0, gcPista: 0, dfPista: 0, dfPuertaPista: 0, dcPista: 0, dcPuertaPista: 0,
    paradas: 0, golesEncajados: 0, porteriasCero: 0, lanzRecibidos: 0, lanzParados: 0,
    valoracion: 0, partidosValorados: 0, video: {}, sit: sitVacia(),
  };
}

/** Disparos totales de una fila (a puerta incluye los goles). */
export function disparos(f: FilaTemporada): number {
  return f.aPuerta + f.fuera + f.palo + f.bloqueados;
}

/** Los partidos que entran en Totales: finalizados, sin el duplicado de vídeo
 *  y con el filtro de la pantalla aplicado DESPUÉS (un partido sigue sin poder
 *  contar dos veces). Del más reciente al más antiguo. */
export function partidosDeTotales(todos: Partido[], incluir?: (p: Partido) => boolean): Partido[] {
  const dup = quitarDuplicadosVideo(todos.filter((p) => p.estado === "finalizado" && p.config));
  return ordenarPartidos(incluir ? dup.cuentan.filter(incluir) : dup.cuentan);
}

/** Segundos de `a` que caen dentro de `b` (los dos, listas de tramos). */
function solape(a: Tramo[], b: Tramo[]): number {
  let s = 0;
  for (const x of a) for (const y of b) {
    const d = Math.min(x.hasta, y.hasta) - Math.max(x.desde, y.desde);
    if (d > 0) s += d;
  }
  return s;
}
function dentro(ts: Tramo[], t: number): boolean {
  return ts.some((x) => t >= x.desde - 1e-6 && t < x.hasta + 1e-6);
}

/** Lo que dice el informe del cliente de cada jugador en ESTE partido. */
interface DelInforme {
  nombre: string; portero: boolean; segundos: number;
  goles: number; asistencias: number;
  aPuerta: number; fuera: number; palo: number; bloqueados: number;
  robos: number; cortes: number; pf: number; pnf: number; bdg: number; bdp: number;
  faltas: number; amarillas: number; rojas: number;
  gfPista: number; gcPista: number;
  paradas: number; golesEncajados: number;
  video: Record<string, number>;
  valoracion: number | null;
}

function delInforme(p: Partido, ctx: ContextoTotales): DelInforme[] {
  if (ctx.completo) {
    const inf = construirInformeCompleto(p, {
      nombreCorto: ctx.nombreCorto, nombreLargo: ctx.nombreLargo ?? ctx.nombreCorto,
      roster: ctx.roster.map((j) => ({ ...j, posicion: String(j.posicion) })),
    });
    if (!inf) return [];
    const val = new Map(inf.valoracion.map((v) => [up(v.nombre), v]));
    return inf.jugadores.map((f) => {
      const v = val.get(up(f.nombre));
      return {
        nombre: f.nombre, portero: f.portero, segundos: f.segTotal,
        goles: f.g, asistencias: f.a,
        aPuerta: f.dp, fuera: f.df, palo: f.dpalo, bloqueados: f.db,
        robos: f.robos, cortes: f.cortes, pf: f.pf, pnf: f.pnf, bdg: f.bdg, bdp: f.bdp,
        faltas: f.fc, amarillas: f.ta, rojas: f.tr,
        gfPista: v?.gf ?? 0, gcPista: v?.gc ?? 0,
        paradas: f.paradas, golesEncajados: f.golesEncajados,
        video: { ...f.video },
        valoracion: v && v.jugo ? v.val : null,
      };
    });
  }
  const inf = construirInforme(p, { nombreCorto: ctx.nombreCorto, roster: ctx.roster });
  if (!inf) return [];
  return [...inf.jugadores, ...inf.porteros].map((f) => ({
    nombre: f.nombre, portero: f.portero, segundos: f.segundos,
    goles: f.goles, asistencias: f.asistencias,
    aPuerta: f.aPuerta, fuera: f.fuera, palo: f.palo, bloqueados: f.bloqueados,
    robos: f.robos, cortes: f.cortes, pf: f.perdidasForzadas, pnf: f.perdidasNoForzadas,
    bdg: f.divididosGanados, bdp: f.divididosPerdidos,
    faltas: f.faltas, amarillas: f.amarillas, rojas: f.rojas,
    gfPista: f.gfPista, gcPista: f.gcPista,
    paradas: f.paradas, golesEncajados: f.golesEncajados,
    video: { ...(f.video as Record<string, number>) },
    valoracion: f.jugo ? valorar(f).puntos : null,
  }));
}

const SUMABLES: (keyof FilaTemporada)[] = [
  "goles", "asistencias", "aPuerta", "fuera", "palo", "bloqueados",
  "robos", "cortes", "pf", "pnf", "bdg", "bdp", "faltas", "amarillas", "rojas",
  "gfPista", "gcPista", "paradas", "golesEncajados",
];

/** La suma de la temporada. `partidos` ya filtrados (ver partidosDeTotales). */
export function calcularTotalesAmpliados(partidos: Partido[], ctx: ContextoTotales): TotalesAmpliados {
  const dorsal = new Map(ctx.roster.map((j) => [up(j.nombre), j.dorsal]));
  const esPorteroRoster = new Set(ctx.roster.filter((j) => j.posicion === "PORTERO").map((j) => up(j.nombre)));
  const filas = new Map<string, FilaTemporada>();
  const dame = (nombre: string): FilaTemporada => {
    const k = up(nombre);
    let f = filas.get(k);
    if (!f) {
      f = filaVacia(nombre, dorsal.get(k) ?? "", esPorteroRoster.has(k));
      filas.set(k, f);
    }
    return f;
  };
  const eq = filaVacia("");
  let haySituaciones = false;

  for (const p of partidos) {
    const cfg = p.config;
    if (!cfg) continue;
    eq.convocado += 1;
    eq.jugados += 1;
    eq.titular += 1;

    // ── Lo del informe ─────────────────────────────────────────────────────
    const deInf = delInforme(p, ctx);
    const convocados = new Set((cfg.convocados ?? []).filter((x) => !NO_SON_JUGADORES.has(x)).map(up));
    for (const d of deInf) {
      if (NO_SON_JUGADORES.has(d.nombre)) continue;
      const f = dame(d.nombre);
      if (d.portero) f.portero = true;
      if (convocados.has(up(d.nombre))) f.convocado += 1;
      f.segundos += d.segundos;
      if (d.segundos > 0) f.jugados += 1;
      for (const k of SUMABLES) (f[k] as number) += n(d[k as keyof DelInforme]);
      for (const [k, v] of Object.entries(d.video)) f.video[k] = (f.video[k] ?? 0) + n(v);
      if (d.valoracion !== null) {
        f.valoracion = Math.round((f.valoracion + d.valoracion) * 10) / 10;
        f.partidosValorados += 1;
      }
      if (d.portero && d.segundos >= SEG_PORTERIA_CERO && d.golesEncajados === 0) f.porteriasCero += 1;
      // Equipo: lo que es suma de jugadores (disparos, robos, faltas…).
      for (const k of SUMABLES) {
        if (k === "gfPista" || k === "gcPista") continue;
        (eq[k] as number) += n(d[k as keyof DelInforme]);
      }
      for (const [k, v] of Object.entries(d.video)) eq.video[k] = (eq.video[k] ?? 0) + n(v);
    }
    const gf = n(p.marcador?.inter);
    const gc = n(p.marcador?.rival);
    eq.gfPista += gf;
    eq.gcPista += gc;

    // ── Titulares ──────────────────────────────────────────────────────────
    const pi = (cfg.pista_inicial ?? {}) as unknown as Record<string, string>;
    for (const k of ["portero", "pista1", "pista2", "pista3", "pista4"]) {
      const quien = String(pi[k] ?? "").trim();
      if (quien && !NO_SON_JUGADORES.has(quien)) dame(quien).titular += 1;
    }

    // ── Eventos: faltas recibidas y lanzamientos ──────────────────────────
    for (const ev of p.eventos ?? []) {
      if (ev.tipo === "falta" && ev.equipo === "RIVAL") {
        const quien = String(ev.jugador ?? "").trim();
        if (quien && !NO_SON_JUGADORES.has(quien)) dame(quien).faltasRecibidas += 1;
        eq.faltasRecibidas += 1;
      } else if (esLanzamiento(ev)) {
        const gol = ev.resultado === "GOL";
        if (ev.equipo === "INTER") {
          const quien = String(ev.tirador ?? "").trim();
          const fs = [eq];
          if (quien && !NO_SON_JUGADORES.has(quien)) fs.push(dame(quien));
          for (const f of fs) {
            if (ev.tipo === "penalti") { f.penL += 1; if (gol) f.penG += 1; }
            else if (ev.tipo === "diezm") { f.diezL += 1; if (gol) f.diezG += 1; }
            else if (ev.tipo === "fsb") { f.fsbL += 1; if (gol) f.fsbG += 1; }
          }
        } else {
          const quien = String(ev.portero ?? "").trim();
          const fs = [eq];
          if (quien && !NO_SON_JUGADORES.has(quien)) fs.push(dame(quien));
          for (const f of fs) {
            f.lanzRecibidos += 1;
            if (ev.resultado === "PARADA") f.lanzParados += 1;
          }
        }
      }
    }
    if (gc === 0) eq.porteriasCero += 1;

    // ── Quién está en pista y cuándo (segundos absolutos de partido) ──────
    const off = offsetsDeParte(p);
    const rec = reconstruirPista(p);
    const segs = rec.segmentos.map((s) => ({
      desde: n(off[s.parte]) + s.ini, hasta: n(off[s.parte]) + s.fin, enPista: s.enPista,
    }));
    const duracion = segs.length ? Math.max(...segs.map((s) => s.hasta)) : 0;
    eq.segundos += duracion;
    const tramosDe = new Map<string, Tramo[]>();
    for (const [parte, porNombre] of Object.entries(rec.intervalos)) {
      for (const [nom, ivs] of Object.entries(porNombre)) {
        const l = tramosDe.get(nom) ?? [];
        for (const [a, b] of ivs) l.push({ desde: n(off[parte]) + a, hasta: n(off[parte]) + b });
        tramosDe.set(nom, l);
      }
    }
    const enPistaEn = (t: number): Set<string> => {
      for (const s of segs) if (t >= s.desde - 1e-6 && t < s.hasta + 1e-6) return s.enPista;
      return new Set();
    };

    // ── Disparos con él en pista ──────────────────────────────────────────
    const porteros = new Set([...esPorteroRoster, ...deInf.filter((d) => d.portero).map((d) => up(d.nombre))]);
    const sits = tramosSituaciones(p, porteros);
    const lista = tiros(p);
    for (const x of lista) {
      const nuestro = x.equipo === "INTER";
      const quienes = [...enPistaEn(x.t)].filter((q) => !NO_SON_JUGADORES.has(q)).map(dame);
      for (const f of [...quienes, eq]) {
        if (nuestro) { f.dfPista += 1; if (x.aPuerta) f.dfPuertaPista += 1; }
        else { f.dcPista += 1; if (x.aPuerta) f.dcPuertaPista += 1; }
      }
      for (const s of SITUACIONES_ESPECIALES) {
        if (!dentro(sits[s], x.t)) continue;
        for (const f of [...quienes, eq]) {
          const e = f.sit[s];
          if (nuestro) { e.df += 1; if (x.aPuerta) e.dfPuerta += 1; if (x.gol) e.gf += 1; }
          else { e.dc += 1; if (x.aPuerta) e.dcPuerta += 1; if (x.gol) e.gc += 1; }
        }
      }
    }

    // ── Minutos en cada situación ─────────────────────────────────────────
    for (const s of SITUACIONES_ESPECIALES) {
      const ts = sits[s];
      if (!ts.length) continue;
      haySituaciones = true;
      eq.sit[s].seg += ts.reduce((a, x) => a + (x.hasta - x.desde), 0);
      for (const [nom, suyos] of tramosDe) {
        if (NO_SON_JUGADORES.has(nom)) continue;
        const seg = solape(unirTramos(suyos), ts);
        if (seg > 0) dame(nom).sit[s].seg += seg;
      }
    }
    if (!haySituaciones && SITUACIONES_ESPECIALES.some((s) => eq.sit[s].df + eq.sit[s].dc > 0)) haySituaciones = true;
  }

  // El portero de la fila del equipo: paradas y encajados ya sumados arriba.
  eq.partidosValorados = 0;
  eq.valoracion = 0;
  const jugadores = [...filas.values()]
    .filter((f) => f.convocado > 0 || f.segundos > 0)
    .sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre));
  const hayVideo = Object.values(eq.video).some((v) => v > 0);
  return { jugadores, equipo: eq, partidos: eq.jugados, hayVideo, haySituaciones };
}

// ──────────────────────────────────────────────────────────────────────────
// Medias
// ──────────────────────────────────────────────────────────────────────────
export type ModoValor = "total" | "partido" | "p40";

/** Un total pasado a «por partido jugado» o «por 40′». `null` = no se puede
 *  (no jugó, o jugó menos de 2′ para el por 40′). */
export function normalizar(valor: number, f: Pick<FilaTemporada, "jugados" | "segundos">, modo: ModoValor): number | null {
  if (modo === "total") return valor;
  if (modo === "partido") return f.jugados > 0 ? valor / f.jugados : null;
  return f.segundos >= MIN_SEG_POR40 ? (valor * 2400) / f.segundos : null;
}

/** Minutos de media por partido jugado. */
export function mediaMinutos(f: Pick<FilaTemporada, "jugados" | "segundos">): number | null {
  return f.jugados > 0 ? f.segundos / 60 / f.jugados : null;
}

/** Valoración media por partido valorado (la nota del informe, de media). */
export function valoracionMedia(f: Pick<FilaTemporada, "valoracion" | "partidosValorados">): number | null {
  return f.partidosValorados > 0 ? f.valoracion / f.partidosValorados : null;
}

/** % con dos decimales de precisión interna; `null` sin denominador. */
export function pct(a: number, b: number): number | null {
  return b > 0 ? (a / b) * 100 : null;
}
