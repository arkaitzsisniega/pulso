/**
 * duplicadosVideo.ts — El mismo partido en DIRECTO y en VÍDEO cuenta una vez
 * (decisión de Arkaitz, 20/11/2026).
 *
 * Un partido se apunta en directo y, días después, se repasa con la grabación
 * en modo vídeo. Los dos se quedan en el aparato y la temporada los sumaba
 * dos veces (goles, minutos, disparos…). La regla:
 *   · MISMO partido = el mismo `config.partido_id` si los DOS lo tienen; si
 *     alguno no lo tiene, la misma fecha (`config.fecha`) y el mismo rival
 *     (sin tildes ni mayúsculas).
 *   · Si de un partido hay versión de vídeo, cuenta SOLO la de vídeo. Con dos
 *     de vídeo, la última modificada (`actualizado`).
 *   · Un partido solo en directo cuenta tal cual.
 * No borra nada del aparato: solo decide qué entra en la suma. Recibe ya los
 * partidos que cuentan (finalizados); sin React ni Dexie (duplicadosVideo.test.ts).
 */
import type { Partido } from "./db";

/** «Valdepeñas » → «valdepenas»: sin tildes, sin mayúsculas, sin espacios de sobra. */
export function normalizarTexto(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function esVideo(p: Partido): boolean {
  return p.modo === "video";
}

/** ¿Son el mismo partido? (ver la regla arriba). */
export function mismoPartido(a: Partido, b: Partido): boolean {
  const ca = a.config, cb = b.config;
  if (!ca || !cb) return false;
  const ida = normalizarTexto(ca.partido_id), idb = normalizarTexto(cb.partido_id);
  if (ida && idb) return ida === idb;
  const fa = (ca.fecha ?? "").trim(), fb = (cb.fecha ?? "").trim();
  const ra = normalizarTexto(ca.rival), rb = normalizarTexto(cb.rival);
  return !!fa && !!ra && fa === fb && ra === rb;
}

export interface SinDuplicados {
  /** Los que se suman, en el mismo orden en que llegaron. */
  cuentan: Partido[];
  /** Versiones en directo que no cuentan porque está su vídeo. */
  directosFuera: Partido[];
  /** Versiones de vídeo más antiguas que no cuentan (hay otra más reciente). */
  videosFuera: Partido[];
}

export function quitarDuplicadosVideo(partidos: Partido[]): SinDuplicados {
  // Grupos de «mismo partido» (unión de parejas: pocos partidos, n² sobra).
  const padre = partidos.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < partidos.length; i++) {
    for (let j = i + 1; j < partidos.length; j++) {
      if (mismoPartido(partidos[i], partidos[j])) padre[raiz(j)] = raiz(i);
    }
  }
  // De cada grupo con vídeo, el vídeo que se queda: el último modificado.
  const elegido = new Map<number, number>();
  partidos.forEach((p, i) => {
    if (!esVideo(p)) return;
    const r = raiz(i);
    const actual = elegido.get(r);
    if (actual === undefined || (p.actualizado ?? 0) > (partidos[actual].actualizado ?? 0)) elegido.set(r, i);
  });

  const res: SinDuplicados = { cuentan: [], directosFuera: [], videosFuera: [] };
  partidos.forEach((p, i) => {
    const video = elegido.get(raiz(i));
    if (video === undefined || video === i) res.cuentan.push(p);
    else if (esVideo(p)) res.videosFuera.push(p);
    else res.directosFuera.push(p);
  });
  return res;
}
