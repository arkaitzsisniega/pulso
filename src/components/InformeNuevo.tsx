"use client";

/**
 * InformeNuevo — Las piezas del informe del partido con el ASPECTO NUEVO
 * (23/11/2026).
 *
 * El informe PDF del club se rediseñó ese día con el lenguaje de la web y del
 * crono (letras Inter + Barlow Condensed, tinta azul noche, tablas de cabecera
 * clara, iconos en vez de emojis) y Arkaitz lo dio por bueno («Perfecto!!!»).
 * Esto lleva lo mismo al informe IMPRIMIBLE del crono (`/informe`), en versión
 * CLARA porque va a papel:
 *
 *   · `CSS_NUEVO` — la piel: se engancha con la clase `ic-n` (informe completo,
 *     el de la demo) o `inf-n` (el de Inter, filial y juvenil). Sin esas clases
 *     no se aplica nada: con el aspecto clásico el informe sale igual que antes.
 *   · `piel()` — el color de siempre → su equivalente en la paleta de la web
 *     (la misma tabla que `pdf_estilo.py`). Con el aspecto clásico devuelve el
 *     MISMO color.
 *   · `GolesNuevo` — línea de tiempo + tabla + marcador a lo largo del partido.
 *   · `MapasNuevo` — una fila por equipo (medio campo + portería sin ceros, con
 *     los disparos a puerta en gris) y el campo entero con burbujas.
 *
 * Todo es SVG y CSS dentro de la app: nada se pide a internet (el crono tiene
 * que funcionar en un pabellón sin cobertura). Las letras son las de
 * `app/layout.tsx`, que ya van dentro.
 */
import React, { createContext, useContext, useId } from "react";
import { t } from "@/lib/i18n";
import {
  H as ALTO, W as ANCHO_CAMPO, M, X_MEDIA, Y_CENTRO, BANDA_SUP_Y, BANDA_INF_Y,
  POSTE_SUP_Y, POSTE_INF_Y, geoMedia,
} from "./Campo";
import {
  COLOR_FAMILIA, escalonesMarcador, familiaSituacion, minutoAbs, mezclar,
  nivelesEtiquetas, nombreBonito, radioBurbuja, resumenGoles, tintaSobre, tinteZona,
  type GolNuevo, type MapaEquipo,
} from "@/lib/informeNuevo";

// ──────────────────────────────────────────────────────────────────────────
// Paleta (la de la web, `pdf_estilo.py`)
// ──────────────────────────────────────────────────────────────────────────
export const TINTA = "#0b1b33";
export const TINTA_2 = "#42526b";
export const TINTA_3 = "#6b7a92";
export const LINEA = "#e3e8f0";
export const LINEA_2 = "#d3dbe7";
export const CAPA_2 = "#f7f9fc";
export const CAPA_3 = "#eef2f7";

/** El color de siempre → el de la web. Lo que no está aquí se queda igual. */
const MAPA_PIEL: Record<string, string> = {
  "#2e7d32": "#12913f", "#388e3c": "#12913f", "#43a047": "#12913f",
  "#16a34a": "#12913f", "#1b5e20": "#0b6b2e", "#558b2f": "#3f8f3a",
  "#66bb6a": "#4cb26e", "#a5d6a7": "#9fd8b2", "#c8e6c9": "#cbebd6",
  "#dcedc8": "#dcf1e2", "#edf7ee": "#eaf6ee", "#f1f8f2": "#eef7f1",
  "#b71c1c": "#d61f1f", "#c62828": "#d61f1f", "#d32f2f": "#d61f1f",
  "#e53935": "#e0493f", "#7f1010": "#9e1515", "#ef9a9a": "#f2a9a9",
  "#ffcdd2": "#f7cfcf", "#ffe0e0": "#fbe3e3", "#fdecec": "#fdeeee",
  "#e65100": "#b85c06", "#f57c00": "#d9700a", "#ffcc80": "#fbd9b5",
  "#fbc02d": "#b98000", "#ffe082": "#f6e0a0", "#fff59d": "#f6e7b8",
  "#1565c0": "#1565e0", "#90caf9": "#9fc2f5", "#bbdefb": "#cfe0fb",
  "#eef4fb": "#eef3fb", "#ce93d8": "#d9b8f0", "#6a1b9a": "#6d4ed8", "#f6effa": "#f4effc",
  "#000000": TINTA, "#111111": TINTA, "#212121": TINTA, "#37474f": TINTA_2,
  "#424242": TINTA_2, "#555555": TINTA_2, "#666666": TINTA_3,
  "#90a4ae": "#8a97ab", "#a3ada8": "#a9b6c8", "#b0bec5": "#a9b6c8",
  "#cfd8dc": LINEA_2, "#d4d4d4": LINEA, "#f5f5f5": CAPA_2, "#fafafa": CAPA_2,
  "#f4f6f3": CAPA_2,
};

/** ¿Se está pintando el informe con el aspecto nuevo? Lo fija la página al
 *  dibujar (las piezas del informe no guardan estado: se pintan siempre en la
 *  misma pasada que la página, así que no hay forma de que lo lean a destiempo). */
let pielNueva = false;
export function fijarPiel(nuevo: boolean) { pielNueva = nuevo; }

/** El color, en la paleta nueva si toca; si no, el mismo. */
export function piel(color: string): string {
  if (!pielNueva) return color;
  return MAPA_PIEL[color.toLowerCase()] ?? color;
}

/** Para las piezas con React (títulos de sección del informe clásico). */
export const InformeNuevoCtx = createContext(false);
export function useInformeNuevo(): boolean { return useContext(InformeNuevoCtx); }

