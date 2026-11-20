"use client";

/**
 * TotalesNuevo.tsx — TOTALES de la temporada con el aspecto NUEVO (rediseño
 * PULSO, tanda 4 · 18/11/2026).
 *
 * SOLO dibuja. Los totales llegan ya sumados (lib/totales.ts → calcularTotales,
 * la MISMA cuenta que el clásico) y la copia de seguridad la siguen haciendo
 * los manejadores de app/totales/page.tsx: aquí solo se llaman. Mismos
 * apartados y en el mismo orden que el clásico.
 *
 * Estilos en app/tema-nuevo.css (clases pz-tot-*).
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { CLIENTE } from "@/lib/clientes";
import { formatMinutos, type Totales } from "@/lib/totales";
import { t, labelCompeticionCorta } from "@/lib/i18n";
import { Ico, sinEmojis } from "@/components/DirectoNuevo";
import { BotonSol } from "@/components/InicioNuevo";
import { estiloPP, icPP } from "@/components/ResumenNuevo";
import { Escudo } from "@/components/Escudo";

/** «*texto*» del catálogo → negrita (igual que en el clásico). */
function conNegritas(frase: string) {
  return frase.split("*").map((trozo, i) => (i % 2 ? <b key={i}>{trozo}</b> : trozo));
}

