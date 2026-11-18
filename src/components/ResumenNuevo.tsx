"use client";

/**
 * ResumenNuevo.tsx — Piezas del RESUMEN del partido (entre partes y al acabar)
 * y de los TOTALES con el aspecto NUEVO (rediseño PULSO, tanda 4 · 18/11/2026).
 * Maqueta: PULSO/comercial/crono/maquetas/resumen.html.
 *
 * SOLO dibujan. Todos los números llegan ya calculados desde app/resumen y
 * app/totales, que siguen haciendo las MISMAS cuentas que el aspecto clásico;
 * aquí no se suma ni se guarda nada. Con el clásico no se usa nada de esto (y
 * `useIcPP` devuelve el texto tal cual).
 *
 * Estilos en app/tema-nuevo.css (clases pz-pp-* y pz-res-*). El informe para
 * imprimir (/informe) NO pasa por aquí: sale igual que siempre.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  Ico, EMOJI_ICONO, RE_EMOJI, dibujaIcono, sinEmojis, type DefIcono,
} from "@/components/DirectoNuevo";
import { LogoPulso, BotonSol } from "@/components/InicioNuevo";
import { variablesEquipos, elegirRival, rgba } from "@/lib/tema";
import { CLIENTE } from "@/lib/clientes";
import { t } from "@/lib/i18n";

// ──────────────── Emojis → iconos (estas pantallas) ────────────────

/** Los emojis que salen en el resumen y los totales y no estaban en la lista
 *  de las ventanas del partido. El resto se dibuja con EMOJI_ICONO. */
const EXTRA: Record<string, DefIcono> = {
  "📄": { ico: "doc" },
  "✏": { ico: "lapiz" },
  "📅": { ico: "calendario" },
  "📤": { ico: "subir" },
  "💾": { ico: "bajar" },
  "📂": { ico: "carpeta" },
  "📍": { ico: "pin" },
  "📌": { ico: "pin" },
  "⚡": { ico: "rayo", color: "var(--aviso)" },
  "⚔": { ico: "espadas" },
  "🛡": { ico: "escudo" },
  "↗": { ico: "subeDer", color: "var(--ok)" },
  "↘": { ico: "bajaDer", color: "var(--mal)" },
  "🗑": { ico: "papelera" },
  "🧍": { ico: "persona" },
  "🧠": { ico: "bombilla" },
};

/** Cambia cada emoji del texto por su icono SVG. Sin emojis devuelve el MISMO
 *  texto. Un emoji sin dibujo se queda como está (no desaparece). */
export function icPP(txt: string): ReactNode {
  if (typeof txt !== "string" || !RE_EMOJI.test(txt)) return txt;
  const trozos = txt.split(RE_EMOJI);
  const out: ReactNode[] = [];
  trozos.forEach((tr, i) => {
    if (i % 2 === 1) {
      const ini = trozos.slice(0, i).join("").trim() === "";
      const fin = trozos.slice(i + 1).join("").trim() === "";
      const k = tr.replace(/️/g, "");
      const def = EXTRA[k] ?? EMOJI_ICONO[k];
      out.push(def ? dibujaIcono(def, i, `${ini ? "ini" : ""} ${fin ? "fin" : ""}`) : tr);
    } else {
      let limpio = tr;
      if (i > 0) limpio = limpio.replace(/^\s+/, "");
      if (i < trozos.length - 1) limpio = limpio.replace(/\s+$/, "");
      if (limpio) out.push(limpio);
    }
  });
  return <span className="pz-conico">{out}</span>;
}

/** ¿Pantalla de después del partido con el aspecto nuevo? Lo da la página. */
export const PostCtx = createContext(false);
function identidad(txt: string): ReactNode { return txt; }
/** Con el aspecto nuevo, emojis → iconos; con el clásico, el texto tal cual. */
export function useIcPP(): (txt: string) => ReactNode {
  return useContext(PostCtx) ? icPP : identidad;
}

/** t() que, con el aspecto nuevo, cambia los emojis del texto por iconos. */
export function useTPP(): (clave: string, params?: Record<string, string | number>) => ReactNode {
  const ic = useIcPP();
  return (clave, params) => ic(t(clave, params));
}

/** Variables de color de la pantalla: las del inicio + el tinte del rival. */
export function estiloPP(sol: boolean): CSSProperties {
  const v = variablesEquipos(CLIENTE.colorPropio, sol);
  const par = elegirRival(CLIENTE.colorPropio);
  const riv = sol ? par.sol : par.oscuro;
  return {
    ...v,
    "--rival-suave": rgba(riv, sol ? 0.1 : 0.16),
    // Tinte flojo de lo nuestro: columnas de las tablas.
    "--nos-flojo": rgba(v["--nos"], sol ? 0.06 : 0.08),
  } as CSSProperties;
}

/** Iniciales para el «escudo» del rival (no hay escudos guardados). */
function iniciales(nombre: string): string {
  const pal = nombre.replace(/^(CD|CF|FS|AD|UD|SD|CE|CDE|FC|CLUB)\s+/i, "").split(/\s+/).filter(Boolean);
  return (pal.length > 1 ? pal[0][0] + pal[1][0] : (pal[0] ?? "?").slice(0, 2)).toUpperCase();
}

// ──────────────── Cabecera ────────────────