// ──────────────────────────────────────────────────────────────────────────
// Iconos (línea, estilo Lucide · ISC), los mismos trazos que el crono nuevo
// ──────────────────────────────────────────────────────────────────────────
const TRAZOS: Record<string, React.ReactNode> = {
  gol: <><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /></>,
  barras: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  reloj: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  grupo: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.8" /><path d="M16 14.2a5.5 5.5 0 0 1 6 5.8" /></>,
  video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M22 8l-6 4 6 4z" /></>,
  guante: <path d="M7 21v-6L4 11V6a1.5 1.5 0 0 1 3 0v4M7 6V4a1.5 1.5 0 0 1 3 0v6M10 4a1.5 1.5 0 0 1 3 0v6M13 5a1.5 1.5 0 0 1 3 0v6l2-2a1.6 1.6 0 0 1 2.3 2.2L16 16v5" />,
  porteria: <><path d="M2 20V5h20v15" /><path d="M6 5v15M10 5v15M14 5v15M18 5v15M2 10h20M2 15h20" strokeWidth="1" /></>,
  tendencia: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  mapa: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  flecha: <path d="M7 17L17 7M8 7h9v9" />,
  cronograma: <path d="M3 6h10M7 12h12M5 18h8" />,
  cambio: <><path d="M17 3l4 4-4 4" /><path d="M21 7H8" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h13" /></>,
  diana: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  tarjeta: <rect x="7" y="3" width="10" height="18" rx="2" />,
  doc: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 15h6" /></>,
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
};

export function Icono(props: { nombre: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={props.className ?? "in-ico"} style={props.style} viewBox="0 0 24 24"
         aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      {TRAZOS[props.nombre] ?? TRAZOS.barras}
    </svg>
  );
}

/** El icono de cada sección, por la clave de su título. */
const ICONO_SECCION: Record<string, string> = {
  // informe completo
  ic_sec_equipo: "barras", ic_sec_minutos: "reloj", ic_sec_individuales: "persona",
  ic_sec_video: "video", ic_sec_video_porteros: "guante", ic_sec_porteria: "porteria",
  ic_sec_valoracion: "tendencia", ic_sec_goles: "gol", ic_sec_5min: "barras",
  ic_sec_matriz: "barras", ic_sec_mapas: "mapa", ic_sec_pases: "flecha",
  ic_sec_crono: "cronograma", ic_sec_rotaciones: "cambio", ic_sec_cuartetos: "grupo",
  ic_sec_tanda: "diana", ic_sec_tm: "reloj",
  // informe de Inter, filial y juvenil
  inf_sec_goles: "gol", inf_sec_equipo: "barras", inf_sec_valoracion: "tendencia",
  inf_sec_jugadores: "persona", inf_sec_porteros: "guante", inf_sec_cronograma: "cronograma",
  inf_sec_rotaciones: "cambio", inf_sec_quintetos: "grupo", inf_sec_cuartetos: "grupo",
  inf_sec_jugadas: "barras", inf_sec_tramos: "reloj", inf_sec_tanda: "diana",
  inf_sec_zonas: "mapa", inf_sec_mapas_juego: "mapa", inf_sec_video: "video",
  inf_sec_otros: "tarjeta",
};
export function iconoSeccion(clave: string): string { return ICONO_SECCION[clave] ?? "barras"; }

/** Tarjeta amarilla o roja dibujada (en vez de 🟨 / 🟥). */
export function Tarjeta(props: { roja?: boolean }) {
  return <span className={`in-tarjeta${props.roja ? " ro" : ""}`} aria-hidden="true" />;
}

// ──────────────────────────────────────────────────────────────────────────
// La piel
// ──────────────────────────────────────────────────────────────────────────
const F_TXT = `var(--font-inter), "Inter", system-ui, -apple-system, sans-serif`;
const F_NUM = `var(--font-barlow), "Barlow Condensed", "Arial Narrow", system-ui, sans-serif`;

