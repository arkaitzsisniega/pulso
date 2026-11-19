/**
 * Hueco para el botón flotante de iniciar/pausar en las ventanas del aspecto
 * nuevo (19/11/2026).
 *
 * El botón va SIEMPRE por encima de las ventanas, a propósito: en futsal el
 * reloj se arranca y se para sin dejar de apuntar, también con una ventana
 * abierta (pedido de Arkaitz, 10/8/2026, commit 0690d04). Por eso no se
 * esconde debajo de la capa oscura. Pero en una ventana alta (la de un
 * jugador, la de gol con todos los pasos) caía encima de su esquina de arriba
 * a la derecha.
 *
 * Arreglo: el botón no se mueve (se pulsa de memoria, siempre en el mismo
 * sitio) y es la VENTANA la que se aparta:
 *  - en horizontal (iPad apaisado), se le quita a la capa por la derecha el
 *    ancho del botón: la ventana se centra en lo que queda, a su izquierda,
 *    y no pierde alto;
 *  - si así quedara demasiado estrecha (iPad en vertical, móvil), se baja por
 *    debajo del botón.
 * Las ventanas pequeñas o estrechas, que no llegan al botón, no cambian.
 */
export type Caja = { left: number; right: number; top: number; bottom: number };

/** Aire entre el botón y la ventana. */
export const AIRE_FLOTANTE = 12;
/** Margen normal de la capa (p-4 de Tailwind). */
export const MARGEN_CAPA = 16;
/** Ancho mínimo que debe quedar para apartarla en horizontal. */
export const ANCHO_MINIMO = 700;

export type Hueco =
  | { lado: "ninguno" }
  | { lado: "derecha"; px: number }
  | { lado: "arriba"; px: number };

/**
 * `panel` es la caja de la ventana colocada SIN hueco (centrada como siempre),
 * `boton` la del flotante (null si no está) y `anchoVentana` el ancho de la
 * pantalla. Devuelve el relleno que hay que darle a la capa y por qué lado.
 */
export function huecoFlotante(panel: Caja, boton: Caja | null, anchoVentana: number): Hueco {
  if (!boton) return { lado: "ninguno" };
  const pisaAncho = boton.left < panel.right + AIRE_FLOTANTE && boton.right > panel.left;
  const pisaAlto = boton.top < panel.bottom && boton.bottom + AIRE_FLOTANTE > panel.top;
  if (!pisaAncho || !pisaAlto) return { lado: "ninguno" };
  const derecha = Math.ceil(anchoVentana - boton.left + AIRE_FLOTANTE);
  if (anchoVentana - derecha - MARGEN_CAPA >= ANCHO_MINIMO) return { lado: "derecha", px: derecha };
  return { lado: "arriba", px: Math.ceil(boton.bottom + AIRE_FLOTANTE) };
}
