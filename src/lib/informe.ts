"use client";

/**
 * informe.ts — Todo lo que se puede sacar de un partido, sin salir del iPad.
 *
 * Por qué existe (31/8/2026): el informe que generaba el crono tenía cinco
 * bloques —goles, faltas, disparos, minutos y porteros— mientras que el informe
 * del sistema del club tiene dieciséis. Arkaitz lo vio de golpe al preparar el
 * material de venta: *"lo veo sencillo y hasta cutre comparado con el que
 * sacamos nosotros"*. Y tenía razón, pero no por un límite del crono: los datos
 * están TODOS en el aparato, solo que nadie los había sacado.
 *
 * De las dieciséis secciones del informe del club, aquí se pueden hacer trece.
 * Las tres que no: la carga física del GPS, los clips de vídeo de los goles y
 * la valoración del partido — esas necesitan el Sheet y el pipeline de Python.
 *
 * Este fichero solo CALCULA. La maquetación vive en `app/informe/page.tsx`, y
 * así lo de aquí se puede comprobar con partidos de mentira, sin navegador.
 */
import type {
  ContadoresJugador,
  Evento,
  Partido,
  ParteId,
} from "./db";

// Solo TIPOS de ./db, y el roster entra por parámetro: así este módulo se
// puede probar con `node --experimental-strip-types` sin arrastrar Dexie ni la
// configuración del cliente. Es el mismo criterio que sigue reconstruir.ts.
export const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];

/** Espejo de JUGADOR_EQUIPO de db.ts: acciones del equipo y tarjetas al cuerpo
 *  técnico. Nunca son un convocado real, así que no salen en las tablas. */
const NO_SON_JUGADORES = new Set(["#EQUIPO", "#CT"]);

/** Lo único que hace falta del roster para el informe. */
export interface JugadorRoster {
  nombre: string;
  dorsal: string;
  posicion: string;
}