export const CSS_NUEVO = `
/* ── Piezas comunes ─────────────────────────────────────────────────── */
/* Con la clase del informe delante: «.ic svg» (todo SVG a lo ancho) no debe pillarlos. */
.informe .in-ico { display: inline-block; width: 1.05em; height: 1.05em; flex: none; vertical-align: -.15em; }
.in-tarjeta { display: inline-block; width: .62em; height: .85em; border-radius: 1.5px;
  background: #e8b800; vertical-align: -.1em; box-shadow: 0 0 0 .5px rgba(0,0,0,.35); }
.in-tarjeta.ro { background: #c81c22; }
.in-num { font-family: ${F_NUM}; font-variant-numeric: tabular-nums; }
.in-sub { font-family: ${F_NUM}; font-size: 12.5pt; font-weight: 700; color: ${TINTA}; margin: 12pt 0 1pt; }
.in-nota { color: ${TINTA_3}; font-size: 6.8pt; line-height: 1.35; margin: 3pt 0 0; }
.in-resumen { color: ${TINTA_2}; font-size: 8.2pt; margin: 0 0 4pt; }
.in-resumen b { color: ${TINTA}; font-weight: 600; }
.in-svg { display: block; width: 100%; height: auto; }
.in-svg text { font-family: ${F_TXT}; }
.in-svg .n { font-family: ${F_NUM}; font-weight: 700; }

/* Tabla de goles */
.in-goles { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6pt; }
.in-goles th { font: 600 6.4pt/1.2 ${F_TXT}; color: ${TINTA_3}; text-transform: uppercase;
  letter-spacing: .05em; text-align: left; padding: 3pt 4pt; border: 0;
  border-bottom: .8pt solid ${LINEA_2}; background: none; }
.in-goles td { font-size: 7.6pt; color: ${TINTA_2}; padding: 3.2pt 4pt; border: 0;
  border-bottom: .5pt solid ${LINEA}; text-align: left; vertical-align: middle; background: none; }
.in-goles td.min { font: 700 11pt/1 ${F_NUM}; color: ${TINTA}; font-variant-numeric: tabular-nums;
  border-left: 2.4pt solid var(--in-c); padding-left: 5pt; }
.in-goles td.gol b { display: block; font-weight: 600; color: ${TINTA}; font-size: 8.2pt; }
.in-goles td.gol small { display: block; color: ${TINTA_3}; font-size: 6.5pt; }
.in-goles td.pista { font-size: 6.8pt; color: ${TINTA_3}; }
.in-chip { display: inline-block; min-width: 2.6em; text-align: center; padding: 1.4pt 5pt;
  border-radius: 999px; color: #fff; font: 700 8.5pt/1.15 ${F_NUM}; font-variant-numeric: tabular-nums; }
.in-etq { display: inline-block; padding: 1.2pt 5pt; border-radius: 999px; font-size: 6.5pt;
  font-weight: 600; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }

/* Mapas */
.in-mapa-cab { display: flex; align-items: baseline; gap: 6pt; margin: 9pt 0 3pt; }
.in-mapa-cab .pt { width: 6.5pt; height: 6.5pt; border-radius: 50%; flex: none; align-self: center; }
.in-mapa-cab b { font: 700 11.5pt/1 ${F_NUM}; color: ${TINTA}; letter-spacing: .01em; }
.in-mapa-cab span.d { margin-left: auto; font-size: 6.5pt; color: ${TINTA_3}; text-align: right; }
.in-mapa-fila { display: grid; grid-template-columns: 27% 60%; gap: 7%; align-items: start; justify-content: center; }
.in-desde { margin-top: 3pt; text-align: center; font-size: 6.8pt; color: ${TINTA_3};
  padding: 2pt 4pt; border-radius: 3pt; background: ${CAPA_2}; }
.in-desde.si { color: #fff; font-weight: 600; }
.in-nomarco { aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
  background: ${CAPA_2}; border: .6pt solid ${LINEA}; border-radius: 4pt; color: ${TINTA_3};
  font-size: 8pt; text-align: center; padding: 6pt; }
.in-burbujas-ley { display: flex; justify-content: space-between; font-size: 7pt; font-weight: 600;
  margin: 2pt 13% 2pt; }

/* ── Informe completo (demo): .ic.ic-n ──────────────────────────────── */
.ic.ic-n { font-family: ${F_TXT}; color: ${TINTA}; }
.ic-n h2 { font-family: ${F_NUM}; font-weight: 700; font-size: 14.5pt; color: ${TINTA};
  display: flex; align-items: center; gap: 5pt; letter-spacing: .01em; margin: 12pt 0 5pt; }
.ic-n h2 .in-ico { color: var(--ic); }
.ic-n h2[style*="center"] { justify-content: center; }
.ic-n th, .ic-n td { border: 0; border-bottom: .5pt solid ${LINEA}; }
.ic-n thead th { background: ${CAPA_3}; color: ${TINTA_2}; border-bottom: .8pt solid ${LINEA_2};
  font-weight: 600; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .03em; }
.ic-n tbody tr:nth-child(even) td { background: ${CAPA_2}; }
.ic-n .ic-nota, .ic-n .ic-txt { color: ${TINTA_3}; }
.ic-n .ic-txt b { color: ${TINTA}; font-weight: 600; }
.ic-n small { color: ${TINTA_3}; }
.ic-n .ic-info th { font-size: 6.5pt; }
.ic-n .ic-info td { color: ${TINTA}; background: ${CAPA_2}; font: 700 11.5pt/1.1 ${F_NUM}; }
.ic-n .ic-marcador { font-family: ${F_NUM}; font-size: 27pt; color: ${TINTA}; letter-spacing: .005em; }
.ic-n .ic-marcador small { font-family: ${F_TXT}; font-size: 7.5pt; color: ${TINTA_3};
  text-transform: uppercase; letter-spacing: .05em; }
.ic-n .ic-pid { color: ${TINTA_3}; }
.ic-n .ic-kpi { border: .6pt solid ${LINEA_2}; background: ${CAPA_2}; border-radius: 3pt; overflow: hidden; }
.ic-n .ic-kpi > div { border: 0; border-right: .5pt solid ${LINEA}; border-bottom: .5pt solid ${LINEA}; }
.ic-n .ic-kpi .l { font-size: 6.2pt; text-transform: uppercase; letter-spacing: .04em; color: ${TINTA_3}; }
.ic-n .ic-kpi .v { font: 700 18pt/1.15 ${F_NUM}; color: ${TINTA}; }
.ic-n .ic-kpi .v small { font-family: ${F_TXT}; font-size: 6.5pt; }
.ic-n .ic-tit { color: ${TINTA_2}; }
.ic-n .ic-tit b { color: ${TINTA}; font-weight: 600; }
.ic-n .ic-mx tr.tot td { background: ${CAPA_3}; }
.ic-n .ic-mx.contra thead th { background: ${CAPA_3}; color: var(--ic-rojo); border-color: ${LINEA_2}; }
.ic-n .ic-leyenda { color: ${TINTA_2}; }
.ic-n .ic-pie { color: ${TINTA_3}; }
@media screen { .ic-n .ic-pag { border-bottom-color: ${LINEA_2}; } }

/* ── Informe de Inter, filial y juvenil: .informe.inf-n ─────────────── */
.informe.inf-n { font-family: ${F_TXT}; color: ${TINTA}; }
.inf-n h1 { font-family: ${F_NUM}; font-weight: 700; letter-spacing: .005em; font-size: 30px; }
.inf-n h2 { font-family: ${F_NUM}; font-size: 15px; font-weight: 700; letter-spacing: .01em;
  text-transform: none; color: ${TINTA}; border-color: ${LINEA_2}; display: flex; align-items: center; gap: 6px; }
.inf-n thead tr { background: ${CAPA_3}; color: ${TINTA_2}; border-color: ${LINEA_2}; }
.inf-n thead th { padding: 4px 4px; font-weight: 600; }
.inf-n tbody tr { border-color: ${LINEA}; }
.inf-n tbody tr:nth-child(even) { background: ${CAPA_2}; }
.inf-n .text-zinc-400 { color: #8a97ab; }
.inf-n .text-zinc-500 { color: ${TINTA_3}; }
.inf-n .text-zinc-600 { color: ${TINTA_2}; }
.inf-n .border-zinc-100, .inf-n .border-zinc-200 { border-color: ${LINEA}; }
.inf-n .bg-zinc-50 { background: ${CAPA_2}; }
.inf-n .bg-zinc-100 { background: ${CAPA_3}; }
.inf-n .bg-zinc-200 { background: ${LINEA}; }
.inf-n .in-kpi { border: 1px solid ${LINEA}; border-radius: 4px; }
.inf-n .in-kpi p:first-child { font-family: ${F_NUM}; font-weight: 700; font-size: 17px; color: ${TINTA} !important; }
.inf-n .font-mono { font-family: ${F_NUM}; font-weight: 700; }
`;

