/**
 * Roster oficial del Inter (canónicos según JUGADORES_ROSTER del Sheet).
 * Sincronizado a 12/05/2026 — JUGADOR, JUGADOR, JUGADOR (sin J. ni Gonza).
 */

export type Posicion = "PORTERO" | "CAMPO";
export type Equipo = "PRIMER" | "FILIAL";

export interface Jugador {
  dorsal: string;
  nombre: string;
  posicion: Posicion;
  equipo: Equipo;
}

export const ROSTER: Jugador[] = [
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

export const PORTEROS = ROSTER.filter((j) => j.posicion === "PORTERO");
export const CAMPO = ROSTER.filter((j) => j.posicion === "CAMPO");
