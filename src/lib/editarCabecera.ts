/**
 * editarCabecera.ts — Corregir los DATOS de un partido ya apuntado (25/11/2026).
 *
 * Lo pidió el entrenador: un amistoso de pretemporada se guardó como LIGA y no
 * había forma de cambiarlo («debería de poder editar todo»). Las acciones ya se
 * editaban (pestaña «Editar» del resumen, EditorEventos); la cabecera no.
 *
 * Qué se puede cambiar: rival, código del partido, fecha, hora, lugar,
 * competición, casa/fuera, duración de cada parte, si hay tanda, hacia dónde
 * atacamos en la 1ª parte y el modo (directo / vídeo).
 *
 * Qué NO cambia nunca aquí:
 *   · el `id` del partido (la clave de la base, `p_<ms>_…`): no sale de la
 *     fecha ni de la competición, así que Totales (sus excepciones van por id),
 *     la cola de subida y el servidor siguen reconociéndolo como el mismo.
 *   · los eventos, minutos, acciones, marcador y tanda: se devuelven tal cual.
 *   · convocados y quinteto inicial (de ellos cuelgan minutos y contadores).
 *
 * Cambiar la competición NO aplica sus duraciones (al revés que en «Nuevo
 * partido»): el partido ya se jugó con las que tiene, y una prórroga que no se
 * jugó aparecería en el resumen. Las duraciones se tocan aparte, si hace falta.
 *
 * Guardar el resultado con el guardado de siempre le pone un `actualizado`
 * nuevo, y con eso la cola de subida (lib/colaSubida.ts) lo da por pendiente.
 *
 * Sin React ni Dexie: node --experimental-strip-types src/lib/editarCabecera.test.ts
 */
import type { ConfigPartido, Partido, ParteId } from "./db";
import { mismoPartido } from "./duplicadosVideo";

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];

export interface CambiosCabecera {
  rival?: string;
  partido_id?: string;
  fecha?: string;
  hora?: string;
  lugar?: string;
  competicion?: string;
  local?: boolean;
  /** EN SEGUNDOS, como en la config. */
  duracionParte?: Partial<Record<ParteId, number>>;
  permiteTanda?: boolean;
  direccionInter1T?: "izq" | "der";
  modo?: "directo" | "video";
}

/** Los datos editables de un partido, tal como están (para rellenar el formulario). */
export function cabeceraDe(p: Partido): Required<Omit<CambiosCabecera, "duracionParte">> & { duracionParte: Record<ParteId, number> } {
  const c = p.config!;
  return {
    rival: c.rival ?? "",
    partido_id: c.partido_id ?? "",
    fecha: c.fecha ?? "",
    hora: c.hora ?? "",
    lugar: c.lugar ?? "",
    competicion: c.competicion ?? "",
    local: c.local === true,
    duracionParte: {
      "1T": c.duracionParte?.["1T"] ?? 0, "2T": c.duracionParte?.["2T"] ?? 0,
      PR1: c.duracionParte?.PR1 ?? 0, PR2: c.duracionParte?.PR2 ?? 0,
    },
    permiteTanda: c.permiteTanda === true,
    direccionInter1T: c.direccionInter1T ?? "der",
    modo: p.modo ?? "directo",
  };
}

/** Segundos de cada parte que el partido YA usa: el evento más tardío, los
 *  minutos de cualquier jugador y el reloj (si se llegó a jugar). Una parte no
 *  puede quedarse más corta que esto, ni a 0 si se usó. */
export function segundosUsados(p: Partido): Record<ParteId, number> {
  const out: Record<ParteId, number> = { "1T": 0, "2T": 0, PR1: 0, PR2: 0 };
  const sube = (parte: ParteId | undefined, s: number | undefined) => {
    if (!parte || !(parte in out)) return;
    const v = Math.max(0, Math.round(Number(s) || 0));
    if (v > out[parte]) out[parte] = v;
  };
  for (const e of p.eventos ?? []) sube(e.parte, e.segundosParte);
  for (const t of Object.values(p.tiempos ?? {})) {
    for (const parte of PARTES) sube(parte, t?.porParte?.[parte]);
  }
  const cr = p.cronometro;
  if (cr) {
    sube(cr.parteActual, cr.segundosParte);
    for (const parte of PARTES) sube(parte, cr.segundosGuardadosPorParte?.[parte]);
  }
  return out;
}