// ──────────────────────────────────────────────────────────────────────────
// Goles
// ──────────────────────────────────────────────────────────────────────────
export interface Corte { seg: number; etiqueta: string; parte: string }

interface PropsGoles {
  goles: GolNuevo[];
  /** Nuestro nombre corto («INTER», «PULSO») y el del rival. */
  nos: string;
  rival: string;
  /** Inicio de cada parte (segundo absoluto) que no sea la 1ª: 2T, PR1…
   *  `etiqueta` va en la línea («Descanso») y `parte` sobre su tramo. */
  cortes: Corte[];
  /** Hasta dónde llega el eje (segundos). */
  fin: number;
  colorNos: string;
  colorRival: string;
  /** El título va fuera (cada informe lo pone con su estilo). */
}

/** Un borde blanco bajo la letra: si el palo de otro gol pasa por detrás de
 *  una etiqueta, no la tacha. */
const HALO = { stroke: "#ffffff", strokeWidth: 4, strokeLinejoin: "round" as const, paintOrder: "stroke" };

/** La línea de tiempo: lo nuestro arriba, lo del rival abajo. */
function LineaTiempo(p: PropsGoles) {
  const { goles, fin, colorNos, colorRival } = p;
  const XL = 140, XR = 985;
  const X = (s: number) => XL + ((XR - XL) * Math.min(s, fin)) / fin;
  const arriba = goles.filter((g) => g.nuestro).sort((a, b) => a.seg - b.seg);
  const abajo = goles.filter((g) => !g.nuestro).sort((a, b) => a.seg - b.seg);
  const ETQ_W = 116;
  const nivA = nivelesEtiquetas(arriba.map((g) => X(g.seg)), ETQ_W);
  const nivB = nivelesEtiquetas(abajo.map((g) => X(g.seg)), ETQ_W);
  const nA = arriba.length ? Math.max(...nivA) + 1 : 0;
  const nB = abajo.length ? Math.max(...nivB) + 1 : 0;
  const BASE = 30, PASO = 44, ETQ = 38;
  const altoA = nA ? BASE + (nA - 1) * PASO + ETQ : 16;
  const altoB = nB ? BASE + (nB - 1) * PASO + ETQ : 16;
  const TOP = 26;
  const ejeY = TOP + altoA + 6;
  const H = ejeY + 12 + altoB + 6;
  const marcas: number[] = [];
  for (let m = 0; m * 60 <= fin; m += 5) marcas.push(m);

  const etiqueta = (g: GolNuevo, arribaSi: boolean, nivel: number, i: number,
                    capa: "palo" | "letra") => {
    const x = X(g.seg);
    const color = g.nuestro ? colorNos : colorRival;
    const nombre = g.nuestro
      ? (nombreBonito(g.goleador) || t("in_col_gol"))
      : (nombreBonito(g.goleador) || t("in_gol_rival"));
    const sub = `${minutoAbs(g.seg)} · ${g.nos}–${g.rival}`;
    const largo = BASE + nivel * PASO;
    const xt = Math.max(XL - 70, Math.min(XR - 10, x));
    if (arribaSi) {
      const y = ejeY - 7 - largo;
      if (capa === "palo") {
        return (
          <g key={`pa${i}`}>
            <line x1={x} x2={x} y1={ejeY - 7} y2={y} stroke={color} strokeWidth="1.6" />
            <circle cx={x} cy={y} r="3" fill={color} />
          </g>
        );
      }
      return (
        <g key={`a${i}`}>
          <text {...HALO} x={xt} y={y - 21} textAnchor="middle" fontSize="15" fontWeight="600" fill={TINTA}>{nombre}</text>
          <text {...HALO} x={xt} y={y - 6} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={color}>{sub}</text>
        </g>
      );
    }
    const y = ejeY + 7 + largo;
    if (capa === "palo") {
      return (
        <g key={`pb${i}`}>
          <line x1={x} x2={x} y1={ejeY + 7} y2={y} stroke={color} strokeWidth="1.6" />
          <circle cx={x} cy={y} r="3" fill={color} />
        </g>
      );
    }
    return (
      <g key={`b${i}`}>
        <text {...HALO} x={xt} y={y + 15} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={color}>{sub}</text>
        <text {...HALO} x={xt} y={y + 31} textAnchor="middle" fontSize="15" fontWeight="600" fill={TINTA}>{nombre}</text>
      </g>
    );
  };

  const golesNos = arriba.length, golesRival = abajo.length;
  return (
    <svg className="in-svg" viewBox={`0 0 1000 ${H}`} role="img"
         aria-label={t("ic_sec_goles")}>
      {p.cortes.map((c) => (
        <g key={c.etiqueta}>
          <line x1={X(c.seg)} x2={X(c.seg)} y1={TOP - 6} y2={H - 4} stroke={LINEA_2}
                strokeWidth="1.2" strokeDasharray="4 4" />
          <text x={X(c.seg)} y={TOP - 12} textAnchor="middle" fontSize="10" fill="#8a97ab"
                letterSpacing="1">{c.etiqueta.toUpperCase()}</text>
        </g>
      ))}
      <rect x={XL} y={ejeY - 7} width={XR - XL} height="14" rx="7" fill={CAPA_3} />
      {marcas.map((m) => (
        <text key={m} x={X(m * 60)} y={ejeY + 3.5} textAnchor="middle" fontSize="9.5"
              fill="#8a97ab">{m}&apos;</text>
      ))}
      <text x={XL - 10} y={ejeY - 4} textAnchor="end" fontSize="10.5" fontWeight="700"
            fill={colorNos} letterSpacing=".5">
        {t("in_goles_de", { equipo: p.nos }).toUpperCase()}
        {!golesNos ? ` · ${t("in_no_marco")}` : ""}
      </text>
      <text x={XL - 10} y={ejeY + 13} textAnchor="end" fontSize="10.5" fontWeight="700"
            fill={colorRival} letterSpacing=".5">
        {t("in_goles_de", { equipo: recortar(p.rival, 16) }).toUpperCase()}
        {!golesRival ? ` · ${t("in_no_marco")}` : ""}
      </text>
      {/* Los palos y luego las letras, para que ningún palo tache un nombre */}
      {arriba.map((g, i) => etiqueta(g, true, nivA[i], i, "palo"))}
      {abajo.map((g, i) => etiqueta(g, false, nivB[i], i, "palo"))}
      {arriba.map((g, i) => etiqueta(g, true, nivA[i], i, "letra"))}
      {abajo.map((g, i) => etiqueta(g, false, nivB[i], i, "letra"))}
    </svg>
  );
}

