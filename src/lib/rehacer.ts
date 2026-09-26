/**
 * rehacer.ts — La cabecera del partido que se REHACE con vídeo (26/9/2026).
 *
 * «🎥 Rehacer con vídeo» crea un partido nuevo con la config del original.
 * Hasta hoy la copiaba tal cual, y casa/fuera solo se elige al crear el
 * partido: si en el del directo salió mal, el rehecho heredaba el fallo y no
 * había forma de arreglarlo (se lo dijo a Arkaitz el compañero que registra
 * los partidos). Ahora, al rehacer, se elige EN CASA / FUERA con lo del
 * original ya marcado.
 *
 * Importa más de lo que parece: de `local` salen el marcador del informe (quién
 * va a la izquierda), el «casa/fuera» de Totales y el LOCAL/VISITANTE que el
 * club guarda al subir el partido.
 *
 * El original NO se toca: se devuelve una config nueva.
 *
 * Sin dependencias de React ni Dexie:
 *   node --experimental-strip-types src/lib/rehacer.test.ts
 */
import type { ConfigPartido } from "./db";

/** Lo que se puede corregir al rehacer. Lo que no venga se queda como en el
 *  original. */
export interface CambiosRehacer {
  /** true = jugamos en casa; false = fuera. */
  local?: boolean;
}

/** ¿El original dice que jugamos en casa? Es lo que sale marcado al rehacer.
 *  Un partido sin el dato cuenta como fuera, igual que la casilla de «Nuevo
 *  partido», que empieza desmarcada. */
export function jugabamosEnCasa(config: Pick<ConfigPartido, "local"> | null | undefined): boolean {
  return config?.local === true;
}

export function configParaRehacer(original: ConfigPartido, cambios: CambiosRehacer = {}): ConfigPartido {
  const nueva: ConfigPartido = {
    ...original,
    convocados: [...(original.convocados ?? [])],
    pista_inicial: { ...original.pista_inicial },
    duracionParte: { ...original.duracionParte },
  };
  if (typeof cambios.local === "boolean") nueva.local = cambios.local;
  return nueva;
}
