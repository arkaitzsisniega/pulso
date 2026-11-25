/**
 * ordenPartidos.ts — En qué orden se listan los partidos (20/11/2026, regla
 * fija del entrenador desde el 25/11/2026).
 *
 * TODAS las listas de partidos del crono (inicio en los dos aspectos, Totales,
 * la copia de seguridad, «Dar por terminados» y «Partidos del club» del
 * servidor) van por la FECHA DEL PARTIDO, el más reciente ARRIBA. Nada de
 * ordenar a mano en una pantalla: se llama a `ordenarPartidos` (partidos del
 * aparato) o a `ordenarPartidosClub` (filas del servidor).
 *
 *   1. `config.fecha`, la más reciente primero. Sin fecha (o con una que no se
 *      entiende): al final.
 *   2. Mismo día: por hora, la más tardía primero (sin hora, detrás).
 *   3. MISMO PARTIDO (misma fecha y mismo rival, sin tildes ni mayúsculas): el
 *      de VÍDEO encima del de directo, aunque uno tenga hora y el otro no. Las
 *      versiones de un partido van siempre juntas: el grupo se coloca con la
 *      hora más tardía de cualquiera de ellas.
 *   4. Empate total: el CREADO más tarde arriba (la marca de tiempo del id
 *      `p_<ms>_…`); si no se sabe, el tocado más recientemente.
 *
 * Sin React ni Dexie: se prueba con node (ordenPartidos.test.ts).
 */
import type { Partido } from "./db";
import { normalizarTexto } from "./duplicadosVideo";

type Ordenable = Pick<Partido, "modo" | "actualizado"> & {
  id?: string;
  config: { fecha?: string; hora?: string; rival?: string } | null;
};

/** «2026-11-18» o «18/11/2026» → «2026-11-18». Lo que no se entiende → "". */
export function fechaClave(fecha: unknown): string {
  const f = String(fecha ?? "").trim();
  let m = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

/** «9:05» → «09:05». Sin hora → "" (va detrás de los que la tienen). */
export function horaClave(hora: unknown): string {
  const m = String(hora ?? "").trim().match(/^(\d{1,2})[:.h](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Cuándo se creó, sacado del id `p_<ms en base 36>_…`. Sin saberlo → 0. */
export function creadoClave(id: unknown): number {
  const m = String(id ?? "").match(/^p_([0-9a-z]+)_/);
  if (!m) return 0;
  const n = parseInt(m[1], 36);
  return Number.isFinite(n) ? n : 0;
}

interface Claves { fecha: string; grupo: string; hora: string; video: number; creado: number; act: number }

function claves(p: Ordenable): Claves {
  const fecha = fechaClave(p.config?.fecha);
  return {
    fecha,
    grupo: `${fecha}|${normalizarTexto(p.config?.rival)}`,
    hora: horaClave(p.config?.hora),
    video: (p.modo ?? "directo") === "video" ? 0 : 1,
    creado: creadoClave(p.id),
    act: p.actualizado ?? 0,
  };
}

/** Copia ordenada (no toca la lista que se pasa). La regla, arriba. */
export function ordenarPartidos<T extends Ordenable>(lista: T[]): T[] {
  const k = lista.map(claves);
  // Lo que comparte cada grupo (mismo partido): su hora más tardía y su
  // creación más reciente. Así las versiones van juntas y el orden es estable.
  const horaGrupo = new Map<string, string>();
  const creadoGrupo = new Map<string, number>();
  for (const c of k) {
    if ((horaGrupo.get(c.grupo) ?? "") < c.hora) horaGrupo.set(c.grupo, c.hora);
    const ref = c.creado || c.act;
    if ((creadoGrupo.get(c.grupo) ?? -1) < ref) creadoGrupo.set(c.grupo, ref);
  }
  const idx = lista.map((_, i) => i);
  idx.sort((i, j) => {
    const a = k[i], b = k[j];
    if (!a.fecha !== !b.fecha) return a.fecha ? -1 : 1;           // sin fecha, al final
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
    if (a.grupo !== b.grupo) {
      const ha = horaGrupo.get(a.grupo)!, hb = horaGrupo.get(b.grupo)!;
      if (ha !== hb) return hb.localeCompare(ha);
      const ca = creadoGrupo.get(a.grupo)!, cb = creadoGrupo.get(b.grupo)!;
      if (ca !== cb) return cb - ca;
      return a.grupo.localeCompare(b.grupo);
    }
    if (a.video !== b.video) return a.video - b.video;            // vídeo encima
    if (a.hora !== b.hora) return b.hora.localeCompare(a.hora);
    if (a.creado !== b.creado) return b.creado - a.creado;
    return b.act - a.act;
  });
  return idx.map((i) => lista[i]);
}

/** Comparador de dos partidos sueltos (para pruebas; las listas, con `ordenarPartidos`). */
export function compararPartidos(a: Ordenable, b: Ordenable): number {
  const r = ordenarPartidos([a, b]);
  return r[0] === a ? (r[1] === a ? 0 : -1) : 1;
}

/** Fila de «Partidos del club» (servidor): lleva fecha, rival y modo sueltos. */
type FilaServidor = { id: string; fecha: string; rival: string; modo: string; actualizado: number };

/** La lista del servidor, con la misma regla que la del aparato. */
export function ordenarPartidosClub<T extends FilaServidor>(lista: T[]): T[] {
  const envueltos = lista.map((f) => ({
    fila: f,
    id: f.id,
    modo: (f.modo === "video" ? "video" : "directo") as "video" | "directo",
    actualizado: f.actualizado,
    config: { fecha: f.fecha, rival: f.rival },
  }));
  return ordenarPartidos(envueltos).map((e) => e.fila);
}
