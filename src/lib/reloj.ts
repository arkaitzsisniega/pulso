/**
 * Aritmética del RELOJ del partido, aislada y testeable (16/8/2026).
 *
 * Por qué existe: Arkaitz notó que "el segundo parece ir más lento que los
 * reales". La causa NO era el cálculo (siempre se ha medido contra Date.now(),
 * así que no puede derivar) sino la PRESENTACIÓN:
 *   1. El dígito grande se repintaba con un tick de 250 ms + el render de toda
 *      la pantalla → cada cambio de segundo llegaba un poco tarde respecto al
 *      marcador de la pista. `msHastaSiguienteCambio` permite programar el
 *      repintado JUSTO en el límite del segundo.
 *   2. La cuenta atrás usaba floor: nada más arrancar marcaba 19:59 y llegaba
 *      a 00:00 un segundo ANTES del final. Los marcadores reales muestran 20:00
 *      durante todo el primer segundo (ceil) y 00:00 solo al acabar. Ahora igual.
 *
 * Todo puro (sin React) para poder probarlo con `node`.
 */

export interface CronoLike {
  /** Segundos acumulados de la parte hasta el último play/pausa. */
  segundosParte: number;
  /** Timestamp (ms) del último play; null = pausado. */
  ultimoStart: number | null;
}

/** Segundos transcurridos de la parte en el instante `now` (en vivo). */
export function segundosVivos(c: CronoLike, now: number = Date.now()): number {
  if (c.ultimoStart == null) return c.segundosParte;
  return c.segundosParte + (now - c.ultimoStart) / 1000;
}

/** Cuenta ATRÁS estilo marcador (ceil): 20:00 durante el 1er segundo, 00:00
 *  solo cuando de verdad se acabó. Para tiempo transcurrido usa formatMMSS. */
export function formatCuentaAtras(restantes: number): string {
  if (!isFinite(restantes) || restantes <= 0) return "00:00";
  // Pequeño épsilon para no mostrar 20:00 → 19:59 por un 1199.9999 de coma flotante.
  const total = Math.ceil(restantes - 1e-6);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Milisegundos hasta que el DÍGITO mostrado cambie (para repintar en el límite
 * exacto del segundo, no cada 250 ms). Con `dur` > 0 se refiere a la cuenta
 * atrás (ceil de los restantes); sin `dur`, al transcurrido (floor).
 * Devuelve al menos 1 ms y como mucho 1000 ms.
 */
export function msHastaSiguienteCambio(c: CronoLike, dur: number, now: number = Date.now()): number {
  const vivos = segundosVivos(c, now);
  let ms: number;
  if (dur > 0) {
    const rest = dur - vivos;
    if (rest <= 0) return 1000;
    const frac = rest - Math.floor(rest);          // parte decimal de los restantes
    ms = (frac <= 1e-6 ? 1 : frac) * 1000;          // el ceil cambia al llegar al entero
  } else {
    const frac = vivos - Math.floor(vivos);
    ms = (1 - frac) * 1000;                          // el floor cambia al superar el entero
  }
  ms = Math.ceil(ms) + 1;                            // margen para caer ya en el nuevo segundo
  return Math.min(1000, Math.max(1, ms));
}
