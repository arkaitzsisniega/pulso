/**
 * asistencia.ts — La flecha de la ASISTENCIA de un gol nuestro (22/9/2026).
 *
 * Arkaitz quiere ver de dónde sale el pase del gol y a dónde llega, igual que
 * ya se ve en el pase de gol (`paseGol.ts`, 18/9/2026): no basta con una zona.
 * Así que la asistencia se apunta dibujando una flecha, con el mismo campo
 * (`CampoFlecha`) y el MISMO sistema de coordenadas (ver `Flecha` en db.ts):
 * números de 0 a 1 con 3 decimales y nuestro ataque siempre a la derecha, se
 * jugara hacia donde se jugara esa parte.
 *
 * Qué se guarda en el gol (el contrato con el club, que lo importa):
 *   · flechaAsistencia       la flecha {x0, y0, x1, y1}, al menos de 1 m.
 *   · zonaAsistencia         la zona de SALIDA, calculada de la flecha.
 *   · zonaAsistenciaDestino  la zona de LLEGADA, calculada de la flecha.
 * Solo en un gol NUESTRO, con asistente, que no sea en propia ni de penalti o
 * de 10 m (ese no tiene pase), y solo se pide en los partidos de VÍDEO: en
 * directo no da tiempo. Sin flecha, ninguno de los tres va en el gol.
 *
 * Una excepción que no se crea, solo se respeta: los goles de vídeo apuntados
 * antes de esto pueden traer `zonaAsistencia` sin flecha (la zona que se tocaba
 * en el paso de antes). Es un dato de verdad y no se borra al editar el gol; lo
 * que sí se va es el "__skip__" que dejaba el botón de saltar esa zona.
 *
 * Sin dependencias de React ni Dexie (la geometría es la de `geometriaCampo`):
 *   node --experimental-strip-types src/lib/asistencia.test.ts
 */
import type { Flecha } from "./db";
import { flechaSuficiente, normalizar, zonasDeFlecha } from "./geometriaCampo";

/** Lo que estas reglas miran de un gol: sirve el evento guardado, el borrador
 *  del editor y lo que lleva elegido el modal del gol. */
export interface GolConAsistencia {
  tipo?: string;
  equipo?: string;
  asistente?: string;
  enPropia?: boolean;
  accion?: string;
  flechaAsistencia?: Flecha;
  zonaAsistencia?: string;
  zonaAsistenciaDestino?: string;
}

/** Los tres campos de la asistencia. Con la flecha van los tres; sin ella,
 *  ninguno (en un objeto que se mezcla sobre el gol van a `undefined`). */
export interface CamposAsistencia {
  flechaAsistencia: Flecha | undefined;
  zonaAsistencia: string | undefined;
  zonaAsistenciaDestino: string | undefined;
}

/** Las acciones de gol que no tienen pase: el penalti y el 10 m se tiran solos. */
const SIN_PASE = new Set(["Penalti", "10m"]);

/**
 * ¿Puede llevar flecha de asistencia este gol? Gol NUESTRO, con asistente, que
 * no sea en propia ni de penalti o de 10 m. No mira el modo del partido: eso es
 * cuándo se PIDE (`pideFlechaAsistencia`); una flecha ya dibujada no se pierde
 * porque alguien cambie el partido de modo.
 */
export function golAdmiteFlecha(gol: GolConAsistencia | null | undefined): boolean {
  if (!gol) return false;
  if (gol.tipo !== undefined && gol.tipo !== "gol") return false;
  if (gol.equipo !== "INTER") return false;
  if (gol.enPropia) return false;
  if (!(gol.asistente ?? "").trim()) return false;
  return !SIN_PASE.has(gol.accion ?? "");
}

/** ¿Se pide la flecha? Lo de arriba, y además partido de vídeo. Los partidos
 *  antiguos no llevan `modo` y son de directo, como en db.ts. */
export function pideFlechaAsistencia(
  gol: GolConAsistencia | null | undefined,
  modo: "directo" | "video" | undefined,
): boolean {
  return modo === "video" && golAdmiteFlecha(gol);
}

