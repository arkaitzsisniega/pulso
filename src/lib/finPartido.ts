/**
 * finPartido.ts — ¿Este partido ya terminó? y darlo por terminado (20/11/2026).
 *
 * El problema: en el iPad del club, «Totales de la temporada» decía que había
 * 22 partidos sin finalizar. Se jugaron enteros (el reloj de la 2ª parte está
 * en su final) pero nadie le da a «Finalizar» al acabar, y además el botón de
 * «Finalizar partido y ver resumen» no guardaba (ver guardadoDiferido.ts). Un
 * partido sin finalizar no cuenta en Totales y, con el servidor de partidos,
 * no pasaría al Sheet.
 *
 * LA REGLA («última parte completa»), mirando SOLO los datos del reloj:
 *   · El reloj tiene que estar PARADO (corriendo, alguien está apuntando).
 *   · Se está en la 2ª parte (o en la 2ª de la prórroga) y su reloj llegó a
 *     la duración (con 1 s de margen).
 *   · Si la competición tiene prórroga/penaltis (`permiteTanda`) y va EMPATE,
 *     no ha terminado: falta la prórroga o la tanda.
 *   · Si hubo tanda: termina cuando la tanda está decidida (5 por equipo y
 *     muerte súbita) o cerrada.
 *   · 1ª parte, descanso de la prórroga, una parte a medias: sigue abierto
 *     (un partido interrumpido NO se cierra solo).
 * Vale igual para directo, vídeo, importados y restaurados: solo mira el reloj.
 *
 * Darlo por terminado NUNCA borra nada: cambia `estado` a «finalizado» y deja
 * anotado cuándo y cómo (`cierre`). Sin React ni Dexie (finPartido.test.ts).
 */
import type { Partido, ParteId, TiroTanda } from "./db";
import { pararReloj } from "./importarPartido";

/** Margen para dar una parte por completa (coma flotante, ajustes de reloj). */
export const MARGEN_FIN_SEG = 1;

export type MotivoFin =
  | "terminado"          // última parte completa
  | "terminado_tanda"    // con tanda de penaltis decidida o cerrada
  | "ya_finalizado"
  | "sin_config"
  | "reloj_en_marcha"
  | "en_1t"              // va por la 1ª parte
  | "en_pr1"             // va por la 1ª parte de la prórroga
  | "parte_sin_acabar"   // 2T o PR2 a medias (partido interrumpido)
  | "sin_duracion"       // la parte no tiene duración: no se puede saber
  | "empate_pendiente"   // empate con prórroga/penaltis posibles
  | "tanda_abierta";     // tanda empezada y sin decidir

export interface EstadoFin {
  terminado: boolean;
  motivo: MotivoFin;
  parte?: ParteId;
  /** Segundos jugados de la parte actual y su duración (para explicarlo). */
  seg?: number;
  dur?: number;
}

/** ¿La tanda ya tiene ganador? 5 tiros por equipo; después, muerte súbita
 *  (mismo número de tiros y distinto marcador). */
export function tandaDecidida(tiros: TiroTanda[]): boolean {
  let gi = 0, gr = 0, ti = 0, tr = 0;
  for (const x of tiros) {
    const gol = x.resultado === "GOL";
    if (x.equipo === "INTER") { ti += 1; if (gol) gi += 1; }
    else { tr += 1; if (gol) gr += 1; }
  }
  if (ti < 5 || tr < 5) {
    // A falta de tiros: decidido si el otro ya no puede alcanzarlo.
    const quedanI = Math.max(0, 5 - ti), quedanR = Math.max(0, 5 - tr);
    return gi > gr + quedanR || gr > gi + quedanI;
  }
  return ti === tr && gi !== gr;
}

/** Segundos jugados de la parte actual (el mayor entre el reloj y lo guardado
 *  de esa parte, por si se cambió de parte y se volvió). */
function segundosDeParte(p: Partido): number {
  const c = p.cronometro;
  const guardado = c.segundosGuardadosPorParte?.[c.parteActual] ?? 0;
  return Math.max(c.segundosParte ?? 0, guardado);
}

/** ¿Este partido ya terminó, según los datos del reloj? */
export function estadoFin(p: Partido): EstadoFin {
  if (p.estado === "finalizado") return { terminado: true, motivo: "ya_finalizado" };
  const cfg = p.config;
  if (!cfg) return { terminado: false, motivo: "sin_config" };
  if (p.cronometro.ultimoStart != null) return { terminado: false, motivo: "reloj_en_marcha" };

  const tanda = p.tanda;
  const huboTanda = !!tanda && (tanda.activa || tanda.tiros.length > 0);
  if (huboTanda) {
    // A la tanda solo se llega con el tiempo acabado.
    if (!tanda.activa || tandaDecidida(tanda.tiros)) return { terminado: true, motivo: "terminado_tanda" };
    return { terminado: false, motivo: "tanda_abierta" };
  }

  const parte = p.cronometro.parteActual;
  if (parte === "1T") return { terminado: false, motivo: "en_1t", parte };
  if (parte === "PR1") return { terminado: false, motivo: "en_pr1", parte };

  const dur = cfg.duracionParte?.[parte] ?? 0;
  const seg = segundosDeParte(p);
  if (!(dur > 0)) return { terminado: false, motivo: "sin_duracion", parte, seg, dur };
  if (seg < dur - MARGEN_FIN_SEG) return { terminado: false, motivo: "parte_sin_acabar", parte, seg, dur };

  const empate = p.marcador.inter === p.marcador.rival;
  if (cfg.permiteTanda && empate) return { terminado: false, motivo: "empate_pendiente", parte, seg, dur };
  return { terminado: true, motivo: "terminado", parte, seg, dur };
}

export type ComoCierre = NonNullable<Partido["cierre"]>["como"];

/** El partido dado por terminado: reloj parado (si corría, en `ref`), estado
 *  «finalizado» y la marca de cuándo y cómo. No borra ni toca nada más. */
export function marcarFinalizado(p: Partido, como: ComoCierre, ahora: number, ref?: number): Partido {
  const parado = pararReloj(p, ref ?? ahora).partido;
  return { ...parado, estado: "finalizado", cierre: { el: ahora, como } };
}

export interface RepasoCierre {
  /** Los que se pueden dar por terminados (todavía sin tocar). */
  cerrar: Partido[];
  /** Los que se quedan abiertos, con el porqué. */
  abiertos: { partido: Partido; fin: EstadoFin }[];
}

/** Repasa los partidos sin finalizar: cuáles ya acabaron y cuáles no. */
export function repasarSinCerrar(todos: Partido[]): RepasoCierre {
  const cerrar: Partido[] = [];
  const abiertos: RepasoCierre["abiertos"] = [];
  for (const p of todos) {
    if (p.estado === "finalizado" || !p.config) continue;
    const fin = estadoFin(p);
    if (fin.terminado) cerrar.push(p); else abiertos.push({ partido: p, fin });
  }
  return { cerrar, abiertos };
}

/** «12:30» de unos segundos (para explicar dónde se quedó el reloj). */
export function mmss(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
