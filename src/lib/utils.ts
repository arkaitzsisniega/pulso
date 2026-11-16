/**
 * Helpers comunes: formato de tiempos, cálculo de minutos en pista, etc.
 */

/** Segundos → "MM:SS" */
export function formatMMSS(segundos: number): string {
  if (!isFinite(segundos) || segundos < 0) segundos = 0;
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Segundos → "M:SS" más compacto (sin ceros a la izquierda en min) */
export function formatMSS(segundos: number): string {
  if (!isFinite(segundos) || segundos < 0) segundos = 0;
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Color de fondo según minutos en pista del turno actual.
 *   <1' azul (recién entrado), 1-2' verde (OK), 2-3' amarillo (atento),
 *   ≥3' rojo (cambia ya). Definido por Arkaitz.
 *
 * NOTA: el portero NO usa esta función (su tiempo no es crítico). En el
 * componente que lo dibuja se le pone un estilo neutro distinto.
 */
export function colorTiempoPista(segundos: number): string {
  if (segundos < 60) return "bg-blue-600";
  if (segundos < 120) return "bg-green-600";
  if (segundos < 180) return "bg-yellow-500";
  return "bg-red-600";
}

/**
 * Color del cuadro de banquillo que refleja FATIGA RESIDUAL.
 *
 * Idea (definida con Arkaitz, 16/5/2026): cuando un jugador sale de pista
 * en rojo (≥3min jugados de tirón), durante el primer minuto en banquillo
 * sigue siendo "rojo" porque sigue cansado. Cada minuto en banquillo
 * recupera un nivel (rojo → amarillo → verde → azul → gris).
 *
 * Niveles (mismos que pista):
 *   0 = AZUL (<1min jugado en su última rotación = recién entró, fresco)
 *   1 = VERDE (1-2min)
 *   2 = AMARILLO (2-3min)
 *   3 = ROJO (≥3min, cansado)
 *
 * Cada minuto en banquillo el nivel baja 1. Cuando llega a -1 = GRIS
 * (totalmente descansado).
 *
 * Los colores son LIGHT/PALETA SUAVE para distinguir visualmente del
 * cuadro de pista (más intensos).
 */
function nivelDePista(segundosTurno: number): number {
  if (segundosTurno < 60) return 0;
  if (segundosTurno < 120) return 1;
  if (segundosTurno < 180) return 2;
  return 3;
}

const COLOR_BANQUILLO_POR_NIVEL = [
  "bg-blue-400/40",     // nivel 0 - AZUL light (fresco al salir)
  "bg-green-400/40",    // nivel 1 - VERDE light
  "bg-yellow-300/40",   // nivel 2 - AMARILLO light
  "bg-red-400/40",      // nivel 3 - ROJO light (recién salió cansado)
];
const COLOR_BANQUILLO_FRESCO = "bg-zinc-700/60";  // gris suave

export function colorTiempoBanquillo(
  segBanquillo: number,
  segUltimoTurno: number | null | undefined = null
): string {
  const nivelActual = nivelTiempoBanquillo(segBanquillo, segUltimoTurno);
  if (nivelActual < 0) return COLOR_BANQUILLO_FRESCO;
  return COLOR_BANQUILLO_POR_NIVEL[nivelActual];
}

/**
 * El NIVEL del semáforo (0 azul · 1 verde · 2 amarillo · 3 rojo) en vez de la
 * clase de color. Lo usa el aspecto NUEVO del crono (rediseño, tanda 1,
 * 16/11/2026), que pinta el color solo en el número y en una franja, no la
 * ficha entera. Mismos umbrales que colorTiempoPista (lo vigila utils.test.ts).
 */
export function nivelTiempoPista(segundos: number): 0 | 1 | 2 | 3 {
  return nivelDePista(segundos) as 0 | 1 | 2 | 3;
}

/**
 * Nivel de fatiga residual en el banquillo: el de la última rotación menos un
 * nivel por minuto sentado; -1 = descansado (gris). Es EXACTAMENTE el cálculo
 * que siempre hizo colorTiempoBanquillo, que ahora lo usa por debajo.
 */
export function nivelTiempoBanquillo(
  segBanquillo: number,
  segUltimoTurno: number | null | undefined = null
): -1 | 0 | 1 | 2 | 3 {
  // Si nunca estuvo en pista (segUltimoTurno null/0), está fresco por defecto.
  if (!segUltimoTurno || segUltimoTurno <= 0) return -1;
  const nivelSalida = nivelDePista(segUltimoTurno);
  const minutosBanquillo = Math.floor(segBanquillo / 60);
  const nivelActual = nivelSalida - minutosBanquillo;
  if (nivelActual < 0) return -1;
  return nivelActual as 0 | 1 | 2 | 3;
}

/** Generar UUID corto sin dependencias. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** ISO yyyy-mm-dd de la fecha actual */
export function hoyISO(): string {
  // Importante: usar hora LOCAL, no UTC. Si usáramos toISOString() podríamos
  // devolver el día siguiente o anterior según la diferencia con UTC, y eso
  // rompe la hidratación de React (el servidor SSR y el cliente calculan en
  // momentos distintos → si cruza medianoche UTC entre uno y otro, distinta
  // fecha → toda la página queda sin handlers de onClick).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
