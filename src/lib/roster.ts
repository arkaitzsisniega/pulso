/**
 * Roster oficial del Inter (canónicos según JUGADORES_ROSTER del Sheet).
 * Sincronizado a 12/05/2026 — JUGADOR, JUGADOR, JUGADOR (sin J. ni Gonza).
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
  { dorsal: "1", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  // Campo primer equipo
  { dorsal: "2", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "6", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "8", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "18", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "20", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "JUGADOR", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "14", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "15", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "22", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "25", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
];

// Roster DEMO — nombres FALSOS (mismo mapeo que dashboard/bot: JUGADOR→REYES,
// JUGADOR→SERRANO, JUGADOR→CANO…). Solo se usa con NEXT_PUBLIC_DEMO=1.
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
