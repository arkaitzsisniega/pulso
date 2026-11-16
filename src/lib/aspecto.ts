"use client";

/**
 * aspecto.ts — Las dos preferencias VISUALES del crono, guardadas en el aparato
 * (rediseño, tanda 1 · 16/11/2026):
 *
 *   · Aspecto «nuevo» o «clásico». Por defecto, el de cada club
 *     (CLIENTE.aspectoPorDefecto): la demo arranca en nuevo; Inter, filial y
 *     juvenil en clásico hasta que alguien lo active en SU iPad. Se cambia en
 *     la pantalla de inicio, nunca dentro del partido (para no tocarlo sin
 *     querer con el reloj corriendo).
 *   · Modo «Sol» (claro) o Pabellón (oscuro, el de por defecto). Solo existe
 *     en el aspecto nuevo y se cambia de un toque en la pantalla del partido.
 *
 * Solo cambian cómo se ve. No tocan el partido, ni los datos, ni los cálculos.
 *
 * Cada club guarda lo suyo con su propia clave: los cuatro cronos se publican
 * en el MISMO sitio web (misma memoria del navegador) y si el filial activa el
 * aspecto nuevo no debe cambiarle el del primer equipo en el mismo iPad.
 */
import { useSyncExternalStore } from "react";
import { CLIENTE } from "@/lib/clientes";

export type Aspecto = "nuevo" | "clasico";

const CLAVE_ASPECTO = `crono_aspecto_${CLIENTE.id}`;
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

function aspectoActual(): Aspecto {
  const v = leer(CLAVE_ASPECTO);
  return v === "nuevo" || v === "clasico" ? v : CLIENTE.aspectoPorDefecto;
}

export function useAspecto(): Aspecto {
  return useSyncExternalStore(suscribir, aspectoActual, () => CLIENTE.aspectoPorDefecto);
}
export function setAspecto(a: Aspecto) { escribir(CLAVE_ASPECTO, a); }

export function useModoSol(): boolean {
  return useSyncExternalStore(suscribir, () => leer(CLAVE_SOL) === "1", () => false);
}
export function setModoSol(sol: boolean) { escribir(CLAVE_SOL, sol ? "1" : "0"); }
