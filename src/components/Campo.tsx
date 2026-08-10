"use client";

/**
 * Campo de fútbol sala HORIZONTAL COMPLETO con zonas clicables (zero-confirm).
 *
 * ⚠️ REGLA FIJA: el campo se dibuja SIEMPRE en HORIZONTAL (40m × 20m, 2:1).
 *    Lo único que cambia entre contextos es a qué lado ataca el equipo.
 *
 * Desde 10/8/2026 se dividen LAS DOS mitades con el mismo detalle (antes solo
 * la ofensiva). Nomenclatura relativa al equipo que ataca hacia la derecha:
 *   - A1..A10 = mitad de ATAQUE (derecha). Portería rival a la derecha.
 *   - D1..D10 = mitad de DEFENSA (izquierda). Portería propia a la izquierda.
 *   (D1..D10 son el espejo horizontal de A1..A10.)
 *
 * Correspondencia por media pista (misma forma, lado espejado):
 *   1 = mitad SUP del área · 2 = mitad INF del área
 *   3 = banda SUP primeros 10m · 6 = banda INF primeros 10m
 *   4 = central SUP primeros 10m · 5 = central INF primeros 10m
 *   7 = banda SUP segundos 10m · 10 = banda INF segundos 10m
 *   8 = central SUP segundos 10m · 9 = central INF segundos 10m
 *
 * Escala: 1m = 20px → SVG 800px × 400px.
 */
import React from "react";
import { t } from "@/lib/i18n";

interface Props {
  seleccionada?: string;
  onSelect: (zona: string) => void;
  nombreAtacante?: string;
  /** Dirección de ataque visual. "der" = portería rival a la derecha (vista por
   *  defecto). "izq" = espejo horizontal (portería rival a la izquierda). */
  direccion?: "izq" | "der";
}

// Escala
const M = 20;
const W = 40 * M;   // 800
const H = 20 * M;   // 400

const POSTE_SUP_Y = H / 2 - 1.5 * M;   // 170
const POSTE_INF_Y = H / 2 + 1.5 * M;   // 230
const R_AREA = 6 * M;                  // 120
const BANDA_SUP_Y = 2.5 * M;           // 50
const BANDA_INF_Y = H - 2.5 * M;       // 350
const X_MEDIA = W / 2;                 // 400
const Y_CENTRO = H / 2;                // 200

/** Geometría de una media pista (der = ataque, izq = defensa). */
function geoMedia(lado: "der" | "izq") {
  const der = lado === "der";
  const XP = der ? W : 0;                       // línea de fondo (portería)
  const XAREA = der ? W - R_AREA : R_AREA;      // techo del área (paralelo a portería)
  const X10 = der ? W - 10 * M : 10 * M;        // línea de 10m
  const sweep = der ? 0 : 1;                    // sweep flag del arco (se invierte al espejar)
  const pre = der ? "A" : "D";
  // Bandas (rects): primeros 10m entre XP y X10; segundos 10m entre X10 y X_MEDIA.
  const b1x = Math.min(XP, X10);                // primeros 10m: x de inicio
  const b1w = Math.abs(XP - X10);               // ancho 10m (200)
  const b2x = Math.min(X10, X_MEDIA);           // segundos 10m
  const b2w = Math.abs(X10 - X_MEDIA);          // ancho 10m (200)
  // Área (paths con arco de 6m centrado en cada poste).
  const p1 = `M ${XP} ${BANDA_SUP_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XAREA} ${POSTE_SUP_Y} L ${XAREA} ${Y_CENTRO} L ${XP} ${Y_CENTRO} Z`;
  const p2 = `M ${XP} ${Y_CENTRO} L ${XAREA} ${Y_CENTRO} L ${XAREA} ${POSTE_INF_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XP} ${BANDA_INF_Y} Z`;
  // Central primeros 10m (envuelve el área): sup (4) e inf (5).
  const p4 = `M ${X10} ${BANDA_SUP_Y} L ${XP} ${BANDA_SUP_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XAREA} ${POSTE_SUP_Y} L ${XAREA} ${Y_CENTRO} L ${X10} ${Y_CENTRO} Z`;
  const p5 = `M ${X10} ${Y_CENTRO} L ${XAREA} ${Y_CENTRO} L ${XAREA} ${POSTE_INF_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XP} ${BANDA_INF_Y} L ${X10} ${BANDA_INF_Y} Z`;
  // Contorno del área (línea blanca, no clicable).
  const pArea = `M ${XP} ${BANDA_SUP_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XAREA} ${POSTE_SUP_Y} L ${XAREA} ${POSTE_INF_Y} A ${R_AREA} ${R_AREA} 0 0 ${sweep} ${XP} ${BANDA_INF_Y}`;
  return { pre, XP, XAREA, X10, b1x, b1w, b2x, b2w, p1, p2, p4, p5, pArea };
}