/** La flecha de la asistencia si es de verdad (al menos 1 m); si no, null. */
export function flechaAsistenciaDe(gol: GolConAsistencia | null | undefined): Flecha | null {
  const f = gol?.flechaAsistencia;
  return f && flechaSuficiente(f) ? f : null;
}

/** ¿Falta dibujarla? Se pide y no está. Es lo que el editor marca como
 *  «asist. sin flecha» para que se vea lo que queda por hacer. */
export function faltaFlechaAsistencia(
  gol: GolConAsistencia | null | undefined,
  modo: "directo" | "video" | undefined,
): boolean {
  return pideFlechaAsistencia(gol, modo) && !flechaAsistenciaDe(gol);
}

/** Los tres campos a partir de una flecha: la flecha (0–1, 3 decimales) y las
 *  zonas que salen de ella. Quien llama se asegura de que es de verdad
 *  (`flechaSuficiente`): `CampoFlecha` solo entrega flechas de 1 m o más. */
export function camposFlechaAsistencia(f: Flecha): CamposAsistencia {
  const flecha: Flecha = {
    x0: normalizar(f.x0), y0: normalizar(f.y0),
    x1: normalizar(f.x1), y1: normalizar(f.y1),
  };
  const { origen, destino } = zonasDeFlecha(flecha);
  return { flechaAsistencia: flecha, zonaAsistencia: origen, zonaAsistenciaDestino: destino };
}

/** Los tres campos vacíos. Van a `undefined` y no se borran porque
 *  `editarEvento` mezcla los cambios sobre el evento: una clave que no está no
 *  quita nada. Al exportar, JSON.stringify no escribe las que valen undefined. */
export function camposSinFlecha(): CamposAsistencia {
  return { flechaAsistencia: undefined, zonaAsistencia: undefined, zonaAsistenciaDestino: undefined };
}

/** El gol con su flecha (una copia; el original no se toca). */
export function conFlechaAsistencia<T extends object>(gol: T, f: Flecha): T {
  return { ...gol, ...camposFlechaAsistencia(f) };
}

/** El gol sin flecha: fuera los tres campos (una copia). */
export function sinFlechaAsistencia<T extends object>(gol: T): T {
  return { ...gol, ...camposSinFlecha() };
}

/**
 * Cómo queda la asistencia al GUARDAR un gol editado:
 *   · si ya no puede llevar flecha (pasa a ser del rival, se queda sin
 *     asistente, en propia o de penalti/10 m): fuera los tres campos;
 *   · con una flecha buena: las zonas se vuelven a sacar de ella, que es el
 *     dato (las zonas son su resumen);
 *   · con una flecha que no vale (menos de 1 m, números rotos): fuera los tres;
 *   · sin flecha: sin destino y sin el "__skip__" de antes; una zona de salida
 *     apuntada a mano antes de las flechas se respeta.
 */
export function asistenciaAlGuardar<T extends GolConAsistencia>(gol: T): T {
  if (!golAdmiteFlecha(gol)) return sinFlechaAsistencia(gol);
  const f = flechaAsistenciaDe(gol);
  if (f) return conFlechaAsistencia(gol, f);
  if (gol.flechaAsistencia !== undefined) return sinFlechaAsistencia(gol);
  const zona = (gol.zonaAsistencia ?? "").trim();
  return {
    ...gol,
    zonaAsistencia: zona && zona !== "__skip__" ? zona : undefined,
    zonaAsistenciaDestino: undefined,
  };
}

/** Cuántas asistencias pide el partido y a cuántas les falta la flecha. */
export function recuentoFlechasAsistencia(
  eventos: GolConAsistencia[] | null | undefined,
  modo: "directo" | "video" | undefined,
): { total: number; faltan: number } {
  let total = 0;
  let faltan = 0;
  for (const ev of eventos ?? []) {
    if (!pideFlechaAsistencia(ev, modo)) continue;
    total += 1;
    if (!flechaAsistenciaDe(ev)) faltan += 1;
  }
  return { total, faltan };
}
