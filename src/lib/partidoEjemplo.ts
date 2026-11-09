"use client";

/**
 * partidoEjemplo.ts — La demo no arranca vacía (9/11/2026).
 *
 * Quien abría la demo veía una lista en blanco y tenía que montar un partido
 * entero antes de ver un informe. Ahora, la primera vez, se guarda en el aparato
 * un partido de ejemplo ya terminado, con jugadores inventados.
 *
 * Una sola vez y sin pisar nada: tiene su propio id, no se marca como activo (lo
 * que se está apuntando sigue siendo lo que se abre) y es un partido normal, así
 * que se puede borrar. Si lo borra, no vuelve. El aviso de «ya está» va en
 * localStorage; si no hay red, se reintenta la próxima vez.
 *
 * Solo con `CLIENTE.partidoEjemplo` (la demo). Inter y filial no hacen nada.
 */
import { db, type Partido } from "@/lib/db";
import { CLIENTE } from "@/lib/clientes";

export const ID_PARTIDO_EJEMPLO = "demo_partido_1";
const YA_SEMBRADO = `${CLIENTE.id}_ejemplo_sembrado`;
const BASE = (process.env.NEXT_PUBLIC_BASEPATH || "").replace(/\/$/, "");

export async function sembrarPartidoEjemplo(): Promise<void> {
  if (!CLIENTE.partidoEjemplo) return;
  try {
    if (localStorage.getItem(YA_SEMBRADO)) return;
    const res = await fetch(`${BASE}/_demo_partido.json`);
    if (!res.ok) return;
    const partido = (await res.json()) as Partido;
    if (!(await db.partidos.get(partido.id))) await db.partidos.put(partido);
    localStorage.setItem(YA_SEMBRADO, "1");
  } catch {
    /* sin red o sin almacenamiento: la demo funciona igual, solo sin ejemplo */
  }
}
