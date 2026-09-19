"use client";

/**
 * CampoFlecha — el campo para dibujar la flecha de un pase (pase de gol,
 * 18/9/2026).
 *
 * Arkaitz quiere ver de dónde sale el pase y a dónde llega, no solo una zona.
 * Se dibuja de dos maneras, las dos con el dedo o con el ratón:
 *   · arrastrando desde donde sale el pase hasta donde llega;
 *   · o tocando el origen y después el destino.
 * Con la flecha ya puesta, tocar otra vez empieza una nueva. Una flecha de
 * menos de 1 m no se acepta: eso es un toque que se ha ido del dedo.
 *
 * Es el MISMO campo que el de las zonas (`FondoCampo` y `LineasCampo` de
 * Campo.tsx) y se gira igual según hacia dónde atacamos en esa parte. Lo que se
 * guarda es el punto sin girar (ver `Flecha` en db.ts): la flecha de la 2ª parte
 * es la misma que la de la 1ª aunque en la pantalla se vea al revés.
 */
import { useId, useRef, useState } from "react";
import type React from "react";
import { FondoCampo, LineasCampo, W, H } from "@/components/Campo";
import { aCanonico, flechaSuficiente, zonasDeFlecha, type PuntoCampo } from "@/lib/geometriaCampo";
import type { Flecha } from "@/lib/db";
import { t } from "@/lib/i18n";

interface Props {
  /** La flecha que hay (sin girar), o null si aún no hay ninguna. */
  flecha: Flecha | null;
  /** Se llama con la flecha nueva cuando está completa, y con null al empezar
   *  otra (tocar otra vez reinicia). */
  onChange: (f: Flecha | null) => void;
  /** Hacia dónde atacamos EN ESA PARTE: "izq" gira el dibujo 180°. */
  direccion: "izq" | "der";
  nombreAtacante?: string;
  /** Aviso fijo encima del campo (el del pase de gol: solo si NO acabó en gol). */
  avisoArriba?: React.ReactNode;
}

interface Arrastre { desde: PuntoCampo; hasta: PuntoCampo; segundoToque: boolean }

