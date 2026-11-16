/**
 * saque.ts — ¿Hay que preguntar quién saca al darle a iniciar? (16/11/2026)
 *
 * Desde el 22/8/2026 el crono pregunta quién saca la PRIMERA vez que se le da
 * a iniciar, y con eso recuerda a quién le toca en la 2ª parte. La condición
 * era «1ª parte, sin saque anotado y SIN NINGÚN EVENTO». Pero corregir el
 * quinteto en pista antes del saque —cambios a 0:00, con el reloj sin
 * arrancar— ya deja eventos, y la pregunta no salía: pasó en el J8 contra
 * Xota (14/11/2026), donde se hicieron dos cambios a 0:00 y el partido se
 * quedó sin saque anotado (ni el aviso de la 2ª parte).
 *
 * Ahora lo que cuenta es que el partido no haya empezado: ningún evento con
 * tiempo jugado y el reloj de la 1ª parte en cero. Un partido ya empezado
 * (aunque sea de antes del 22/8 y no lleve saque) sigue arrancando directo.
 */
import type { Evento, ParteId } from "./db";

export function hayQuePreguntarSaque(
  parte: ParteId,
  saqueInicial1T: "INTER" | "RIVAL" | undefined,
  segundosParte: number | undefined,
  eventos: readonly Pick<Evento, "parte" | "segundosPartido">[],
): boolean {
  if (saqueInicial1T) return false;
  if (parte !== "1T") return false;
  if ((segundosParte ?? 0) > 0) return false;
  return eventos.every((e) => e.parte === "1T" && (e.segundosPartido ?? 0) === 0);
}
