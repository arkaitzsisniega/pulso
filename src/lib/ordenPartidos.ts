/**
 * ordenPartidos.ts — En qué orden se listan los partidos (20/11/2026).
 *
 * Arkaitz: la lista del inicio salía por el ÚLTIMO partido abierto o tocado
 * (`actualizado`), y con solo abrir uno viejo se ponía el primero. Ahora va
 * por la FECHA DEL PARTIDO, del más reciente al más antiguo: el último jugado
 * arriba. Mismo orden en el inicio (los dos aspectos), Totales y la copia de
 * seguridad.
 *
 *   1. `config.fecha`, la más reciente primero.
 *   2. Mismo día: `config.hora`, la más tardía primero.
 *   3. Mismo día y hora (el directo y su rehecho con vídeo): el de VÍDEO
 *      delante, que es el bueno.
 *   4. Sin fecha (o con una que no se entiende): al final.
 *   5. Empate total: el tocado más recientemente primero (como antes).
 *
 * Sin React ni Dexie: se prueba con node (ordenPartidos.test.ts).
 */
import type { Partido } from "./db";

type Ordenable = Pick<Partido, "modo" | "actualizado"> & {
  config: { fecha?: string; hora?: string } | null;
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

/** Comparador para `sort`: el partido más reciente primero. */
export function compararPartidos(a: Ordenable, b: Ordenable): number {
  const fa = fechaClave(a.config?.fecha), fb = fechaClave(b.config?.fecha);
  if (!fa !== !fb) return fa ? -1 : 1;                 // sin fecha, al final
  if (fa !== fb) return fb.localeCompare(fa);
  const ha = horaClave(a.config?.hora), hb = horaClave(b.config?.hora);
  if (ha !== hb) return hb.localeCompare(ha);
  const va = (a.modo ?? "directo") === "video" ? 0 : 1;
  const vb = (b.modo ?? "directo") === "video" ? 0 : 1;
  if (va !== vb) return va - vb;
  return (b.actualizado ?? 0) - (a.actualizado ?? 0);
}

/** Copia ordenada (no toca la lista que se pasa). */
export function ordenarPartidos<T extends Ordenable>(lista: T[]): T[] {
  return [...lista].sort(compararPartidos);
}