export function CampoFlecha({ flecha, onChange, direccion, nombreAtacante, avisoArriba }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const marca = `punta-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // El origen de un primer toque, a la espera del segundo (el destino).
  const [origen, setOrigen] = useState<PuntoCampo | null>(null);
  // El dedo apoyado. Va también en una ref: pointerdown y pointerup pueden
  // llegar antes de que React vuelva a pintar, y la lógica no puede depender
  // de un estado que aún no se ha actualizado.
  const [arrastre, setArrastreEstado] = useState<Arrastre | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const setArrastre = (a: Arrastre | null) => { arrastreRef.current = a; setArrastreEstado(a); };
  const [corta, setCorta] = useState(false);

  const flip = direccion === "izq";
  const gTransform = flip ? `rotate(180 ${W / 2} ${H / 2})` : undefined;

  /** Del toque en la pantalla al punto del campo (sin girar). */
  const punto = (e: React.PointerEvent<SVGSVGElement>): PuntoCampo | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return aCanonico(p.x, p.y, direccion);
  };

  const alBajar = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = punto(e);
    if (!p) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no pasa nada */ }
    setCorta(false);
    if (flecha) {                 // ya había una: tocar otra vez empieza de nuevo
      onChange(null);
      setOrigen(null);
      setArrastre({ desde: p, hasta: p, segundoToque: false });
    } else if (origen) {          // segundo toque: el destino
      setArrastre({ desde: origen, hasta: p, segundoToque: true });
    } else {
      setArrastre({ desde: p, hasta: p, segundoToque: false });
    }
  };

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = arrastreRef.current;
    if (!a) return;
    const p = punto(e);
    if (p) setArrastre({ ...a, hasta: p });
  };

  const alSubir = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = arrastreRef.current;
    if (!a) return;
    const p = punto(e) ?? a.hasta;
    setArrastre(null);
    const f: Flecha = { x0: a.desde.x, y0: a.desde.y, x1: p.x, y1: p.y };
    if (flechaSuficiente(f)) {    // arrastre largo o segundo toque: flecha hecha
      setOrigen(null);
      onChange(f);
    } else if (a.segundoToque) {  // el destino pegado al origen: no vale
      setCorta(true);
    } else {                      // un toque: el origen, a la espera del destino
      setOrigen(a.desde);
    }
  };

  const px = (p: PuntoCampo) => ({ x: p.x * W, y: p.y * H });
  const linea = (a: PuntoCampo, b: PuntoCampo, provisional: boolean) => {
    const A = px(a), B = px(b);
    return (
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
        stroke="#facc15" strokeWidth={5} strokeLinecap="round"
        strokeDasharray={provisional ? "12 8" : undefined}
        markerEnd={provisional ? undefined : `url(#${marca})`} />
    );
  };
  const puntoOrigen = (p: PuntoCampo) => {
    const P = px(p);
    return <circle cx={P.x} cy={P.y} r={9} fill="#ffffff" stroke="#facc15" strokeWidth={4} />;
  };

  const zonas = flecha ? zonasDeFlecha(flecha) : null;

  return (
    <div>
      {avisoArriba && (
        <div className="mb-2 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-base font-semibold text-amber-200">
          ⚠️ {avisoArriba}
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none cursor-crosshair"
        style={{ maxHeight: "58vh", touchAction: "none" }}
        onPointerDown={alBajar} onPointerMove={alMover}
        onPointerUp={alSubir} onPointerCancel={() => setArrastre(null)}>
        <defs>
          <marker id={marca} viewBox="0 0 10 10" refX="7" refY="5"
            markerWidth="4" markerHeight="4" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" />
          </marker>
        </defs>
        <g transform={gTransform}>
          <FondoCampo />
          <LineasCampo />
          {/* La flecha va DENTRO del grupo girado: se dibuja con el punto sin
              girar y el giro la pone donde se tocó. */}
          {flecha && (
            <g style={{ pointerEvents: "none" }}>
              {linea({ x: flecha.x0, y: flecha.y0 }, { x: flecha.x1, y: flecha.y1 }, false)}
              {puntoOrigen({ x: flecha.x0, y: flecha.y0 })}
            </g>
          )}
          {!flecha && arrastre && (
            <g style={{ pointerEvents: "none" }}>
              {linea(arrastre.desde, arrastre.hasta, true)}
              {puntoOrigen(arrastre.desde)}
            </g>
          )}
          {!flecha && !arrastre && origen && (
            <g style={{ pointerEvents: "none" }}>{puntoOrigen(origen)}</g>
          )}
        </g>
        {/* Quién ataca, FUERA del grupo girado: siempre legible. */}
        <text x={flip ? W - 8 : 8} y="18" textAnchor={flip ? "end" : "start"} fontSize="11"
          fill="#ffffff" opacity="0.65" style={{ pointerEvents: "none" }}>
          {flip
            ? t("campo_ataca_izq", { nombre: nombreAtacante ?? t("campo_atacante") })
            : t("campo_ataca_der", { nombre: nombreAtacante ?? t("campo_atacante") })}
        </text>
      </svg>
      <div className="mt-2 min-h-[2.5rem] flex items-center justify-between gap-3">
        {zonas ? (
          <>
            <span className="text-2xl font-bold tabular-nums text-yellow-300" data-zonas-flecha>
              {zonas.origen} → {zonas.destino}
            </span>
            <span className="text-sm text-zinc-400">{t("pg_otra_vez")}</span>
          </>
        ) : (
          <span className={`text-base ${corta ? "text-red-300 font-semibold" : "text-zinc-300"}`}>
            {corta ? t("pg_muy_corta") : origen ? t("pg_toca_destino") : t("pg_instrucciones")}
          </span>
        )}
      </div>
    </div>
  );
}
