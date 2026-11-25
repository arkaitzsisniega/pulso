/**
 * competiciones.ts — La lista de competiciones que se eligen en el crono.
 *
 * Una sola lista para «Nuevo partido» (los dos aspectos) y para «Editar datos
 * del partido» (25/11/2026): así no puede pasar que en una pantalla esté
 * «Amistoso» y en otra no. Los presets de cada una (duración de las partes,
 * tanda) siguen en `PRESETS_COMPETICION` de db.ts.
 *
 * Sin Dexie ni React: la importan también los tests de node.
 */
export const COMPETICIONES = [
  "LIGA", "COPA_REY", "COPA_ESPANA", "COPA_MUNDO", "COPA_MADRID", "AMISTOSO", "PLAYOFF", "SUPERCOPA",
] as const;

/** Las opciones del desplegable para un partido YA guardado: la lista de
 *  siempre y, si el partido trae otra (importado, de una versión vieja), esa
 *  también, para que el desplegable no la cambie sin que nadie la toque. */
export function opcionesCompeticion(actual: string | undefined | null): string[] {
  const lista: string[] = [...COMPETICIONES];
  const a = String(actual ?? "").trim();
  if (a && !lista.includes(a)) lista.push(a);
  return lista;
}
