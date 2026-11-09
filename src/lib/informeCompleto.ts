/**
 * informeCompleto.ts — Las cuentas del informe de partido de PULSO (9/11/2026).
 *
 * Por qué existe: Arkaitz va a enseñar PULSO a un entrenador que trabaja con
 * selecciones y clubes asiáticos y quiere que el informe que sale de la app se
 * parezca —o sea igual— al que sale cuando el partido sube a Alfred
 * (`src/pdf_partido.py` del repo del club), sin nada de Oliver ni de carga,
 * porque cada club mide con una cosa distinta.
 *
 * Es un módulo APARTE a propósito: el crono del Inter y el del filial siguen
 * sacando su informe de `informe.ts`, que no se ha tocado. Este solo lo usan
 * los clientes con `informeCompleto: true` en `clientes.ts`.
 *
 * Las reglas son las de `pdf_partido.py` + `importar_crono.py`, una a una, para
 * que el mismo partido dé las mismas cifras por los dos caminos. Las diferencias
 * son pocas, deliberadas y están comentadas donde ocurren:
 *   · Un penalti, 10 m o FSB metido con su propio botón no tiene evento `gol`.
 *     Aquí ES un gol en TODO (lista, ±, valoración, cuartetos, tramos, disparos),
 *     igual que en el importador: lo que dice el marcador sale en la lista.
 *   · Los bloqueos y postes del portero salen de los eventos. El importador los
 *     deja a cero, por eso NO suman en la valoración: si sumaran, el mismo
 *     partido valdría distinto aquí y en el informe del club.
 *   · Si hay prórroga se cuenta y se pinta (el del club solo mira 1.ª y 2.ª).
 *
 * Este fichero solo CALCULA; los textos son CLAVES de i18n y la maquetación
 * vive en `components/InformeCompleto.tsx`. Sin React ni Dexie:
 *   node --experimental-strip-types src/lib/informeCompleto.test.ts
 */
import type { ContadoresJugador, Evento, Flecha, ParteId, Partido } from "./db";
import { accionDeLanzamiento, esLanzamiento } from "./lanzamientos";
import { flechaSuficiente, zonasDeFlecha } from "./geometriaCampo";

export const PARTES_INFORME: ParteId[] = ["1T", "2T", "PR1", "PR2"];
const ORDEN_PARTE: Record<string, number> = { "1T": 0, "2T": 1, PR1: 2, PR2: 3 };

/** Acciones de equipo y tarjetas al cuerpo técnico: nunca son un convocado. */
const NO_SON_JUGADORES = new Set(["#EQUIPO", "#CT"]);

/** Un tramo de menos de esto es la costura del cambio de parte, no un turno
 *  (TRAMO_MINIMO_SEG en importar_crono.py). */
const TRAMO_MINIMO_SEG = 0.5;

export interface JugadorRosterCompleto {
  nombre: string;
  dorsal: string;
  posicion: string;
  equipo?: string;
}

