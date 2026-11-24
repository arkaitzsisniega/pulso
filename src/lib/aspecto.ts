"use client";

/**
 * aspecto.ts — Preferencias VISUALES del crono, guardadas en el aparato.
 *
 * ── Desde el 15/12/2026: SIN INTERRUPTOR (decisión de Arkaitz, 19/11/2026) ──
 * Ya no se elige entre «nuevo» y «clásico»: TODOS los clientes (Inter, filial,
 * juvenil y la demo) van siempre con el aspecto NUEVO. `useAspecto()` devuelve
 * "nuevo" siempre, también en el HTML que se genera al publicar (antes ese HTML
 * salía en clásico para Inter, filial y juvenil y luego cambiaba).
 *
 * Migración: un iPad que tenía guardado «clásico» (clave `crono_aspecto_<club>`)
 * pasa al nuevo sin hacer nada: esa clave ya NO se lee, y tampoco se borra
 * (no se toca la memoria del aparato; los partidos viven aparte, en IndexedDB,
 * y no dependen de esto). Si hubiera que volver atrás, cada iPad recuperaría la
 * elección que tenía.
 *
 * Lo que SIGUE: el modo «Sol» (claro) o Pabellón (oscuro, por defecto), que es
 * una opción del aspecto nuevo y se cambia de un toque en las pantallas.
 * Cada club guarda lo suyo con su propia clave: los cuatro cronos se publican
 * en el MISMO sitio web (misma memoria del navegador).
 *
 * PARA BORRAR MÁS ADELANTE (cuando el nuevo lleve un tiempo sin problemas):
 * el código del aspecto clásico ya no es alcanzable, pero se deja para poder
 * volver atrás. Se podrá quitar:
 *   · el tipo `Aspecto` y `useAspecto()` (y cada `aspecto === "nuevo"` /
 *     `nuevo ? … : …` de app/page, nuevo, partido, resumen, totales, informe
 *     y components/InformeCompleto: quedarse con la rama nueva);
 *   · el JSX clásico de esas páginas (el `return` de después del
 *     `if (nuevo) return …`) y el `InformeClasico` sin piel nueva;
 *   · los «sin proveedor = clásico» de DirectoNuevo/ResumenNuevo/InformeNuevo
 *     (`conIconos`, `ic`, `piel`, `InformeNuevoCtx`…), que pasarán a fijos;
 *   · el CSS `.pz-ini-aspecto` de tema-nuevo.css y los textos i18n
 *     `pz_aspecto_*` (ya no los pinta nadie);
 *   · los tests que vigilan el clásico (manifest.test «botón de tiempo del
 *     aspecto clásico», huecoFlotante.test «el clásico no se toca»,
 *     importarPartido.test «aspecto clásico: botón…»).
 */
import { useSyncExternalStore } from "react";
import { CLIENTE } from "@/lib/clientes";

/** Se mantiene el tipo para que el código del clásico (ya inalcanzable) compile. */
export type Aspecto = "nuevo" | "clasico";

/** El aspecto de todos los clientes desde el 15/12/2026. */
export const ASPECTO_UNICO: Aspecto = "nuevo";

const CLAVE_SOL = `crono_sol_${CLIENTE.id}`;
const EVENTO = "crono-aspecto";

function leer(clave: string): string | null {
  try { return window.localStorage.getItem(clave); } catch { return null; }
}
function escribir(clave: string, valor: string) {
  try { window.localStorage.setItem(clave, valor); } catch { /* modo privado: dura la sesión */ }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Siempre el nuevo. No es un hook de verdad (no lee nada): se deja con este
 *  nombre para no tocar las pantallas que lo llaman. */
export function useAspecto(): Aspecto {
  return ASPECTO_UNICO;
}

export function useModoSol(): boolean {
  return useSyncExternalStore(suscribir, () => leer(CLAVE_SOL) === "1", () => false);
}
export function setModoSol(sol: boolean) { escribir(CLAVE_SOL, sol ? "1" : "0"); }
