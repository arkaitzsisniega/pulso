/**
 * Plantillas del crono.
 *
 * Desde el 24/11/2026 aquí NO hay ninguna plantilla real (decisión de Arkaitz,
 * 23/11: el repositorio es público). Las del Inter, el filial y el juvenil se
 * le dan al build desde fuera —secreto de GitHub Actions o fichero local
 * ignorado por git— y `next.config.ts` mete en el paquete SOLO la del club que
 * se construye. Cómo y por qué: `cargarRoster.mjs` y el README («Plantillas
 * privadas»). Para ensayar sin la real: `roster-privado.ejemplo/` (inventadas).
 *
 * Lo único que vive aquí son los tipos y ROSTER_DEMO, la plantilla de la demo
 * CD Pulso: nombres FALSOS (los mismos del dashboard MODO_DEMO y del bot
 * Stats) para grabar vídeos y enseñar el crono. Sus dorsales los baraja
 * scripts/generar_partido_demo.ts (22/11/2026).
 *   Arrancar la demo en local:  npm run demo   (= NEXT_PUBLIC_CLIENTE=pulso)
 *
 * ⛔ No vuelvas a escribir aquí (ni en ningún otro fichero del repo) un nombre
 * de la plantilla real: lo vigila `src/lib/sinNombresReales.test.ts`.
 */

export type Posicion = "PORTERO" | "CAMPO";
export type Equipo = "PRIMER" | "FILIAL";

export interface Jugador {
  dorsal: string;
  nombre: string;
  posicion: Posicion;
  equipo: Equipo;
}

// Roster DEMO — nombres FALSOS. Lo selecciona clientes.ts con
// NEXT_PUBLIC_CLIENTE=pulso.
export const ROSTER_DEMO: Jugador[] = [
  // Porteros primer equipo
  { dorsal: "30", nombre: "REYES", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "13", nombre: "SERRANO", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "25", nombre: "ROMAN", posicion: "PORTERO", equipo: "PRIMER" },
  // Campo primer equipo
  { dorsal: "6", nombre: "PRIETO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "31", nombre: "IBAÑEZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "40", nombre: "SOTO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "4", nombre: "PARRA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "41", nombre: "LARA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "CANO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "DUARTE", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "12", nombre: "NEGRO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "3", nombre: "CALVO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "SUAREZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "19", nombre: "ORTEGA", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "18", nombre: "MARIN", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "LEON", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "2", nombre: "ARANDA", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "26", nombre: "PASTOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "1", nombre: "MENDEZ", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "38", nombre: "MOLINA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "14", nombre: "TORRES", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "8", nombre: "VEGA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "35", nombre: "SALAS", posicion: "CAMPO", equipo: "FILIAL" },
];
