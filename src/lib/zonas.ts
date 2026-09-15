/**
 * zonas.ts — En qué zona del mapa de disparos del resumen cae cada tiro.
 *
 * Por qué existe (15/9/2026): desde el 10/8/2026 el campo de apuntar divide
 * también la mitad propia —A1..A10 es la de ataque y D1..D10 la de defensa—,
 * pero el mapa de la pestaña de disparos sigue siendo el de 11 zonas: A1..A10
 * y la A11, que es la otra mitad entera. Solo se contaban esas once, así que
 * todo tiro desde D1..D10 se caía del mapa sin avisar. Arkaitz lo vio en el
 * informe del club con los dos últimos goles del Cartagena (13/9/2026), a
 * puerta vacía desde D8 y D3, y aquí pasaba lo mismo.
 *
 * La regla es la del club (`_zona_campo_a_z` en importar_crono.py): toda D
 * cuenta en la A11. No se esconde nada que este mapa sepa enseñar: la A11 se
 * dibuja justo encima de esas diez zonas.
 *
 * Solo lógica, sin React ni Dexie: se prueba con
 * `node --experimental-strip-types src/lib/zonas.test.ts`.
 */

export type ResultadoTiro = "GOL" | "PUERTA" | "PALO" | "FUERA" | "BLOQUEADO";

/** Las 11 zonas del mapa del resumen, tal cual las dibuja `CampoConteos`:
 *  A1..A10 en la mitad de ataque y la A11, que es la otra mitad ENTERA. */
export const ZONAS_MAPA_RESUMEN: string[] = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11",
];

export type ConteoZona = Record<ResultadoTiro, number> & { total: number };

/** La zona del mapa del resumen donde cae una zona apuntada; "" si ninguna.
 *
 *  "A4" → "A4" · "D1".."D10" → "A11" (la mitad propia del que tira, sea nuestro
 *  o del rival: la zona se guarda desde SU ataque) · "__skip__", vacío o
 *  cualquier otra cosa → "". */
export function zonaMapaResumen(zonaCampo?: string): string {
  const z = (zonaCampo ?? "").trim().toUpperCase();
  if (ZONAS_MAPA_RESUMEN.includes(z)) return z;
  return /^D([1-9]|10)$/.test(z) ? "A11" : "";
}

/** Tiros por zona del mapa y por resultado. El que no tiene zona que pintar
 *  —no se apuntó, se pulsó «saltar zona»…— va a `sinZona`, que es la nota de
 *  debajo del mapa: entre los dos suman siempre todos los tiros. */
export function contarPorZona(
  tiros: { res: ResultadoTiro; zonaCampo?: string }[],
): { conteos: Record<string, ConteoZona>; sinZona: number } {
  const conteos: Record<string, ConteoZona> = {};
  for (const z of ZONAS_MAPA_RESUMEN) {
    conteos[z] = { GOL: 0, PUERTA: 0, PALO: 0, BLOQUEADO: 0, FUERA: 0, total: 0 };
  }
  let sinZona = 0;
  for (const t of tiros) {
    const z = zonaMapaResumen(t.zonaCampo);
    if (!z) { sinZona++; continue; }
    conteos[z][t.res]++;
    conteos[z].total++;
  }
  return { conteos, sinZona };
}
