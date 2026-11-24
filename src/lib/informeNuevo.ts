/**
 * informeNuevo.ts — Las cuentas del informe del partido con el ASPECTO NUEVO
 * (23/11/2026).
 *
 * El informe PDF del club se rediseñó ese día (`pdf_goles_mapas.py`) y Arkaitz
 * eligió para las páginas de goles y de mapas:
 *
 *   Goles — arriba, la línea de tiempo del partido (lo nuestro arriba, lo del
 *           rival abajo, descanso marcado); una tabla limpia (marcador como
 *           chip, situación como etiqueta, quién estaba en pista en UNA línea)
 *           y, al final, el marcador a lo largo del partido en escalones.
 *   Mapas — una fila por equipo: medio campo con sus zonas y la portería al
 *           lado, SIN ceros; en cada cuadrante los goles y, en gris, los
 *           disparos a puerta. Abajo, el campo entero con burbujas por zona.
 *
 * Aquí están solo las cuentas (sin React ni nada del navegador), para que se
 * prueben con `node --experimental-strip-types src/lib/informeNuevo.test.ts`.
 * El dibujo está en `components/InformeNuevo.tsx`. Con el aspecto clásico no se
 * usa nada de esto: el informe sale como siempre.
 */
import { esAccionLanzamiento, esTipoLanzamiento } from "./lanzamientos";

// ──────────────────────────────────────────────────────────────────────────
// Goles
// ──────────────────────────────────────────────────────────────────────────

/** Un gol, ya preparado para dibujarlo (lo arman los dos informes). */
export interface GolNuevo {
  /** Segundo absoluto del partido (la 2ª parte empieza donde acabó la 1ª). */
  seg: number;
  nuestro: boolean;
  /** Marcador tras el gol, nosotros primero. */
  nos: number;
  rival: number;
  /** Quién lo marcó (vacío si no se apuntó). */
  goleador: string;
  asistente: string;
  /** La situación tal como se apuntó (o traducida). */
  situacion: string;
  /** La situación tal como se apuntó, en castellano: decide la familia. */
  situacionOriginal: string;
  /** Nuestro portero en ese momento, si se sabe. */
  portero: string;
  /** Los de campo que estaban en pista. */
  enPista: string[];
}

const ENLACES = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y"]);

/** «BALDOMERO» → «Baldomero», «J.REYES» → «J.Reyes», «CD SERENO» → «CD
 *  Sereno» (las siglas de dos letras se quedan: CD, FS, UD…), «PUERTA DE
 *  HIERRO» → «Puerta de Hierro». Lo que ya viene con minúsculas (un nombre
 *  escrito a mano) se respeta. */
export function nombreBonito(n: string): string {
  const s = String(n ?? "").trim();
  if (!s || s !== s.toUpperCase()) return s;
  return s.replace(/\p{L}+/gu, (w, pos: number) => {
    if (pos > 0 && ENLACES.has(w)) return w.toLowerCase();
    if (w.length <= 2 && !ENLACES.has(w)) return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  });
}

