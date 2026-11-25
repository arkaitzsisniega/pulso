/**
 * deshacer.ts — Lo que «Deshacer» tiene que quitar de una vez (25/11/2026).
 *
 * El entrenador, en el iPad: «si expulso a un jugador por roja y le doy a
 * Deshacer, no se deshace esa expulsión». Dos motivos:
 *
 *  1. Una ROJA a uno nuestro que está en pista son DOS apuntes: la `roja` y un
 *     `cambio` que lo saca sin que entre nadie (`entra: ""`). Y la 2ª amarilla
 *     son TRES: `amarilla` + `roja` + `cambio`. «Deshacer» quitaba solo el
 *     último, así que el primer toque no parecía hacer nada.
 *  2. Ese `cambio` con `entra: ""` no se sabía deshacer: buscaba en la pista a
 *     un jugador llamado "" para cambiarlo por el expulsado, no lo encontraba y
 *     el expulsado se quedaba fuera. (Lo mismo, al revés, con la
 *     reincorporación tras la sanción, `sale: ""`: metía un hueco "" en pista.)
 *     Y ningún cambio deshecho devolvía los relojes de turno: el que volvía a
 *     pista no sumaba minutos.
 *
 * Aquí, sin React ni Dexie, las dos piezas: cuántos apuntes forman la última
 * acción, y cómo se deshace un cambio (pista y relojes).
 *
 *   node --experimental-strip-types src/lib/deshacer.test.ts
 */
import type { Evento, ParteId, TiempoJugador } from "./db";

/** Los apuntes de una misma acción se hacen en el mismo toque: milisegundos. */
const MS_MISMA_ACCION = 2000;

function mismoToque(a: Evento, b: Evento): boolean {
  return Math.abs((a.timestampReal ?? 0) - (b.timestampReal ?? 0)) <= MS_MISMA_ACCION;
}

/**
 * Cuántos apuntes del final de la lista son la ÚLTIMA ACCIÓN del usuario:
 *   · `cambio` que saca al expulsado (entra "") justo tras su `roja` INTER → 2
 *   · y si esa roja venía de la 2ª `amarilla` del mismo jugador          → 3
 *   · `roja` INTER sin cambio (estaba en el banquillo) tras su 2ª amarilla → 2
 * Todo lo demás, 1. Solo se juntan los del mismo jugador y del mismo toque,
 * así que vale también para partidos ya apuntados (no hace falta marca nueva).
 * La roja del rival tras su 2ª amarilla NO se junta: es una pregunta aparte
 * («¿juegan con uno menos?») y se deshace por separado.
 */
export function cuantosDeshacer(eventos: Evento[]): number {
  const n = eventos.length;
  if (n === 0) return 0;
  let i = n - 1;
  let ev = eventos[i] as any;
  let jugador: string | undefined;
  // 1) El cambio que deja el hueco del expulsado.
  if (ev.tipo === "cambio" && ev.entra === "" && ev.sale) {
    const prev = eventos[i - 1] as any;
    if (prev && prev.tipo === "roja" && prev.equipo === "INTER"
        && prev.jugador === ev.sale && mismoToque(prev, ev)) {
      i -= 1; ev = prev; jugador = prev.jugador;
    } else {
      return 1;
    }
  }
  // 2) La roja que viene de la 2ª amarilla.
  if (ev.tipo === "roja" && ev.equipo === "INTER" && ev.jugador) {
    jugador = ev.jugador;
    const prev = eventos[i - 1] as any;
    if (prev && prev.tipo === "amarilla" && prev.equipo === "INTER"
        && prev.jugador === jugador && mismoToque(prev, ev)) {
      // Solo si era la 2ª: la 1ª amarilla no expulsa.
      const amarillas = eventos.slice(0, i).filter((e: any) =>
        e.tipo === "amarilla" && e.equipo === "INTER" && e.jugador === jugador).length;
      if (amarillas >= 2) i -= 1;
    }
  }
  return n - i;
}

