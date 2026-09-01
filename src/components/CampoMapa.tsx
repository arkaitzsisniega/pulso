"use client";

/**
 * CampoMapa — El campo del informe, pintado por intensidad.
 *
 * Por qué existe (1/9/2026): el informe enseñaba las zonas como una lista de
 * barras («A5 ▓▓▓ 20»). Arkaitz: *"no sale el campo, por ejemplo, para el mapa
 * de robos o pérdidas"*. Tenía razón: un cuerpo técnico lee un campo de un
 * vistazo y una lista de códigos no la lee nadie.
 *
 * Usa EXACTAMENTE la misma geometría que `Campo.tsx` —la de capturar— así que
 * lo que se pinta cae donde se marcó. Si un día se retoca el campo, se retoca
 * en un sitio.
 *
 * Diferencias con el campo de capturar, todas por el papel:
 *   · Césped BLANCO y líneas grises. Un campo verde oscuro a toda página se
 *     come el tóner y en una impresora normal sale un manchón.
 *   · Cada zona se tiñe según cuánto pasó ahí, y lleva su número dentro.
 *   · No es clicable: es un dibujo.
 */
import React from "react";
import {
  M, W, H, POSTE_SUP_Y, POSTE_INF_Y, BANDA_SUP_Y, BANDA_INF_Y,
  X_MEDIA, Y_CENTRO, geoMedia,
} from "./Campo";

interface Props {
  /** {"A5": 20, "D3": 2, …} */
  zonas: Record<string, number>;
  titulo: string;
  /** Color base del degradado. */
  color: string;
  /** Hacia dónde atacamos: "der" pinta la portería rival a la derecha. */
  direccion?: "izq" | "der";
  /** Texto pequeño bajo el campo. */
  pie?: string;
}

export function CampoMapa({ zonas, titulo, color, direccion = "der", pie }: Props) {
  const valores = Object.values(zonas);
  const max = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);

  // Una zona sin nada se queda en blanco: teñirla de un verde clarito sugiere
  // que algo pasó ahí y no pasó nada.
  const tinte = (z: string) => {
    const v = zonas[z] ?? 0;
    return v ? 0.12 + 0.68 * (v / max) : 0;
  };
  const flip = direccion === "izq";

  const zonasMedia = (lado: "der" | "izq") => {
    const g = geoMedia(lado);
    const Z = (n: number) => `${g.pre}${n}`;
    const path = (id: string, d: string) => (
      <path key={id} d={d} fill={color} fillOpacity={tinte(id)}
            stroke="#c9cfcc" strokeWidth="1" />
    );
    const rect = (id: string, x: number, y: number, w: number, h: number) => (
      <rect key={id} x={x} y={y} width={w} height={h} fill={color}
            fillOpacity={tinte(id)} stroke="#c9cfcc" strokeWidth="1" />
    );
    return [
      rect(Z(3), g.b1x, 0, g.b1w, BANDA_SUP_Y),
      rect(Z(6), g.b1x, BANDA_INF_Y, g.b1w, H - BANDA_INF_Y),
      path(Z(4), g.p4),
      path(Z(5), g.p5),
      rect(Z(7), g.b2x, 0, g.b2w, BANDA_SUP_Y),
      rect(Z(10), g.b2x, BANDA_INF_Y, g.b2w, H - BANDA_INF_Y),
      rect(Z(8), g.b2x, BANDA_SUP_Y, g.b2w, Y_CENTRO - BANDA_SUP_Y),
      rect(Z(9), g.b2x, Y_CENTRO, g.b2w, BANDA_INF_Y - Y_CENTRO),
      path(Z(1), g.p1),
      path(Z(2), g.p2),
    ];
  };

  /** Dónde va el número de cada zona. Calculado a mano, no del path: el centro
   *  geométrico de un área con arco cae fuera y el número queda descolocado. */
  const centros = (lado: "der" | "izq"): [string, number, number][] => {
    const g = geoMedia(lado);
    const Z = (n: number) => `${g.pre}${n}`;
    const xArea = (g.XP + g.XAREA) / 2;
    const x1 = (g.X10 + g.XAREA) / 2;          // central primeros 10m
    const x2 = (g.b2x + g.b2w / 2);            // segundos 10m
    const xb1 = g.b1x + g.b1w / 2;             // banda primeros 10m
    return [
      [Z(1), xArea, Y_CENTRO - 2.2 * M],
      [Z(2), xArea, Y_CENTRO + 2.2 * M],
      [Z(3), xb1, BANDA_SUP_Y / 2],
      [Z(6), xb1, (BANDA_INF_Y + H) / 2],
      [Z(4), x1, Y_CENTRO - 2.2 * M],
      [Z(5), x1, Y_CENTRO + 2.2 * M],
      [Z(7), x2, BANDA_SUP_Y / 2],
      [Z(10), x2, (BANDA_INF_Y + H) / 2],
      [Z(8), x2, (BANDA_SUP_Y + Y_CENTRO) / 2],
      [Z(9), x2, (Y_CENTRO + BANDA_INF_Y) / 2],
    ];
  };

  const gDer = geoMedia("der");
  const gIzq = geoMedia("izq");
  const numeros = [...centros("der"), ...centros("izq")]
    .filter(([z]) => (zonas[z] ?? 0) > 0);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-600">{titulo}</p>
        {total > 0 && (
          <p className="text-[9px] tabular-nums text-zinc-500">{total}</p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
        <g transform={flip ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
          <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
          {zonasMedia("izq")}
          {zonasMedia("der")}
          <g fill="none" stroke="#9aa5a0" strokeWidth="2">
            <rect x="1" y="1" width={W - 2} height={H - 2} />
            <line x1={X_MEDIA} y1="0" x2={X_MEDIA} y2={H} />
            <circle cx={X_MEDIA} cy={Y_CENTRO} r={3 * M} />
            <path d={gDer.pArea} />
            <path d={gIzq.pArea} />
            <line x1={gDer.X10} y1={BANDA_SUP_Y} x2={gDer.X10} y2={BANDA_INF_Y}
                  strokeDasharray="6 5" opacity="0.7" />
            <line x1={gIzq.X10} y1={BANDA_SUP_Y} x2={gIzq.X10} y2={BANDA_INF_Y}
                  strokeDasharray="6 5" opacity="0.7" />
          </g>
          {/* Porterías, en negro: son la referencia para leer el campo */}
          <rect x={W - 5} y={POSTE_SUP_Y} width="5" height={POSTE_INF_Y - POSTE_SUP_Y} fill="#333" />
          <rect x="0" y={POSTE_SUP_Y} width="5" height={POSTE_INF_Y - POSTE_SUP_Y} fill="#333" />
        </g>
        {/* Los números van FUERA del grupo girado: si no, salen del revés */}
        {numeros.map(([z, x, y]) => {
          const px = flip ? W - x : x;
          const py = flip ? H - y : y;
          return (
            <text key={z} x={px} y={py + 7} textAnchor="middle" fontSize="21"
                  fontWeight="700" fill="#1a1a1a">
              {zonas[z]}
            </text>
          );
        })}
      </svg>
      {pie && <p className="mt-[2px] text-[8px] text-zinc-500">{pie}</p>}
    </div>
  );
}
