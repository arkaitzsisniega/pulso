/**
 * geometriaCampo.ts — De un punto del campo a su zona, y del toque en la
 * pantalla a ese punto (18/9/2026, para la flecha del pase de gol).
 *
 * Hasta ahora las zonas solo existían como dibujo: `Campo` pinta las 20
 * (A1..A10 y D1..D10) y cada una responde a su toque. La flecha del pase de gol
 * guarda un PUNTO (ver `Flecha` en db.ts), y la zona hay que sacarla de ese
 * punto con las mismas formas que dibuja `Campo`: el área con sus cuartos de
 * círculo de 6 m, las bandas de 2,5 m y las líneas de 10 m.
 *
 * Las medidas se copian de `components/Campo.tsx` en vez de importarlas para
 * poder probar esto con node, sin React. Que no se separen lo vigila el test,
 * que lee Campo.tsx como texto y compara:
 *   node --experimental-strip-types src/lib/geometriaCampo.test.ts
 *
 * Sin dependencias: ni React, ni Dexie, ni el cliente activo.
 */

// ── Medidas del dibujo (1 m = 20 px; el SVG mide 800 × 400) ─────────────────
export const M = 20;
export const W = 40 * M;                  // 800
export const H = 20 * M;                  // 400
export const POSTE_SUP_Y = H / 2 - 1.5 * M;   // 170
export const POSTE_INF_Y = H / 2 + 1.5 * M;   // 230
export const R_AREA = 6 * M;                  // 120
export const BANDA_SUP_Y = 2.5 * M;           // 50
export const BANDA_INF_Y = H - 2.5 * M;       // 350
export const X_MEDIA = W / 2;                 // 400
export const Y_CENTRO = H / 2;                // 200

/** Largo y ancho del campo en metros. */
export const LARGO_M = W / M;   // 40
export const ANCHO_M = H / M;   // 20

/** Lo más corta que puede ser la flecha de un pase: 1 metro. Menos que eso es
 *  un toque que se ha ido del dedo, no un pase. */
export const FLECHA_MIN_M = 1;

export interface PuntoCampo { x: number; y: number }

/** Un número del 0 al 1 con 3 decimales: lo que se guarda. */
export function normalizar(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const c = Math.min(1, Math.max(0, v));
  return Math.round(c * 1000) / 1000;
}

/**
 * Del punto tocado en el dibujo al punto del campo que se guarda.
 *
 * `px`, `py` son coordenadas del SVG (0..800, 0..400) tal como se ve en la
 * pantalla. Si en esa parte atacamos hacia la izquierda, `Campo` gira el
 * dibujo 180°: lo que se ve arriba a la izquierda es, en el campo, abajo a la
 * derecha. Aquí se deshace el giro para que el dato sea siempre el mismo
 * mirando con nuestro ataque hacia la derecha.
 */
export function aCanonico(px: number, py: number, direccion: "izq" | "der"): PuntoCampo {
  const x = px / W;
  const y = py / H;
  return direccion === "izq"
    ? { x: normalizar(1 - x), y: normalizar(1 - y) }
    : { x: normalizar(x), y: normalizar(y) };
}

/**
 * Zona de un punto del campo (coordenadas 0–1, nuestro ataque a la derecha):
 * "A1".."A10" en la mitad del rival, "D1".."D10" en la nuestra.
 *
 * Las mismas formas que `Campo`: 1 y 2 el área (cuarto de círculo de 6 m desde
 * cada poste y la recta entre ellos), 3 y 6 las bandas de los primeros 10 m, 4
 * y 5 el centro de los primeros 10 m, 7 y 10 las bandas de los segundos 10 m,
 * 8 y 9 su centro. Arriba (1, 3, 4, 7, 8) es la banda izquierda según
 * atacamos. En una raya exacta gana la zona que `Campo` pinta encima, que es la
 * que recibe el toque.
 */
export function zonaDePunto(x: number, y: number): string {
  const X = normalizar(x) * W;
  const Y = normalizar(y) * H;
  // La media del rival a la derecha; la nuestra es su espejo horizontal.
  const ataque = X >= X_MEDIA;
  const pre = ataque ? "A" : "D";
  const Xa = ataque ? X : W - X;      // distancia a la línea de fondo = W − Xa
  const X10 = W - 10 * M;             // 600: la línea de 10 m
  const XAREA = W - R_AREA;           // 680: la recta del área

  // Área: se pinta la última, así que manda sobre 4 y 5.
  if (Y < Y_CENTRO) {
    const enRecta = Xa >= XAREA && Y >= POSTE_SUP_Y;
    const enArco = Y < POSTE_SUP_Y && Math.hypot(W - Xa, POSTE_SUP_Y - Y) <= R_AREA;
    if (enRecta || enArco) return `${pre}1`;
  } else {
    const enRecta = Xa >= XAREA && Y <= POSTE_INF_Y;
    const enArco = Y > POSTE_INF_Y && Math.hypot(W - Xa, Y - POSTE_INF_Y) <= R_AREA;
    if (enRecta || enArco) return `${pre}2`;
  }

  const primeros10 = Xa > X10;        // en la raya de 10 m manda la de fuera
  if (Y < BANDA_SUP_Y) return `${pre}${primeros10 ? 3 : 7}`;
  if (Y > BANDA_INF_Y) return `${pre}${primeros10 ? 6 : 10}`;
  if (Y < Y_CENTRO) return `${pre}${primeros10 ? 4 : 8}`;
  return `${pre}${primeros10 ? 5 : 9}`;
}

/** Largo de la flecha en metros. */
export function largoFlechaM(f: { x0: number; y0: number; x1: number; y1: number }): number {
  return Math.hypot((f.x1 - f.x0) * LARGO_M, (f.y1 - f.y0) * ANCHO_M);
}

/** ¿Es una flecha de verdad? Tiene que medir al menos `FLECHA_MIN_M`. */
export function flechaSuficiente(f: { x0: number; y0: number; x1: number; y1: number } | null | undefined): boolean {
  if (!f) return false;
  const nums = [f.x0, f.y0, f.x1, f.y1];
  if (!nums.every((v) => typeof v === "number" && Number.isFinite(v))) return false;
  return largoFlechaM(f) >= FLECHA_MIN_M;
}

/** Zona de salida y de llegada de una flecha. */
export function zonasDeFlecha(f: { x0: number; y0: number; x1: number; y1: number }): { origen: string; destino: string } {
  return { origen: zonaDePunto(f.x0, f.y0), destino: zonaDePunto(f.x1, f.y1) };
}