export interface EstadoPista {
  enPista: string[];
  tiempos: Record<string, TiempoJugador>;
  cronometro: { parteActual: ParteId; segundosParte: number; ultimoStart: number | null };
}

/**
 * Deshace un `cambio`: el que salió vuelve a pista y el que entró vuelve al
 * banquillo, con sus relojes como si el cambio no se hubiera hecho. El tiempo
 * de reloj que corrió desde el cambio se le pasa al que vuelve (estuvo en
 * pista) y se le quita al que entró.
 *   · `entra: ""` (expulsión): el expulsado vuelve; no sale nadie.
 *   · `sale: ""` (reincorporación tras la sanción): el que entró al hueco se
 *     va; el hueco vuelve a quedar.
 */
export function deshacerCambio(
  p: EstadoPista,
  ev: { parte: ParteId; segundosParte?: number; sale: string; entra: string },
  ahora: number = Date.now(),
): { enPista: string[]; tiempos: Record<string, TiempoJugador> } {
  const { sale, entra } = ev;
  const c = p.cronometro;
  const corriendo = c.ultimoStart != null;
  const parte = c.parteActual;
  const segAhora = corriendo ? c.segundosParte + (ahora - (c.ultimoStart as number)) / 1000 : c.segundosParte;
  // Reloj de partido corrido desde el cambio (si seguimos en la misma parte).
  const d = ev.parte === parte ? Math.max(0, segAhora - (ev.segundosParte ?? segAhora)) : 0;

  let enPista = p.enPista.slice();
  if (entra !== "" && sale !== "") {
    if (enPista.includes(entra) && !enPista.includes(sale)) {
      enPista = enPista.map((n) => (n === entra ? sale : n));
    }
  } else if (entra === "" && sale !== "") {
    if (!enPista.includes(sale)) enPista.push(sale);
  } else if (sale === "" && entra !== "") {
    enPista = enPista.filter((n) => n !== entra);
  }
  enPista = enPista.filter((n) => n !== "");

  const tiempos = { ...p.tiempos };
  // El que ENTRÓ vuelve al banquillo, sin los segundos desde el cambio.
  if (entra !== "" && tiempos[entra] && !enPista.includes(entra)) {
    let t = tiempos[entra];
    if (t.turnoStart != null) {
      const tramo = (ahora - t.turnoStart) / 1000;
      t = { ...t, segTurnoActual: (t.segTurnoActual ?? 0) + tramo,
            totalSegundos: t.totalSegundos + tramo,
            porParte: { ...t.porParte, [parte]: (t.porParte[parte] ?? 0) + tramo },
            turnoStart: null };
    }
    const turno = t.segTurnoActual ?? 0;
    tiempos[entra] = {
      ...t,
      totalSegundos: Math.max(0, t.totalSegundos - d),
      porParte: { ...t.porParte, [parte]: Math.max(0, (t.porParte[parte] ?? 0) - d) },
      segTurnoActual: null,
      turnoStart: null,
      // Si al entrar retomó su turno, esto lo deja como estaba.
      segTurnoUltimo: Math.max(0, turno - d),
      ultimaSalida: t.ultimaSalida ?? ahora,
      segDescansoActual: d,
      descansoStart: corriendo ? ahora : null,
    };
  }
  // El que SALIÓ vuelve a pista, con los segundos desde el cambio.
  if (sale !== "" && tiempos[sale] && enPista.includes(sale)) {
    const t = tiempos[sale];
    tiempos[sale] = {
      ...t,
      totalSegundos: t.totalSegundos + d,
      porParte: { ...t.porParte, [parte]: (t.porParte[parte] ?? 0) + d },
      segTurnoActual: (t.segTurnoUltimo ?? 0) + d,
      turnoStart: corriendo ? ahora : null,
      ultimaSalida: null,
      segDescansoActual: null,
      descansoStart: null,
      segTurnoUltimo: null,
    };
  }
  return { enPista, tiempos };
}
