/**
 * paseGol.ts — ¿Está este pase de gol pegado a un gol nuestro? (18/9/2026)
 *
 * La regla de Arkaitz: el pase de gol es el que deja a un compañero en ocasión
 * CLARA y la ocasión NO acaba en gol. Si acaba en gol se apunta la asistencia,
 * como siempre, y nunca las dos cosas. Apuntarlo dos veces no da error: da una
 * valoración con +2 de más que nadie ve.
 *
 * Por eso el crono AVISA (no prohíbe) cuando un pase de gol y un gol nuestro
 * caen muy juntos en la misma parte, en los dos órdenes:
 *   · al guardar un gol, si hay un pase de gol en los VENTANA segundos
 *     anteriores (`pasesGolCerca`);
 *   · al guardar un pase de gol, si hay un gol nuestro a ±VENTANA
 *     (`golNuestroCerca`).
 * Puede ser otra jugada, así que la última palabra es del que apunta.
 *
 * Sin dependencias de React ni Dexie:
 *   node --experimental-strip-types src/lib/paseGol.test.ts
 */
import type { Evento, ParteId } from "./db";

/** Segundos de juego que se consideran "la misma jugada". */
export const VENTANA_PASE_GOL_SEG = 20;

const seg = (ev: Evento) => Number(ev.segundosParte) || 0;

/** ¿Es un gol nuestro? Los del botón GOL y los penaltis/10 m metidos con su
 *  propio botón, que no tienen evento "gol" (el que lo tiene, `golId`, ya
 *  cuenta por su gol y no se mira dos veces). */
export function esGolNuestro(ev: Evento): boolean {
  if (ev.tipo === "gol") return ev.equipo === "INTER";
  if (ev.tipo === "penalti" || ev.tipo === "diezm") {
    return ev.equipo === "INTER" && ev.resultado === "GOL" && !ev.golId;
  }
  return false;
}

export function esPaseGol(ev: Evento): boolean {
  return ev.tipo === "accion_individual" && ev.accion === "paseGol";
}

/** El gol nuestro más cercano a ese instante, si está a VENTANA segundos o
 *  menos (antes o después) y en la misma parte. `null` si no hay ninguno. */
export function golNuestroCerca(eventos: Evento[], parte: ParteId, segundos: number): Evento | null {
  let mejor: Evento | null = null;
  let dist = Infinity;
  for (const ev of eventos ?? []) {
    if (ev.parte !== parte || !esGolNuestro(ev)) continue;
    const d = Math.abs(seg(ev) - segundos);
    if (d <= VENTANA_PASE_GOL_SEG && d < dist) { mejor = ev; dist = d; }
  }
  return mejor;
}

/** Los pases de gol de la misma parte en los VENTANA segundos ANTERIORES a
 *  ese instante (el mismo segundo incluido), del más reciente al más antiguo.
 *  Después de un gol viene otro saque y otra jugada: esos no se miran. */
export function pasesGolCerca(eventos: Evento[], parte: ParteId, segundos: number): Evento[] {
  return (eventos ?? [])
    .filter((ev) => ev.parte === parte && esPaseGol(ev)
      && seg(ev) <= segundos && segundos - seg(ev) <= VENTANA_PASE_GOL_SEG)
    .sort((a, b) => seg(b) - seg(a));
}
