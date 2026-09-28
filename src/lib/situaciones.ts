/**
 * situaciones.ts — Las SITUACIONES DE GOL: la lista, en UN solo sitio (28/9/2026).
 *
 * De qué nació el gol: un córner, un contraataque, un robo en zona alta… Se
 * elige en el modal del botón ⚽ GOL, se puede cambiar en el editor
 * post-partido, y viaja al club en `evento.accion` → `EST_EVENTOS.accion`.
 *
 * POR QUÉ ESTE FICHERO
 * La lista estaba escrita a mano en TRES sitios —el modal del partido
 * (`app/partido/page.tsx`), el editor post-partido (`components/EditorEventos.tsx`)
 * y el mapa de etiquetas de `lib/i18n.ts`— y ya no eran la misma: al editor le
 * faltaban «Incorporación de portero» y «Defensa de incorporación», así que al
 * abrir un gol apuntado con una de ellas el desplegable no la tenía y enseñaba
 * OTRA en su sitio. Un nombre equivocado no avisa: parece un dato bueno. Es el
 * mismo cuento que ya mató `lib/lanzamientos.ts` con la FSB y `lib/acciones.ts`
 * con las acciones individuales.
 *
 * ⚠️ EL VALOR NO SE TRADUCE. Lo que se guarda en el evento es SIEMPRE el
 * español de esta lista: el club lo lee tal cual y `lib/lanzamientos.ts`
 * compara con "Penalti" / "10m" / "FSB". Lo único que se traduce es la ETIQUETA
 * del botón, vía `labelAccionGol()` de `lib/i18n.ts`.
 *
 * LAS PAREJAS CON ESPEJO — el mismo gol, dos nombres
 * Hay jugadas que se llaman distinto según quién las mire, y el crono tiene un
 * botón para cada lado porque el mismo modal sirve para un gol nuestro y para
 * uno del rival:
 *
 *   marcamos nosotros                    nos lo meten
 *   ───────────────────────────────────  ────────────────────────────────────
 *   Defensa de incorporación             Pérdida en incorporación de portero
 *   Robo zona alta                       Pérdida en salida de presión  ← 28/9
 *
 * «Pérdida en salida de presión» la pidió Arkaitz el 28/9/2026: «lo apuntamos
 * como pérdida en salida de presión, porque es una pérdida nuestra en salida de
 * presión». En el club ese gol entra así en NUESTRAS hojas y, al pasarlo al
 * scouting del rival —que es quien marcó—, se convierte en su «Robo en zona
 * alta». Eso lo hace el club (`src/situaciones.py`), no el crono: aquí solo se
 * apunta lo que se ve.
 *
 * «Pérdida en incorporación de portero» nació ese mismo día, un poco después:
 * el club le había abierto columna propia en el informe (PIP) y el crono no
 * tenía botón, así que ese gol solo podía apuntarse editando el partido en la
 * web al día siguiente. En directo se pulsaba «Incorporación de portero», que
 * en el club es OTRA cosa —atacar con el portero arriba, sin decir quién ganó
 * la jugada—, y la pérdida se perdía. Ahora el trío está completo:
 *
 *   Incorporación de portero              subimos al portero y marcamos
 *   Defensa de incorporación              le robamos el balón al que subió
 *   Pérdida en incorporación de portero   subimos al portero y nos lo meten
 *
 * Sin React ni Dexie, para poder probarlo con node:
 *   node --experimental-strip-types src/lib/situaciones.test.ts
 */

/** Columna izquierda del modal: juego abierto (lo que más se marca). */
export const ACCIONES_GOL_IZQ = [
  "Robo zona alta", "Ataque posicional", "1x1 banda", "Contraataque",
  // «Pérdida en salida de presión» va pegada a «Salida de presión», que es
  // donde se busca por el nombre, y es la pareja de «Robo zona alta» de arriba:
  // el mismo gol, contado por el que lo encaja.
  "2ª jugada", "Salida de presión", "Pérdida en salida de presión",
  // Y la del portero, con su pérdida pegada detrás por el mismo motivo: en
  // directo se busca por el nombre, y las dos empiezan por «Incorporación».
  // Su pareja de verdad —«Defensa de incorporación»— está en la otra columna,
  // igual que «Robo zona alta» está lejos de su pérdida.
  "Incorporación de portero", "Pérdida en incorporación de portero",
] as const;

