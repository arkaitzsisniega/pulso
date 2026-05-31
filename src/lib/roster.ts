/**
 * Roster oficial del Inter (canónicos según JUGADORES_ROSTER del Sheet).
 * Sincronizado a 12/05/2026 — HERRERO, GARCIA, GONZALO (sin J. ni Gonza).
 *
 * MODO DEMO: con la variable de entorno NEXT_PUBLIC_DEMO=1 se usa ROSTER_DEMO
 * (nombres FALSOS, mismo mapeo que el dashboard MODO_DEMO y el bot Stats) para
 * grabar vídeos comerciales sin exponer nombres reales. Sin la variable (build
 * de producción / despliegue normal) van los nombres REALES.
 *   Grabar la demo:  NEXT_PUBLIC_DEMO=1 npm run dev   (y abre http://localhost:3000)
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
  { dorsal: "18", nombre: "BARONA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "20", nombre: "CARLOS", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "OSCAR", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "14", nombre: "RUBIO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "15", nombre: "JAIME", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "22", nombre: "SEGO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "25", nombre: "DANI", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "GONZALO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "PABLO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "GABRI", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "NACHO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "ANCHU", posicion: "CAMPO", equipo: "FILIAL" },
];

// Roster DEMO — nombres FALSOS (mismo mapeo que dashboard/bot: HERRERO→REYES,
// GARCIA→SERRANO, JAVI→CANO…). Solo se usa con NEXT_PUBLIC_DEMO=1.
export const ROSTER_DEMO: Jugador[] = [
  { dorsal: "1", nombre: "REYES", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "SERRANO", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "2", nombre: "PRIETO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "IBAÑEZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "6", nombre: "SOTO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "PARRA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "8", nombre: "LARA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "CANO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "DUARTE", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "NEGRO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "18", nombre: "VIDAL", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "20", nombre: "SOLER", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "28", nombre: "PASTOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "14", nombre: "BRAVO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "15", nombre: "LOZANO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "22", nombre: "GIL", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "25", nombre: "GALLEGO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "CAMPOS", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "VEGA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "MOLINA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "ROMAN", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "TORRES", posicion: "CAMPO", equipo: "FILIAL" },
];

// Interruptor: NEXT_PUBLIC_DEMO=1 → nombres falsos (para grabar). Si no, reales.
const _DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const ROSTER: Jugador[] = _DEMO ? ROSTER_DEMO : ROSTER_REAL;

export const PORTEROS = ROSTER.filter((j) => j.posicion === "PORTERO");
export const CAMPO = ROSTER.filter((j) => j.posicion === "CAMPO");
