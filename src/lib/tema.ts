/**
 * tema.ts — Colores del aspecto NUEVO del crono (rediseño, tanda 1 · 16/11/2026).
 *
 * Solo cuentas de color, sin React ni nada del navegador (así se prueba con
 * `node --experimental-strip-types src/lib/tema.test.ts`).
 *
 * La regla que vigila: lo NUESTRO va del color del club (clientes.ts) y lo del
 * RIVAL de un color genérico, el coral. Si el color del club se parece al coral
 * (un club rojo, naranja o coral), el rival pasa solo a otro color de la lista.
 * «Se parece» se mide, no se decide a ojo: diferencia de tono (rueda de color)
 * Y diferencia de color percibida (ΔE en el espacio Lab).
 */

export interface ParColor {
  /** En el modo Pabellón (fondo azul noche). */
  oscuro: string;
  /** En el modo Sol (fondo claro). */
  sol: string;
}

/** Candidatos para el rival, por orden de preferencia. El primero es el coral. */
export const RIVAL_CANDIDATOS: ParColor[] = [
  { oscuro: "#ff7a6b", sol: "#c8321f" }, // coral
  { oscuro: "#2ed3e6", sol: "#0b7f8f" }, // cian
  { oscuro: "#c08bff", sol: "#7a3fd0" }, // violeta
];

/** Umbrales para dar dos colores por «distintos». */
export const MIN_DIF_TONO = 40;   // grados en la rueda de color
export const MIN_DELTA_E = 35;    // ΔE76 en Lab

export function hexARgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alfa: number): string {
  const [r, g, b] = hexARgb(hex);
  return `rgba(${r},${g},${b},${alfa})`;
}

/** Tono (0-360) y saturación (0-1) en HSL. */
export function tonoYSaturacion(hex: string): { tono: number; sat: number } {
  const [r, g, b] = hexARgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { tono: 0, sat: 0 };
  const sat = d / (1 - Math.abs(2 * l - 1));
  let tono: number;
  if (max === r) tono = ((g - b) / d) % 6;
  else if (max === g) tono = (b - r) / d + 2;
  else tono = (r - g) / d + 4;
  tono *= 60;
  if (tono < 0) tono += 360;
  return { tono, sat };
}

export function difTono(a: string, b: string): number {
  const A = tonoYSaturacion(a), B = tonoYSaturacion(b);
  // Un gris no tiene tono: cuenta como «tono completamente distinto» y decide ΔE.
  if (A.sat < 0.15 || B.sat < 0.15) return 180;
  const d = Math.abs(A.tono - B.tono) % 360;
  return d > 180 ? 360 - d : d;
}

function lab(hex: string): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexARgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Diferencia de color percibida (ΔE76). Por debajo de ~35, se confunden. */
export function deltaE(a: string, b: string): number {
  const A = lab(a), B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

export function seDistinguen(a: string, b: string): boolean {
  return difTono(a, b) >= MIN_DIF_TONO && deltaE(a, b) >= MIN_DELTA_E;
}

/**
 * El color del rival para un club: el coral salvo que se parezca al del club.
 * Se mira en los DOS modos (Pabellón y Sol), para que el rival no cambie de
 * familia al pasar de uno a otro.
 */
export function elegirRival(propio: ParColor, candidatos: ParColor[] = RIVAL_CANDIDATOS): ParColor {
  for (const c of candidatos) {
    if (seDistinguen(propio.oscuro, c.oscuro) && seDistinguen(propio.sol, c.sol)) return c;
  }
  return candidatos[0];
}

/**
 * Variables CSS de los dos equipos para una pantalla con el aspecto nuevo
 * (tanda 3 · 18/11/2026: inicio y partido nuevo). --nos y --rival como en la
 * pantalla del partido; --nos-suave es el tinte de fondo de lo «elegido» y
 * --sobre-nos el color de la letra encima de un botón relleno con --nos.
 */
export function variablesEquipos(propio: ParColor, sol: boolean): Record<string, string> {
  const nos = sol ? propio.sol : propio.oscuro;
  const par = elegirRival(propio);
  return {
    "--nos": nos,
    "--nos-suave": rgba(nos, sol ? 0.1 : 0.16),
    "--rival": sol ? par.sol : par.oscuro,
    "--sobre-nos": sol ? "#ffffff" : "#04152a",
  };
}
