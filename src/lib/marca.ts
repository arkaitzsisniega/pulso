/**
 * marca.ts — La marca que sale en el informe del partido.
 *
 * Desde el 21/11/2026 cada club lleva en el informe SU escudo, SU nombre y SU
 * color (el `colorPropio.sol` de `lib/clientes.ts`, el del modo claro: el
 * informe es papel blanco). Sale todo de su entrada en `clientes.ts`, así que
 * un club nuevo sigue siendo «su png + una línea». La DEMO no es un club:
 * lleva la marca PULSO de siempre (`public/marca.png` y el verde de antes).
 *
 * El rival va en rojo, salvo que el club sea de un color que se le parezca:
 * entonces sale otro de la lista de `lib/tema.ts` (como en el aspecto nuevo).
 *
 * El día que haga falta que cada club se lo configure él mismo, esto pasa a
 * leerse de una pantalla de ajustes guardada en el aparato; la forma del objeto
 * no cambia.
 */
import { elegirRival, seDistinguen, type ParColor } from "./tema";
import { rutaEscudo } from "./escudo";
import { CLIENTE } from "@/lib/clientes";

export interface MarcaInforme {
  /** Sale arriba, en pequeño, encima del marcador. */
  nombre: string;
  /** Ruta pública de la imagen, o null para no enseñar ninguna. */
  escudo: string | null;
  /** Color de acento: títulos, barras y dorsales. */
  color: string;
  /** El del rival: todo lo suyo va de este color, en el informe entero. Que se
   *  distinga de un vistazo lo nuestro de lo suyo es media lectura. */
  colorRival: string;
  /** Acento cálido para lo que hay que mirar (avisos, mejores registros). */
  colorAcento: string;
  /** Línea del pie. */
  pie: string;
  /** Quién está detrás. El club autorizó (31/8/2026) vender el crono diciendo
   *  que se diseñó y se usa en el Inter: es el aval que distingue esto de una
   *  app hecha por alguien que nunca se ha sentado en un banquillo. */
  origen: string;
}

/** Lo que el informe necesita saber del club (un trozo de `ConfigCliente`). */
export interface ClubInforme {
  demo: boolean;
  nombreLargo: string;
  escudo: string;
  escudoInforme?: string;
  colorPropio: ParColor;
}

/** El rojo del rival de siempre. */
export const ROJO_RIVAL = "#b3261e";

/** Pie y autoría: iguales en todos los informes. PULSO es de Arkaitz, y el
 *  club autorizó (31/8/2026) decir que se usa en el Inter. */
const PIE = "Generado con PULSO desde el crono del banquillo";
const ORIGEN = "Creado por Arkaitz Sisniega (preparador físico de Inter JP Financial)";

/** La marca PULSO, la de la demo (y la de todos hasta el 21/11/2026). */
export function marcaPulso(base: string): MarcaInforme {
  return {
    nombre: "PULSO",
    escudo: `${base}/marca.png`,
    color: "#0d7a4f",
    colorRival: ROJO_RIVAL,
    colorAcento: "#b8912e",
    // Sin dominio en el pie hasta que exista de verdad: una dirección inventada
    // en un documento que se manda a un club se descubre al primer clic.
    pie: PIE,
    origen: ORIGEN,
  };
}

/** La ruta (relativa a `public/`) de la imagen del informe de un club. */
export function ficheroEscudoInforme(club: ClubInforme): string {
  return club.escudoInforme || club.escudo;
}

/** La marca del informe para un club. Pura, para poder probarla. */
export function construirMarcaInforme(club: ClubInforme, base: string): MarcaInforme {
  if (club.demo) return marcaPulso(base);
  const color = club.colorPropio.sol;
  // El rojo de siempre si se distingue del color del club; si no (un club
  // rojo o naranja), el primero de la lista que se distinga.
  const rojoVale = seDistinguen(color, ROJO_RIVAL);
  return {
    ...marcaPulso(base),
    nombre: club.nombreLargo,
    escudo: rutaEscudo(base, ficheroEscudoInforme(club)),
    color,
    colorRival: rojoVale ? ROJO_RIVAL : elegirRival(club.colorPropio).sol,
  };
}

const BASE = process.env.NEXT_PUBLIC_BASEPATH || "";

/** La marca del informe de ESTE build (el cliente se fija al construir). */
export const MARCA_INFORME: MarcaInforme = construirMarcaInforme(CLIENTE, BASE);
