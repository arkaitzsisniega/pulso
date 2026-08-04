/**
 * Roster oficial del Inter (canónicos según JUGADORES_ROSTER del Sheet).
 * Actualizado a la plantilla 26/27 (25/06/2026): altas RIVILLOS, MAHREZ
 * (João Cambangula), GORDILLO, TONI (Escribano), MARVIN; bajas BARONA, CARLOS,
 * RUBIO, SEGO, DANI, GONZALO, NACHO.
 *
 * Aquí solo viven los DATOS crudos (ROSTER_REAL y ROSTER_DEMO). Qué roster usa
 * cada build lo decide `clientes.ts` según NEXT_PUBLIC_CLIENTE: "inter" → reales,
 * "pulso" → ROSTER_DEMO (nombres FALSOS, mismo mapeo que el dashboard MODO_DEMO
 * y el bot Stats) para grabar vídeos comerciales sin exponer nombres reales.
 *   Arrancar la demo en local:  npm run demo   (= NEXT_PUBLIC_CLIENTE=pulso)
 */

export type Posicion = "PORTERO" | "CAMPO";
export type Equipo = "PRIMER" | "FILIAL";

export interface Jugador {
  dorsal: string;
  nombre: string;
  posicion: Posicion;
  equipo: Equipo;
}

export const ROSTER_REAL: Jugador[] = [
  // Porteros primer equipo
  { dorsal: "1", nombre: "HERRERO", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "GARCIA", posicion: "PORTERO", equipo: "PRIMER" },
  // Campo primer equipo
  { dorsal: "2", nombre: "CECILIO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "CHAGUINHA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "6", nombre: "RAUL", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "HARRISON", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "8", nombre: "RAYA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "JAVI", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "PANI", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "PIRATA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "14", nombre: "RIVILLOS", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "12", nombre: "MAHREZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "39", nombre: "GORDILLO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "4", nombre: "TONI", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "99", nombre: "MARVIN", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "OSCAR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "", nombre: "ANDRES", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "15", nombre: "JAIME", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "GABRI", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "ANCHU", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "PABLO", posicion: "CAMPO", equipo: "FILIAL" },
];

// Roster DEMO — nombres FALSOS (mismo mapeo que dashboard/bot: HERRERO→REYES,
// GARCIA→SERRANO, JAVI→CANO…). Lo selecciona clientes.ts con NEXT_PUBLIC_CLIENTE=pulso.
export const ROSTER_DEMO: Jugador[] = [
  // Porteros primer equipo
  { dorsal: "1", nombre: "REYES", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "SERRANO", posicion: "PORTERO", equipo: "PRIMER" },
  // Campo primer equipo
  { dorsal: "2", nombre: "PRIETO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "IBAÑEZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "6", nombre: "SOTO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "PARRA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "8", nombre: "LARA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "CANO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "DUARTE", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "NEGRO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "14", nombre: "CALVO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "12", nombre: "SUAREZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "39", nombre: "ORTEGA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "4", nombre: "MARIN", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "99", nombre: "LEON", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "PASTOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "", nombre: "MENDEZ", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "15", nombre: "LOZANO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "MOLINA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "TORRES", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "VEGA", posicion: "CAMPO", equipo: "FILIAL" },
];

// El roster ACTIVO (ROSTER / PORTEROS / CAMPO) lo expone `@/lib/clientes` según
// el cliente del build (NEXT_PUBLIC_CLIENTE). Aquí quedan solo los DATOS crudos
// (ROSTER_REAL / ROSTER_DEMO) para que clientes.ts los componga SIN dependencia
// circular (clientes.ts importa estos arrays; este módulo no importa clientes).