/** Partes que tienen ALGO apuntado (un evento o minutos), aunque sea en el 0:00. */
export function partesConDatos(p: Partido): Set<ParteId> {
  const s = new Set<ParteId>();
  for (const e of p.eventos ?? []) if (e.parte) s.add(e.parte);
  for (const t of Object.values(p.tiempos ?? {})) {
    for (const parte of PARTES) if ((t?.porParte?.[parte] ?? 0) > 0) s.add(parte);
  }
  return s;
}

export type ErrorCabecera =
  | { clave: "nuevo_alert_rival" }
  | { clave: "nuevo_alert_id" }
  | { clave: "edc_err_fecha" }
  | { clave: "edc_err_parte_cero"; parte: ParteId }
  | { clave: "edc_err_parte_corta"; parte: ParteId; usados: number };

/** null = se puede guardar. Si no, el primer problema (clave del catálogo). */
export function validarCabecera(p: Partido, cambios: CambiosCabecera): ErrorCabecera | null {
  const nueva = aplicarCabecera(p, cambios);
  const c = nueva.config!;
  if (!c.rival) return { clave: "nuevo_alert_rival" };
  if (!c.partido_id) return { clave: "nuevo_alert_id" };
  if (c.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) return { clave: "edc_err_fecha" };
  // Solo se frena lo que ACORTA una parte: un partido viejo con un evento
  // apuntado en el descuento (más allá de la duración) se tiene que poder
  // guardar aunque no se toquen las duraciones.
  const usados = segundosUsados(p);
  const conDatos = partesConDatos(p);
  for (const parte of PARTES) {
    const dur = c.duracionParte[parte] ?? 0;
    const antes = p.config?.duracionParte?.[parte] ?? 0;
    if (dur >= antes) continue;
    if (dur === 0 && (conDatos.has(parte) || usados[parte] > 0)) return { clave: "edc_err_parte_cero", parte };
    if (dur > 0 && dur < usados[parte]) return { clave: "edc_err_parte_corta", parte, usados: usados[parte] };
  }
  return null;
}

/** El partido con la cabecera cambiada. Lo que no venga en `cambios` se queda
 *  como estaba; el resto del partido (eventos incluidos) va TAL CUAL, sin copiar.
 *  Rival y código se guardan como en «Nuevo partido»: sin espacios de sobra y
 *  en mayúsculas. */
export function aplicarCabecera(p: Partido, cambios: CambiosCabecera): Partido {
  if (!p.config) return p;
  const viejo = p.config;
  const txt = (v: string | undefined, antes: string) => (v === undefined ? antes : v.trim());
  const config: ConfigPartido = {
    ...viejo,
    rival: cambios.rival === undefined ? viejo.rival : cambios.rival.trim().toUpperCase(),
    partido_id: cambios.partido_id === undefined ? viejo.partido_id : cambios.partido_id.trim().toUpperCase(),
    fecha: txt(cambios.fecha, viejo.fecha),
    hora: txt(cambios.hora, viejo.hora),
    lugar: txt(cambios.lugar, viejo.lugar),
    competicion: txt(cambios.competicion, viejo.competicion),
    local: typeof cambios.local === "boolean" ? cambios.local : viejo.local,
    permiteTanda: typeof cambios.permiteTanda === "boolean" ? cambios.permiteTanda : viejo.permiteTanda,
    direccionInter1T: cambios.direccionInter1T ?? viejo.direccionInter1T,
    duracionParte: { ...viejo.duracionParte },
  };
  for (const parte of PARTES) {
    const v = cambios.duracionParte?.[parte];
    if (v !== undefined) config.duracionParte[parte] = Math.max(0, Math.round(Number(v) || 0));
  }
  return { ...p, config, modo: cambios.modo ?? p.modo };
}

/** ¿Cambia algo? (para no guardar —ni marcar para subir— si no se tocó nada). */
export function hayCambiosCabecera(p: Partido, cambios: CambiosCabecera): boolean {
  const a = aplicarCabecera(p, cambios);
  return JSON.stringify([a.config, a.modo ?? "directo"]) !== JSON.stringify([p.config, p.modo ?? "directo"]);
}

/** Otros partidos guardados que, con los datos nuevos, serían «el mismo
 *  partido» (lib/duplicadosVideo.ts: mismo código, o misma fecha y rival).
 *  Sirve para avisar ANTES de guardar: en Totales, de un mismo partido en
 *  directo y en vídeo solo cuenta el de vídeo. El propio partido no sale. */
export function otrosMismoPartido(editado: Partido, todos: Partido[]): Partido[] {
  return todos.filter((o) => o.id !== editado.id && mismoPartido(editado, o));
}