export function CabeceraResumen(props: {
  rival: string;
  golesNos: number;
  golesRival: number;
  local: boolean;
  meta: string[];
  estado: string;
  enCurso: boolean;
  partes: string;
  tanda?: ReactNode;
  sol: boolean;
  onSol: () => void;
  /** Botón de la izquierda (volver al partido o inicio), el de siempre. */
  izquierda: ReactNode;
  /** «Inicio →» de la derecha (solo en curso: si no, ya está a la izquierda). */
  derecha?: ReactNode;
}) {
  return (
    <div className="pz-res-cab">
      <div className="pz-res-top">
        {props.izquierda}
        <span className="pz-etq pz-res-titulo">{sinEmojis(t("res_titulo"))}</span>
        <div className="der">
          <BotonSol sol={props.sol} onCambiar={props.onSol} />
          {props.derecha}
        </div>
      </div>
      <div className="pz-capa pz-res-hero">
        <div className="eq">
          <span className="esc nos"><LogoPulso className="esc-svg" /></span>
          <div className="eq-txt">
            <div className="n nos">{CLIENTE.nombreCorto}</div>
            <div className="s">{props.local ? t("inf_local") : t("inf_visitante")}</div>
          </div>
        </div>
        <div className="res">
          <div className="g pz-num">
            <span className="nos">{props.golesNos}</span>
            <span className="sep">–</span>
            <span className="riv">{props.golesRival}</span>
          </div>
          {props.tanda && <div className="tanda">{props.tanda}</div>}
          <div className="meta">
            {props.meta.map((m, i) => <span key={i} className="pz-chip">{m}</span>)}
            <span className={`pz-chip ${props.enCurso ? "curso" : "fin"}`}>
              <span className="punto" />{props.estado}
            </span>
          </div>
          <div className="partes">{t("res_partes_jugadas")} <b>{props.partes}</b></div>
        </div>
        <div className="eq r">
          <span className="esc riv">{iniciales(props.rival)}</span>
          <div className="eq-txt">
            <div className="n riv">{props.rival}</div>
            <div className="s">{props.local ? t("inf_visitante") : t("inf_local")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────── Pestañas ────────────────

const ICONO_PESTANA: Record<string, (p: { className?: string }) => ReactNode> = {
  general: Ico.barras,
  tiempos: Ico.reloj,
  individual: Ico.persona,
  cronograma: Ico.linea,
  disparos: Ico.diana,
  analisis: Ico.bombilla,
  editar: Ico.lapiz,
};

export function PestanasResumen(props: {
  pestanas: { id: string; lbl: string }[];
  actual: string;
  onElegir: (id: string) => void;
}) {
  return (
    <div className="pz-res-tabs" role="tablist">
      {props.pestanas.map((p) => {
        const I = ICONO_PESTANA[p.id];
        return (
          <button key={p.id} type="button" role="tab" aria-selected={props.actual === p.id}
            onClick={() => props.onElegir(p.id)}
            className={props.actual === p.id ? "on" : ""}>
            {I && <I className="pz-ico" />}
            <span>{sinEmojis(p.lbl)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ──────────────── General: disparos y balón ────────────────

export interface FilaCmp { lbl: string; nos: number; riv: number; total?: boolean }

/** Disparos nuestros contra los del rival, fila a fila, con barras. */
export function DisparosNuevo(props: { titulo: string; rival: string; filas: FilaCmp[]; pie?: ReactNode }) {
  const maxFilas = Math.max(1, ...props.filas.filter((f) => !f.total).flatMap((f) => [f.nos, f.riv]));
  return (
    <div className="pz-capa pz-res-panel">
      <h3 className="pz-res-h3">
        <Ico.diana className="pz-ico" />{sinEmojis(props.titulo)}
        <span className="ley">
          <span><i className="nos" />{CLIENTE.nombreCorto}</span>
          <span><i className="riv" />{props.rival}</span>
        </span>
      </h3>
      {props.filas.map((f) => {
        // Misma escala para todas las filas (la del total, aparte): así una
        // barra llena es «el que más», no «más que el rival en esa fila».
        const max = f.total ? Math.max(f.nos, f.riv, 1) : maxFilas;
        return (
          <div key={f.lbl} className={`pz-res-cmp ${f.total ? "tot" : ""}`}>
            <span className="v l pz-num">{f.nos}</span>
            <div className="barra l"><i style={{ width: `${(f.nos / max) * 100}%` }} /></div>
            <span className="lab">{f.lbl}</span>
            <div className="barra r"><i style={{ width: `${(f.riv / max) * 100}%` }} /></div>
            <span className="v r pz-num">{f.riv}</span>
          </div>
        );
      })}
      {props.pie && <div className="pz-res-pie">{props.pie}</div>}
    </div>
  );
}

export interface Kpi {
  lbl: string;
  color: string;
  grande: ReactNode;
  detalle: { lbl: ReactNode; val: ReactNode }[];
  /** Detalle en filas (parte a parte) en vez de en línea. */
  enFilas?: boolean;
}

export function BalonNuevo(props: { titulo: string; kpis: Kpi[] }) {
  return (
    <div className="pz-capa pz-res-panel">
      <h3 className="pz-res-h3"><Ico.barras className="pz-ico" />{sinEmojis(props.titulo)}</h3>
      <div className="pz-res-kpis">
        {props.kpis.map((k) => (
          <div key={k.lbl} className="pz-res-k" style={{ ["--c" as string]: k.color } as CSSProperties}>
            <div className="t"><i />{sinEmojis(k.lbl)}</div>
            <div className="big pz-num">{k.grande}</div>
            <div className={`det ${k.enFilas ? "filas" : ""}`}>
              {k.detalle.map((d, i) => <span key={i}><span className="l">{d.lbl}</span> <b className="pz-num">{d.val}</b></span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** «🧤 » delante de un texto: con el clásico, el MISMO texto de siempre (un solo
 *  trozo, para que se dibuje igual al píxel); con el nuevo, el icono. */
export function prefijo(nuevo: boolean, emoji: string): ReactNode {
  return nuevo ? <>{icPP(emoji)}{" "}</> : emoji + " ";
}