/** Columna derecha: balón parado y superioridades.
 *  «Incorporación de portero» (atacamos con el portero arriba) y «Defensa de
 *  incorporación» (marcamos con el portero rival subido) van con las
 *  superioridades, que es su familia (pedido de Arkaitz 30/8/2026).
 *  «FSB» (falta sin barrera, 26/9/2026) va pegada al 10 m: es la misma
 *  situación, tirada desde donde fue la falta. */
export const ACCIONES_GOL_DER = [
  "Córner", "Banda", "Falta", "10m", "FSB", "Penalti",
  "5x4", "4x5", "4x3", "3x4", "Defensa de incorporación", "Otra",
] as const;

/** Todas, en el orden de los botones. Es también lo que ofrece el desplegable
 *  del editor post-partido: si ahí faltara una, un gol ya apuntado con ella se
 *  vería con el nombre de otra. */
export const ACCIONES_GOL: string[] = [...ACCIONES_GOL_IZQ, ...ACCIONES_GOL_DER];

/**
 * Acción de gol (el valor canónico en español) → clave del catálogo de
 * `lib/i18n.ts`. Vive aquí, junto a la lista, para que no puedan desparejarse:
 * una acción sin clave saldría en el botón con su nombre en español aunque el
 * crono esté en inglés o en italiano.
 */
export const CLAVE_ACCION_GOL: Record<string, string> = {
  "Córner": "acc_corner", "Banda": "acc_banda", "Falta": "acc_falta",
  "5x4": "acc_5x4", "4x5": "acc_4x5", "4x3": "acc_4x3", "3x4": "acc_3x4",
  "Contraataque": "acc_contraataque", "Robo zona alta": "acc_robo_zona_alta",
  "Salida de presión": "acc_salida_presion",
  "Pérdida en salida de presión": "acc_perdida_salida_presion",
  "1x1 banda": "acc_1x1_banda", "Ataque posicional": "acc_ataque_posicional",
  "10m": "acc_10m", "Penalti": "acc_penalti", "FSB": "acc_fsb",
  "2ª jugada": "acc_2a_jugada", "Otra": "acc_otra",
  "Incorporación de portero": "acc_incorporacion_portero",
  "Pérdida en incorporación de portero": "acc_perdida_incorporacion",
  "Defensa de incorporación": "acc_defensa_incorporacion",
};

/** Formas viejas del mismo valor, para que un partido ya guardado se siga
 *  leyendo bien. «10 m» (con espacio) lo usaba el resumen hasta el 26/9/2026. */
export const ALIAS_ACCION_GOL: Record<string, string> = {
  "10 m": "10m",
};

/** Las parejas con espejo, como las llama el crono: [marcamos, nos lo meten].
 *  Está aquí escrito para que se vea que son DOS botones de la misma jugada y
 *  que ninguno se quede suelto; el que traduce de un lado al otro es el club.
 *
 *  ⚠️ Hasta el 28/9/2026 la pareja de «Defensa de incorporación» era
 *  «Incorporación de portero», y no lo es: en el club «Incorporación del
 *  portero» NO tiene espejo (si uno sube al portero, el otro lo encaja con el
 *  portero rival arriba: es el mismo hecho). El espejo del robo es la PÉRDIDA,
 *  que es la que faltaba por poner. */
export const PAREJAS_ESPEJO: ReadonlyArray<readonly [string, string]> = [
  ["Defensa de incorporación", "Pérdida en incorporación de portero"],
  ["Robo zona alta", "Pérdida en salida de presión"],
] as const;

// ── Aviso temprano: ninguna acción se queda sin etiqueta ─────────────────────
// Dar de alta una situación es añadirla arriba Y darle su clave de i18n.
// Olvidarse de la clave no rompe nada: el botón sale en español para todos, sin
// avisar. Se comprueba al importar, que es cuando todavía se entiende el motivo.
for (const a of ACCIONES_GOL) {
  if (!CLAVE_ACCION_GOL[a]) {
    throw new Error(
      `situaciones.ts: la acción de gol «${a}» no tiene clave en ` +
      `CLAVE_ACCION_GOL. Sin ella su botón sale siempre en español, aunque el ` +
      `crono esté en inglés o en italiano, y nadie se entera.`);
  }
}
for (const [marca, encaja] of PAREJAS_ESPEJO) {
  for (const a of [marca, encaja]) {
    if (!ACCIONES_GOL.includes(a)) {
      throw new Error(
        `situaciones.ts: «${a}» está en PAREJAS_ESPEJO pero no es un botón. ` +
        `Las dos caras de la pareja tienen que poder apuntarse: si falta una, ` +
        `ese gol se apunta con el nombre del otro lado.`);
    }
  }
}