/** «1:05» → «01:05»: los minutos del informe siempre con dos cifras. */
export function minutoAbs(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export type FamiliaSituacion = "superioridad" | "abp" | "transicion" | "ataque";

/** Color de la etiqueta de cada familia (los del PDF del club). */
export const COLOR_FAMILIA: Record<FamiliaSituacion, string> = {
  superioridad: "#0f7f86",
  abp: "#6b4fd8",
  transicion: "#c2620a",
  ataque: "#1565e0",
};

/** Balón parado: córner, banda, falta… y los lanzamientos (penalti, 10 m y
 *  FSB), que los dice `lib/lanzamientos.ts`, no una lista aquí. */
const ABP = new Set(["córner", "corner", "banda", "falta", "doble penalti",
  "saque de banda", "abp"]);
const TRANSICION = ["contraataque", "robo", "pérdida", "perdida", "salida de presión",
  "defensa de incorporación", "transición", "transicion"];

/** La familia de una situación de gol, con el vocabulario del crono
 *  (`lib/situaciones.ts`). Misma regla que `familia()` de pdf_goles_mapas.py. */
export function familiaSituacion(accion: string): FamiliaSituacion {
  const a = String(accion ?? "").trim().toLowerCase();
  if (/\b[345]x[345]\b/.test(a) || a.includes("incorporación de portero")) return "superioridad";
  if (ABP.has(a) || esAccionLanzamiento(String(accion ?? "").trim())) return "abp";
  if (TRANSICION.some((k) => a.includes(k))) return "transicion";
  return "ataque";
}

/** «a favor N · en contra M» y el marcador al descanso. */
export function resumenGoles(goles: GolNuevo[], inicio2T: number) {
  const nos = goles.filter((g) => g.nuestro).length;
  const desc = goles.filter((g) => g.seg < inicio2T);
  const descNos = desc.filter((g) => g.nuestro).length;
  return { nos, rival: goles.length - nos, descNos, descRival: desc.length - descNos };
}

/**
 * Niveles de altura de las etiquetas de la línea de tiempo para que no se
 * monten: cada etiqueta (centrada en `x`, de ancho `ancho`) va al primer nivel
 * en el que no choca con la anterior de ese nivel. Devuelve el nivel de cada
 * una, en el mismo orden (que debe ir de izquierda a derecha).
 */
export function nivelesEtiquetas(xs: number[], ancho: number, hueco = 6): number[] {
  const finNivel: number[] = [];
  return xs.map((x) => {
    const ini = x - ancho / 2;
    let nivel = finNivel.findIndex((fin) => ini >= fin + hueco);
    if (nivel < 0) { nivel = finNivel.length; finNivel.push(0); }
    finNivel[nivel] = x + ancho / 2;
    return nivel;
  });
}

/** El marcador a lo largo del partido: la diferencia de goles (nosotros menos
 *  rival) a partir de cada segundo. Empieza en 0 en el segundo 0 y acaba en
 *  `fin`. Cada gol abre un escalón. */
export function escalonesMarcador(goles: GolNuevo[], fin: number): { seg: number; dif: number }[] {
  const orden = [...goles].sort((a, b) => a.seg - b.seg);
  const out = [{ seg: 0, dif: 0 }];
  for (const g of orden) out.push({ seg: g.seg, dif: g.nos - g.rival });
  // Sin .at(-1): los iPads con Safari 15.0-15.3 no lo tienen.
  const ultimoSeg = orden.length ? orden[orden.length - 1].seg : 0;
  out.push({ seg: Math.max(fin, ultimoSeg), dif: out[out.length - 1].dif });
  return out;
}

/** Hasta dónde llega el eje de tiempo: el partido entero (40′ como mínimo). */
export function finEje(goles: GolNuevo[], finPartido: number): number {
  const ultimo = Math.max(0, ...goles.map((g) => g.seg));
  return Math.max(2400, finPartido, ultimo + 30);
}

// ──────────────────────────────────────────────────────────────────────────
// Mapas
// ──────────────────────────────────────────────────────────────────────────

/** Lo de un equipo para los mapas. */
export interface MapaEquipo {
  /** Goles por zona de la mitad de ataque (A1..A10). */
  campo: Record<string, number>;
  /** Goles marcados desde su propio campo (zonas D* o A11). */
  desdeSuCampo: number;
  /** Goles por cuadrante de la portería (P1..P9). */
  porteria: Record<string, number>;
  /** Disparos a puerta por cuadrante, goles incluidos (P1..P9). */
  aPuerta: Record<string, number>;
  goles: number;
  /** Disparos a puerta en total, tengan cuadrante o no (goles incluidos). */
  aPuertaTotal: number;
}

const vacioMapa = (): MapaEquipo => ({
  campo: {}, desdeSuCampo: 0, porteria: {}, aPuerta: {}, goles: 0, aPuertaTotal: 0,
});

function zonaAtaque(z: unknown): string {
  const s = String(z ?? "").trim().toUpperCase();
  return /^A([1-9]|10)$/.test(s) ? s : "";
}
function esDeSuCampo(z: unknown): boolean {
  const s = String(z ?? "").trim().toUpperCase();
  return s === "A11" || /^D([1-9]|10)$/.test(s);
}
function cuadrante(z: unknown): string {
  const s = String(z ?? "").trim().toUpperCase();
  return /^P[1-9]$/.test(s) ? s : "";
}

/**
 * Cuenta los mapas de los dos equipos a partir de los eventos del partido.
 *
 *  · Goles: los `gol` y los lanzamientos (penalti, 10 m, FSB) convertidos que
 *    NO tienen gol enlazado (si lo tienen, ya cuenta el gol).
 *  · Disparos a puerta: los `disparo` con resultado PUERTA, los goles y los
 *    lanzamientos parados o convertidos, cada uno en su cuadrante. Un disparo
 *    enlazado a un gol (`golId`) no se cuenta dos veces.
 *
 * Las zonas se guardan siempre desde el ataque del que tira, así que las de los
 * dos equipos se leen igual: A* es la mitad que ataca, D* la suya.
 */
export function contarMapas(eventos: readonly unknown[]): { nos: MapaEquipo; rival: MapaEquipo; hayDatos: boolean } {
  const nos = vacioMapa();
  const rival = vacioMapa();
  const sumar = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
  for (const raw of eventos) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const tipo = String(e.tipo ?? "");
    const lado = String(e.equipo ?? "") === "INTER" ? nos : rival;
    const res = String(e.resultado ?? "").toUpperCase();
    const lanzamiento = esTipoLanzamiento(tipo);
    const esGol = tipo === "gol" || (lanzamiento && res === "GOL" && !e.golId);
    const aPuerta = esGol
      || (tipo === "disparo" && res === "PUERTA" && !e.golId)
      || (lanzamiento && res === "PARADA");
    if (!esGol && !aPuerta) continue;
    const q = cuadrante(e.zonaPorteria);
    if (aPuerta) lado.aPuertaTotal += 1;
    if (aPuerta && q) sumar(lado.aPuerta, q);
    if (!esGol) continue;
    lado.goles += 1;
    if (q) sumar(lado.porteria, q);
    if (tipo === "gol") {
      const z = zonaAtaque(e.zonaCampo);
      if (z) sumar(lado.campo, z);
      else if (esDeSuCampo(e.zonaCampo)) lado.desdeSuCampo += 1;
    }
  }
  const hayDatos = [nos, rival].some((m) =>
    Object.keys(m.campo).length || Object.keys(m.aPuerta).length || m.desdeSuCampo);
  return { nos, rival, hayDatos };
}

/** Lo que pesa una burbuja de `v` goles: radio en unidades del dibujo. */
export function radioBurbuja(v: number, max: number, rMin = 14, rMax = 34): number {
  if (v <= 0) return 0;
  const f = Math.sqrt(v / Math.max(1, max));
  return rMin + (rMax - rMin) * f;
}

/** De blanco hacia `color` según v/max (como `_escala` del PDF); "" si es cero. */
export function tinteZona(v: number, max: number, color: string): string {
  if (max <= 0 || v <= 0) return "";
  const f = 0.25 + 0.75 * Math.min(1, v / max);
  return mezclar("#ffffff", color, f);
}

/** Mezcla dos colores «#rrggbb» (t = 0 → a, t = 1 → b). */
export function mezclar(a: string, b: string, t: number): string {
  const rgb = (h: string) => {
    const s = h.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  };
  const x = rgb(a), y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** ¿Letra blanca o tinta oscura sobre este fondo? */
export function tintaSobre(fondo: string): "#ffffff" | "#0b1b33" {
  const s = fondo.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.55 ? "#ffffff" : "#0b1b33";
}
