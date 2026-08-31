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
  /** Color de acento: títulos, barras y dorsales. En papel, todo lo demás
   *  va en negro sobre blanco — un informe a todo color se imprime fatal. */
  color: string;
  /** Línea del pie. */
  pie: string;
}

const BASE = process.env.NEXT_PUBLIC_BASEPATH || "";

export const MARCA_INFORME: MarcaInforme = {
  nombre: "PULSO",
  escudo: `${BASE}/marca.png`,
  color: "#0d7a4f",
  pie: "Generado con PULSO desde el crono del banquillo · pulso.futsal",
};
