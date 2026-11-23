"use client";

/**
 * InicioNuevo.tsx — Pantalla de INICIO con el aspecto NUEVO (rediseño PULSO,
 * tanda 3 · 18/11/2026). Maqueta: PULSO/comercial/crono/maquetas/inicio.html.
 *
 * SOLO dibuja. La lista de partidos, continuar, estadísticas, rehacer y borrar
 * llegan hechos desde app/page.tsx (el interruptor de aspecto se quitó el
 * 15/12/2026: todos van con el nuevo, ver lib/aspecto.ts): los MISMOS
 * manejadores que el aspecto clásico. Los textos son los de i18n de siempre;
 * los emojis se cambian por iconos SVG al dibujar (sinEmojis / Ico).
 *
 * Estilos en app/tema-nuevo.css (clases pz-ini-*).
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { type Partido } from "@/lib/db";
import { t, labelCompeticionCorta } from "@/lib/i18n";
import { ID_PARTIDO_EJEMPLO } from "@/lib/partidoEjemplo";
import { CLIENTE, VERSION_CRONO } from "@/lib/clientes";
import { variablesEquipos } from "@/lib/tema";
import { Ico, sinEmojis } from "@/components/DirectoNuevo";
import { Escudo } from "@/components/Escudo";

/** El logo de PULSO (la línea del pulso). Dibujo, sin imágenes. */
export function LogoPulso(props: { className?: string; aro?: boolean }) {
  return (
    <svg className={props.className} viewBox="0 0 120 64" aria-hidden="true">
      {props.aro && (
        <ellipse cx="60" cy="32" rx="55" ry="27" fill="none" stroke="currentColor" strokeWidth="6" />
      )}
      <polyline points={props.aro ? "17,32 46,32 51,27 56,36 63,15 70,46 77,32 103,32" : "10,32 46,32 51,27 56,36 63,15 70,46 77,32 110,32"}
        fill="none" stroke="#e63946" strokeWidth={props.aro ? 6 : 7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Botón de un toque para el modo Sol (mismo ajuste que en el partido). */
export function BotonSol(props: { sol: boolean; onCambiar: () => void }) {
  return (
    <button type="button" className="pz-btn ico pz-sol-ini" onClick={props.onCambiar}
      title={props.sol ? t("pz_tema_pabellon") : t("pz_tema_sol")}
      aria-label={props.sol ? t("pz_tema_pabellon") : t("pz_tema_sol")}>
      {props.sol ? <Ico.luna /> : <Ico.sol />}
    </button>
  );
}

export function InicioNuevo(props: {
  partidos: Partido[];
  cargado: boolean;
  sol: boolean;
  onSol: () => void;
  onContinuar: (id: string) => void;
  onStats: (id: string) => void;
  onRehacer: (p: Partido) => void;
  onBorrar: (id: string) => void;
  /** «Finalizar» un partido abierto (con confirmación; 20/11/2026). */
  onFinalizar: (p: Partido) => void;
  /** «Importar partido»: abre el selector de archivo (19/11/2026). */
  onImportar: () => void;
  /** La ventana de «rehacer con vídeo» (la misma del clásico). */
  ventana: ReactNode;
}) {
  const { partidos, cargado } = props;
  return (
    <div className="pz pz-ini" data-tema={props.sol ? "sol" : undefined}
      style={variablesEquipos(CLIENTE.colorPropio, props.sol) as React.CSSProperties}>
      <div className="pz-ini-cols">
        {/* ── Columna izquierda: club, partido nuevo, totales ── */}
        <div className="pz-ini-izq">
          <div className="pz-capa pz-ini-club">
            <div className="pz-ini-club-fila">
              <Escudo className="pz-ini-escudo" />
              <div className="pz-ini-club-txt">
                <h1>{sinEmojis(t("home_titulo", { marca: CLIENTE.marcaTitulo }))}</h1>
                <p>{t("home_subtitulo", { club: CLIENTE.nombreLargo })}</p>
              </div>
              <BotonSol sol={props.sol} onCambiar={props.onSol} />
            </div>
            <div className="pz-ini-chips">
              <span className="pz-chip pz-num">v{VERSION_CRONO}</span>
            </div>
          </div>

          <Link href="/nuevo" className="pz-ini-nuevo">
            <span className="ic"><Ico.mas /></span>
            <b>{sinEmojis(t("home_nuevo"))}</b>
            <Ico.chevron className="pz-ico fl" />
          </Link>

          <Link href="/totales" className="pz-ini-sec">
            <Ico.barras />
            <span>{sinEmojis(t("home_totales"))}</span>
            <Ico.chevron className="pz-ico fl" />
          </Link>

          <button type="button" className="pz-ini-sec" onClick={props.onImportar} data-importar-boton="">
            <Ico.bajar />
            <span>{sinEmojis(t("home_importar"))}</span>
            <Ico.chevron className="pz-ico fl" />
          </button>

          <p className="pz-ini-offline">
            <LogoPulso className="pz-ini-logo" aro />
            <span>{t("home_offline")}</span>
          </p>
        </div>

        {/* ── Columna derecha: partidos guardados ── */}
        <div className="pz-ini-der">
          <h2 className="pz-ini-h2">{sinEmojis(t("home_guardados"))}</h2>
          {!cargado ? (
            <p className="pz-ini-vacio">{t("cargando")}</p>
          ) : partidos.length === 0 ? (
            <p className="pz-ini-vacio">{t("home_sin_partidos")}</p>
          ) : (
            <div className="pz-ini-lista">
              {partidos.map((p) => {
                const enCurso = p.estado !== "finalizado";
                const video = (p.modo ?? "directo") === "video";
                return (
                  <div key={p.id} className={`pz-capa pz-ini-p ${enCurso ? "curso" : ""}`}>
                    <div className="pz-ini-p-info">
                      <div className="pz-ini-p-chips">
                        <span className="id pz-num">{p.config!.partido_id}</span>
                        {video ? (
                          <span className="pz-chip"><Ico.video className="pz-ico mini" />{sinEmojis(t("home_modo_video"))}</span>
                        ) : (
                          <span className="pz-chip vivo"><span className="punto" />{sinEmojis(t("home_modo_directo"))}</span>
                        )}
                        <span className={`pz-chip ${enCurso ? "curso" : ""}`}>
                          {enCurso ? t("home_estado_curso") : t("home_estado_fin")}
                        </span>
                        {CLIENTE.partidoEjemplo && p.id === ID_PARTIDO_EJEMPLO && (
                          <span className="pz-chip ejemplo">{t("home_ejemplo")}</span>
                        )}
                        {p.importado && (
                          <span className="pz-chip importado" data-importado="">
                            <Ico.bajar className="pz-ico mini" />
                            {p.importado.copia ? t("home_importado_copia") : t("home_importado")}
                          </span>
                        )}
                      </div>
                      <div className="pz-ini-marc pz-num">
                        <span className="nos">{CLIENTE.nombreCorto}</span>
                        <span className="g nos">{p.marcador.inter}</span>
                        <span className="sep">–</span>
                        <span className="g riv">{p.marcador.rival}</span>
                        <span className="riv nom">{p.config!.rival}</span>
                      </div>
                      <div className="pz-ini-meta">
                        {p.config!.fecha} · {labelCompeticionCorta(p.config!.competicion)}
                      </div>
                    </div>
                    <div className="pz-ini-acc">
                      {enCurso && (
                        <button type="button" onClick={() => props.onContinuar(p.id)} className="pz-ib lleno">
                          <Ico.play className="pz-ico relleno" />{sinEmojis(t("home_continuar"))}
                        </button>
                      )}
                      {enCurso && (
                        <button type="button" onClick={() => props.onFinalizar(p)} className="pz-ib"
                          data-finalizar-partido="">
                          <Ico.bandera />{sinEmojis(t("home_finalizar"))}
                        </button>
                      )}
                      <button type="button" onClick={() => props.onStats(p.id)} className={`pz-ib ${enCurso ? "" : "nos"}`}>
                        <Ico.barras />{sinEmojis(t("home_ver_stats"))}
                      </button>
                      <button type="button" onClick={() => props.onRehacer(p)} className="pz-ib">
                        <Ico.video />{sinEmojis(t("home_rehacer"))}
                      </button>
                      <button type="button" onClick={() => props.onBorrar(p.id)} className="pz-ib icono"
                        title={t("home_borrar")} aria-label={t("home_borrar")}>
                        <Ico.papelera />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {props.ventana}
    </div>
  );
}
