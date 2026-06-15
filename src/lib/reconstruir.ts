/**
 * reconstruir.ts — Re-derivación de los agregados del partido desde la lista
 * de eventos. Pieza central de la EDICIÓN POST-PARTIDO (Fase 2): cuando se
 * edita / añade / borra / reordena un evento cualquiera, no basta con deshacer
 * el último (LIFO de `deshacerUltimoEvento`); hay que recalcular desde cero
 * `marcador`, `stats`, `acciones` y `disparosRival`, y re-sellar el snapshot
 * `marcador` de cada evento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIDELIDAD CON registrarEvento() (store.ts)
 * ─────────────────────────────────────────────────────────────────────────
 * Las reglas de auto-conteo de aquí son un ESPEJO de las de `registrarEvento`
 * y `registrarAccionIndividual` en store.ts. Si cambias las reglas de conteo
 * en store.ts, ACTUALIZA esta función y su test (reconstruir.test.ts).
 * El test verifica que, sobre una lista de eventos, esta función produce los
 * mismos agregados que mantendría el motor incremental en vivo.
 *
 * NO recalcula `tiempos` (minutos por jugador): eso se trata aparte (los
 * play/pausa del reloj no se guardan como eventos, así que los minutos no se
 * pueden derivar exactos). Ver el bloque de minutos del plan Fase 2.
 *
 * Módulo PURO: solo imports de tipo (sin React, sin Dexie, sin alias) para que
 * sea testeable en aislamiento con `node --experimental-strip-types`.
 */
import type {
  Partido,
  Evento,
  ParteId,
  ContadoresJugador,
  ResultadoDisparo,
} from "./db";

// ── helpers locales (espejo de los de store.ts/db.ts; aquí para mantener el
//    módulo puro y sin imports de runtime) ──────────────────────────────────

function contadoresVacios(): ContadoresJugador {
  return {
    pf: 0, pnf: 0, robos: 0, cortes: 0, bdg: 0, bdp: 0,
    dpp: 0, dpf: 0, dpa: 0, dpb: 0,
    golesEncajados: 0, paradas: 0,
  };
}

type Acciones = Partido["acciones"];
type DisparosRival = Partido["disparosRival"];
type Stats = Partido["stats"];

/** Suma delta a un campo de contadores del jugador (defensivo, retrocompat). */
function bump(acciones: Acciones, nombre: string, campo: keyof ContadoresJugador, delta = 1): void {
  const cur = acciones.porJugador[nombre] ?? contadoresVacios();
  acciones.porJugador[nombre] = {
    ...contadoresVacios(),
    ...cur,
    [campo]: Math.max(0, (cur[campo] ?? 0) + delta),
  };
}

function campoDisparo(r: ResultadoDisparo): keyof ContadoresJugador {
  switch (r) {
    case "PUERTA":    return "dpp";
    case "PALO":      return "dpa";
    case "FUERA":     return "dpf";
    case "BLOQUEADO": return "dpb";
  }
}

function campoDisparoRival(r: ResultadoDisparo): keyof DisparosRival {
  switch (r) {
    case "PUERTA":    return "puerta";
    case "PALO":      return "palo";
    case "FUERA":     return "fuera";
    case "BLOQUEADO": return "bloqueado";
  }
}

function statsVacios(): Stats {
  const cero = (): Record<ParteId, { inter: number; rival: number }> => ({
    "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 },
    PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 },
  });
  return { faltas: cero(), amarillas: cero(), tiemposMuerto: cero() };
}

/** enPista inicial a partir de la config (portero + 4 de pista). */
function enPistaInicial(partido: Partido): string[] {
  const pi = partido.config?.pista_inicial;
  if (!pi) return [];
  return [pi.portero, pi.pista1, pi.pista2, pi.pista3, pi.pista4].filter(Boolean);
}

/** Aplica un cambio al array enPista (espejo de cambiarJugador/reincorporar). */
function aplicarCambioEnPista(enPista: string[], sale: string, entra: string): string[] {
  if (entra === "") return enPista.filter((n) => n !== sale);   // expulsión: hueco
  if (sale === "") return [...enPista, entra];                   // reincorporación
  return enPista.map((n) => (n === sale ? entra : n));           // cambio normal
}

function porteroEnPista(enPista: string[], esPortero: (n: string) => boolean): string | null {
  for (const n of enPista) if (esPortero(n)) return n;
  return null;
}

const ORDEN_PARTE: Record<ParteId, number> = { "1T": 0, "2T": 1, PR1: 2, PR2: 3 };

/** Ordena los eventos cronológicamente (parte → segundosParte → timestamp),
 *  garantizando que un gol-padre va ANTES que su penalti/diezm hijo (golId). */
