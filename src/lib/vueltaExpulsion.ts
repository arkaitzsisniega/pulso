/**
 * vueltaExpulsion.ts — «Vuelve en el 5:08» en la barra de una expulsión
 * (25/11/2026, pedido del entrenador).
 *
 * La barra de inferioridad / superioridad ya enseñaba la cuenta atrás de 2:00.
 * Faltaba lo que de verdad se mira desde el banquillo: en qué MINUTO DEL RELOJ
 * del partido puede volver a entrar el equipo con uno menos. El reloj va hacia
 * abajo (lo que queda de la parte): si expulsan a falta de 7:08, vuelve en el
 * 5:08.
 *
 * Reglas, las MISMAS que ya usa la pantalla del partido (no se inventa nada):
 *   · 2 minutos de juego desde la roja (el reloj parado no cuenta);
 *   · si el equipo con superioridad marca antes, se acaba: eso lo decide quien
 *     llama (la barra desaparece y aquí no se llega);
 *   · la cuenta sigue en la parte siguiente si la roja cae al final de una
 *     parte (page.tsx suma los segundos de las partes ya jugadas). Por eso, si
 *     la vuelta cae después del final de la 1ª parte, se dice el minuto de la
 *     2ª; y de la 1ª prórroga a la 2ª igual.
 *
 * Lo que NO se dice, porque no se sabe: si la vuelta cae después del final de
 * la 2ª parte (habrá prórroga o no según el marcador) o de la 2ª prórroga, se
 * devuelve null y la barra enseña solo la cuenta atrás.
 *
 * Todo puro (sin React) para poder probarlo con `node`.
 */
import type { ParteId } from "./db";

/** Lo que dura una expulsión, en segundos de juego. */
export const SEGUNDOS_EXPULSION = 120;

/** Parte en la que SEGURO se sigue jugando después de cada una. */
const SIGUIENTE_SEGURA: Partial<Record<ParteId, ParteId>> = { "1T": "2T", PR1: "PR2" };

export interface EntradaVuelta {
  /** Segundo de la roja en el reloj ABSOLUTO del partido (partes sumadas). */
  tInicioAbs: number;
  /** Parte que se está jugando ahora. */
  parteActual: ParteId;
  /** Segundos jugados en las partes anteriores a la actual (mismo reloj absoluto). */
  offsetParteActual: number;
  /** Duración configurada de cada parte, en segundos (0 = sin duración fija). */
  duraciones: Partial<Record<ParteId, number>>;
}

export interface Vuelta {
  /** Parte en la que vuelve. */
  parte: ParteId;
  /** Lo que marcará el reloj grande cuando vuelva, en segundos enteros. */
  reloj: number;
  /** true si es la parte que se está jugando (no hace falta decir cuál). */
  mismaParte: boolean;
}

/**
 * Minuto del reloj en que puede volver el jugador (o null si no se sabe).
 * Con duración fija el reloj cuenta hacia ABAJO y se redondea como él (ceil:
 * el número que se ve en el marcador en ese instante); sin duración, el reloj
 * cuenta hacia arriba y se da el tiempo transcurrido.
 */
export function vueltaExpulsion(e: EntradaVuelta): Vuelta | null {
  if (!isFinite(e.tInicioAbs) || !isFinite(e.offsetParteActual)) return null;
  // Segundo de la parte ACTUAL en el que se cumplen los 2 minutos.
  const rel = e.tInicioAbs + SEGUNDOS_EXPULSION - e.offsetParteActual;
  const dur = e.duraciones[e.parteActual] ?? 0;
  if (dur <= 0) {
    // Reloj hacia arriba (parte sin duración): el transcurrido.
    return { parte: e.parteActual, reloj: Math.max(0, Math.floor(rel + 1e-6)), mismaParte: true };
  }
  if (rel <= dur) {
    return { parte: e.parteActual, reloj: relojCuentaAtras(dur - rel), mismaParte: true };
  }
  // Se pasa del final de esta parte: la cuenta sigue en la siguiente, si es seguro que la hay.
  const sig = SIGUIENTE_SEGURA[e.parteActual];
  if (!sig) return null;
  const durSig = e.duraciones[sig] ?? 0;
  const sobra = rel - dur;
  if (durSig <= 0 || sobra > durSig) return null;
  return { parte: sig, reloj: relojCuentaAtras(durSig - sobra), mismaParte: false };
}

/** Como el marcador: 20:00 durante el 1er segundo (ceil), sin pasar de 0. */
function relojCuentaAtras(restantes: number): number {
  return Math.max(0, Math.ceil(restantes - 1e-6));
}
