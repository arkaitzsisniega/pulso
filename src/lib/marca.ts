/**
 * marca.ts — La marca que sale en el informe del partido.
 *
 * Está en un fichero suyo A PROPÓSITO. Hoy el informe lleva la marca PULSO,
 * pero en cuanto un club compre el crono va a querer SU escudo y SU nombre en
 * el documento que enseña a su directiva — es lo primero que se pide. Con esto,
 * ese cambio son tres valores y no una cacería por media docena de ficheros.
 *
 * El día que haga falta que cada club se lo configure él mismo, esto pasa a
 * leerse de una pantalla de ajustes guardada en el aparato; la forma del objeto
 * no cambia.
 */
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

const BASE = process.env.NEXT_PUBLIC_BASEPATH || "";

export const MARCA_INFORME: MarcaInforme = {
  nombre: "PULSO",
  escudo: `${BASE}/marca.png`,
  color: "#0d7a4f",
  colorRival: "#b3261e",
  colorAcento: "#b8912e",
  // Sin dominio en el pie hasta que exista de verdad: una dirección inventada
  // en un documento que se manda a un club se descubre al primer clic.
  pie: "Generado con PULSO desde el crono del banquillo",
  origen: "Diseñado y utilizado por Inter JP Financial",
};