function ordenarEventos(eventos: Evento[]): Evento[] {
  return [...eventos].sort((a, b) => {
    const dp = ORDEN_PARTE[a.parte] - ORDEN_PARTE[b.parte];
    if (dp !== 0) return dp;
    if (a.segundosParte !== b.segundosParte) return a.segundosParte - b.segundosParte;
    // gol padre antes que su hijo penalti (mismo instante)
    const aPad = (b as { golId?: string }).golId === a.id;
    const bPad = (a as { golId?: string }).golId === b.id;
    if (aPad) return -1;
    if (bPad) return 1;
    return a.timestampReal - b.timestampReal;
  });
}

/**
 * Re-deriva agregados y re-sella los snapshots de marcador. Devuelve un nuevo
 * Partido con `eventos` ordenados + `marcador`/`stats`/`acciones`/`disparosRival`
 * recalculados. `tiempos`, `tanda` y el resto se mantienen intactos.
 */
export function reconstruirAgregados(
  partido: Partido,
  esPortero: (nombre: string) => boolean,
): Partido {
  const eventos = ordenarEventos(partido.eventos);

  const marcador = { inter: 0, rival: 0 };
  const stats = statsVacios();
  const acciones: Acciones = { porJugador: {} };
  const disparosRival: DisparosRival = { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 };

  let enPista = enPistaInicial(partido);
  const marcadorPorGolId: Record<string, { inter: number; rival: number }> = {};

  const sellados: Evento[] = [];

  for (const ev0 of eventos) {
    // CAMBIO: solo afecta a enPista (los minutos van aparte). Sellar y seguir.
    if (ev0.tipo === "cambio") {
      sellados.push({ ...ev0, marcador: { ...marcador } });
      enPista = aplicarCambioEnPista(enPista, ev0.sale, ev0.entra);
      continue;
    }

    const golIdHijo = (ev0 as { golId?: string }).golId;
    const esHijoPenalti = (ev0.tipo === "penalti" || ev0.tipo === "diezm") && !!golIdHijo;

    // Snapshot del marcador: para el hijo penalti, el de su gol padre (=pre-gol).
    let snap = { ...marcador };
    if (esHijoPenalti && golIdHijo && marcadorPorGolId[golIdHijo]) {
      snap = { ...marcadorPorGolId[golIdHijo] };
    }
    const ev = { ...ev0, marcador: snap } as Evento;

    if (!esHijoPenalti) {
      aplicarEfecto(ev, marcador, stats, acciones, disparosRival, enPista, esPortero);
    }
    if (ev.tipo === "gol") marcadorPorGolId[ev.id] = { ...ev.marcador };

    sellados.push(ev);
  }

  return { ...partido, eventos: sellados, marcador, stats, acciones, disparosRival };
}

/**
 * Aplica los efectos de auto-conteo de UN evento sobre los agregados (mutándolos
 * en sitio). ESPEJO de registrarEvento()/registrarAccionIndividual() de store.ts.
 * No maneja eventos `cambio` ni la creación de penaltis hijos (eso lo hace el
 * caller / el motor en vivo).
 */
