/**
 * candado.ts — «Solo mirar» en el store (servidor de partidos, fase 3,
 * 21/11/2026). Sin React ni Dexie: lo prueba `soloMirar.test.ts`.
 */
/** Envuelve cada acción: con `bloqueado()` en true no se llama (devuelve
 *  undefined). Pura, para probarla sin React (soloMirar.test.ts). */
export function conCandado<T extends Record<string, unknown>>(acciones: T, bloqueado: () => boolean): T {
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(acciones)) {
    out[k] = typeof f === "function"
      ? (...args: unknown[]) => (bloqueado() ? undefined : (f as (...a: unknown[]) => unknown)(...args))
      : f;
  }
  return out as T;
}