export function TotalesNuevo(props: {
  tot: Totales | null;
  sinCerrar: number;
  aviso: string;
  /** «Dar por terminados los que ya acabaron» + su informe (20/11/2026). */
  cerrar?: ReactNode;
  sol: boolean;
  onSol: () => void;
  onGuardar: () => void;
  onRestaurar: () => void;
  /** El <input type=file> de siempre (con su ref), escondido. */
  fichero: ReactNode;
}) {
  const { tot, sinCerrar } = props;
  return (
    <div className="pz pz-pp pz-tot" data-tema={props.sol ? "sol" : undefined} style={estiloPP(props.sol)}>
      <div className="pz-res-top">
        <Link href="/" className="pz-ib"><Ico.casa />{sinEmojis(t("inicio"))}</Link>
        <h1 className="pz-tot-h1"><Escudo className="pz-tot-escudo" />{sinEmojis(t("tot_titulo"))}</h1>
        <div className="der"><BotonSol sol={props.sol} onCambiar={props.onSol} /></div>
      </div>

      {!tot ? (
        <p className="pz-tot-vacio">{t("cargando")}</p>
      ) : (
        <>
          {sinCerrar > 0 && (
            <p className="pz-tot-aviso">
              <Ico.aviso className="pz-ico" />
              <span>{conNegritas(sinEmojis(sinCerrar > 1 ? t("tot_sin_cerrar_n", { n: sinCerrar }) : t("tot_sin_cerrar_1")))}</span>
            </p>
          )}
          {tot.directosFuera > 0 && (
            <p className="pz-tot-aviso">
              <span>{conNegritas(sinEmojis(tot.directosFuera > 1 ? t("tot_dup_directo_n", { n: tot.directosFuera }) : t("tot_dup_directo_1")))}</span>
            </p>
          )}
          {tot.videosFuera > 0 && (
            <p className="pz-tot-aviso">
              <span>{conNegritas(sinEmojis(tot.videosFuera > 1 ? t("tot_dup_video_n", { n: tot.videosFuera }) : t("tot_dup_video_1")))}</span>
            </p>
          )}
          {props.cerrar}

          {tot.equipo.partidos === 0 ? (
            <p className="pz-tot-vacio">{t("tot_vacio")}</p>
          ) : (
            <>
              <section className="pz-tot-kpis">
                {[
                  [t("tot_partidos"), String(tot.equipo.partidos)],
                  [t("tot_gep"), `${tot.equipo.ganados} · ${tot.equipo.empatados} · ${tot.equipo.perdidos}`],
                  [t("tot_goles"), t("tot_goles_val", { f: tot.equipo.golesFavor, c: tot.equipo.golesContra })],
                  [t("tot_disparos"), t("tot_disparos_val", { d: tot.equipo.disparos, p: tot.equipo.aPuerta })],
                ].map(([k, v]) => (
                  <div key={k} className="pz-capa pz-tot-k">
                    <div className="pz-etq">{k}</div>
                    <div className="v pz-num">{v}</div>
                  </div>
                ))}
              </section>

              <section className="pz-capa pz-tot-sec">
                <h2 className="pz-res-h3"><Ico.persona className="pz-ico" />{t("tot_por_jugador")}</h2>
                <div className="pz-tot-scroll">
                  <table className="pz-tot-tabla">
                    <thead>
                      <tr>
                        <th>{t("tot_th_num")}</th><th className="izq">{t("tot_th_jugador")}</th>
                        <th>{t("tot_th_pj")}</th><th>{t("tot_th_min")}</th>
                        <th title={t("tot_goles")}>{icPP("⚽")}</th><th>{t("tot_th_asist")}</th>
                        <th>{t("tot_th_disp")}</th><th>{t("tot_th_robos")}</th>
                        <th>{t("tot_th_cortes")}</th><th>{t("tot_th_perd")}</th>
                        <th title={t("inf_amarillas")}>{icPP("🟨")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tot.jugadores.map((j) => (
                        <tr key={j.nombre}>
                          <td className="dorsal pz-num">{j.dorsal}</td>
                          <td className="izq nombre">{j.nombre}</td>
                          <td className="pz-num">{j.jugados}</td>
                          <td className="pz-num">{formatMinutos(j.segundos)}</td>
                          <td className="pz-num fuerte">{j.goles || ""}</td>
                          <td className="pz-num">{j.asistencias || ""}</td>
                          <td className="pz-num">{(j.aPuerta + j.fuera + j.palo + j.bloqueados) || ""}</td>
                          <td className="pz-num">{j.robos || ""}</td>
                          <td className="pz-num">{j.cortes || ""}</td>
                          <td className="pz-num">{j.perdidas || ""}</td>
                          <td className="pz-num">{j.amarillas || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="pz-tot-nota">{t("tot_nota_pj")}</p>
              </section>

              {tot.jugadores.some((j) => j.paradas + j.golesEncajados > 0) && (
                <section className="pz-capa pz-tot-sec">
                  <h2 className="pz-res-h3"><Ico.guante className="pz-ico" />{t("tot_porteros")}</h2>
                  <table className="pz-tot-tabla">
                    <thead>
                      <tr>
                        <th>{t("tot_th_num")}</th><th className="izq">{t("tot_th_portero")}</th>
                        <th>{t("tot_th_pj")}</th><th>{t("tot_th_min")}</th>
                        <th>{t("tot_th_paradas")}</th>
                        <th>{t("tot_th_encajados")}</th>
                        <th>{t("tot_th_pct")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tot.jugadores.filter((j) => j.paradas + j.golesEncajados > 0).map((j) => {
                        const tiros = j.paradas + j.golesEncajados;
                        return (
                          <tr key={j.nombre}>
                            <td className="dorsal pz-num">{j.dorsal}</td>
                            <td className="izq nombre">{j.nombre}</td>
                            <td className="pz-num">{j.jugados}</td>
                            <td className="pz-num">{formatMinutos(j.segundos)}</td>
                            <td className="pz-num">{j.paradas}</td>
                            <td className="pz-num">{j.golesEncajados}</td>
                            <td className="pz-num fuerte">
                              {tiros ? `${Math.round((j.paradas / tiros) * 100)}%` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}

              <section className="pz-capa pz-tot-sec">
                <h2 className="pz-res-h3"><Ico.calendario className="pz-ico" />{t("tot_por_partido")}</h2>
                <ul className="pz-tot-partidos">
                  {tot.partidos.map((p) => (
                    <li key={p.id}>
                      <span className={`res ${p.resultado}`}>{t(`tot_res_${p.resultado}`)}</span>
                      <span className="fecha pz-num">{p.fecha}</span>
                      <span className="marc">
                        {p.local ? `${CLIENTE.nombreCorto} ${p.golesFavor} - ${p.golesContra} ${p.rival}`
                                 : `${p.rival} ${p.golesContra} - ${p.golesFavor} ${CLIENTE.nombreCorto}`}
                      </span>
                      <span className="pz-chip">{labelCompeticionCorta(p.competicion)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <section className="pz-capa pz-tot-sec pz-tot-copia">
            <h2 className="pz-res-h3"><Ico.escudo className="pz-ico" />{t("tot_copia")}</h2>
            <p className="txt">{conNegritas(t("tot_copia_txt"))}</p>
            <div className="acc">
              <button type="button" onClick={props.onGuardar} className="pz-ib nos">
                <Ico.bajar />{sinEmojis(t("tot_guardar"))}
              </button>
              <button type="button" onClick={props.onRestaurar} className="pz-ib">
                <Ico.carpeta />{sinEmojis(t("tot_restaurar"))}
              </button>
              {props.fichero}
            </div>
            {props.aviso && <p className="pz-tot-msg">{props.aviso}</p>}
          </section>
        </>
      )}
    </div>
  );
}
