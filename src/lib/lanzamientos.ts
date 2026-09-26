/**
 * lanzamientos.ts — Los lanzamientos sin barrera: penalti, 10 m y FSB (26/9/2026).
 *
 * Tres tipos de evento que se apuntan IGUAL (lanzador, portero, resultado y
 * cuadrante de portería) y cuentan igual (marcador, disparos, paradas):
 *   · "penalti" — el de 6 m.
 *   · "diezm"   — el 10 m: desde la 6.ª falta acumulada, desde el punto de 10 m.
 *   · "fsb"     — la FALTA SIN BARRERA (Arkaitz, 26/9/2026): la misma situación
 *                 que el 10 m, pero la falta fue más cerca de la portería que el
 *                 punto de 10 m y se tira desde donde fue. «Lo mismo» que el 10 m.
 *
 * Hasta hoy cada sitio preguntaba `tipo === "penalti" || tipo === "diezm"`, y
 * dar de alta uno más era buscarlos uno a uno: el que se escapara dejaba fuera
 * un gol de FSB del marcador al editar el partido (reconstruir.ts), sin error.
 * La lista vive aquí y los demás le preguntan a esto. Si algún día hay un
 * cuarto, se añade AQUÍ y `lanzamientos.test.ts` avisa de lo que falte.
 *
 * Contrato con el club (`importar_crono.py`): el evento lleva `tipo: "fsb"` y,
 * cuando se apunta con el botón GOL, el gol lleva `accion: "FSB"`. Allí va a
 * EST_PENALTIS_10M con tipo FSB. No cambiar estos valores.
 *
 * Sin dependencias de React ni Dexie:
 *   node --experimental-strip-types src/lib/lanzamientos.test.ts
 */
import type { Evento } from "./db";

/** Los tipos de evento que son un lanzamiento sin barrera. */
export const TIPOS_LANZAMIENTO = ["penalti", "diezm", "fsb"] as const;
export type TipoLanzamiento = (typeof TIPOS_LANZAMIENTO)[number];
export type EventoLanzamiento = Extract<Evento, { tipo: TipoLanzamiento }>;

export function esTipoLanzamiento(tipo: unknown): tipo is TipoLanzamiento {
  return (TIPOS_LANZAMIENTO as readonly unknown[]).includes(tipo);
}

/** ¿Es este evento un penalti, un 10 m o un FSB? Estrecha el tipo: dentro del
 *  `if` se puede leer `tirador`, `portero`, `resultado` y `golId`. */
export function esLanzamiento(ev: Evento): ev is EventoLanzamiento {
  return esTipoLanzamiento(ev?.tipo);
}

/**
 * La ACCIÓN de un gol (el valor canónico en español que se guarda en el evento
 * `gol`) que es un lanzamiento, y el tipo de su evento enlazado. Un gol con una
 * de estas acciones no tiene pase (no lleva flecha de asistencia) ni zona de
 * campo en el modal: se tira solo, como el 10 m.
 */
const TIPO_DE_ACCION: Record<string, TipoLanzamiento> = {
  "Penalti": "penalti",
  "10m": "diezm",
  "FSB": "fsb",
};

/** Acción de gol → tipo del lanzamiento enlazado (o null si no lo es). */
export function tipoLanzamientoDeAccion(accion: string | null | undefined): TipoLanzamiento | null {
  return TIPO_DE_ACCION[String(accion ?? "")] ?? null;
}

export function esAccionLanzamiento(accion: string | null | undefined): boolean {
  return tipoLanzamientoDeAccion(accion) !== null;
}

/** Tipo del lanzamiento → la acción de gol con que se muestra (y se guarda en
 *  el gol cuando se apunta con el botón GOL). */
const ACCION_DE_TIPO: Record<TipoLanzamiento, string> = {
  penalti: "Penalti",
  diezm: "10m",
  fsb: "FSB",
};

export function accionDeLanzamiento(tipo: TipoLanzamiento): string {
  return ACCION_DE_TIPO[tipo];
}