function recortar(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** El marcador a lo largo del partido, en escalones. */
function MarcadorEnElTiempo(p: PropsGoles) {
  const id = useId().replace(/:/g, "");
  const { goles, fin, colorNos, colorRival } = p;
  const pasos = escalonesMarcador(goles, fin);
  const maxAbs = Math.max(2, ...pasos.map((x) => Math.abs(x.dif)));
  const XL = 60, XR = 985, TOP = 34, ALTO_G = 200;
  const mid = TOP + ALTO_G / 2;
  const X = (s: number) => XL + ((XR - XL) * Math.min(s, fin)) / fin;
  const Y = (d: number) => mid - (d * (ALTO_G / 2)) / maxAbs;
  const salto = maxAbs <= 4 ? 1 : 2;
  const niveles: number[] = [];
  for (let d = -maxAbs; d <= maxAbs; d += 1) if (d % salto === 0) niveles.push(d);
  let linea = `M ${X(0)} ${Y(0)}`;
  for (let i = 1; i < pasos.length; i += 1) {
    linea += ` H ${X(pasos[i].seg)} V ${Y(pasos[i].dif)}`;
  }
  const area = `${linea} V ${mid} H ${X(0)} Z`;
  const marcas: number[] = [];
  for (let m = 0; m * 60 <= fin; m += 5) marcas.push(m);
  // Las partes, para los rótulos de arriba.
  const limites = [0, ...p.cortes.map((c) => c.seg), fin];
  const nombres = [t("ic_1a_parte"), ...p.cortes.map((c) => c.parte)];
  const H = TOP + ALTO_G + 30;
  return (
    <svg className="in-svg" viewBox={`0 0 1000 ${H}`} role="img" aria-label={t("in_marcador_tit")}>
      <defs>
        <clipPath id={`${id}a`}><rect x={XL} y={0} width={XR - XL} height={mid} /></clipPath>
        <clipPath id={`${id}b`}><rect x={XL} y={mid} width={XR - XL} height={H - mid} /></clipPath>
      </defs>
      {nombres.map((nm, i) => {
        const a = limites[i], b = limites[i + 1] ?? fin;
        if (b <= a) return null;
        return (
          <text key={i} x={(X(a) + X(b)) / 2} y={TOP - 18} textAnchor="middle" fontSize="10"
                fill="#8a97ab" letterSpacing="1">{nm.toUpperCase()}</text>
        );
      })}
      {niveles.map((d) => (
        <g key={d}>
          <line x1={XL} x2={XR} y1={Y(d)} y2={Y(d)} stroke={d === 0 ? "#a9b6c8" : LINEA}
                strokeWidth={d === 0 ? 1.4 : 1} strokeDasharray={d === 0 ? undefined : "3 4"} />
          <text x={XL - 10} y={Y(d) + 4} textAnchor="end" fontSize="11" fill={TINTA_3}>
            {d > 0 ? `+${d}` : d}
          </text>
        </g>
      ))}
      {p.cortes.map((c) => (
        <line key={c.etiqueta} x1={X(c.seg)} x2={X(c.seg)} y1={TOP - 10} y2={TOP + ALTO_G}
              stroke={LINEA_2} strokeWidth="1.2" strokeDasharray="4 4" />
      ))}
      <path d={area} fill={colorNos} fillOpacity=".13" clipPath={`url(#${id}a)`} />
      <path d={area} fill={colorRival} fillOpacity=".13" clipPath={`url(#${id}b)`} />
      <path d={linea} fill="none" stroke={TINTA} strokeWidth="2" strokeLinejoin="round" />
      {[...goles].sort((a, b) => a.seg - b.seg).map((g, i) => {
        const c = g.nuestro ? colorNos : colorRival;
        const y = Y(g.nos - g.rival);
        return (
          <g key={i}>
            <circle cx={X(g.seg)} cy={y} r="4.5" fill={c} stroke="#fff" strokeWidth="1.5" />
            <text className="n" x={X(g.seg)} y={g.nuestro ? y - 10 : y + 20} textAnchor="middle"
                  fontSize="14" fill={c}>{g.nos}–{g.rival}</text>
          </g>
        );
      })}
      <text x={XR - 4} y={TOP + 14} textAnchor="end" fontSize="11" fontWeight="600" fill={colorNos}>
        {t("in_por_delante", { equipo: nombreBonito(p.nos) })}
      </text>
      <text x={XR - 4} y={TOP + ALTO_G - 6} textAnchor="end" fontSize="11" fontWeight="600" fill={colorRival}>
        {t("in_por_delante", { equipo: recortar(p.rival, 26) })}
      </text>
      {marcas.map((m) => (
        <text key={m} x={X(m * 60)} y={TOP + ALTO_G + 20} textAnchor="middle" fontSize="10.5"
              fill="#8a97ab">{m}&apos;</text>
      ))}
    </svg>
  );
}

/** La tabla limpia: marcador como chip, situación como etiqueta y quién estaba
 *  en pista en UNA línea. */
function TablaGoles(p: PropsGoles & { conPortero: boolean }) {
  const { goles, colorNos, colorRival } = p;
  const fondoRival = mezclar(colorRival, "#ffffff", 0.94);
  return (
    <table className="in-goles">
      <colgroup>
        <col style={{ width: "10%" }} /><col style={{ width: "10%" }} />
        <col style={{ width: p.conPortero ? "20%" : "24%" }} />
        <col style={{ width: p.conPortero ? "21%" : "24%" }} />
        {p.conPortero && <col style={{ width: "11%" }} />}
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>{t("in_col_min")}</th><th>{t("in_col_marcador")}</th><th>{t("in_col_gol")}</th>
          <th>{t("in_col_situacion")}</th>
          {p.conPortero && <th>{t("in_col_portero")}</th>}
          <th>{t("in_col_en_pista")}</th>
        </tr>
      </thead>
      <tbody>
        {goles.map((g, i) => {
          const c = g.nuestro ? colorNos : colorRival;
          const fam = COLOR_FAMILIA[familiaSituacion(g.situacionOriginal)];
          const fondo = g.nuestro ? undefined : { background: fondoRival };
          const autor = g.nuestro
            ? (nombreBonito(g.goleador) || "—")
            : p.rival;
          return (
            <tr key={i} style={{ ["--in-c" as string]: c }}>
              <td className="min" style={fondo}>{minutoAbs(g.seg)}</td>
              <td style={fondo}>
                <span className="in-chip" style={{ background: c }}>{g.nos}–{g.rival}</span>
              </td>
              <td className="gol" style={fondo}>
                <b>{autor}</b>
                {g.nuestro && g.asistente && <small>{t("in_asist", { n: nombreBonito(g.asistente) })}</small>}
              </td>
              <td style={fondo}>
                {g.situacion && (
                  <span className="in-etq" style={{
                    background: mezclar(fam, "#ffffff", 0.87), color: mezclar(fam, "#000000", 0.18),
                  }}>{g.situacion}</span>
                )}
              </td>
              {p.conPortero && <td style={fondo}>{nombreBonito(g.portero)}</td>}
              <td className="pista" style={fondo}>{g.enPista.map(nombreBonito).join(" · ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** La página de goles entera, debajo del título de la sección. */
export function GolesNuevo(p: PropsGoles & { inicio2T: number }) {
  const r = resumenGoles(p.goles, p.inicio2T);
  const conPortero = p.goles.some((g) => g.portero);
  return (
    <>
      <p className="in-resumen">
        <b>{nombreBonito(p.nos)} {r.nos}–{r.rival} {p.rival}</b>
        {"  ·  "}{t("in_desc", { a: r.descNos, b: r.descRival })}
        {"  ·  "}<b style={{ color: p.colorNos }}>{t("in_a_favor_n", { n: r.nos })}</b>
        {"  ·  "}<b style={{ color: p.colorRival }}>{t("in_en_contra_n", { n: r.rival })}</b>
      </p>
      <LineaTiempo {...p} />
      <TablaGoles {...p} conPortero={conPortero} />
      <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
        <p className="in-sub">{t("in_marcador_tit")}</p>
        <p className="in-nota" style={{ marginTop: 0 }}>{t("in_marcador_sub")}</p>
        <MarcadorEnElTiempo {...p} />
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mapas
// ──────────────────────────────────────────────────────────────────────────

/** Dónde va el número de cada zona de la mitad de ataque (portería a la
 *  derecha, la geometría de capturar de `Campo.tsx`). Como en CampoMapa: a
 *  mano, porque el centro geométrico de una zona con arco cae fuera. */
function centrosAtaque(): [string, number, number][] {
  const g = geoMedia("der");
  const xArea = (g.XP + g.XAREA) / 2;
  const x1 = (g.X10 + g.XAREA) / 2;
  const x2 = g.b2x + g.b2w / 2;
  const xb1 = g.b1x + g.b1w / 2;
  return [
    ["A1", xArea, Y_CENTRO - 2.2 * M], ["A2", xArea, Y_CENTRO + 2.2 * M],
    ["A3", xb1, BANDA_SUP_Y / 2], ["A6", xb1, (BANDA_INF_Y + ALTO) / 2],
    ["A4", x1, Y_CENTRO - 2.2 * M], ["A5", x1, Y_CENTRO + 2.2 * M],
    ["A7", x2, BANDA_SUP_Y / 2], ["A10", x2, (BANDA_INF_Y + ALTO) / 2],
    ["A8", x2, (BANDA_SUP_Y + Y_CENTRO) / 2], ["A9", x2, (Y_CENTRO + BANDA_INF_Y) / 2],
  ];
}

/** Las zonas de la mitad de ataque como formas (portería a la derecha). */
function formasAtaque(): [string, "rect" | "path", (number | string)[]][] {
  const g = geoMedia("der");
  return [
    ["A3", "rect", [g.b1x, 0, g.b1w, BANDA_SUP_Y]],
    ["A6", "rect", [g.b1x, BANDA_INF_Y, g.b1w, ALTO - BANDA_INF_Y]],
    ["A4", "path", [g.p4]], ["A5", "path", [g.p5]],
    ["A7", "rect", [g.b2x, 0, g.b2w, BANDA_SUP_Y]],
    ["A10", "rect", [g.b2x, BANDA_INF_Y, g.b2w, ALTO - BANDA_INF_Y]],
    ["A8", "rect", [g.b2x, BANDA_SUP_Y, g.b2w, Y_CENTRO - BANDA_SUP_Y]],
    ["A9", "rect", [g.b2x, Y_CENTRO, g.b2w, BANDA_INF_Y - Y_CENTRO]],
    ["A1", "path", [g.p1]], ["A2", "path", [g.p2]],
  ];
}

/** Medio campo en vertical, con la portería arriba. Sin ceros: una zona sin
 *  gol se queda en blanco. */
function MedioCampo(p: { m: MapaEquipo; color: string; titulo: string }) {
  const id = useId().replace(/:/g, "");
  const { m, color } = p;
  const max = Math.max(0, ...Object.values(m.campo));
  // (x, y) del campo con la portería a la derecha → (y, 800 − x): portería
  // arriba y la izquierda del que ataca, a la izquierda.
  const T = `translate(0 ${ANCHO_CAMPO}) rotate(-90)`;
  const g = geoMedia("der");
  return (
    <svg className="in-svg" viewBox="-8 -22 416 430" role="img" aria-label={p.titulo}>
      <defs>
        <clipPath id={id}><rect x="0" y="0" width={ALTO} height={ANCHO_CAMPO / 2} /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <g transform={T}>
          <rect x={X_MEDIA} y="0" width={ANCHO_CAMPO / 2} height={ALTO} fill="#ffffff" />
          {formasAtaque().map(([z, tipo, a]) => {
            const fill = tinteZona(m.campo[z] ?? 0, max, color) || "#ffffff";
            return tipo === "rect"
              ? <rect key={z} x={a[0]} y={a[1]} width={a[2]} height={a[3]} fill={fill}
                      stroke={LINEA_2} strokeWidth="1.2" />
              : <path key={z} d={String(a[0])} fill={fill} stroke={LINEA_2} strokeWidth="1.2" />;
          })}
          <g fill="none" stroke="#a9b6c8" strokeWidth="2">
            <path d={g.pArea} />
            <line x1={g.X10} y1={BANDA_SUP_Y} x2={g.X10} y2={BANDA_INF_Y} strokeDasharray="6 5" />
            <circle cx={X_MEDIA} cy={Y_CENTRO} r={3 * M} />
          </g>
        </g>
        <rect x="1" y="1" width={ALTO - 2} height={ANCHO_CAMPO / 2 - 2} fill="none"
              stroke="#a9b6c8" strokeWidth="2.4" />
      </g>
      {/* La portería, encima de la línea de fondo */}
      <rect x={POSTE_SUP_Y} y="-14" width={POSTE_INF_Y - POSTE_SUP_Y} height="14" fill="#ffffff"
            stroke={TINTA_2} strokeWidth="2.4" />
      {centrosAtaque().filter(([z]) => (m.campo[z] ?? 0) > 0).map(([z, x, y]) => {
        const fondo = tinteZona(m.campo[z], max, color);
        return (
          <text key={z} className="n" x={y} y={ANCHO_CAMPO - x + 12} textAnchor="middle"
                fontSize="34" fill={tintaSobre(fondo)}>{m.campo[z]}</text>
        );
      })}
    </svg>
  );
}

/** La portería de frente: goles por cuadrante (con su % del total) y, en gris,
 *  los disparos a puerta. Un cuadrante sin nada no lleva número. */
function PorteriaNueva(p: { m: MapaEquipo; color: string; titulo: string }) {
  const id = useId().replace(/:/g, "");
  const { m, color } = p;
  const maxG = Math.max(0, ...Object.values(m.porteria));
  const X0 = 66, Y0 = 26, PW = 468, PH = 300, POSTE = 13;
  const cw = PW / 3, ch = PH / 3;
  return (
    <svg className="in-svg" viewBox="0 0 600 340" role="img" aria-label={p.titulo}>
      <defs>
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 0L16 16M16 0L0 16" stroke={LINEA} strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={X0} y={Y0} width={PW} height={PH} fill={`url(#${id})`} />
      {Array.from({ length: 9 }, (_, i) => {
        const q = `P${i + 1}`;
        const x = X0 + (i % 3) * cw, y = Y0 + Math.floor(i / 3) * ch;
        const gl = m.porteria[q] ?? 0;
        const ap = m.aPuerta[q] ?? 0;
        if (!gl && !ap) return null;
        const pct = m.goles ? Math.round((gl / m.goles) * 100) : 0;
        if (gl) {
          const fondo = tinteZona(gl, maxG, color);
          const tinta = tintaSobre(fondo);
          return (
            <g key={q}>
              <rect x={x + 5} y={y + 5} width={cw - 10} height={ch - 10} rx="7" fill={fondo} />
              <text className="n" x={x + cw / 2} y={y + ch / 2 + 6} textAnchor="middle"
                    fontSize="38" fill={tinta}>{gl}</text>
              <text x={x + cw / 2} y={y + ch - 15} textAnchor="middle" fontSize="13"
                    fill={tinta} opacity=".9">{pct} % · {ap} {t("in_a_puerta")}</text>
            </g>
          );
        }
        return (
          <g key={q}>
            <rect x={x + 5} y={y + 5} width={cw - 10} height={ch - 10} rx="7" fill="#ffffff"
                  stroke={LINEA} strokeWidth="1.2" />
            <text className="n" x={x + cw / 2} y={y + ch / 2 + 4} textAnchor="middle"
                  fontSize="28" fill={TINTA_3}>{ap}</text>
            <text x={x + cw / 2} y={y + ch - 16} textAnchor="middle" fontSize="12.5"
                  fill="#8a97ab">{t("in_a_puerta")}</text>
          </g>
        );
      })}
      {/* Postes y larguero */}
      <path d={`M ${X0 - POSTE / 2} ${Y0 + PH + 8} V ${Y0 - POSTE / 2} H ${X0 + PW + POSTE / 2} V ${Y0 + PH + 8}`}
            fill="none" stroke={TINTA_2} strokeWidth={POSTE} strokeLinejoin="round" />
      <line x1="20" x2="580" y1={Y0 + PH + 8} y2={Y0 + PH + 8} stroke="#a9b6c8" strokeWidth="2" />
    </svg>
  );
}

function FilaMapa(p: {
  m: MapaEquipo; color: string; equipo: string; nuestro: boolean;
}) {
  const { m, color, equipo } = p;
  const goles = m.goles === 1 ? t("in_gol_1") : t("in_goles_n", { n: m.goles });
  const titulo = `${p.nuestro ? t("in_mapa_favor") : t("in_mapa_contra")} · ${goles} · ${t("in_a_puerta_n", { n: m.aPuertaTotal })}`;
  return (
    <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div className="in-mapa-cab">
        <span className="pt" style={{ background: color }} />
        <b>{titulo}</b>
        <span className="d">{t("in_mapa_eq", { equipo })}</span>
      </div>
      <div className="in-mapa-fila">
        <div>
          {m.goles > 0 ? (
            <>
              <MedioCampo m={m} color={color} titulo={titulo} />
              <p className={`in-desde${m.desdeSuCampo ? " si" : ""}`}
                 style={m.desdeSuCampo ? { background: color } : undefined}>
                {t("in_desde_campo", { n: m.desdeSuCampo || "—" })}
              </p>
            </>
          ) : (
            <div className="in-nomarco">{t("in_no_marco_eq", { equipo })}</div>
          )}
        </div>
        <PorteriaNueva m={m} color={color} titulo={titulo} />
      </div>
    </div>
  );
}

/** El campo entero con burbujas: lo nuestro ataca a la derecha y lo del rival
 *  a la izquierda. */
function CampoBurbujas(p: {
  nos: MapaEquipo; rival: MapaEquipo; nombreNos: string; nombreRival: string;
  colorNos: string; colorRival: string;
}) {
  const centros = centrosAtaque();
  const max = Math.max(1, ...Object.values(p.nos.campo), ...Object.values(p.rival.campo),
    p.nos.desdeSuCampo, p.rival.desdeSuCampo);
  const burbujas: { x: number; y: number; v: number; c: string; k: string }[] = [];
  for (const [z, x, y] of centros) {
    const a = p.nos.campo[z] ?? 0;
    const b = p.rival.campo[z] ?? 0;
    if (a) burbujas.push({ x, y, v: a, c: p.colorNos, k: `n${z}` });
    // El rival ataca hacia la izquierda: su campo, girado media vuelta.
    if (b) burbujas.push({ x: ANCHO_CAMPO - x, y: ALTO - y, v: b, c: p.colorRival, k: `r${z}` });
  }
  if (p.nos.desdeSuCampo) {
    burbujas.push({ x: X_MEDIA - 45, y: Y_CENTRO, v: p.nos.desdeSuCampo, c: p.colorNos, k: "nD" });
  }
  if (p.rival.desdeSuCampo) {
    burbujas.push({ x: X_MEDIA + 45, y: Y_CENTRO, v: p.rival.desdeSuCampo, c: p.colorRival, k: "rD" });
  }
  const gDer = geoMedia("der");
  const gIzq = geoMedia("izq");
  return (
    <svg className="in-svg" viewBox={`-16 -8 ${ANCHO_CAMPO + 32} ${ALTO + 16}`} role="img"
         aria-label={t("in_burbujas_tit")}>
      <rect x="0" y="0" width={ANCHO_CAMPO} height={ALTO} fill={CAPA_2} />
      <g fill="none" stroke="#b9c4d4" strokeWidth="2">
        <rect x="1" y="1" width={ANCHO_CAMPO - 2} height={ALTO - 2} />
        <line x1={X_MEDIA} y1="0" x2={X_MEDIA} y2={ALTO} />
        <circle cx={X_MEDIA} cy={Y_CENTRO} r={3 * M} />
        <path d={gDer.pArea} />
        <path d={gIzq.pArea} />
      </g>
      <g fill="#b9c4d4">
        <circle cx={X_MEDIA} cy={Y_CENTRO} r="3" />
        <circle cx={gDer.X10} cy={Y_CENTRO} r="3" />
        <circle cx={gIzq.X10} cy={Y_CENTRO} r="3" />
      </g>
      <rect x={ANCHO_CAMPO} y={POSTE_SUP_Y} width="12" height={POSTE_INF_Y - POSTE_SUP_Y}
            fill="#fff" stroke="#8a97ab" strokeWidth="2" />
      <rect x="-12" y={POSTE_SUP_Y} width="12" height={POSTE_INF_Y - POSTE_SUP_Y}
            fill="#fff" stroke="#8a97ab" strokeWidth="2" />
      {burbujas.map((b) => {
        const r = radioBurbuja(b.v, max, 15, 34);
        return (
          <g key={b.k}>
            <circle cx={b.x} cy={b.y} r={r} fill={b.c} stroke="#fff" strokeWidth="2.5" />
            <text className="n" x={b.x} y={b.y + 7} textAnchor="middle" fontSize="21" fill="#fff">{b.v}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** La página de mapas entera, debajo del título de la sección. */
export function MapasNuevo(p: {
  nos: MapaEquipo; rival: MapaEquipo; nombreNos: string; nombreRival: string;
  colorNos: string; colorRival: string;
}) {
  const hayBurbujas = Object.keys(p.nos.campo).length || Object.keys(p.rival.campo).length
    || p.nos.desdeSuCampo || p.rival.desdeSuCampo;
  return (
    <>
      <FilaMapa m={p.nos} color={p.colorNos} equipo={nombreBonito(p.nombreNos)} nuestro />
      <FilaMapa m={p.rival} color={p.colorRival} equipo={p.nombreRival} nuestro={false} />
      <p className="in-nota" style={{ marginTop: "6pt" }}>{t("in_mapa_nota")}</p>
      {hayBurbujas ? (
        <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
          <p className="in-sub">{t("in_burbujas_tit")}</p>
          <div className="in-burbujas-ley">
            <span style={{ color: p.colorRival }}>
              {t("in_goles_de", { equipo: p.nombreRival })} · {p.rival.goles}
            </span>
            <span style={{ color: p.colorNos }}>
              {t("in_goles_de", { equipo: nombreBonito(p.nombreNos) })} · {p.nos.goles}
            </span>
          </div>
          <div style={{ width: "74%", margin: "0 auto" }}>
            <CampoBurbujas {...p} />
          </div>
          <p className="in-nota" style={{ textAlign: "center" }}>{t("in_burbujas_nota")}</p>
        </div>
      ) : null}
    </>
  );
}

/** Los cortes de la línea de tiempo (descanso y prórroga) a partir del inicio
 *  de cada parte. */
export function cortesDePartes(inicios: Record<string, number>, partes: string[]): Corte[] {
  const out: Corte[] = [];
  if (partes.includes("2T") && inicios["2T"] > 0) {
    out.push({ seg: inicios["2T"], etiqueta: t("in_descanso"), parte: t("ic_2a_parte") });
  }
  if (partes.includes("PR1") && inicios.PR1 > 0) {
    out.push({ seg: inicios.PR1, etiqueta: t("ic_prorroga"), parte: t("ic_prorroga") });
  }
  return out;
}