export interface ContextoInforme {
  nombreCorto: string;
  roster: JugadorRoster[];
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos de salida
// ──────────────────────────────────────────────────────────────────────────
export interface GolInforme {
  minuto: string;            // "12:34"
  parte: ParteId;
  nuestro: boolean;
  goleador: string;
  asistente?: string;
  accion?: string;           // la jugada: "Robo zona alta", "Banda"…
  zonaCampo?: string;
  zonaPorteria?: string;
  /** Los cinco que estaban en pista cuando cayó. */
  quinteto: string[];
  marcador: string;          // "2-1" tras el gol
}

export interface FilaJugador {
  nombre: string;
  dorsal: string;
  portero: boolean;
  segundos: number;
  jugo: boolean;
  goles: number;
  asistencias: number;
  aPuerta: number;
  fuera: number;
  palo: number;
  bloqueados: number;
  disparos: number;
  robos: number;
  cortes: number;
  perdidas: number;
  divididosGanados: number;
  divididosPerdidos: number;
  amarillas: number;
  rojas: number;
  faltas: number;
  /** Goles a favor y en contra con él en pista. */
  gfPista: number;
  gcPista: number;
  masMenos: number;
  /** Solo porteros. */
  paradas: number;
  golesEncajados: number;
  pctParada: number | null;
  /** Métricas de vídeo, tal cual, para las tablas de vídeo. */
  video: Partial<ContadoresJugador>;
}

export interface TramoPista {
  desde: number;             // segundos absolutos de partido
  hasta: number;
  enPista: string[];         // los cinco
}

export interface FilaQuinteto {
  jugadores: string[];
  segundos: number;
  gf: number;
  gc: number;
  masMenos: number;
  veces: number;             // cuántas veces salió ese quinteto
}

export interface EquipoStats {
  goles: number;
  disparos: number;
  aPuerta: number;
  fuera: number;
  palo: number;
  bloqueados: number;
  faltas: number;
  amarillas: number;
  rojas: number;
  tiemposMuerto: number;
  /** Solo nuestro: salen de los contadores individuales. */
  robos?: number;
  cortes?: number;
  perdidas?: number;
  divididosGanados?: number;
  divididosPerdidos?: number;
}

export interface Informe {
  cabecera: {
    nosotros: string;
    rival: string;
    gf: number;
    gc: number;
    fecha: string;
    hora?: string;
    competicion?: string;
    lugar?: string;
    local: boolean;
    modo: string;            // "directo" | "video"
    partidoId?: string;
    partesJugadas: ParteId[];
    duracionTotal: number;   // segundos
  };
  goles: GolInforme[];
  golesPorJugada: { jugada: string; nuestros: number; rival: number }[];
  nosotros: EquipoStats;
  rival: EquipoStats;
  jugadores: FilaJugador[];   // campo, ordenados por minutos
  porteros: FilaJugador[];
  tramos: TramoPista[];
  quintetos: FilaQuinteto[];
  zonasCampo: Record<string, number>;
  zonasPorteria: Record<string, number>;
  zonasCampoRival: Record<string, number>;
  zonasPorteriaRival: Record<string, number>;
  penaltis: {
    minuto: string; parte: ParteId; nuestro: boolean;
    tipo: string; tirador?: string; resultado: string;
  }[];
  tiemposMuerto: { minuto: string; parte: ParteId; nuestro: boolean }[];
  tarjetas: { minuto: string; parte: ParteId; nuestro: boolean;
              jugador?: string; roja: boolean }[];
  /** ¿Se revisó con vídeo? Si no, las métricas de vídeo van todas a cero y NO
   *  hay que enseñarlas: un cero que en realidad es "nadie lo contó" miente. */
  hayVideo: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────────────
export function mmss(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Segundos ABSOLUTOS de partido de un evento.
 *
 *  No se usa `segundosPartido` del propio evento: en los partidos rehechos con
 *  vídeo se reinicia por parte y los eventos de la segunda quedaban ANTES que
 *  los de la primera al ordenar. Se recalcula sumando lo que duró cada parte
 *  anterior, que es un dato del cronómetro y no del evento. */
function absoluto(ev: Evento, iniciosParte: Record<string, number>): number {
  return (iniciosParte[ev.parte] ?? 0) + n((ev as { segundosParte?: number }).segundosParte);
}

function iniciosDeParte(p: Partido): Record<string, number> {
  const dur = p.cronometro?.segundosGuardadosPorParte ?? {};
  const cron = p.cronometro as { parteActual?: string; segundosParte?: number } | undefined;
  const out: Record<string, number> = {};
  let acumulado = 0;
  for (const parte of PARTES) {
    out[parte] = acumulado;
    let d = n((dur as Record<string, number>)[parte]);
    // La parte en curso (partido exportado sin cerrar) aún no está guardada.
    if (!d && cron?.parteActual === parte) d = n(cron.segundosParte);
    acumulado += d;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Quién está en pista en cada momento
// ──────────────────────────────────────────────────────────────────────────
/** Reconstruye los tramos de pista a partir del quinteto inicial y los cambios.
 *
 *  Los minutos totales ya los lleva el crono en `tiempos`, pero para el
 *  cronograma y para el rendimiento por quinteto hace falta saber QUIÉN estaba
 *  y CUÁNDO, y eso solo se puede reconstruir desde los cambios. */
export function tramosDePista(p: Partido): TramoPista[] {
  const cfg = p.config;
  if (!cfg) return [];
  const inicial = cfg.pista_inicial ?? {};
  const enPista = new Set<string>(
    (["portero", "pista1", "pista2", "pista3", "pista4"] as const)
      .map((k) => (inicial as Record<string, string>)[k])
      .filter(Boolean)
  );
  if (enPista.size === 0) return [];

  const inicios = iniciosDeParte(p);
  // El final del partido lo da duracionTotal y nada más. Sumar el arranque de
  // la última parte más lo que duró la 2ª daba 3.600 en un partido de 2.400
  // (el arranque de PR2 ya lleva dentro las dos partes): los minutos por
  // quinteto salían inflados un 50 %.
  const total = duracionTotal(p);

  const cambios = (p.eventos ?? [])
    .filter((e) => e.tipo === "cambio")
    .map((e) => ({ t: absoluto(e, inicios), ...(e as unknown as { sale: string; entra: string }) }))
    .sort((a, b) => a.t - b.t);

  const tramos: TramoPista[] = [];
  let desde = 0;
  for (const c of cambios) {
    if (c.t > desde) {
      tramos.push({ desde, hasta: c.t, enPista: [...enPista] });
    }
    if (c.sale) enPista.delete(c.sale);
    if (c.entra) enPista.add(c.entra);
    desde = c.t;
  }
  const cierre = Math.max(total, desde);
  if (cierre > desde) tramos.push({ desde, hasta: cierre, enPista: [...enPista] });
  return tramos;
}

export function duracionTotal(p: Partido): number {
  const inicios = iniciosDeParte(p);
  const dur = (p.cronometro?.segundosGuardadosPorParte ?? {}) as Record<string, number>;
  const cron = p.cronometro as { parteActual?: string; segundosParte?: number } | undefined;
  let ultimo = 0;
  for (const parte of PARTES) {
    let d = n(dur[parte]);
    if (!d && cron?.parteActual === parte) d = n(cron.segundosParte);
    if (d) ultimo = (inicios[parte] ?? 0) + d;
  }
  return ultimo;
}

/** Quiénes estaban en pista en un instante dado. */
function enPistaEn(tramos: TramoPista[], t: number): string[] {
  for (const tr of tramos) {
    if (t >= tr.desde && t < tr.hasta) return tr.enPista;
  }
  return tramos.length ? tramos[tramos.length - 1].enPista : [];
}

// ──────────────────────────────────────────────────────────────────────────
// El informe entero
// ──────────────────────────────────────────────────────────────────────────
export function construirInforme(p: Partido, ctx: ContextoInforme): Informe | null {
  const cfg = p.config;
  if (!cfg) return null;
  const { nombreCorto, roster } = ctx;

  const inicios = iniciosDeParte(p);
  const evs = (p.eventos ?? []) as Evento[];
  const conT = evs
    .map((e) => ({ ev: e, t: absoluto(e, inicios) }))
    .sort((a, b) => a.t - b.t);
  const tramos = tramosDePista(p);
  const dorsal = new Map(roster.map((j) => [j.nombre, j.dorsal]));
  const esPortero = new Set(
    roster.filter((j) => j.posicion === "PORTERO").map((j) => j.nombre));

  const partesJugadas = PARTES.filter(
    (parte) => n((cfg.duracionParte as Record<string, number> | undefined)?.[parte]) > 0
  );

  // ── Goles ──────────────────────────────────────────────────────────────
  const goles: GolInforme[] = [];
  let gfAcum = 0, gcAcum = 0;
  for (const { ev, t } of conT) {
    if (ev.tipo !== "gol") continue;
    const e = ev as unknown as Record<string, unknown>;
    const nuestro = String(e.equipo) === "INTER";
    if (nuestro) gfAcum += 1; else gcAcum += 1;
    goles.push({
      minuto: mmss(n(e.segundosParte)),
      parte: ev.parte,
      nuestro,
      goleador: String(e.goleador ?? "").trim(),
      asistente: String(e.asistente ?? "").trim() || undefined,
      accion: String(e.accion ?? "").trim() || undefined,
      zonaCampo: (e.zonaCampo as string) || undefined,
      zonaPorteria: (e.zonaPorteria as string) || undefined,
      quinteto: (e.cuarteto as string[])?.length
        ? (e.cuarteto as string[])
        : enPistaEn(tramos, t),
      marcador: `${gfAcum}-${gcAcum}`,
    });
  }

  // ── Goles por tipo de jugada ───────────────────────────────────────────
  const jugadas = new Map<string, { nuestros: number; rival: number }>();
  for (const g of goles) {
    const clave = g.accion || "—";
    const c = jugadas.get(clave) ?? { nuestros: 0, rival: 0 };
    if (g.nuestro) c.nuestros += 1; else c.rival += 1;
    jugadas.set(clave, c);
  }
  const golesPorJugada = [...jugadas.entries()]
    .map(([jugada, c]) => ({ jugada, ...c }))
    .sort((a, b) => (b.nuestros + b.rival) - (a.nuestros + a.rival));

  // ── Jugadores ──────────────────────────────────────────────────────────
  const cont = (p.acciones?.porJugador ?? {}) as Record<string, ContadoresJugador>;
  const convocados = (cfg.convocados ?? []).filter((x) => !NO_SON_JUGADORES.has(x));

  // Goles a favor / en contra con cada uno en pista (el ±)
  const gfPista = new Map<string, number>();
  const gcPista = new Map<string, number>();
  for (const { ev, t } of conT) {
    if (ev.tipo !== "gol") continue;
    const nuestro = String((ev as unknown as Record<string, unknown>).equipo) === "INTER";
    for (const j of enPistaEn(tramos, t)) {
      const m = nuestro ? gfPista : gcPista;
      m.set(j, (m.get(j) ?? 0) + 1);
    }
  }

  const golesPorJugador = new Map<string, number>();
  const asistPorJugador = new Map<string, number>();
  for (const g of goles) {
    if (!g.nuestro) continue;
    if (g.goleador && !NO_SON_JUGADORES.has(g.goleador)) {
      golesPorJugador.set(g.goleador, (golesPorJugador.get(g.goleador) ?? 0) + 1);
    }
    if (g.asistente && !NO_SON_JUGADORES.has(g.asistente)) {
      asistPorJugador.set(g.asistente, (asistPorJugador.get(g.asistente) ?? 0) + 1);
    }
  }

  const tarjetasPorJugador = new Map<string, { a: number; r: number }>();
  const faltasPorJugador = new Map<string, number>();
  for (const { ev } of conT) {
    const e = ev as unknown as Record<string, unknown>;
    if (String(e.equipo) !== "INTER") continue;
    const quien = String(e.jugador ?? "").trim();
    if (!quien || NO_SON_JUGADORES.has(quien)) continue;
    if (ev.tipo === "amarilla" || ev.tipo === "roja") {
      const c = tarjetasPorJugador.get(quien) ?? { a: 0, r: 0 };
      if (ev.tipo === "amarilla") c.a += 1; else c.r += 1;
      tarjetasPorJugador.set(quien, c);
    } else if (ev.tipo === "falta") {
      faltasPorJugador.set(quien, (faltasPorJugador.get(quien) ?? 0) + 1);
    }
  }

  const CLAVES_VIDEO: (keyof ContadoresJugador)[] = [
    "duelC_g", "duelC_p", "duelP_g", "duelP_p", "unoAtq_g", "unoAtq_p",
    "unoDef_g", "unoDef_p", "ultCob", "corteConex", "conexPivot", "recibePivot",
    "saqueB", "saqueM", "achique", "cobBR", "cobBN", "cobMR", "cobMN",
    "paseB", "paseM",
  ];

  const filas: FilaJugador[] = convocados.map((nombre) => {
    const c = (cont[nombre] ?? {}) as ContadoresJugador;
    const seg = n(p.tiempos?.[nombre]?.totalSegundos);
    const tj = tarjetasPorJugador.get(nombre) ?? { a: 0, r: 0 };
    const tiros = n(c.paradas) + n(c.golesEncajados);
    const video: Partial<ContadoresJugador> = {};
    for (const k of CLAVES_VIDEO) {
      const v = n(c[k] as number);
      if (v) (video as Record<string, number>)[k] = v;
    }
    return {
      nombre,
      dorsal: dorsal.get(nombre) ?? "",
      portero: esPortero.has(nombre),
      segundos: seg,
      jugo: seg > 0,
      goles: golesPorJugador.get(nombre) ?? 0,
      asistencias: asistPorJugador.get(nombre) ?? 0,
      aPuerta: n(c.dpp), fuera: n(c.dpf), palo: n(c.dpa), bloqueados: n(c.dpb),
      disparos: n(c.dpp) + n(c.dpf) + n(c.dpa) + n(c.dpb),
      robos: n(c.robos), cortes: n(c.cortes),
      perdidas: n(c.pf) + n(c.pnf),
      divididosGanados: n(c.bdg), divididosPerdidos: n(c.bdp),
      amarillas: tj.a, rojas: tj.r,
      faltas: faltasPorJugador.get(nombre) ?? 0,
      gfPista: gfPista.get(nombre) ?? 0,
      gcPista: gcPista.get(nombre) ?? 0,
      masMenos: (gfPista.get(nombre) ?? 0) - (gcPista.get(nombre) ?? 0),
      paradas: n(c.paradas), golesEncajados: n(c.golesEncajados),
      pctParada: tiros ? Math.round((n(c.paradas) / tiros) * 100) : null,
      video,
    };
  });
  filas.sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre));

  // ── Estadísticas de equipo ─────────────────────────────────────────────
  const suma = (f: (x: FilaJugador) => number) => filas.reduce((a, x) => a + f(x), 0);
  const stats = p.stats ?? { faltas: {}, amarillas: {}, tiemposMuerto: {} };
  const porParte = (clave: "faltas" | "amarillas" | "tiemposMuerto", lado: "inter" | "rival") =>
    PARTES.reduce((a, parte) => a + n(
      ((stats as Record<string, Record<string, Record<string, number>>>)[clave]?.[parte])?.[lado]
    ), 0);

  const dr = p.disparosRival ?? { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 };
  const gf = n(p.marcador?.inter);
  const gc = n(p.marcador?.rival);

  const nosotrosStats: EquipoStats = {
    goles: gf,
    aPuerta: suma((x) => x.aPuerta), fuera: suma((x) => x.fuera),
    palo: suma((x) => x.palo), bloqueados: suma((x) => x.bloqueados),
    disparos: suma((x) => x.disparos),
    faltas: porParte("faltas", "inter"),
    amarillas: porParte("amarillas", "inter"),
    rojas: filas.reduce((a, x) => a + x.rojas, 0),
    tiemposMuerto: porParte("tiemposMuerto", "inter"),
    robos: suma((x) => x.robos), cortes: suma((x) => x.cortes),
    perdidas: suma((x) => x.perdidas),
    divididosGanados: suma((x) => x.divididosGanados),
    divididosPerdidos: suma((x) => x.divididosPerdidos),
  };
  const rivalStats: EquipoStats = {
    goles: gc,
    aPuerta: n(dr.puerta), fuera: n(dr.fuera),
    palo: n(dr.palo), bloqueados: n(dr.bloqueado),
    disparos: n(dr.puerta) + n(dr.fuera) + n(dr.palo) + n(dr.bloqueado),
    faltas: porParte("faltas", "rival"),
    amarillas: porParte("amarillas", "rival"),
    rojas: conT.filter(({ ev }) => ev.tipo === "roja"
      && String((ev as unknown as Record<string, unknown>).equipo) === "RIVAL").length,
    tiemposMuerto: porParte("tiemposMuerto", "rival"),
  };

  // ── Quintetos ──────────────────────────────────────────────────────────
  const porQuinteto = new Map<string, FilaQuinteto>();
  for (const tr of tramos) {
    const jug = [...tr.enPista].sort();
    const clave = jug.join("|");
    const dur = Math.max(0, tr.hasta - tr.desde);
    const q = porQuinteto.get(clave)
      ?? { jugadores: jug, segundos: 0, gf: 0, gc: 0, masMenos: 0, veces: 0 };
    q.segundos += dur;
    q.veces += 1;
    porQuinteto.set(clave, q);
  }
  for (const { ev, t } of conT) {
    if (ev.tipo !== "gol") continue;
    const clave = [...enPistaEn(tramos, t)].sort().join("|");
    const q = porQuinteto.get(clave);
    if (!q) continue;
    if (String((ev as unknown as Record<string, unknown>).equipo) === "INTER") q.gf += 1;
    else q.gc += 1;
  }
  const quintetos = [...porQuinteto.values()]
    .map((q) => ({ ...q, masMenos: q.gf - q.gc }))
    .sort((a, b) => b.segundos - a.segundos);

  // ── Zonas ──────────────────────────────────────────────────────────────
  const zonasCampo: Record<string, number> = {};
  const zonasPorteria: Record<string, number> = {};
  const zonasCampoRival: Record<string, number> = {};
  const zonasPorteriaRival: Record<string, number> = {};
  for (const { ev } of conT) {
    const e = ev as unknown as Record<string, unknown>;
    const esTiro = ev.tipo === "disparo" || ev.tipo === "gol";
    if (!esTiro) continue;
    const nuestro = String(e.equipo) === "INTER";
    const zc = String(e.zonaCampo ?? "");
    const zp = String(e.zonaPorteria ?? "");
    if (zc) {
      const m = nuestro ? zonasCampo : zonasCampoRival;
      m[zc] = (m[zc] ?? 0) + 1;
    }
    if (zp) {
      const m = nuestro ? zonasPorteria : zonasPorteriaRival;
      m[zp] = (m[zp] ?? 0) + 1;
    }
  }

  // ── Penaltis, tiempos muertos y tarjetas ───────────────────────────────
  const penaltis = conT
    .filter(({ ev }) => ev.tipo === "penalti" || ev.tipo === "diezm")
    .map(({ ev }) => {
      const e = ev as unknown as Record<string, unknown>;
      return {
        minuto: mmss(n(e.segundosParte)),
        parte: ev.parte,
        nuestro: String(e.equipo) === "INTER",
        tipo: ev.tipo === "diezm" ? "10m" : "Penalti",
        tirador: String(e.tirador ?? "").trim() || undefined,
        resultado: String(e.resultado ?? ""),
      };
    });

  const tiemposMuerto = conT
    .filter(({ ev }) => ev.tipo === "tiempo_muerto")
    .map(({ ev }) => ({
      minuto: mmss(n((ev as unknown as Record<string, unknown>).segundosParte)),
      parte: ev.parte,
      nuestro: String((ev as unknown as Record<string, unknown>).equipo) === "INTER",
    }));

  const tarjetas = conT
    .filter(({ ev }) => ev.tipo === "amarilla" || ev.tipo === "roja")
    .map(({ ev }) => {
      const e = ev as unknown as Record<string, unknown>;
      return {
        minuto: mmss(n(e.segundosParte)),
        parte: ev.parte,
        nuestro: String(e.equipo) === "INTER",
        jugador: String(e.jugador ?? "").trim() || undefined,
        roja: ev.tipo === "roja",
      };
    });

  // ¿Hubo revisión con vídeo? Si nadie contó duelos ni coberturas, esas tablas
  // NO se pintan: un cero que en realidad es "no se contó" engaña más que
  // no enseñar nada. Es la misma regla que en el panel del club.
  const hayVideo = filas.some((f) => Object.keys(f.video).length > 0);

  return {
    cabecera: {
      nosotros: nombreCorto,
      rival: String(cfg.rival ?? ""),
      gf, gc,
      fecha: String(cfg.fecha ?? ""),
      hora: cfg.hora || undefined,
      competicion: cfg.competicion || undefined,
      lugar: cfg.lugar || undefined,
      local: Boolean(cfg.local),
      modo: p.modo ?? "directo",
      partidoId: cfg.partido_id || undefined,
      partesJugadas,
      duracionTotal: duracionTotal(p),
    },
    goles,
    golesPorJugada,
    nosotros: nosotrosStats,
    rival: rivalStats,
    jugadores: filas.filter((f) => !f.portero),
    porteros: filas.filter((f) => f.portero),
    tramos,
    quintetos,
    zonasCampo, zonasPorteria, zonasCampoRival, zonasPorteriaRival,
    penaltis, tiemposMuerto, tarjetas,
    hayVideo,
  };
}