function aplicarEfecto(
  ev: Evento,
  marcador: { inter: number; rival: number },
  stats: Stats,
  acciones: Acciones,
  disparosRival: DisparosRival,
  enPista: string[],
  esPortero: (n: string) => boolean,
): void {
  switch (ev.tipo) {
    case "gol": {
      if (ev.equipo === "INTER") {
        marcador.inter += 1;
        if (ev.goleador) bump(acciones, ev.goleador, "dpp", 1);
      } else {
        marcador.rival += 1;
        disparosRival.puerta += 1;
        const p = porteroEnPista(enPista, esPortero);
        if (p) bump(acciones, p, "golesEncajados", 1);
      }
      break;
    }
    case "falta": {
      const c = stats.faltas[ev.parte];
      if (ev.equipo === "INTER") c.inter += 1; else c.rival += 1;
      break;
    }
    case "amarilla": {
      const c = stats.amarillas[ev.parte];
      if (ev.equipo === "INTER") c.inter += 1; else c.rival += 1;
      break;
    }
    case "tiempo_muerto": {
      const c = stats.tiemposMuerto[ev.parte];
      if (ev.equipo === "INTER") c.inter += 1; else c.rival += 1;
      break;
    }
    case "accion_individual": {
      bump(acciones, ev.jugador, ev.accion, 1);
      break;
    }
    case "disparo": {
      if (ev.equipo === "INTER") {
        if (ev.jugador) bump(acciones, ev.jugador, campoDisparo(ev.resultado), 1);
      } else {
        disparosRival[campoDisparoRival(ev.resultado)] += 1;
        if (ev.resultado === "PUERTA") {
          const p = ev.portero || porteroEnPista(enPista, esPortero);
          if (p) bump(acciones, p, "paradas", 1);
        }
      }
      break;
    }
    case "penalti":
    case "diezm": {
      if (ev.resultado === "GOL") {
        if (ev.equipo === "INTER") {
          marcador.inter += 1;
          if (ev.tirador) bump(acciones, ev.tirador, "dpp", 1);
        } else {
          marcador.rival += 1;
          disparosRival.puerta += 1;
          const p = porteroEnPista(enPista, esPortero);
          if (p) bump(acciones, p, "golesEncajados", 1);
        }
      } else {
        const res: ResultadoDisparo =
          ev.resultado === "PARADA" ? "PUERTA" : ev.resultado === "POSTE" ? "PALO" : "FUERA";
        if (ev.equipo === "INTER") {
          if (ev.tirador) bump(acciones, ev.tirador, campoDisparo(res), 1);
        } else {
          disparosRival[campoDisparoRival(res)] += 1;
          if (ev.resultado === "PARADA") {
            const p = ev.portero || porteroEnPista(enPista, esPortero);
            if (p) bump(acciones, p, "paradas", 1);
          }
        }
      }
      break;
    }
    // "roja" no tiene efecto de conteo (espejo de registrarEvento).
  }
}

/**
 * Recálculo APROXIMADO de los minutos por jugador (opción D de la edición
 * post-partido). Reparte el tiempo de cada parte entre quienes estaban en pista,
 * usando la pista inicial + los eventos `cambio` (ordenados) como fronteras.
 *
 * Es una APROXIMACIÓN: asume que el reloj corrió de forma continua en cada parte
 * (ignora pausas y tiempos muertos) y que cada parte duró `duracionParte`. Sirve
 * como punto de partida tras editar sustituciones; el usuario puede afinar los
 * minutos a mano (campo editable en el editor). NO toca los contadores ni el
 * marcador (eso es reconstruirAgregados).
 *
 * Devuelve un nuevo mapa `tiempos`. Como el partido está finalizado, los campos
 * de seguimiento en vivo (turnoStart, segDescansoActual…) quedan a null/0.
 */
export function recomputarMinutos(partido: Partido): Partido["tiempos"] {
  const cfg = partido.config;
  const partes: ParteId[] = ["1T", "2T", "PR1", "PR2"];
  const tiempos: Partido["tiempos"] = {};
  const init = (n: string) => {
    if (!n || tiempos[n]) return;
    tiempos[n] = {
      nombre: n, totalSegundos: 0,
      porParte: { "1T": 0, "2T": 0, PR1: 0, PR2: 0 },
      segTurnoActual: null, turnoStart: null, ultimaSalida: null,
      segDescansoActual: null, descansoStart: null, segTurnoUltimo: null,
    };
  };
  (cfg?.convocados ?? []).forEach(init);
  if (!cfg) return tiempos;

  let enPista = [cfg.pista_inicial.portero, cfg.pista_inicial.pista1,
    cfg.pista_inicial.pista2, cfg.pista_inicial.pista3, cfg.pista_inicial.pista4].filter(Boolean);
  enPista.forEach(init);

  for (const p of partes) {
    const Tp = cfg.duracionParte[p] ?? 0;
    if (Tp <= 0) continue;
    const cambios = partido.eventos
      .filter((e) => e.tipo === "cambio" && e.parte === p)
      .sort((a, b) => (a.segundosParte || 0) - (b.segundosParte || 0)) as Array<Evento & { tipo: "cambio" }>;

    let cursor = 0;
    const acumula = (hasta: number) => {
      const fin = Math.min(Math.max(hasta, 0), Tp);
      const dt = fin - cursor;
      if (dt > 0) { for (const j of enPista) { init(j); tiempos[j].porParte[p] += dt; } cursor = fin; }
    };

    for (const c of cambios) {
      acumula(c.segundosParte || 0);
      init(c.entra); init(c.sale);
      if (c.entra === "") enPista = enPista.filter((n) => n !== c.sale);
      else if (c.sale === "") enPista = [...enPista, c.entra];
      else enPista = enPista.map((n) => (n === c.sale ? c.entra : n));
    }
    acumula(Tp);
  }

  for (const n of Object.keys(tiempos)) {
    tiempos[n].totalSegundos = partes.reduce((s, p) => s + tiempos[n].porParte[p], 0);
  }
  return tiempos;
}
