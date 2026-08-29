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
  { dorsal: "21", nombre: "NACHO GOMEZ", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "OSCAR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "29", nombre: "ANDRES", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "15", nombre: "JAIME", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "32", nombre: "GABRI", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "ANCHU", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "33", nombre: "PABLO", posicion: "CAMPO", equipo: "FILIAL" },
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
  { dorsal: "21", nombre: "ARANDA", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "PASTOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "29", nombre: "MENDEZ", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "15", nombre: "LOZANO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "32", nombre: "MOLINA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "TORRES", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "33", nombre: "VEGA", posicion: "CAMPO", equipo: "FILIAL" },
];

/**
 * Plantilla del FILIAL (cliente "filial"). Datos de Arkaitz, 29/8/2026.
 *
 * Son DOS equipos, y por eso están los dos aquí: el filial (INTER F.S. B) y el
 * juvenil de División de Honor, que es el escalón de abajo. Los juveniles
 * juegan muchas veces con el B, así que el cuerpo técnico necesita a los 29 a
 * mano — pero no todos en cada partido.
 *
 * De ahí el uso del campo `equipo`, que en este build significa otra cosa que
 * en el del primer equipo:
 *   · "PRIMER" = plantilla del B  → sale preseleccionado en convocados (verde)
 *   · "FILIAL" = juvenil DH       → hay que tocarlo para convocarlo (gris)
 * Así el caso normal (juegan los del B) no obliga a tocar nada, y subir a un
 * juvenil es un toque.
 *
 * Los DORSALES son los suyos, los de su ficha, no los que llevan cuando
 * entrenan con el primer equipo (Óscar es el 28 arriba y el 01 aquí). En el
 * banquillo del filial lo que se ve en la espalda es este número.
 *
 * Nombres cortos y sin repetir, que es lo que se grita: hay dos Gutiérrez
 * (Alejandro y Fabio), dos Sánchez (Alejandro y Héctor) y tres Adrianes
 * (Comas, Lucas y Pascual).
 */
export const ROSTER_FILIAL: Jugador[] = [
  // ── INTER F.S. B ──
  { dorsal: "01", nombre: "OSCAR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "25", nombre: "ANDRES", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "19", nombre: "RISQUEZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "03", nombre: "ALEX GUTIERREZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "07", nombre: "ANCHU", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "04", nombre: "FABIO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "05", nombre: "CESAR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "22", nombre: "EVANGELIO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "20", nombre: "PECELLIN", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "99", nombre: "ALEX SANCHEZ", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "08", nombre: "MARCOS", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "PABLO", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "GABRI", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "09", nombre: "MURILO", posicion: "CAMPO", equipo: "PRIMER" },
  // ── INTER F.S. JUVENIL DH ──
  { dorsal: "55", nombre: "HECTOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "32", nombre: "COMAS", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "66", nombre: "VILLACORTA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "34", nombre: "SANABRIA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "80", nombre: "NICO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "88", nombre: "PASTOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "70", nombre: "GUILLE", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "12", nombre: "BERMUDEZ", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "39", nombre: "IBAI", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "35", nombre: "CORDON", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "14", nombre: "LUCAS", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "27", nombre: "PASCUAL", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "21", nombre: "SOBRIN", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "17", nombre: "CARRILLO", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "15", nombre: "MATEO", posicion: "CAMPO", equipo: "FILIAL" },
];

/** Nombre completo de cada uno del filial, para la guía en papel y para no
 *  perder de vista a quién corresponde cada mote. */
export const NOMBRES_FILIAL: Record<string, string> = {
  OSCAR: "Óscar Delgado", ANDRES: "Andrés García", RISQUEZ: "Raúl Risquez",
  "ALEX GUTIERREZ": "Alejandro Gutiérrez", ANCHU: "Ángel Luis Anchuelo",
  FABIO: "Fabio Gutiérrez", CESAR: "César Paramio", EVANGELIO: "Luis Evangelio",
  PECELLIN: "Daniel Pecellín", "ALEX SANCHEZ": "Alejandro Sánchez",
  MARCOS: "Marcos Lorenzo", PABLO: "Pablo Palacios", GABRI: "Gabriel Marín",
  MURILO: "Murilo Nunes",
  HECTOR: "Héctor Sánchez", COMAS: "Adrián Comas", VILLACORTA: "Diego Villacorta",
  SANABRIA: "Roberto Sanabria", NICO: "Nicolás Martínez", PASTOR: "Alejandro Pastor",
  GUILLE: "Guillermo Menéndez", BERMUDEZ: "David Bermúdez", IBAI: "Ibai González",
  CORDON: "Carlos Cordón", LUCAS: "Adrián Lucas", PASCUAL: "Adrián Pascual",
  SOBRIN: "Rodrigo Sobrín", CARRILLO: "Raúl Carrillo", MATEO: "Mateo Barrero",
};

// El roster ACTIVO (ROSTER / PORTEROS / CAMPO) lo expone `@/lib/clientes` según
// el cliente del build (NEXT_PUBLIC_CLIENTE). Aquí quedan solo los DATOS crudos
// (ROSTER_REAL / ROSTER_DEMO) para que clientes.ts los componga SIN dependencia
// circular (clientes.ts importa estos arrays; este módulo no importa clientes).
