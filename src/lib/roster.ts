/**
 * Roster oficial del Inter (canónicos según JUGADORES_ROSTER del Sheet).
 * Actualizado a la plantilla 26/27 (25/06/2026): altas JUGADOR, JUGADOR
 * (Jugador), JUGADOR, JUGADOR (Jugador), JUGADOR; bajas JUGADOR, JUGADOR,
 * JUGADOR, JUGADOR, JUGADOR, JUGADOR, JUGADOR.
 *
 * 25/9/2026 — alta de JUGADOR (Jugador Jugador), PORTERO del primer equipo con el
 * dorsal 15. Ese 15 lo llevaba JUGADOR, que está en stand by y en el Sheet se ha
 * quedado SIN dorsal: se saca de aquí, porque este roster se indexa por dorsal.
 * De paso entra JUGADOR (34), que estaba en el roster del FILIAL pero no en el
 * del primer equipo: si subía a jugar con los mayores, no se le podía elegir.
 * ⚠️ Hay TRES Raúles y «Jugador» a secas es el 6: Jugador Gómez = JUGADOR · Jugador
 * = JUGADOR · Jugador Jugador = JUGADOR.
 *
 * ROSTER_DEMO va EN PARALELO: mismos dorsales y posiciones, nombres falsos
 * (JUGADOR→ROMAN, JUGADOR→SALAS). Si se añade a uno, se añade al otro.
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
  { dorsal: "1", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "15", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  // Campo primer equipo
  { dorsal: "2", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "5", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "6", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "7", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "8", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "17", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "14", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "12", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "39", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "4", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "99", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "21", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  // Portero filial
  { dorsal: "28", nombre: "JUGADOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "29", nombre: "JUGADOR", posicion: "PORTERO", equipo: "FILIAL" },
  // Campo filial
  { dorsal: "32", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "33", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "34", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
];

// Roster DEMO — nombres FALSOS (mismo mapeo que dashboard/bot: JUGADOR→REYES,
// JUGADOR→SERRANO, JUGADOR→CANO…). Lo selecciona clientes.ts con NEXT_PUBLIC_CLIENTE=pulso.
export const ROSTER_DEMO: Jugador[] = [
  // Porteros primer equipo
  { dorsal: "1", nombre: "REYES", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "27", nombre: "SERRANO", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "15", nombre: "ROMAN", posicion: "PORTERO", equipo: "PRIMER" },
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
  { dorsal: "32", nombre: "MOLINA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "31", nombre: "TORRES", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "33", nombre: "VEGA", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "34", nombre: "SALAS", posicion: "CAMPO", equipo: "FILIAL" },
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
 * entrenan con el primer equipo (Jugador es el 28 arriba y el 01 aquí). En el
 * banquillo del filial lo que se ve en la espalda es este número.
 *
 * Nombres cortos y sin repetir, que es lo que se grita: hay nombres y apellidos
 * repetidos.
 */
export const ROSTER_FILIAL: Jugador[] = [
  // ── INTER F.S. B ──
  { dorsal: "01", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "25", nombre: "JUGADOR", posicion: "PORTERO", equipo: "PRIMER" },
  { dorsal: "19", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "03", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "07", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "04", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "05", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "22", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "20", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "99", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "08", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "11", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "10", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  { dorsal: "09", nombre: "JUGADOR", posicion: "CAMPO", equipo: "PRIMER" },
  // ── INTER F.S. JUVENIL DH ──
  { dorsal: "55", nombre: "JUGADOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "32", nombre: "JUGADOR", posicion: "PORTERO", equipo: "FILIAL" },
  { dorsal: "66", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "34", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "80", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "88", nombre: "PASTOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "70", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "12", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "39", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "35", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "14", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "27", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "21", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "17", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
  { dorsal: "15", nombre: "JUGADOR", posicion: "CAMPO", equipo: "FILIAL" },
];

/** Nombre completo de cada uno del filial, para la guía en papel y para no
 *  perder de vista a quién corresponde cada mote. */
export const NOMBRES_FILIAL: Record<string, string> = {
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  "JUGADOR": "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador", "JUGADOR": "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", PASTOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
  JUGADOR: "Jugador", JUGADOR: "Jugador", JUGADOR: "Jugador",
};

// El roster ACTIVO (ROSTER / PORTEROS / CAMPO) lo expone `@/lib/clientes` según
// el cliente del build (NEXT_PUBLIC_CLIENTE). Aquí quedan solo los DATOS crudos
// (ROSTER_REAL / ROSTER_DEMO) para que clientes.ts los componga SIN dependencia
// circular (clientes.ts importa estos arrays; este módulo no importa clientes).
