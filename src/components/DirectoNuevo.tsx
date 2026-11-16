"use client";

/**
 * DirectoNuevo.tsx — Piezas de la pantalla del partido EN DIRECTO con el
 * aspecto NUEVO (rediseño PULSO, tanda 1 · 16/11/2026).
 *
 * SOLO dibujan. No guardan nada, no calculan tiempos ni semáforos: todo les
 * llega hecho desde app/partido/page.tsx, que es quien sigue llamando al store
 * con los MISMOS manejadores que el aspecto clásico. Mismo sitio, mismo orden y
 * mismas acciones que el clásico; cambia cómo se ve.
 *
 * Estilos en app/tema-nuevo.css (clases pz-*).
 */
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatMMSS, formatMSS } from "@/lib/utils";

/** Quita el emoji/símbolo de delante de una etiqueta del catálogo
 *  («⚽ GOL» → «GOL»): en el aspecto nuevo el icono es un dibujo SVG. */
export function sinIcono(txt: string): string {
  return txt.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

// ──────────────── Iconos (línea, estilo Lucide · ISC) ────────────────
type IcoProps = { className?: string };
const Svg = (p: IcoProps & { children: ReactNode }) => (
  <svg className={p.className ?? "pz-ico"} viewBox="0 0 24 24" aria-hidden="true">{p.children}</svg>
);
export const Ico = {
  gol: (p: IcoProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /></Svg>,
  diana: (p: IcoProps) => <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Svg>,
  arriba: (p: IcoProps) => <Svg {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>,
  aviso: (p: IcoProps) => <Svg {...p}><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></Svg>,
  reloj: (p: IcoProps) => <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M10 2h4" /></Svg>,
  porteria: (p: IcoProps) => <Svg {...p}><rect x="3" y="5" width="18" height="12" rx="1" /><circle cx="12" cy="20" r="1.5" /></Svg>,
  check: (p: IcoProps) => <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>,
  cruz: (p: IcoProps) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>,
  deshacer: (p: IcoProps) => <Svg {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Svg>,
  barras: (p: IcoProps) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>,
  bandera: (p: IcoProps) => <Svg {...p}><path d="M4 21V4h12l-2 4 2 4H4" /></Svg>,
  casa: (p: IcoProps) => <Svg {...p}><path d="M3 11l9-8 9 8M5 9v11h14V9" /></Svg>,
  trofeo: (p: IcoProps) => <Svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></Svg>,
  guante: (p: IcoProps) => <Svg {...p}><path d="M7 21v-6L4 11V6a1.5 1.5 0 0 1 3 0v4M7 6V4a1.5 1.5 0 0 1 3 0v6M10 4a1.5 1.5 0 0 1 3 0v6M13 5a1.5 1.5 0 0 1 3 0v6l2-2a1.6 1.6 0 0 1 2.3 2.2L16 16v5" /></Svg>,
  atras: (p: IcoProps) => <Svg {...p}><path d="M6 5v14M18 6l-8 6 8 6z" /></Svg>,
  adelante: (p: IcoProps) => <Svg {...p}><path d="M6 6l8 6-8 6zM18 5v14" /></Svg>,
  flechaIzq: (p: IcoProps) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>,
  flechaDer: (p: IcoProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>,
  sol: (p: IcoProps) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>,
  luna: (p: IcoProps) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>,
};

/** Tarjetas de un jugador: amarilla(s) con el número si hay 2, y roja si está
 *  expulsado (roja directa o segunda amarilla). */
export function Tarjetas(props: { amarillas: number; expulsado: boolean }) {
  const { amarillas, expulsado } = props;
  if (!amarillas && !expulsado) return null;
  return (
    <span className="pz-tarjetas"
      title={expulsado ? t("part_expulsado_title") : t("part_amarilla_title")}>
      {amarillas > 0 && <span className="pz-tarjeta am" />}
      {amarillas > 1 && <span>{amarillas}</span>}
      {expulsado && <span className="pz-tarjeta ro" />}
    </span>
  );
}

// ──────────────── Cabecera: reloj · marcador · parte ────────────────

function PuntosFaltas(props: { n: number; derecha?: boolean }) {
  const { n } = props;
  const puntos = [0, 1, 2, 3, 4].map((i) => (
    <span key={i} className={`f ${i < n ? "on" : ""}`} />
  ));
  const etq = <b>{t("part_faltas")}</b>;
  const num = <span className="n pz-num">{n}</span>;
  return (
    <div className={`pz-faltas ${n >= 5 ? "limite" : ""}`}>
      {props.derecha ? <>{num}{etq}{puntos}</> : <>{puntos}{etq}{num}</>}
    </div>
  );
}

export function CabeceraNueva(props: {
  reloj: ReactNode;
  parte: string;
  textoTiempo: string;
  /** 0-1 de la parte jugada, o null si la parte no tiene duración. */
  progreso: number | null;
  acabada: boolean;
  nombreNos: string;
  nombreRival: string;
  golesNos: number;
  golesRival: number;
  faltasNos: number;
  faltasRival: number;
  colorNos: string;
  colorRival: string;
  fondoNos: string;
  fondoRival: string;
  puedeRetroceder: boolean;
  onRetroceder: () => void;
  onParte: () => void;
}) {
  const p = props;
  return (
    <div className="pz-cab pz-capa">
      <div className="pz-reloj">
        {p.reloj}
        <div className="pz-meta">
          <span className="pz-chip">{p.parte}</span>
          {p.progreso != null && (
            <div className="pz-parte-bar"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, p.progreso)) * 100)}%` }} /></div>
          )}
          <small>{p.textoTiempo}</small>
          {p.acabada && <span className="fin">{sinIcono(t("part_fin_parte"))}</span>}
        </div>
      </div>
      <div className="pz-marcador">
        <div className="pz-equipo">
          <div className="nom" style={{ color: p.colorNos }}>{p.nombreNos}</div>
          <PuntosFaltas n={p.faltasNos} />
        </div>
        <div className="pz-goles">
          <span className="g" style={{ background: p.fondoNos, color: p.colorNos }}>{p.golesNos}</span>
          <span className="sep">–</span>
          <span className="g" style={{ background: p.fondoRival, color: p.colorRival }}>{p.golesRival}</span>
        </div>
        <div className="pz-equipo r">
          <div className="nom" style={{ color: p.colorRival }} title={p.nombreRival}>{p.nombreRival}</div>
          <PuntosFaltas n={p.faltasRival} derecha />
        </div>
      </div>
      <div className="pz-control">
        <button className="pz-btn ico" onClick={p.onRetroceder} disabled={!p.puedeRetroceder}
          title={t("part_volver_parte_title")} aria-label={t("part_volver_parte_title")}>
          <Ico.atras />
        </button>
        <button className="pz-btn" onClick={p.onParte}>
          {sinIcono(t("part_parte_btn"))} <Ico.adelante className="pz-ico" />
        </button>
      </div>
    </div>
  );
}

/** Iniciar / pausar: flotante, siempre por encima de los modales (z-60). */
export function BotonTiempoNuevo(props: { corriendo: boolean; onIniciar: () => void; onPausar: () => void }) {
  return props.corriendo ? (
    <button className="pz-play pausar" onClick={props.onPausar} aria-label={t("part_pausar")}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
      {sinIcono(t("part_pausar"))}
    </button>
  ) : (
    <button className="pz-play iniciar" onClick={props.onIniciar} aria-label={t("part_iniciar")}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>
      {sinIcono(t("part_iniciar"))}
    </button>
  );
}

// ──────────────── Barra de herramientas ────────────────

export function HerramientasNueva(props: {
  directo: boolean;
  onModo: (m: "directo" | "video") => void;
  ataqueDer: boolean;
  colorNos: string;
  onCambiarAtaque: () => void;
  onAjustar: (d: number) => void;
  parte: string;
  amaNos: number;
  amaRival: number;
  tmNos: number;
  tmRival: number;
  sol: boolean;
  onSol: () => void;
  /** Avisos de faltas y tarjetas del rival (mismos textos que el clásico). */
  extra: ReactNode;
}) {
  const p = props;
  return (
    <div className="pz-herr">
      <div className="pz-seg" title={p.directo ? t("part_modo_directo_nota") : t("part_modo_video_nota")}>
        <button className={p.directo ? "on vivo" : ""} onClick={() => p.onModo("directo")}>
          <span className="punto" />{t("part_modo_directo")}
        </button>
        <button className={!p.directo ? "on" : ""} onClick={() => p.onModo("video")}>
          {t("part_modo_video")}
        </button>
      </div>
      <div className="pz-seg">
        <button className="on" onClick={p.onCambiarAtaque} title={t("part_direccion_nota")}>
          {t("part_direccion")}
          <span style={{ color: p.colorNos, display: "inline-flex" }}>
            {p.ataqueDer ? <Ico.flechaDer className="pz-ico" /> : <Ico.flechaIzq className="pz-ico" />}
          </span>
        </button>
      </div>
      <div className="pz-ajuste" title={t("part_ajustar_nota")}>
        <span className="pz-etq" style={{ padding: "0 4px" }}>{t("part_ajustar_reloj").replace(/:\s*$/, "")}</span>
        {([-60, -10, -1, 1, 10, 60] as const).map((d) => (
          <button key={d} onClick={() => p.onAjustar(d)}>
            {d < 0 ? "−" : "+"}{formatMMSS(Math.abs(d)).replace(/^0/, "")}
          </button>
        ))}
      </div>
      <div className="pz-der">
        <span className="pz-etq">{t("part_stats_parte", { parte: p.parte })}</span>
        <span className="pz-dato" title={t("part_amarilla_title")}>
          <span className="pz-tarjeta am" style={{ width: 11, height: 15 }} />
          <strong>{p.amaNos}</strong><span className="barra">/</span><strong>{p.amaRival}</strong>
        </span>
        <span className="pz-dato">
          {t("part_tm_abbr")} <strong>{p.tmNos}</strong><span className="barra">/</span><strong>{p.tmRival}</strong>
        </span>
        {p.extra}
        <button className="pz-btn pz-sol" onClick={p.onSol}
          title={p.sol ? t("pz_tema_pabellon") : t("pz_tema_sol")} aria-label={p.sol ? t("pz_tema_pabellon") : t("pz_tema_sol")}>
          {p.sol ? <Ico.luna /> : <Ico.sol />}
        </button>
      </div>
    </div>
  );
}

// ──────────────── En pista ────────────────

export interface FichaPista {
  nombre: string;
  dorsal: string;
  seg: number;
  segParte: number;
  esPortero: boolean;
  amarillas: number;
  expulsado: boolean;
  /** 0-3, el nivel del semáforo (utils.nivelTiempoPista). */
  nivel: number;
}

export function PistaNueva(props: { fichas: FichaPista[]; onTocar: (nombre: string) => void }) {
  const titulo = t("part_en_pista");
  const [cab, ayuda] = partirTitulo(titulo);
  return (
    <div className="pz-bloque pz-capa flex-[31] min-h-[70px]">
      <h2><span className="pz-etq">{cab}</span>{ayuda && <span className="ayuda">{ayuda}</span>}</h2>
      <div className="grid grid-cols-5 gap-2 flex-1 min-h-0">
        {props.fichas.map((f) => {
          const clase = f.expulsado ? "expulsado" : f.esPortero ? "portero" : "";
          const c = f.expulsado || f.esPortero ? undefined : `var(--t${f.nivel})`;
          return (
            <button key={f.nombre} className={`pz-tj ${clase}`}
              style={c ? ({ ["--c" as string]: c } as React.CSSProperties) : undefined}
              disabled={f.expulsado}
              onClick={() => { if (!f.expulsado) props.onTocar(f.nombre); }}>
              <div className="arriba">
                <span className="pz-dorsal">{f.dorsal || "—"}</span>
                <span className="nombre">{f.nombre}</span>
                {f.esPortero && !f.expulsado && <Ico.guante className="pz-ico pz-guante" />}
                <Tarjetas amarillas={f.amarillas} expulsado={f.expulsado} />
              </div>
              {f.expulsado ? (
                <div className="pz-exp-txt">{t("part_expulsado")}</div>
              ) : (
                <>
                  <div className="tiempo">{formatMSS(f.seg)}</div>
                  <div className="pie">
                    <span>{t("part_parte_corto", { tiempo: formatMMSS(f.segParte) })}</span>
                  </div>
                  <div className="pz-prog">
                    <i style={{ width: f.esPortero ? 0 : `${Math.round(Math.min(1, f.seg / 180) * 100)}%` }} />
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────── Banquillo ────────────────

export interface FichaBanquillo {
  nombre: string;
  dorsal: string;
  segSentado: number;
  segParte: number;
  segTotal: number;
  esPortero: boolean;
  amarillas: number;
  expulsado: boolean;
  /** -1 (descansado) a 3, utils.nivelTiempoBanquillo. */
  nivel: number;
}

export function BanquilloNuevo(props: { fichas: FichaBanquillo[]; columnas: number; onTocar: (nombre: string) => void }) {
  const [cab, ayuda] = partirTitulo(t("part_banquillo"));
  return (
    <div className="pz-bloque pz-capa flex-[25] min-h-[110px]">
      <h2><span className="pz-etq">{cab}</span>{ayuda && <span className="ayuda">{ayuda}</span>}</h2>
      <div className="grid gap-1.5 flex-1 min-h-0 auto-rows-fr"
        style={{ gridTemplateColumns: `repeat(${props.columnas}, minmax(0, 1fr))` }}>
        {props.fichas.map((f) => {
          const c = f.expulsado ? "var(--roja)"
            : f.esPortero || f.nivel < 0 ? "transparent" : `var(--t${f.nivel})`;
          return (
            <button key={f.nombre}
              className={`pz-tb ${f.expulsado ? "expulsado" : ""}`}
              style={{ ["--c" as string]: c } as React.CSSProperties}
              disabled={f.expulsado}
              onClick={() => { if (!f.expulsado) props.onTocar(f.nombre); }}>
              <div style={{ minWidth: 0 }}>
                <div className="n">
                  {f.dorsal && <span className="pz-dorsal">{f.dorsal}</span>}
                  <span className="txt">{f.nombre}</span>
                  <Tarjetas amarillas={f.amarillas} expulsado={f.expulsado} />
                </div>
                {f.expulsado ? (
                  <div className="sub" style={{ color: "var(--roja)", fontWeight: 800 }}>{t("part_expulsado")}</div>
                ) : (
                  <div className="sub">{formatMSS(f.segParte)} · <b>{formatMSS(f.segTotal)}</b></div>
                )}
              </div>
              {!f.expulsado && (
                <div className="sent">
                  {formatMSS(f.segSentado)}
                  <small>{f.esPortero ? t("pz_portero") : t("pz_sentado")}</small>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** «EN PISTA (toca un jugador…)» → ["EN PISTA", "Toca un jugador…"]. */
function partirTitulo(txt: string): [string, string] {
  const m = txt.match(/^([^(]+)\((.+)\)\s*$/);
  if (!m) return [txt, ""];
  const ayuda = m[2].trim();
  return [m[1].trim(), ayuda.charAt(0).toUpperCase() + ayuda.slice(1)];
}

// ──────────────── Botones de acción ────────────────

export function BotonNuevo(props: {
  label: string;
  color: string;
  icono?: ReactNode;
  tipo?: "lleno" | "nav";
  onClick: () => void;
}) {
  return (
    <button onClick={props.onClick}
      className={`pz-a ${props.tipo ?? ""}`}
      style={{ ["--c" as string]: props.color } as React.CSSProperties}>
      {props.icono}
      <span>{sinIcono(props.label)}</span>
    </button>
  );
}