export interface ContextoCompleto {
  nombreCorto: string;
  nombreLargo: string;
  roster: JugadorRosterCompleto[];
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos de salida
// ──────────────────────────────────────────────────────────────────────────
/** Un total y su reparto por partes: [1.ª, 2.ª] o [1.ª, 2.ª, prórroga].
 *  `partes` es null cuando el reparto NO suma el total: un desglose que no
 *  cuadra hace dudar del resto de la hoja, mejor no enseñarlo. */
export interface Reparto { total: number; partes: number[] | null }

/** Clave de i18n + parámetros: el titular se escribe en el idioma activo. */
export interface Titular { clave: string; params: Record<string, string | number> }

export interface GolCompleto {
  parte: ParteId;
  segParte: number;
  segAbs: number;
  minuto: string;             // absoluto de partido: "23:11"
  nuestro: boolean;
  accion: string;             // la del crono, con los números orientados
  columna: string;            // su columna de la matriz
  goleador: string;
  asistente: string;
  portero: string;
  cuarteto: string[];         // los de campo, para la tabla
  /** Los cinco del ± (cuarteto + portero + goleador + asistente). */
  enPistaValoracion: string[];
  /** Los que cuentan en la matriz de goles en contra (cuarteto + portero). */
  enPistaMatriz: string[];
  enPropia: boolean;
  deLanzamiento: boolean;
  marcador: string;           // "2-1" tras el gol, nosotros-rival
}

export interface FilaCompleta {
  nombre: string;
  dorsal: string;
  /** Portero por el roster o por tener estadística de portería. */
  portero: boolean;
  seg1: number; seg2: number; segPR: number; segTotal: number;
  pf: number; pnf: number; robos: number; cortes: number; bdg: number; bdp: number;
  dp: number; dpalo: number; db: number; df: number;
  fc: number; fr: number; ta: number; tr: number; g: number; a: number;
  paradas: number; golesEncajados: number; bloqueos: number; postes: number;
  video: Record<string, number>;
}

export interface FilaValoracion {
  nombre: string; dorsal: string; portero: boolean; segTotal: number;
  jugo: boolean; gf: number; gc: number; masMenos: number;
  video: number; val: number; val40: number;
}

export interface FilaPorteria {
  nombre: string; dorsal: string;
  paradas: number; golesEncajados: number; bloqueos: number; postes: number;
  disparos: number; pct: number | null;
}

export interface TramoCrono { parte: ParteId; desde: number; hasta: number }

export interface MarcaFalta { parte: ParteId; seg: number; nuestro: boolean; num: number; jugador: string }
export interface MarcaTarjeta { parte: ParteId; seg: number; nuestro: boolean; roja: boolean; jugador: string }

export interface Cronograma {
  partes: { parte: ParteId; inicio: number; dur: number }[];
  total: number;
  jugadores: { nombre: string; dorsal: string; portero: boolean; segTotal: number; tramos: TramoCrono[] }[];
  goles: { x: number; nuestro: boolean }[];
  faltas: (MarcaFalta & { x: number })[];
  tarjetas: (MarcaTarjeta & { x: number })[];
}

export interface RotacionParte {
  parte: ParteId;
  maxTurnos: number;
  filas: { nombre: string; dorsal: string; portero: boolean; turnos: number[]; total: number }[];
}

export interface FilaCuarteto {
  jugadores: string[]; n: number; segundos: number;
  perdidas: number; recuperaciones: number; robos: number; cortes: number;
  bdg: number; bdp: number; gf: number; gc: number; balance: number;
}

export interface CuadroCuartetos {
  filas: FilaCuarteto[];
  segCubiertos: number;
  segOtros: number;
  segPartido: number;
  hayDivididos: boolean;
}

export interface ColumnaMatriz { canon: string; clave: string }

export interface FilaMatriz { dorsal: string; nombre: string; celdas: number[]; total: number }

export interface Matriz { filas: FilaMatriz[]; totales: number[]; total: number }

export interface FilaPase {
  asistencia: boolean; parte: ParteId; segAbs: number; minuto: string;
  jugador: string; receptor: string;
  zonaOrigen: string; zonaDestino: string; flecha: Flecha | null;
}

export interface TiroTandaInforme {
  orden: number; nuestro: boolean; tirador: string; portero: string;
  resultado: string; marcadorNos: number; marcadorRival: number;
}

export interface Incorporaciones {
  total: number; conDisparo: number; sinDisparo: number;
  partes: { parte: ParteId; con: number; sin: number }[] | null;
}

export interface InformeCompleto {
  cabecera: {
    nombreLargo: string; nombreCorto: string; rival: string;
    gf: number; gc: number; local: boolean;
    competicion: string; lugar: string; hora: string; fecha: string;
    partidoId: string;
  };
  hayVideo: boolean;
  hayDivididos: boolean;
  hayProrroga: boolean;
  kpis: {
    dt: Reparto; dp: Reparto; dtRival: Reparto; dpRival: Reparto;
    pf: Reparto; pnf: Reparto; robos: Reparto; cortes: Reparto;
    incorporaciones: Incorporaciones | null;
  };
  titulares: Titular[];
  equipo: {
    goles: Reparto; golesRival: Reparto;
    dt: Reparto; dtRival: Reparto; dp: Reparto; dpRival: Reparto;
    dpalo: Reparto; dpaloRival: Reparto; db: Reparto; dbRival: Reparto;
    df: Reparto; dfRival: Reparto;
    perdidas: Reparto; robos: Reparto; cortes: Reparto;
    balance: number; bdg: number; bdp: number;
    video: Record<string, number>;
  };
  jugadores: FilaCompleta[];
  /** La escala del semáforo de minutos: lo máximo de un jugador de campo. */
  maxMinutos: { m1: number; m2: number; pr: number; total: number };
  porteria: FilaPorteria[];
  valoracion: FilaValoracion[];
  hayValoracionVideo: boolean;
  goles: GolCompleto[];
  golesPorTramo: { desde: number; nuestros: number; rival: number }[];
  cronograma: Cronograma;
  rotaciones: RotacionParte[];
  cuartetos: CuadroCuartetos;
  columnasMatriz: ColumnaMatriz[];
  matrizFavor: Matriz;
  matrizContra: Matriz;
  mapas: {
    favorCampo: Record<string, number>; favorPorteria: Record<string, number>;
    contraCampo: Record<string, number>; contraPorteria: Record<string, number>;
  } | null;
  pases: {
    filas: FilaPase[];
    flechas: FilaPase[];
    pasesGol: number; asistencias: number; sinFlecha: number;
  } | null;
  tanda: { tiros: TiroTandaInforme[]; nos: number; rival: number } | null;
  tiemposMuertos: { parte: ParteId; minuto: string; nuestro: boolean; nos: number; rival: number }[];
}

// ──────────────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────────────
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function up(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

/** "m:ss", como el `_fmt_minutos` del informe del club; "—" si es cero. */
export function minSeg(segundos: number): string {
  const s = Math.round(segundos);
  if (s <= 0) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "mm:ss" con ceros, como `_seg_a_mmss` del importador. */
export function mmss2(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Redondeo del colegio (9,85 → 9,9; -2,25 → -2,3), el `_redondear` del club.
 *  El cuerpo técnico suma las acciones a mano: si le sale 9,85 y ve 9,8 deja de
 *  fiarse del número. El toPrecision quita el 9,8499… del binario. */
export function redondear(x: number, dec = 1): number {
  const f = 10 ** dec;
  const a = Number((Math.abs(x) * f).toPrecision(12));
  const r = Math.round(a) / f;
  return x < 0 ? -r : r;
}

function parteBucket(parte: string): 0 | 1 | 2 {
  return parte === "1T" ? 0 : parte === "2T" ? 1 : 2;
}

function hacerReparto(total: number, cubos: number[], hayPR: boolean): Reparto {
  const suma = cubos[0] + cubos[1] + cubos[2];
  if (suma !== total) return { total, partes: null };
  return { total, partes: hayPR ? [cubos[0], cubos[1], cubos[2]] : [cubos[0], cubos[1]] };
}

const zonaLimpia = (v: unknown): string => {
  const s = up(v);
  return s.startsWith("__") ? "" : s;
};

/** Normaliza una zona de campo a la del mapa: "A4" → "A4"; D* → "A11". */
export function zonaMapa(zc: unknown): string {
  const z = zonaLimpia(zc);
  if (/^D([1-9]|10)$/.test(z)) return "A11";
  return /^A([1-9]|1[01])$/.test(z) ? z : "";
}

function cuadrantePorteria(zp: unknown): string {
  const z = up(zp);
  return /^P[1-9]$/.test(z) ? z : "";
}

/** ¿Este evento suma un gol al marcador? `gol`, o un lanzamiento convertido SIN
 *  gol enlazado (`es_gol_de_verdad` en el club). Devuelve quién lo marca. */
export function equipoDelGol(ev: Evento): "INTER" | "RIVAL" | null {
  if (ev.tipo === "gol") return ev.equipo === "INTER" ? "INTER" : "RIVAL";
  if (esLanzamiento(ev) && ev.resultado === "GOL" && !ev.golId) {
    return ev.equipo === "INTER" ? "INTER" : "RIVAL";
  }
  return null;
}

/** La situación de números contada desde nuestro lado (regla de Arkaitz). */
export function orientarNumeros(accion: string, nuestros: number | null): string {
  const s = String(accion ?? "").trim();
  const m = /^(\d)x(\d)$/.exec(s);
  if (!m) return s;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a !== b && nuestros !== null && (nuestros === a || nuestros === b)) {
    return `${nuestros}x${nuestros === a ? b : a}`;
  }
  return s;
}

// ──────────────────────────────────────────────────────────────────────────
// La matriz de goles: una columna por situación, en el orden del club
// ──────────────────────────────────────────────────────────────────────────
export const COLUMNAS_MATRIZ: ColumnaMatriz[] = [
  { canon: "Banda", clave: "ban" }, { canon: "Córner", clave: "cor" },
  { canon: "Saque de Centro", clave: "sqc" }, { canon: "Falta", clave: "fal" },
  { canon: "2ª jugada de ABP", clave: "2ab" }, { canon: "10 metros", clave: "10m" },
  { canon: "Penalti", clave: "pen" }, { canon: "Falta sin barrera", clave: "fsb" },
  { canon: "Salida de presión", clave: "sal" },
  { canon: "Ataque Posicional 4x4", clave: "4x4" },
  { canon: "1x1 en banda", clave: "1x1" }, { canon: "2ª jugada", clave: "2ju" },
  { canon: "Incorporación del portero", clave: "ipo" },
  { canon: "Robo en incorporación de portero", clave: "rip" },
  { canon: "Pérdida en incorporación de portero", clave: "pip" },
  { canon: "5x4", clave: "5x4" }, { canon: "4x3", clave: "4x3" },
  { canon: "4x5", clave: "4x5" }, { canon: "3x4", clave: "3x4" },
  { canon: "Contraataque", clave: "ctr" }, { canon: "Robo en zona alta", clave: "rza" },
  { canon: "Pérdida en salida de presión", clave: "psp" },
  { canon: "No calificado", clave: "nc" },
];

const NO_CALIFICADO = "No calificado";

function claveTexto(t: unknown): string {
  return String(t ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIAS_COLUMNA: Record<string, string> = {
  "ataque posicional": "Ataque Posicional 4x4", "4x4": "Ataque Posicional 4x4",
  "1x1 banda": "1x1 en banda",
  "segunda jugada": "2ª jugada",
  "10m": "10 metros", "10 m": "10 metros",
  "fsb": "Falta sin barrera",
  "incorporacion de portero": "Incorporación del portero",
  "defensa de incorporacion": "Robo en incorporación de portero",
  "robo zona alta": "Robo en zona alta",
  "otra": NO_CALIFICADO, "otro": NO_CALIFICADO,
};
for (const c of COLUMNAS_MATRIZ) ALIAS_COLUMNA[claveTexto(c.canon)] = c.canon;

/** La columna de la matriz en que cae una jugada, escrita como venga. Lo que no
 *  se reconoce va a «No calificado»: un gol sin columna descuadra la fila. */
export function columnaMatriz(accion: unknown): string {
  return ALIAS_COLUMNA[claveTexto(accion)] ?? NO_CALIFICADO;
}

// ──────────────────────────────────────────────────────────────────────────
// Quién está en pista: reconstrucción con los cambios, parte a parte
// ──────────────────────────────────────────────────────────────────────────
export interface Segmento { parte: ParteId; ini: number; fin: number; enPista: Set<string> }

export interface Reconstruccion {
  intervalos: Record<string, Record<string, [number, number][]>>;
  segmentos: Segmento[];
}

function ultimoSegundo(eventos: Evento[], parte: string): number {
  let m = 0;
  for (const e of eventos) if (e.parte === parte) m = Math.max(m, n(e.segundosParte));
  return m;
}

function finDeParte(p: Partido, parte: string): number {
  const d = n((p.config?.duracionParte as Record<string, number> | undefined)?.[parte]);
  return d > 0 ? d : ultimoSegundo(p.eventos ?? [], parte);
}

/** Minuto de inicio de cada parte, para el minuto absoluto (`_offsets_parte`). */
export function offsetsDeParte(p: Partido): Record<string, number> {
  const out: Record<string, number> = {};
  let acum = 0;
  for (const parte of PARTES_INFORME) {
    out[parte] = acum;
    acum += finDeParte(p, parte);
  }
  return out;
}

/** El crono NO reinicia el quinteto al cambiar de parte: el 2T empieza con los
 *  que acabaron el 1T. Es `_reconstruir_pista` del importador, con un añadido:
 *  si la última parte no tiene ningún cambio, se cierra igual (allí se perdía). */
export function reconstruirPista(p: Partido): Reconstruccion {
  const cfg = p.config;
  const eventos = (p.eventos ?? []) as Evento[];
  const pi = (cfg?.pista_inicial ?? {}) as unknown as Record<string, string>;
  const inicial = ["portero", "pista1", "pista2", "pista3", "pista4"]
    .map((k) => up(pi[k])).filter(Boolean);

  const cambios = eventos
    .filter((e): e is Extract<Evento, { tipo: "cambio" }> => e.tipo === "cambio")
    .slice()
    .sort((a, b) => (ORDEN_PARTE[a.parte] - ORDEN_PARTE[b.parte])
      || (n(a.segundosParte) - n(b.segundosParte)));

  const jugadas = PARTES_INFORME.filter((pt) => eventos.some((e) => e.parte === pt));
  const intervalos: Reconstruccion["intervalos"] = {};
  for (const pt of jugadas) intervalos[pt] = {};
  const segmentos: Segmento[] = [];
  const enPista = new Set(inicial);
  const abiertos = new Map<string, number>(inicial.map((x) => [x, 0]));
  let parteActual: ParteId = jugadas[0] ?? "1T";
  let segIni = 0;

  const anota = (pt: string, nom: string, a: number, b: number) => {
    intervalos[pt] ??= {};
    (intervalos[pt][nom] ??= []).push([a, b]);
  };
  const emitir = (pt: ParteId, s0: number, s1: number) => {
    if (s1 > s0 + 1e-6) segmentos.push({ parte: pt, ini: s0, fin: s1, enPista: new Set(enPista) });
  };
  const cerrarFrontera = (hasta: ParteId) => {
    for (let i = ORDEN_PARTE[parteActual]; i < ORDEN_PARTE[hasta]; i += 1) {
      const pt = PARTES_INFORME[i];
      const fin = finDeParte(p, pt);
      emitir(pt, segIni, fin);
      for (const [nom, ini] of abiertos) {
        anota(pt, nom, ini, fin);
        abiertos.set(nom, 0);
      }
      segIni = 0;
    }
    parteActual = hasta;
  };

  for (const c of cambios) {
    if (ORDEN_PARTE[c.parte] > ORDEN_PARTE[parteActual]) cerrarFrontera(c.parte);
    const t = n(c.segundosParte);
    const sale = up(c.sale);
    const entra = up(c.entra);
    emitir(parteActual, segIni, t);
    if (sale) {
      const ini = abiertos.get(sale);
      if (ini !== undefined) {
        abiertos.delete(sale);
        anota(c.parte, sale, ini, t);
      }
      enPista.delete(sale);
    }
    if (entra) {
      const ya = abiertos.get(entra);
      if (ya !== undefined) anota(c.parte, entra, ya, t);
      abiertos.set(entra, t);
      enPista.add(entra);
    }
    segIni = t;
  }

  const ultima = jugadas[jugadas.length - 1];
  if (ultima && ORDEN_PARTE[ultima] > ORDEN_PARTE[parteActual]) cerrarFrontera(ultima);
  const finUlt = finDeParte(p, parteActual);
  emitir(parteActual, segIni, finUlt);
  for (const [nom, ini] of abiertos) anota(parteActual, nom, ini, finUlt);

  return { intervalos, segmentos };
}

function enPistaEn(rec: Reconstruccion, parte: string, seg: number): string[] {
  for (const s of rec.segmentos) {
    if (s.parte === parte && s.ini - 1e-6 <= seg && seg < s.fin + 1e-6) {
      return [...s.enPista].sort();
    }
  }
  return [];
}

// ──────────────────────────────────────────────────────────────────────────
// Valoración: los pesos y la fórmula del informe del club
// ──────────────────────────────────────────────────────────────────────────
const CAMPOS_VIDEO: (keyof ContadoresJugador)[] = [
  "duelC_g", "duelC_p", "duelP_g", "duelP_p", "unoAtq_g", "unoAtq_p",
  "unoDef_g", "unoDef_p", "ultCob", "corteConex", "conexPivot", "recibePivot",
  "saqueB", "saqueM", "achique", "cobBR", "cobBN", "cobMR", "cobMN",
  "paseB", "paseM", "antB", "antM", "paseGol",
];

const PESOS_VIDEO_TODOS: Record<string, number> = {
  unoDef_g: 0.5, unoDef_p: -0.5, unoAtq_g: 0.5, unoAtq_p: -0.25,
  duelC_g: 0.5, duelC_p: -0.4, duelP_g: 0.5, duelP_p: -0.4,
  ultCob: 0.6, corteConex: 0.5, conexPivot: 0.25, recibePivot: 0.15,
  antB: 0.5, antM: -0.25, paseGol: 2,
};
const PESOS_VIDEO_PORTERO: Record<string, number> = {
  achique: 0.4, cobBR: 0.5, cobBN: 0.25, cobMR: -0.1, cobMN: -0.4,
  saqueB: 0.2, saqueM: -0.4, paseB: 0.15, paseM: -0.4,
};

export function valorarCompleto(f: FilaCompleta, gf: number, gc: number): FilaValoracion {
  const min = f.segTotal / 60;
  let bruto = f.robos * 1 + f.cortes * 0.75 + f.bdg * 0.5 + f.bdp * -0.25
    + f.dp * 0.4 + f.dpalo * 0.3 + f.db * 0.1 + f.df * 0.05
    + f.pf * -0.75 + f.pnf * -1.5
    + f.g * 3 + f.a * 2;
  if (f.portero) {
    // Bloqueos y postes NO suman: ver la cabecera del fichero.
    bruto += f.paradas * 0.8 + f.golesEncajados * -1.5;
    if (min >= 20 && f.golesEncajados === 0 && gc === 0) bruto += 2;
  }
  let video = 0;
  for (const [k, w] of Object.entries(PESOS_VIDEO_TODOS)) video += n(f.video[k]) * w;
  if (f.portero) {
    for (const [k, w] of Object.entries(PESOS_VIDEO_PORTERO)) video += n(f.video[k]) * w;
  }
  bruto += video;
  bruto += gf - gc;
  bruto += f.fc * -0.25 + f.ta * -0.5 + f.tr * -2;
  return {
    nombre: f.nombre, dorsal: f.dorsal, portero: f.portero, segTotal: f.segTotal,
    jugo: f.segTotal > 0, gf, gc, masMenos: gf - gc,
    video: redondear(video, 2), val: redondear(bruto, 1),
    val40: min > 0 ? redondear((bruto / min) * 40, 1) : 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// El informe entero
// ──────────────────────────────────────────────────────────────────────────
export function construirInformeCompleto(
  p: Partido, ctx: ContextoCompleto,
): InformeCompleto | null {
  const cfg = p.config;
  if (!cfg) return null;
  const eventos = (p.eventos ?? []) as Evento[];
  const porJugador = (p.acciones?.porJugador ?? {}) as Record<string, ContadoresJugador>;
  const convocados = (cfg.convocados ?? []).filter((x) => !NO_SON_JUGADORES.has(x));

  const ordenados = eventos.slice().sort(
    (a, b) => (ORDEN_PARTE[a.parte] - ORDEN_PARTE[b.parte])
      || (n(a.segundosParte) - n(b.segundosParte)));

  const rosterPor = new Map(ctx.roster.map((j) => [up(j.nombre), j]));
  const porteros = new Set(
    ctx.roster.filter((j) => j.posicion === "PORTERO").map((j) => up(j.nombre)));
  const piPortero = up((cfg.pista_inicial as unknown as Record<string, string>)?.portero);
  if (piPortero) porteros.add(piPortero);
  for (const [nom, c] of Object.entries(porJugador)) {
    if (n(c.paradas) > 0 || n(c.golesEncajados) > 0) porteros.add(up(nom));
  }

  const hayPR = eventos.some((e) => e.parte === "PR1" || e.parte === "PR2")
    || Object.values(p.tiempos ?? {}).some(
      (t) => n(t.porParte?.PR1) > 0 || n(t.porParte?.PR2) > 0);

  const offsets = offsetsDeParte(p);
  const rec = reconstruirPista(p);

  // ── Goles ──────────────────────────────────────────────────────────────
  const goles: GolCompleto[] = [];
  let gi = 0;
  let gr = 0;
  for (const ev of ordenados) {
    const lado = equipoDelGol(ev);
    if (!lado) continue;
    const nuestro = lado === "INTER";
    if (nuestro) gi += 1; else gr += 1;
    const seg = n(ev.segundosParte);
    const lanzamiento = ev.tipo !== "gol";
    const e = ev as unknown as Record<string, unknown>;
    const crudo = !lanzamiento && Array.isArray(e.cuarteto) && (e.cuarteto as string[]).length
      ? (e.cuarteto as string[]).map(up).filter(Boolean)
      : enPistaEn(rec, ev.parte, seg);
    let portero = "";
    let campo: string[] = [];
    for (const x of crudo) {
      if (porteros.has(x) && !portero) portero = x; else campo.push(x);
    }
    if (!portero && crudo.length >= 5) {
      portero = crudo[0];
      campo = crudo.slice(1);
    }
    const goleador = nuestro
      ? up(lanzamiento ? e.tirador : e.goleador) : "";
    const asistente = nuestro && !lanzamiento ? up(e.asistente) : "";

    // Los de campo que teníamos, para orientar el 4x3 / 3x4: el crono saca al
    // goleador de la lista, así que se vuelve a contar.
    const contados = new Set(campo);
    if (nuestro && goleador && !porteros.has(goleador)) contados.add(goleador);
    if (portero && !porteros.has(portero)) contados.add(portero);
    const accionCruda = lanzamiento
      ? accionDeLanzamiento(ev.tipo as "penalti" | "diezm" | "fsb")
      : String(e.accion ?? "").trim();
    const accion = orientarNumeros(accionCruda, contados.size ? contados.size : null);

    const enPistaValoracion = new Set(campo);
    if (portero) enPistaValoracion.add(portero);
    if (goleador) enPistaValoracion.add(goleador);
    if (asistente) enPistaValoracion.add(asistente);

    goles.push({
      parte: ev.parte, segParte: seg, segAbs: offsets[ev.parte] + seg,
      minuto: mmss2(offsets[ev.parte] + seg),
      nuestro, accion, columna: columnaMatriz(accion),
      goleador, asistente, portero, cuarteto: campo,
      enPistaValoracion: [...enPistaValoracion],
      enPistaMatriz: [...new Set([...campo, ...(portero ? [portero] : [])])],
      enPropia: Boolean(e.enPropia),
      deLanzamiento: lanzamiento,
      marcador: `${gi}-${gr}`,
    });
  }
  const gf = n(p.marcador?.inter);
  const gc = n(p.marcador?.rival);

  // ── Disparos por parte (eventos), como `_construir_totales` ─────────────
  type Cat = "dp" | "dpalo" | "db" | "df";
  const vacia = (): Record<Cat, number[]> => ({
    dp: [0, 0, 0], dpalo: [0, 0, 0], db: [0, 0, 0], df: [0, 0, 0],
  });
  const catNos = vacia();
  const catRival = vacia();
  const MAPA_RES: Record<string, Cat> = {
    PUERTA: "dp", PALO: "dpalo", BLOQUEADO: "db", FUERA: "df",
  };
  const MAPA_LANZ: Record<string, Cat> = { PARADA: "dp", POSTE: "dpalo", FUERA: "df" };
  for (const ev of eventos) {
    const b = parteBucket(ev.parte);
    let cat: Cat | undefined;
    let equipo: unknown;
    if (ev.tipo === "disparo") {
      if (ev.golId) continue;                       // ya contado por su gol
      cat = MAPA_RES[up(ev.resultado)];
      equipo = ev.equipo;
    } else if (ev.tipo === "gol") {
      cat = "dp";
      equipo = ev.equipo;
    } else if (esLanzamiento(ev)) {
      // Un lanzamiento convertido sin gol enlazado ES el gol y es un disparo a
      // puerta (el importador se lo saltaba y el desglose no cuadraba).
      if (ev.resultado === "GOL") cat = ev.golId ? undefined : "dp";
      else cat = MAPA_LANZ[up(ev.resultado)];
      equipo = ev.equipo;
    }
    if (!cat) continue;
    if (equipo === "INTER") catNos[cat][b] += 1;
    else if (equipo === "RIVAL") catRival[cat][b] += 1;
  }
  const suma3 = (x: number[]) => x[0] + x[1] + x[2];
  const sumaCats = (c: Record<Cat, number[]>): number[] => [0, 1, 2].map(
    (i) => c.dp[i] + c.dpalo[i] + c.db[i] + c.df[i]);

  const dtCubos = sumaCats(catNos);
  const dtRivalCubos = sumaCats(catRival);
  const dr = p.disparosRival ?? { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 };
  const rep = (t: number, c: number[]) => hacerReparto(t, c, hayPR);

  // ── Acciones de equipo por parte ────────────────────────────────────────
  const accionesTotal: Record<string, number> = { pf: 0, pnf: 0, robos: 0, cortes: 0 };
  for (const c of Object.values(porJugador)) {
    for (const k of Object.keys(accionesTotal)) {
      accionesTotal[k] += n((c as unknown as Record<string, number>)[k]);
    }
  }
  const accionesCubos: Record<string, number[]> = {
    pf: [0, 0, 0], pnf: [0, 0, 0], robos: [0, 0, 0], cortes: [0, 0, 0],
  };
  for (const ev of eventos) {
    if (ev.tipo !== "accion_individual") continue;
    const c = accionesCubos[ev.accion];
    if (c) c[parteBucket(ev.parte)] += 1;
  }
  const perdidasCubos = [0, 1, 2].map((i) => accionesCubos.pf[i] + accionesCubos.pnf[i]);
  const perdidasTotal = accionesTotal.pf + accionesTotal.pnf;

  // ── Goles por parte ─────────────────────────────────────────────────────
  const golesCubos = [0, 0, 0];
  const golesRivalCubos = [0, 0, 0];
  for (const g of goles) {
    (g.nuestro ? golesCubos : golesRivalCubos)[parteBucket(g.parte)] += 1;
  }

  // ── Incorporaciones del portero rival ───────────────────────────────────
  const inc = p.incorporacionesRival;
  let incorporaciones: Incorporaciones | null = null;
  if (inc && n(inc.total) > 0) {
    const porParte = new Map<ParteId, { con: number; sin: number }>();
    let contadas = 0;
    for (const ev of eventos) {
      if (ev.tipo !== "incorporacion_rival") continue;
      const c = porParte.get(ev.parte) ?? { con: 0, sin: 0 };
      if (ev.conDisparo) c.con += 1; else c.sin += 1;
      porParte.set(ev.parte, c);
      contadas += 1;
    }
    incorporaciones = {
      total: n(inc.total), conDisparo: n(inc.conDisparo), sinDisparo: n(inc.sinDisparo),
      partes: contadas === n(inc.total)
        ? PARTES_INFORME.filter((pt) => porParte.has(pt))
          .map((pt) => ({ parte: pt, ...porParte.get(pt)! }))
        : null,
    };
  }

  // ── Por jugador ─────────────────────────────────────────────────────────
  const fc = new Map<string, number>();
  const fr = new Map<string, number>();
  const ta = new Map<string, number>();
  const tr = new Map<string, number>();
  const sumar = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const faltas: MarcaFalta[] = [];
  const tarjetas: MarcaTarjeta[] = [];
  const contadorFaltas = new Map<string, number>();
  for (const ev of ordenados) {
    if (ev.tipo === "falta") {
      const quien = up(ev.jugador);
      const nuestro = ev.equipo === "INTER";
      if (quien && !NO_SON_JUGADORES.has(quien)) sumar(nuestro ? fc : fr, quien);
      const clave = `${ev.parte}|${ev.equipo}`;
      const num = (contadorFaltas.get(clave) ?? 0) + 1;
      contadorFaltas.set(clave, num);
      faltas.push({ parte: ev.parte, seg: n(ev.segundosParte), nuestro, num, jugador: quien });
    } else if (ev.tipo === "amarilla" || ev.tipo === "roja") {
      const quien = up(ev.jugador);
      const nuestro = ev.equipo === "INTER";
      if (nuestro && quien && !NO_SON_JUGADORES.has(quien)) {
        sumar(ev.tipo === "roja" ? tr : ta, quien);
      }
      tarjetas.push({
        parte: ev.parte, seg: n(ev.segundosParte), nuestro,
        roja: ev.tipo === "roja", jugador: quien,
      });
    }
  }

  const golesJ = new Map<string, number>();
  const asistJ = new Map<string, number>();
  const gfPista = new Map<string, number>();
  const gcPista = new Map<string, number>();
  for (const g of goles) {
    if (g.nuestro && g.goleador) sumar(golesJ, g.goleador);
    if (g.nuestro && g.asistente) sumar(asistJ, g.asistente);
    for (const j of g.enPistaValoracion) sumar(g.nuestro ? gfPista : gcPista, j);
  }

  // Bloqueos y postes del portero: de los disparos y lanzamientos del rival.
  const bloqueos = new Map<string, number>();
  const postes = new Map<string, number>();
  const porteroDe = (ev: Evento, escrito: unknown): string => {
    const u = up(escrito);
    if (u) return u;
    return enPistaEn(rec, ev.parte, n(ev.segundosParte)).find((x) => porteros.has(x)) ?? "";
  };
  for (const ev of eventos) {
    if (ev.tipo === "disparo" && ev.equipo === "RIVAL") {
      const res = up(ev.resultado);
      if (res === "BLOQUEADO") { const q = porteroDe(ev, ev.portero); if (q) sumar(bloqueos, q); }
      if (res === "PALO") { const q = porteroDe(ev, ev.portero); if (q) sumar(postes, q); }
    } else if (esLanzamiento(ev) && ev.equipo === "RIVAL" && up(ev.resultado) === "POSTE") {
      const q = porteroDe(ev, ev.portero);
      if (q) sumar(postes, q);
    }
  }

  const claveOrden = (nom: string): [number, number, number, number, string] => {
    const j = rosterPor.get(up(nom));
    if (!j) return [1, 9, 9, 9999, up(nom)];
    const filial = String(j.equipo ?? "PRIMER").toUpperCase().startsWith("PRIM") ? 0 : 1;
    const d = Number.parseInt(j.dorsal, 10);
    return [0, j.posicion === "PORTERO" ? 0 : 1, filial,
            Number.isFinite(d) ? d : 9999, up(nom)];
  };
  const comparaOrden = (a: string, b: string): number => {
    const ka = claveOrden(a);
    const kb = claveOrden(b);
    for (let i = 0; i < 4; i += 1) {
      if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
    }
    return ka[4].localeCompare(kb[4]);
  };

  const filas: FilaCompleta[] = convocados.slice().sort(comparaOrden).map((nombre) => {
    const u = up(nombre);
    const c = (porJugador[nombre] ?? porJugador[u] ?? {}) as ContadoresJugador;
    const t = p.tiempos?.[nombre] ?? p.tiempos?.[u];
    const seg1 = Math.round(n(t?.porParte?.["1T"]));
    const seg2 = Math.round(n(t?.porParte?.["2T"]));
    const segPR = Math.round(n(t?.porParte?.PR1) + n(t?.porParte?.PR2));
    const video: Record<string, number> = {};
    for (const k of CAMPOS_VIDEO) {
      const v = n(c[k] as number);
      if (v) video[k] = v;
    }
    return {
      nombre, dorsal: rosterPor.get(u)?.dorsal ?? "",
      portero: porteros.has(u),
      seg1, seg2, segPR, segTotal: seg1 + seg2 + segPR,
      pf: n(c.pf), pnf: n(c.pnf), robos: n(c.robos), cortes: n(c.cortes),
      bdg: n(c.bdg), bdp: n(c.bdp),
      dp: n(c.dpp), dpalo: n(c.dpa), db: n(c.dpb), df: n(c.dpf),
      fc: fc.get(u) ?? 0, fr: fr.get(u) ?? 0, ta: ta.get(u) ?? 0, tr: tr.get(u) ?? 0,
      g: golesJ.get(u) ?? 0, a: asistJ.get(u) ?? 0,
      paradas: n(c.paradas), golesEncajados: n(c.golesEncajados),
      bloqueos: bloqueos.get(u) ?? 0, postes: postes.get(u) ?? 0,
      video,
    };
  });

  const hayVideo = filas.some((f) => Object.keys(f.video).length > 0);
  const bdgTotal = filas.reduce((a, f) => a + f.bdg, 0);
  const bdpTotal = filas.reduce((a, f) => a + f.bdp, 0);
  const hayDivididos = bdgTotal + bdpTotal > 0;

  const videoEquipo: Record<string, number> = {};
  for (const k of CAMPOS_VIDEO) {
    videoEquipo[k] = filas.reduce((a, f) => a + n(f.video[k]), 0);
  }

  const maxCampo = (val: (f: FilaCompleta) => number) => Math.max(
    0, ...filas.filter((f) => !f.portero).map(val));

  const valoracion = filas.map((f) => {
    const u = up(f.nombre);
    return valorarCompleto(f, gfPista.get(u) ?? 0, gcPista.get(u) ?? 0);
  });

  const porteria: FilaPorteria[] = filas.filter((f) => f.portero).map((f) => ({
    nombre: f.nombre, dorsal: f.dorsal,
    paradas: f.paradas, golesEncajados: f.golesEncajados,
    bloqueos: f.bloqueos, postes: f.postes,
    disparos: f.paradas + f.golesEncajados + f.bloqueos + f.postes,
    pct: f.paradas + f.golesEncajados > 0
      ? redondear((f.paradas / (f.paradas + f.golesEncajados)) * 100, 1) : null,
  }));

  // ── Titulares automáticos ───────────────────────────────────────────────
  const titulares: Titular[] = [];
  const rival = String(cfg.rival ?? "");
  titulares.push({
    clave: gf > gc ? "ic_tit_victoria" : gf === gc ? "ic_tit_empate" : "ic_tit_derrota",
    params: { gf, gc, rival },
  });
  const difs = goles.map((g) => {
    const [a, b] = g.marcador.split("-").map(Number);
    return a - b;
  });
  if (difs.length) {
    const max = Math.max(...difs);
    const min = Math.min(...difs);
    if (max >= 2 && gf <= gc) {
      titulares.push({ clave: "ic_tit_se_escapo", params: { dif: max, gf, gc } });
    } else if (min <= -2 && gf >= gc) {
      titulares.push({ clave: "ic_tit_remontada", params: { dif: Math.abs(min), gf, gc } });
    }
  }
  const dtTotal = suma3(dtCubos);
  const dtRivalTotal = n(dr.puerta) + n(dr.palo) + n(dr.bloqueado) + n(dr.fuera);
  if (dtTotal && dtRivalTotal) {
    if (dtTotal > dtRivalTotal * 1.2) {
      titulares.push({ clave: "ic_tit_dominio", params: { a: dtTotal, b: dtRivalTotal } });
    } else if (dtRivalTotal > dtTotal * 1.2) {
      titulares.push({ clave: "ic_tit_superados", params: { a: dtTotal, b: dtRivalTotal } });
    }
  }

  // ── Goles cada 5 minutos ────────────────────────────────────────────────
  const finPartido = hayPR ? offsets.PR2 + finDeParte(p, "PR2") : 2400;
  const nTramos = Math.max(8, Math.ceil(finPartido / 300));
  const golesPorTramo = Array.from({ length: nTramos }, (_, i) => ({
    desde: i * 5, nuestros: 0, rival: 0,
  }));
  for (const g of goles) {
    const i = Math.min(nTramos - 1, Math.max(0, Math.floor(g.segAbs / 300)));
    if (g.nuestro) golesPorTramo[i].nuestros += 1; else golesPorTramo[i].rival += 1;
  }

  // ── Cronograma ──────────────────────────────────────────────────────────
  const partesCrono: Cronograma["partes"] = [];
  let acum = 0;
  const maxSale = (pt: string) => {
    let m = 0;
    for (const lista of Object.values(rec.intervalos[pt] ?? {})) {
      for (const [, b] of lista) m = Math.max(m, b);
    }
    return m;
  };
  for (const pt of PARTES_INFORME) {
    const jugada = eventos.some((e) => e.parte === pt);
    if ((pt === "PR1" || pt === "PR2") && !jugada) continue;
    if (!jugada && pt === "2T" && maxSale(pt) === 0 && !finDeParte(p, pt)) continue;
    const minimo = pt === "1T" || pt === "2T" ? 1200 : 0;
    const dur = Math.max(minimo, maxSale(pt), finDeParte(p, pt));
    partesCrono.push({ parte: pt, inicio: acum, dur });
    acum += dur;
  }
  const inicioCrono = new Map(partesCrono.map((x) => [x.parte, x.inicio]));
  const xDe = (pt: ParteId, seg: number) => (inicioCrono.get(pt) ?? 0) + seg;

  const cronograma: Cronograma = {
    partes: partesCrono,
    total: acum,
    jugadores: filas.filter((f) => f.segTotal > 0).map((f) => {
      const u = up(f.nombre);
      const tramos: TramoCrono[] = [];
      for (const pt of PARTES_INFORME) {
        for (const [desde, hasta] of rec.intervalos[pt]?.[u] ?? []) {
          if (hasta - desde >= TRAMO_MINIMO_SEG) tramos.push({ parte: pt, desde, hasta });
        }
      }
      return {
        nombre: f.nombre, dorsal: f.dorsal, portero: f.portero,
        segTotal: f.segTotal, tramos,
      };
    }),
    goles: goles.map((g) => ({ x: xDe(g.parte, g.segParte), nuestro: g.nuestro })),
    faltas: faltas.map((f) => ({ ...f, x: xDe(f.parte, f.seg) })),
    tarjetas: tarjetas.map((f) => ({ ...f, x: xDe(f.parte, f.seg) })),
  };

  // ── Rotaciones por turno y parte ────────────────────────────────────────
  const rotaciones: RotacionParte[] = [];
  for (const pt of PARTES_INFORME) {
    const filasRot = filas.filter((f) => f.segTotal > 0).map((f) => {
      const turnos = (rec.intervalos[pt]?.[up(f.nombre)] ?? [])
        .map(([a, b]) => b - a)
        .filter((d) => d >= TRAMO_MINIMO_SEG)
        .map((d) => Math.round(d));
      return {
        nombre: f.nombre, dorsal: f.dorsal, portero: f.portero, turnos,
        total: turnos.reduce((a, b) => a + b, 0),
      };
    });
    const maxTurnos = Math.max(0, ...filasRot.map((f) => f.turnos.length));
    if (maxTurnos > 0) rotaciones.push({ parte: pt, maxTurnos, filas: filasRot });
  }

  // ── Cuartetos ───────────────────────────────────────────────────────────
  type Agg = {
    segundos: number; pf: number; pnf: number; robos: number; cortes: number;
    bdg: number; bdp: number; gf: number; gc: number;
  };
  const agg = new Map<string, Agg>();
  const claveCuarteto = (enPista: Iterable<string>) =>
    [...enPista].filter((x) => !porteros.has(x)).sort().join("|");
  const dameAgg = (k: string): Agg => {
    let a = agg.get(k);
    if (!a) {
      a = { segundos: 0, pf: 0, pnf: 0, robos: 0, cortes: 0, bdg: 0, bdp: 0, gf: 0, gc: 0 };
      agg.set(k, a);
    }
    return a;
  };
  for (const s of rec.segmentos) {
    const k = claveCuarteto(s.enPista);
    if (k) dameAgg(k).segundos += s.fin - s.ini;
  }
  const cuartetoEn = (parte: string, seg: number): string | null => {
    for (const s of rec.segmentos) {
      if (s.parte === parte && s.ini - 1e-6 <= seg && seg < s.fin + 1e-6) {
        return claveCuarteto(s.enPista);
      }
    }
    return null;
  };
  for (const ev of eventos) {
    const seg = n(ev.segundosParte);
    if (ev.tipo === "accion_individual") {
      if (["pf", "pnf", "robos", "cortes", "bdg", "bdp"].includes(ev.accion)) {
        const k = cuartetoEn(ev.parte, seg);
        if (k) dameAgg(k)[ev.accion as "pf"] += 1;
      }
    } else {
      const lado = equipoDelGol(ev);
      if (lado) {
        const k = cuartetoEn(ev.parte, seg);
        if (k) dameAgg(k)[lado === "INTER" ? "gf" : "gc"] += 1;
      }
    }
  }
  const todosCuartetos: FilaCuarteto[] = [...agg.entries()].map(([k, v]) => {
    const jugadores = k.split("|").filter(Boolean);
    const perdidas = v.pf + v.pnf;
    const recuperaciones = v.robos + v.cortes;
    return {
      jugadores, n: jugadores.length, segundos: v.segundos,
      perdidas, recuperaciones, robos: v.robos, cortes: v.cortes,
      bdg: v.bdg, bdp: v.bdp, gf: v.gf, gc: v.gc,
      balance: recuperaciones - perdidas,
    };
  }).filter((f) => f.n >= 4);
  const segCuartetos = todosCuartetos.reduce((a, f) => a + f.segundos, 0);
  const filasCuartetos = todosCuartetos
    .filter((f) => f.segundos >= 30)
    .sort((a, b) => (b.segundos - a.segundos) || (b.recuperaciones - a.recuperaciones));
  const segCubiertos = filasCuartetos.reduce((a, f) => a + f.segundos, 0);
  const segPartido = PARTES_INFORME.reduce((a, pt) => a + maxSale(pt), 0);

  // ── Matriz jugador × tipo de jugada ─────────────────────────────────────
  const construirMatriz = (lista: GolCompleto[], cuenta: (g: GolCompleto, u: string) => boolean): Matriz => {
    const filasM = filas.map((f) => {
      const u = up(f.nombre);
      const celdas = COLUMNAS_MATRIZ.map((c) => lista.filter(
        (g) => g.columna === c.canon && cuenta(g, u)).length);
      return { dorsal: f.dorsal, nombre: f.nombre, celdas,
               total: celdas.reduce((a, b) => a + b, 0) };
    });
    const totales = COLUMNAS_MATRIZ.map(
      (c) => lista.filter((g) => g.columna === c.canon).length);
    return { filas: filasM, totales, total: lista.length };
  };
  const golesNos = goles.filter((g) => g.nuestro);
  const golesRival = goles.filter((g) => !g.nuestro);
  const matrizFavor = construirMatriz(golesNos, (g, u) => g.goleador === u);
  const matrizContra = construirMatriz(golesRival, (g, u) => g.enPistaMatriz.includes(u));

  // ── Mapas de zona (solo con vídeo y si hay alguna) ──────────────────────
  let mapas: InformeCompleto["mapas"] = null;
  if (hayVideo) {
    const favorCampo: Record<string, number> = {};
    const favorPorteria: Record<string, number> = {};
    const contraCampo: Record<string, number> = {};
    const contraPorteria: Record<string, number> = {};
    for (const ev of eventos) {
      const lado = equipoDelGol(ev);
      if (!lado) continue;
      const e = ev as unknown as Record<string, unknown>;
      const zc = ev.tipo === "gol" ? zonaMapa(e.zonaCampo) : "";
      const zp = cuadrantePorteria(e.zonaPorteria);
      const c = lado === "INTER" ? favorCampo : contraCampo;
      const q = lado === "INTER" ? favorPorteria : contraPorteria;
      if (zc) c[zc] = (c[zc] ?? 0) + 1;
      if (zp) q[zp] = (q[zp] ?? 0) + 1;
    }
    const alguna = [favorCampo, favorPorteria, contraCampo, contraPorteria]
      .some((m) => Object.keys(m).length > 0);
    if (alguna) mapas = { favorCampo, favorPorteria, contraCampo, contraPorteria };
  }

  // ── Pases de gol y asistencias con flecha (solo vídeo) ──────────────────
  let pases: InformeCompleto["pases"] = null;
  if (hayVideo) {
    const lista: FilaPase[] = [];
    const flechaValida = (f: unknown): Flecha | null => {
      const x = f as Flecha | undefined;
      if (!x || [x.x0, x.y0, x.x1, x.y1].some((v) => typeof v !== "number")) return null;
      return flechaSuficiente(x) ? x : null;
    };
    for (const ev of ordenados) {
      if (ev.tipo === "accion_individual" && ev.accion === "paseGol") {
        const flecha = flechaValida(ev.flecha);
        const z = flecha ? zonasDeFlecha(flecha) : null;
        const segAbs = offsets[ev.parte] + n(ev.segundosParte);
        lista.push({
          asistencia: false, parte: ev.parte, segAbs, minuto: mmss2(segAbs),
          jugador: up(ev.jugador), receptor: "",
          zonaOrigen: zonaLimpia(ev.zonaCampo) || z?.origen || "",
          zonaDestino: zonaLimpia(ev.zonaDestino) || z?.destino || "",
          flecha,
        });
      }
    }
    for (const g of golesNos) {
      if (g.enPropia || g.deLanzamiento || !g.asistente) continue;
      if (["Penalti", "10m", "10 m", "FSB"].includes(g.accion)) continue;
      const ev = ordenados.find((e) => e.tipo === "gol" && e.parte === g.parte
        && n(e.segundosParte) === g.segParte);
      const e = ev as unknown as Record<string, unknown> | undefined;
      const flecha = flechaValida(e?.flechaAsistencia);
      const z = flecha ? zonasDeFlecha(flecha) : null;
      lista.push({
        asistencia: true, parte: g.parte, segAbs: g.segAbs, minuto: g.minuto,
        jugador: g.asistente, receptor: g.goleador,
        zonaOrigen: zonaLimpia(e?.zonaAsistencia) || z?.origen || "",
        zonaDestino: zonaLimpia(e?.zonaAsistenciaDestino) || z?.destino || "",
        flecha,
      });
    }
    lista.sort((a, b) => a.segAbs - b.segAbs);
    const flechas = lista.filter((x) => x.flecha);
    // Sin ninguna flecha dibujada, la hoja sería una pista vacía: no sale.
    if (flechas.length > 0) {
      pases = {
        filas: lista, flechas,
        pasesGol: lista.filter((x) => !x.asistencia).length,
        asistencias: flechas.filter((x) => x.asistencia).length,
        sinFlecha: lista.filter((x) => x.asistencia && !x.flecha).length,
      };
    }
  }

  // ── Tanda ───────────────────────────────────────────────────────────────
  let tanda: InformeCompleto["tanda"] = null;
  const tirosCrudos = Array.isArray(p.tanda?.tiros) ? p.tanda.tiros : [];
  if (tirosCrudos.length) {
    let mi = 0;
    let mr = 0;
    const tiros = tirosCrudos.slice().sort((a, b) => n(a.orden) - n(b.orden)).map((x) => {
      const nuestro = x.equipo === "INTER";
      const resultado = up(x.resultado);
      if (resultado === "GOL") { if (nuestro) mi += 1; else mr += 1; }
      return {
        orden: n(x.orden), nuestro, tirador: up(x.tirador), portero: up(x.portero),
        resultado, marcadorNos: mi, marcadorRival: mr,
      };
    });
    tanda = { tiros, nos: mi, rival: mr };
  }

  // ── Tiempos muertos ─────────────────────────────────────────────────────
  const tiemposMuertos = ordenados
    .filter((ev) => ev.tipo === "tiempo_muerto")
    .map((ev) => ({
      parte: ev.parte,
      minuto: mmss2(n(ev.segundosParte)),
      nuestro: (ev as unknown as { equipo: string }).equipo === "INTER",
      nos: n(ev.marcador?.inter),
      rival: n(ev.marcador?.rival),
    }));

  const dtR = rep(dtRivalTotal, dtRivalCubos);
  const dpR = rep(n(dr.puerta), catRival.dp);
  const dt = rep(dtTotal, dtCubos);
  const dp = rep(suma3(catNos.dp), catNos.dp);

  return {
    cabecera: {
      nombreLargo: ctx.nombreLargo, nombreCorto: ctx.nombreCorto, rival,
      gf, gc, local: Boolean(cfg.local),
      competicion: String(cfg.competicion ?? ""), lugar: String(cfg.lugar ?? ""),
      hora: String(cfg.hora ?? ""), fecha: String(cfg.fecha ?? ""),
      partidoId: String(cfg.partido_id ?? ""),
    },
    hayVideo, hayDivididos, hayProrroga: hayPR,
    kpis: {
      dt, dp, dtRival: dtR, dpRival: dpR,
      pf: rep(accionesTotal.pf, accionesCubos.pf),
      pnf: rep(accionesTotal.pnf, accionesCubos.pnf),
      robos: rep(accionesTotal.robos, accionesCubos.robos),
      cortes: rep(accionesTotal.cortes, accionesCubos.cortes),
      incorporaciones,
    },
    titulares: titulares.slice(0, 3),
    equipo: {
      goles: rep(gf, golesCubos), golesRival: rep(gc, golesRivalCubos),
      dt, dtRival: dtR, dp, dpRival: dpR,
      dpalo: rep(suma3(catNos.dpalo), catNos.dpalo),
      dpaloRival: rep(n(dr.palo), catRival.dpalo),
      db: rep(suma3(catNos.db), catNos.db),
      dbRival: rep(n(dr.bloqueado), catRival.db),
      df: rep(suma3(catNos.df), catNos.df),
      dfRival: rep(n(dr.fuera), catRival.df),
      perdidas: rep(perdidasTotal, perdidasCubos),
      robos: rep(accionesTotal.robos, accionesCubos.robos),
      cortes: rep(accionesTotal.cortes, accionesCubos.cortes),
      balance: accionesTotal.robos + accionesTotal.cortes - perdidasTotal,
      bdg: bdgTotal, bdp: bdpTotal,
      video: videoEquipo,
    },
    jugadores: filas,
    maxMinutos: {
      m1: maxCampo((f) => f.seg1), m2: maxCampo((f) => f.seg2),
      pr: maxCampo((f) => f.segPR), total: maxCampo((f) => f.segTotal),
    },
    porteria, valoracion,
    hayValoracionVideo: valoracion.some((v) => Math.abs(v.video) > 0),
    goles, golesPorTramo, cronograma, rotaciones,
    cuartetos: {
      filas: filasCuartetos, segCubiertos,
      segOtros: Math.max(0, segCuartetos - segCubiertos), segPartido,
      hayDivididos: filasCuartetos.some((f) => f.bdg + f.bdp > 0),
    },
    columnasMatriz: COLUMNAS_MATRIZ, matrizFavor, matrizContra,
    mapas, pases, tanda, tiemposMuertos,
  };
}