export function Campo({ seleccionada, onSelect, nombreAtacante, direccion = "der" }: Props) {
  const sel = (z: string) => seleccionada === z;
  const colorZona = (z: string) => (sel(z) ? "#1d4ed8" : "#ffffff");
  const opZona = (z: string) => (sel(z) ? 0.55 : 0.05);

  const flip = direccion === "izq";
  const gTransform = flip ? `rotate(180 ${W / 2} ${H / 2})` : undefined;

  // Zonas clicables de una media pista (rects para bandas/central 2º tramo,
  // paths para área y central 1º tramo).
  const zonasMedia = (lado: "der" | "izq") => {
    const g = geoMedia(lado);
    const Z = (n: number) => `${g.pre}${n}`;
    const zonaPath = (id: string, d: string) => (
      <g key={id} onClick={() => onSelect(id)} className="cursor-pointer">
        <path d={d} fill={colorZona(id)} fillOpacity={opZona(id)}
          stroke="#ffffff" strokeOpacity={0.3} strokeWidth="1" />
      </g>
    );
    const zonaRect = (id: string, x: number, y: number, w: number, h: number) => (
      <g key={id} onClick={() => onSelect(id)} className="cursor-pointer">
        <rect x={x} y={y} width={w} height={h} fill={colorZona(id)} fillOpacity={opZona(id)}
          stroke="#ffffff" strokeOpacity={0.3} strokeWidth="1" />
      </g>
    );
    return [
      // bandas primeros 10m: sup (3) e inf (6)
      zonaRect(Z(3), g.b1x, 0, g.b1w, BANDA_SUP_Y),
      zonaRect(Z(6), g.b1x, BANDA_INF_Y, g.b1w, H - BANDA_INF_Y),
      // central primeros 10m: sup (4) e inf (5) — envuelven el área
      zonaPath(Z(4), g.p4),
      zonaPath(Z(5), g.p5),
      // bandas segundos 10m: sup (7) e inf (10)
      zonaRect(Z(7), g.b2x, 0, g.b2w, BANDA_SUP_Y),
      zonaRect(Z(10), g.b2x, BANDA_INF_Y, g.b2w, H - BANDA_INF_Y),
      // central segundos 10m: sup (8) e inf (9)
      zonaRect(Z(8), g.b2x, BANDA_SUP_Y, g.b2w, Y_CENTRO - BANDA_SUP_Y),
      zonaRect(Z(9), g.b2x, Y_CENTRO, g.b2w, BANDA_INF_Y - Y_CENTRO),
      // área: sup (1) e inf (2) — encima para que capten el click
      zonaPath(Z(1), g.p1),
      zonaPath(Z(2), g.p2),
    ];
  };

  const gDer = geoMedia("der");
  const gIzq = geoMedia("izq");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none"
      style={{ maxHeight: "60vh" }}>
      <g transform={gTransform}>
        {/* Césped */}
        <rect x="0" y="0" width={W} height={H} fill="#1b5e20" rx="8" />
        {/* Borde exterior */}
        <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke="#ffffff" strokeWidth="3" rx="6" />

        {/* ── ZONAS: media pista de DEFENSA (izq) y de ATAQUE (der) ── */}
        {zonasMedia("izq")}
        {zonasMedia("der")}

        {/* ── LÍNEAS DEL CAMPO (encima, sin pointerEvents) ── */}
        <g style={{ pointerEvents: "none" }} fill="none" stroke="#ffffff" strokeWidth="2.5">
          {/* Línea media + círculo central */}
          <line x1={X_MEDIA} y1="0" x2={X_MEDIA} y2={H} strokeWidth="3" />
          <circle cx={X_MEDIA} cy={Y_CENTRO} r={3 * M} strokeWidth="2" />
          <circle cx={X_MEDIA} cy={Y_CENTRO} r="3" fill="#ffffff" stroke="none" />
          {/* Áreas (ambas) */}
          <path d={gDer.pArea} />
          <path d={gIzq.pArea} />
          {/* Línea central de 4m que separa 4/5 en cada mitad */}
          <line x1={gDer.X10} y1={Y_CENTRO} x2={gDer.XAREA} y2={Y_CENTRO} strokeDasharray="4 4" opacity="0.55" />
          <line x1={gIzq.X10} y1={Y_CENTRO} x2={gIzq.XAREA} y2={Y_CENTRO} strokeDasharray="4 4" opacity="0.55" />
          {/* Líneas de 10m (ambas) */}
          <line x1={gDer.X10} y1={BANDA_SUP_Y} x2={gDer.X10} y2={BANDA_INF_Y} strokeDasharray="4 4" opacity="0.4" />
          <line x1={gIzq.X10} y1={BANDA_SUP_Y} x2={gIzq.X10} y2={BANDA_INF_Y} strokeDasharray="4 4" opacity="0.4" />
          {/* Puntos de penalti (6m) y doble penalti (10m) en ambas mitades */}
          <circle cx={gDer.XAREA} cy={Y_CENTRO} r="3" fill="#ffffff" stroke="none" />
          <circle cx={gDer.X10} cy={Y_CENTRO} r="3" fill="#ffffff" stroke="none" />
          <circle cx={gIzq.XAREA} cy={Y_CENTRO} r="3" fill="#ffffff" stroke="none" />
          <circle cx={gIzq.X10} cy={Y_CENTRO} r="3" fill="#ffffff" stroke="none" />
          {/* Porterías: derecha (rival) e izquierda (propia) */}
          <rect x={W - 4} y={POSTE_SUP_Y} width="4" height={POSTE_INF_Y - POSTE_SUP_Y} fill="#ffffff" />
          <rect x="0" y={POSTE_SUP_Y} width="4" height={POSTE_INF_Y - POSTE_SUP_Y} fill="#ffffff" />
        </g>
      </g>{/* fin del grupo rotable */}

      {/* Etiqueta del atacante FUERA del grupo rotado: siempre legible. */}
      <text x={flip ? W - 8 : 8} y="18" textAnchor={flip ? "end" : "start"} fontSize="11"
        fill="#ffffff" opacity="0.65">
        {flip
          ? t("campo_ataca_izq", { nombre: nombreAtacante ?? t("campo_atacante") })
          : t("campo_ataca_der", { nombre: nombreAtacante ?? t("campo_atacante") })}
      </text>
    </svg>
  );
}
