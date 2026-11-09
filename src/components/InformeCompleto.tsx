"use client";

/**
 * InformeCompleto — El informe de partido de PULSO, para imprimir o guardar en
 * PDF desde el iPad (9/11/2026).
 *
 * Es la misma hoja que sale cuando un partido sube a Alfred (`pdf_partido.py`
 * del club): mismo orden, mismas secciones y mismo aire, con la marca PULSO y
 * sin la carga física, porque cada club mide con una cosa distinta. Lo que no
 * tiene datos en ese partido no sale: un cero que en realidad es «nadie lo
 * contó» se lee como «no pasó».
 *
 * Solo lo enseñan los clientes con `informeCompleto: true` en `clientes.ts`. El
 * del Inter y el del filial siguen en `app/informe/page.tsx`, sin tocar.
 *
 * Los estilos van aquí dentro y con prefijo `ic-`, sin clases nuevas de
 * Tailwind, para no tocar el CSS del resto de clientes. Las cuentas están en
 * `lib/informeCompleto.ts`.
 */
import Link from "next/link";
import React, { useEffect } from "react";
import { usePartido } from "@/lib/store";
import { CLIENTE, ROSTER } from "@/lib/clientes";
import { idiomaActivo, labelCompeticion, t, useIdioma } from "@/lib/i18n";
import { MARCA_INFORME } from "@/lib/marca";
import {
  COLUMNAS_MATRIZ, construirInformeCompleto, minSeg,
  type Cronograma, type FilaPase, type InformeCompleto as Informe,
  type Matriz, type Reparto,
} from "@/lib/informeCompleto";
import type { ParteId } from "@/lib/db";

const COLOR = MARCA_INFORME.color;
const ROJO = MARCA_INFORME.colorRival;

const CSS = `
.ic { --ic: ${COLOR}; --ic-rojo: ${ROJO}; color: #111; background: #fff;
  font-family: Helvetica, Arial, sans-serif; font-size: 9pt; line-height: 1.25;
  width: 186mm; max-width: 100%; margin: 0 auto; padding: 16px 0; }
.ic * { box-sizing: border-box; }
.ic-pag + .ic-pag { break-before: page; page-break-before: always; }
.ic h2 { color: var(--ic); font-size: 12pt; font-weight: 700; margin: 10pt 0 4pt; }
.ic-pag > h2:first-child { margin-top: 0; }
.ic-sec { break-inside: avoid; page-break-inside: avoid; }
.ic-nota { color: #666; font-size: 7pt; text-align: center; margin: 3pt 0 0; }
.ic-txt { color: #666; font-size: 8pt; margin: 0 0 6pt; }
.ic-txt b { color: #333; }
.ic table { border-collapse: collapse; table-layout: fixed; margin: 0 auto; width: 100%; }
.ic th, .ic td { border: .3pt solid #d4d4d4; font-size: 8pt; padding: 2.2pt 2pt;
  text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
.ic thead th { background: var(--ic); color: #fff; font-weight: 700; border-color: var(--ic);
  overflow-wrap: normal; padding-left: 1pt; padding-right: 1pt; font-size: 7.5pt; }
.ic tbody tr:nth-child(even) td { background: #fafafa; }
.ic td.ic-izq { text-align: left; }
.ic td.ic-neg { font-weight: 700; }
.ic small { display: block; color: #777; font-size: 6.5pt; line-height: 1.1; }
.ic-cab { display: flex; align-items: center; gap: 8pt; margin-bottom: 6pt; }
.ic-cab img { width: 20mm; height: auto; flex: none; }
.ic-info th { font-size: 8pt; padding: 3pt 2pt; }
.ic-info td { font-size: 10pt; font-weight: 700; color: var(--ic); background: #fafafa; padding: 5pt 3pt; }
.ic-marcador { text-align: center; font-size: 24pt; font-weight: 700; color: var(--ic); margin: 6pt 0 2pt; }
.ic-marcador small { display: inline; font-size: 9pt; color: #666; font-weight: 400; }
.ic-pid { text-align: center; font-size: 8pt; color: #666; margin: 0 0 10pt; }
.ic-kpi { display: grid; grid-template-columns: repeat(4, 1fr); border: .5pt solid #666;
  background: #fafafa; margin: 0 auto 14pt; }
.ic-kpi > div { border: .3pt solid #d4d4d4; text-align: center; padding: 3pt 2pt 4pt; }
.ic-kpi .l { font-size: 8pt; color: #666; }
.ic-kpi .v { font-size: 14pt; font-weight: 700; color: var(--ic); line-height: 1.2; }
.ic-kpi .v small { font-size: 8pt; font-weight: 400; }
.ic-kpi .ancha { grid-column: span 4; }
.ic-tit { font-size: 9pt; margin: 0 0 3pt; }
.ic-eq td:first-child { text-align: left; font-weight: 700; }
.ic-eq th, .ic-eq td { font-size: 9pt; padding: 3pt; }
.ic-leyenda { display: flex; flex-wrap: wrap; justify-content: center; gap: 3pt 10pt;
  color: #444; font-size: 7pt; margin-top: 4pt; }
.ic-leyenda i { display: inline-block; width: 9pt; height: 7pt; margin-right: 3pt; vertical-align: -0.5pt; }
.ic-leyenda i.c { border-radius: 50%; }
.ic-ind span { padding: 0 3pt; }
.ic svg { display: block; width: 100%; height: auto; }
.ic-mapa { margin: 0 auto 4pt; }
.ic-mapa p { font-weight: 700; font-size: 9pt; margin: 0 0 2pt; }
.ic-mx th, .ic-mx td { font-size: 6.5pt; padding: 1.8pt 0; overflow-wrap: normal; }
.ic-mx td.ic-izq { padding-left: 2pt; white-space: nowrap; }
.ic-mx tr.tot td { background: #fafafa; font-weight: 700; }
.ic-mx.contra thead th { background: var(--ic-rojo); border-color: var(--ic-rojo); }
.ic-pie { color: #666; font-size: 7.5pt; text-align: center; margin-top: 12pt; }
@media screen {
  .ic-pag { border-bottom: 1px dashed #bbb; padding-bottom: 18px; margin-bottom: 18px; }
}
@media print {
  .ic { width: auto; padding: 0; }
}
`;

// ──────────────────────────────────────────────────────────────────────────
// Formatos (dependen del idioma: la coma decimal, los ordinales)
// ──────────────────────────────────────────────────────────────────────────
function decimal(v: number, dec = 1): string {
  const s = Math.abs(v).toFixed(dec);
  const signo = v < 0 ? "-" : "";
  return signo + (idiomaActivo() === "en" ? s : s.replace(".", ","));
}

function conSigno(v: number, dec = 1): string {
  return (v >= 0 ? "+" : "") + decimal(v, dec);
}

function entSigno(v: number): string {
  return (v >= 0 ? "+" : "") + String(v);
}

function ordinal(i: number): string {
  if (idiomaActivo() !== "en") return `${i}ª`;
  const r10 = i % 10;
  const r100 = i % 100;
  const suf = r100 >= 11 && r100 <= 13 ? "th"
    : r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
  return `${i}${suf}`;
}

function nombreParte(parte: ParteId): string {
  return t(`ic_parte_${parte}`);
}

function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function competicion(codigo: string): string {
  return labelCompeticion(codigo, codigo).split(" (")[0];
}

/** `*esto*` en negrita: los titulares llevan la cifra resaltada. */
function conNegrita(s: string): React.ReactNode {
  return s.split("*").map((x, i) => (i % 2 ? <b key={i}>{x}</b> : <span key={i}>{x}</span>));
}

function Cifra(props: { r: Reparto }) {
  const { r } = props;
  return (
    <>
      {r.total}
      {r.partes && <small>({r.partes.join("/")})</small>}
    </>
  );
}

function vacio(v: number): number | string {
  return v || "";
}

function parGP(a?: number, b?: number): string {
  return a || b ? `${a ?? 0}/${b ?? 0}` : "";
}

// ──────────────────────────────────────────────────────────────────────────
// Colores del informe del club
// ──────────────────────────────────────────────────────────────────────────
/** Semáforo de minutos: verde → amarillo → rojo, con t de 0 a 1. */
function colorMinutos(t01: number): string {
  const f = Math.max(0, Math.min(1, t01));
  const tramo = (a: number, b: number, u: number) => Math.round(a + (b - a) * u);
  if (f <= 0.5) {
    const u = f / 0.5;
    return `rgb(${tramo(0xc8, 0xff, u)},${tramo(0xe6, 0xf5, u)},${tramo(0xc9, 0x9d, u)})`;
  }
  const u = (f - 0.5) / 0.5;
  return `rgb(${tramo(0xff, 0xef, u)},${tramo(0xf5, 0x9a, u)},${tramo(0x9d, 0x9a, u)})`;
}

function colorRotacion(seg: number, portero: boolean): string | undefined {
  if (portero || seg <= 0) return undefined;
  const m = seg / 60;
  if (m < 1) return "#BBDEFB";
  if (m < 2) return "#C8E6C9";
  if (m < 3) return "#FFF59D";
  return "#EF9A9A";
}

function colorValoracion(v: number): string | undefined {
  if (v < 0) return v <= -2 ? "#FFCDD2" : "#FFE0E0";
  if (v < 3) return undefined;
  if (v < 6) return "#DCEDC8";
  if (v < 10) return "#A5D6A7";
  return "#66BB6A";
}

function colorZona(v: number, max: number): string {
  if (max <= 0 || v <= 0) return "#f5f5f5";
  const f = Math.max(0, Math.min(1, v / max));
  if (f < 0.5) return `rgb(255,${Math.round(220 - 50 * f * 2)},180)`;
  const u = (f - 0.5) * 2;
  return `rgb(${Math.round(255 - 100 * u)},${Math.round(170 - 130 * u)},${Math.round(80 - 30 * u)})`;
}

// ──────────────────────────────────────────────────────────────────────────
// Secciones
// ──────────────────────────────────────────────────────────────────────────
function Anchos(props: { mm: number[] }) {
  const total = props.mm.reduce((a, b) => a + b, 0);
  return (
    <colgroup>
      {props.mm.map((m, i) => <col key={i} style={{ width: `${(m / total) * 100}%` }} />)}
    </colgroup>
  );
}

function Cabecera(props: { inf: Informe }) {
  const c = props.inf.cabecera;
  const izq = c.local ? c.nombreLargo : c.rival;
  const der = c.local ? c.rival : c.nombreLargo;
  const golIzq = c.local ? c.gf : c.gc;
  const golDer = c.local ? c.gc : c.gf;
  const colorIzq = c.local ? "#2E7D32" : "#B71C1C";
  const colorDer = c.local ? "#B71C1C" : "#2E7D32";
  return (
    <>
      <div className="ic-cab">
        {MARCA_INFORME.escudo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={MARCA_INFORME.escudo} alt={MARCA_INFORME.nombre} />
        )}
        <table className="ic-info">
          <Anchos mm={[56, 32, 34, 20, 26]} />
          <thead>
            <tr>
              <th>{t("ic_cab_partido")}</th><th>{t("ic_cab_categoria")}</th>
              <th>{t("ic_cab_lugar")}</th><th>{t("ic_cab_hora")}</th>
              <th>{t("ic_cab_fecha")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{izq.toUpperCase()} <i>vs</i> {der.toUpperCase()}</td>
              <td>{competicion(c.competicion) || "—"}</td>
              <td>{c.lugar || "—"}</td>
              <td>{c.hora || "—"}</td>
              <td>{fechaLarga(c.fecha)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ic-marcador">
        {izq} &nbsp;<span style={{ color: colorIzq }}>{golIzq}</span>
        {" – "}
        <span style={{ color: colorDer }}>{golDer}</span>&nbsp; {der}{" "}
        <small>({c.local ? t("ic_local") : t("ic_visitante")})</small>
      </p>
      <p className="ic-pid">{t("ic_partido_id", { id: c.partidoId })}</p>
    </>
  );
}

function Kpis(props: { inf: Informe }) {
  const k = props.inf.kpis;
  const cajas: [string, Reparto][] = [
    [t("ic_kpi_dt"), k.dt], [t("ic_kpi_dp"), k.dp],
    [t("ic_kpi_dt_rival"), k.dtRival], [t("ic_kpi_dp_rival"), k.dpRival],
    [t("ic_kpi_pf"), k.pf], [t("ic_kpi_pnf"), k.pnf],
    [t("ic_kpi_robos"), k.robos], [t("ic_kpi_cortes"), k.cortes],
  ];
  const inc = k.incorporaciones;
  const reparto = inc
    ? (inc.partes
      ? inc.partes.map((p) => t("ic_inc_parte", { parte: nombreParte(p.parte), con: p.con, sin: p.sin })).join(" · ")
      : t("ic_inc_total", { con: inc.conDisparo, sin: inc.sinDisparo }))
    : "";
  return (
    <div className="ic-kpi">
      {cajas.map(([l, r]) => (
        <div key={l}>
          <div className="l">{l}</div>
          <div className="v"><Cifra r={r} /></div>
        </div>
      ))}
      {inc && (
        <div className="ancha">
          <div className="l">{t("ic_kpi_inc")}</div>
          <div className="v">{inc.total}<small>{reparto}</small></div>
        </div>
      )}
    </div>
  );
}

function Equipo(props: { inf: Informe }) {
  const { inf } = props;
  const e = inf.equipo;
  const v = e.video;
  const guion = "—";
  const fila = (etq: string, a: React.ReactNode, b: React.ReactNode, sub = false) => (
    <tr key={etq}>
      <td style={sub ? { paddingLeft: "12pt" } : undefined}>{sub ? `· ${etq}` : etq}</td>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_equipo")}</h2>
      <table className="ic-eq" style={{ width: "140mm" }}>
        <Anchos mm={[70, 35, 35]} />
        <thead>
          <tr><th /><th>{inf.cabecera.nombreCorto}</th><th>{inf.cabecera.rival.slice(0, 18)}</th></tr>
        </thead>
        <tbody>
          {fila(t("ic_eq_goles"), <Cifra r={e.goles} />, <Cifra r={e.golesRival} />)}
          {fila(t("ic_eq_dt"), <Cifra r={e.dt} />, <Cifra r={e.dtRival} />)}
          {fila(t("ic_eq_dp"), <Cifra r={e.dp} />, <Cifra r={e.dpRival} />, true)}
          {fila(t("ic_eq_palo"), <Cifra r={e.dpalo} />, <Cifra r={e.dpaloRival} />, true)}
          {fila(t("ic_eq_bloq"), <Cifra r={e.db} />, <Cifra r={e.dbRival} />, true)}
          {fila(t("ic_eq_fuera"), <Cifra r={e.df} />, <Cifra r={e.dfRival} />, true)}
          {fila(t("ic_eq_perdidas"), <Cifra r={e.perdidas} />, guion)}
          {fila(t("ic_eq_robos"), <Cifra r={e.robos} />, guion)}
          {fila(t("ic_eq_cortes"), <Cifra r={e.cortes} />, guion)}
          {fila(t("ic_eq_balance"), entSigno(e.balance), guion)}
          {inf.hayDivididos && fila(t("ic_eq_bd"), `${e.bdg}/${e.bdp}`, guion)}
          {inf.hayVideo && (
            <>
              {fila(t("ic_eq_1x1a"), `${v.unoAtq_g}/${v.unoAtq_p}`, guion)}
              {fila(t("ic_eq_1x1d"), `${v.unoDef_g}/${v.unoDef_p}`, guion)}
              {fila(t("ic_eq_dcp"), `${v.duelC_g}/${v.duelC_p}`, guion)}
              {fila(t("ic_eq_dpc"), `${v.duelP_g}/${v.duelP_p}`, guion)}
              {fila(t("ic_eq_conex"), v.conexPivot, guion)}
              {fila(t("ic_eq_antic"), `${v.antB}/${v.antM}`, guion)}
              {v.paseGol > 0 && fila(t("ic_eq_pasegol"), v.paseGol, guion)}
            </>
          )}
        </tbody>
      </table>
      <p className="ic-nota">
        {t("ic_eq_nota", { equipo: inf.cabecera.nombreCorto })}
        {inf.hayProrroga ? ` ${t("ic_eq_nota_pr")}` : ""}
        {inf.hayVideo ? ` ${t("ic_eq_nota_video")}` : ""}
      </p>
    </section>
  );
}

function Minutos(props: { inf: Informe }) {
  const { inf } = props;
  const mx = inf.maxMinutos;
  const conPR = inf.hayProrroga && mx.pr > 0;
  const celda = (seg: number, max: number, portero: boolean) => (
    <td style={!portero && max > 0 && seg > 0
      ? { background: colorMinutos(seg / max) } : undefined}>{minSeg(seg)}</td>
  );
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_minutos")}</h2>
      <table style={{ width: "127mm" }}>
        <Anchos mm={conPR ? [12, 40, 25, 25, 25, 25] : [12, 40, 25, 25, 25]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_jugador")}</th>
            <th>{t("ic_1a_parte")}</th><th>{t("ic_2a_parte")}</th>
            {conPR && <th>{t("ic_prorroga")}</th>}
            <th>{t("ic_total")}</th>
          </tr>
        </thead>
        <tbody>
          {inf.jugadores.map((j) => (
            <tr key={j.nombre}>
              <td>{j.dorsal}</td>
              <td className="ic-izq">{j.nombre}</td>
              {celda(j.seg1, mx.m1, j.portero)}
              {celda(j.seg2, mx.m2, j.portero)}
              {conPR && celda(j.segPR, mx.pr, j.portero)}
              {celda(j.segTotal, mx.total, j.portero)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ic-nota">
        {t("ic_semaforo")}{" "}
        <span style={{ background: "#C8E6C9" }}>&nbsp;{t("ic_sem_pocos")}&nbsp;</span>{" "}
        <span style={{ background: "#FFF59D" }}>&nbsp;{t("ic_sem_medios")}&nbsp;</span>{" "}
        <span style={{ background: "#EF9A9A" }}>&nbsp;{t("ic_sem_muchos")}&nbsp;</span>.{" "}
        {t("ic_sem_porteros")}
      </p>
    </section>
  );
}

function Individuales(props: { inf: Informe }) {
  const { inf } = props;
  const bd = inf.hayDivididos;
  const n = bd ? 16 : 14;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_individuales")}</h2>
      <table>
        <Anchos mm={[9, 28, ...Array(n).fill(149 / n)]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_jugador")}</th>
            <th>{t("ic_c_pf")}</th><th>{t("ic_c_pnf")}</th>
            <th>{t("ic_c_rob")}</th><th>{t("ic_c_cor")}</th>
            {bd && <><th>{t("ic_c_bdg")}</th><th>{t("ic_c_bdp")}</th></>}
            <th>{t("ic_c_dp")}</th><th>{t("ic_c_dpalo")}</th>
            <th>{t("ic_c_db")}</th><th>{t("ic_c_df")}</th>
            <th>{t("ic_c_fc")}</th><th>{t("ic_c_fr")}</th>
            <th>{t("ic_c_ta")}</th><th>{t("ic_c_tr")}</th>
            <th>{t("ic_c_g")}</th><th>{t("ic_c_a")}</th>
          </tr>
        </thead>
        <tbody>
          {inf.jugadores.map((j) => (
            <tr key={j.nombre}>
              <td>{j.dorsal}</td>
              <td className="ic-izq">{j.nombre}</td>
              <td>{vacio(j.pf)}</td><td>{vacio(j.pnf)}</td>
              <td>{vacio(j.robos)}</td><td>{vacio(j.cortes)}</td>
              {bd && <><td>{vacio(j.bdg)}</td><td>{vacio(j.bdp)}</td></>}
              <td>{vacio(j.dp)}</td><td>{vacio(j.dpalo)}</td>
              <td>{vacio(j.db)}</td><td>{vacio(j.df)}</td>
              <td>{vacio(j.fc)}</td><td>{vacio(j.fr)}</td>
              <td>{vacio(j.ta)}</td><td>{vacio(j.tr)}</td>
              <td>{vacio(j.g)}</td><td>{vacio(j.a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ic-nota">{bd ? t("ic_guia_ind_bd") : t("ic_guia_ind")}</p>
    </section>
  );
}

function VideoCampo(props: { inf: Informe }) {
  const { inf } = props;
  const hayPase = inf.equipo.video.paseGol > 0;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_video")}</h2>
      <table>
        <Anchos mm={[9, 28, 15, 15, 17, 17, 16, 15, 14, 14, ...(hayPase ? [13] : [])]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_jugador")}</th>
            <th>{t("ic_v_1at")}</th><th>{t("ic_v_1df")}</th>
            <th>{t("ic_v_dcp")}</th><th>{t("ic_v_dpc")}</th>
            <th>{t("ic_v_cxp")}</th><th>{t("ic_v_ccx")}</th>
            <th>{t("ic_v_uco")}</th><th>{t("ic_v_ant")}</th>
            {hayPase && <th>{t("ic_v_pg")}</th>}
          </tr>
        </thead>
        <tbody>
          {inf.jugadores.map((j) => {
            const v = j.video;
            return (
              <tr key={j.nombre}>
                <td>{j.dorsal}</td>
                <td className="ic-izq">{j.nombre}</td>
                <td>{parGP(v.unoAtq_g, v.unoAtq_p)}</td>
                <td>{parGP(v.unoDef_g, v.unoDef_p)}</td>
                <td>{parGP(v.duelC_g, v.duelC_p)}</td>
                <td>{parGP(v.duelP_g, v.duelP_p)}</td>
                <td>{parGP(v.conexPivot, v.recibePivot)}</td>
                <td>{vacio(v.corteConex ?? 0)}</td>
                <td>{vacio(v.ultCob ?? 0)}</td>
                <td>{parGP(v.antB, v.antM)}</td>
                {hayPase && <td>{vacio(v.paseGol ?? 0)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ic-nota">{t("ic_guia_video")}{hayPase ? ` ${t("ic_guia_video_pg")}` : ""}</p>
    </section>
  );
}

function VideoPorteros(props: { inf: Informe }) {
  const porteros = props.inf.jugadores.filter((j) => j.portero);
  if (!porteros.length) return null;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_video_porteros")}</h2>
      <table style={{ width: "149mm" }}>
        <Anchos mm={[9, 28, 19, 19, 15, 14, 15, 14, 16]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_portero")}</th>
            <th>{t("ic_g_saques")}</th><th>{t("ic_g_pases")}</th>
            <th>{t("ic_g_cbr")}</th><th>{t("ic_g_cb")}</th>
            <th>{t("ic_g_cmr")}</th><th>{t("ic_g_cm")}</th>
            <th>{t("ic_g_achiques")}</th>
          </tr>
        </thead>
        <tbody>
          {porteros.map((j) => {
            const v = j.video;
            return (
              <tr key={j.nombre}>
                <td>{j.dorsal}</td>
                <td className="ic-izq">{j.nombre}</td>
                <td>{parGP(v.saqueB, v.saqueM)}</td>
                <td>{parGP(v.paseB, v.paseM)}</td>
                <td>{vacio(v.cobBR ?? 0)}</td><td>{vacio(v.cobBN ?? 0)}</td>
                <td>{vacio(v.cobMR ?? 0)}</td><td>{vacio(v.cobMN ?? 0)}</td>
                <td>{vacio(v.achique ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ic-nota">{t("ic_guia_porteros")}</p>
    </section>
  );
}

function PorteriaTabla(props: { inf: Informe }) {
  const filas = props.inf.porteria;
  if (!filas.length) return null;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_porteria")}</h2>
      <table style={{ width: "143mm" }}>
        <Anchos mm={[10, 30, 20, 20, 18, 15, 15, 15]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_portero")}</th>
            <th>{t("ic_p_paradas")}</th><th>{t("ic_p_goles")}</th>
            <th>{t("ic_p_bloqueos")}</th><th>{t("ic_p_postes")}</th>
            <th>{t("ic_p_disparos")}</th><th>{t("ic_p_pct")}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <td>{f.dorsal}</td>
              <td className="ic-izq">{f.nombre}</td>
              <td>{vacio(f.paradas)}</td><td>{vacio(f.golesEncajados)}</td>
              <td>{vacio(f.bloqueos)}</td><td>{vacio(f.postes)}</td>
              <td>{vacio(f.disparos)}</td>
              <td>{f.pct ? `${decimal(f.pct)}%` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Valoracion(props: { inf: Informe }) {
  const { inf } = props;
  const conVideo = inf.hayValoracionVideo;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_valoracion")}</h2>
      <p className="ic-txt">{conNegrita(t("ic_val_txt"))}</p>
      <p className="ic-txt">{conNegrita(conVideo ? t("ic_val_video") : t("ic_val_directo"))}</p>
      <table style={{ width: "133mm" }}>
        <Anchos mm={[9, 36, 15, 24, 12, ...(conVideo ? [15] : []), 22, 19]} />
        <thead>
          <tr>
            <th>{t("ic_num")}</th><th>{t("ic_jugador")}</th><th>{t("ic_min")}</th>
            <th>{t("ic_v_gfgc")}</th><th>±</th>
            {conVideo && <th>{t("ic_v_devideo")}</th>}
            <th>{t("ic_v_val")}</th><th>{t("ic_v_val40")}</th>
          </tr>
        </thead>
        <tbody>
          {inf.valoracion.map((v) => (
            <tr key={v.nombre}>
              <td>{v.dorsal}</td>
              <td className="ic-izq">{v.nombre}{v.portero ? ` (${t("ic_p_letra")})` : ""}</td>
              {v.jugo ? (
                <>
                  <td>{minSeg(v.segTotal)}</td>
                  <td>{v.gf}/{v.gc}</td>
                  <td>{entSigno(v.masMenos)}</td>
                  {conVideo && <td>{v.video ? conSigno(v.video) : "—"}</td>}
                  <td className="ic-neg" style={{ background: colorValoracion(v.val) }}>{conSigno(v.val)}</td>
                  <td style={{ color: "#555" }}>{conSigno(v.val40)}</td>
                </>
              ) : (
                <>
                  <td>—</td><td /><td />
                  {conVideo && <td />}
                  <td className="ic-neg">{t("ic_no_jugo")}</td><td />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** En castellano, la jugada tal como se apuntó; en otro idioma, su nombre. */
function nombreAccion(accion: string, columna: string): string {
  if (idiomaActivo() === "es") return accion;
  const c = COLUMNAS_MATRIZ.find((x) => x.canon === columna);
  return c ? t(`ic_mxl_${c.clave}`) : accion;
}

function GolesTabla(props: { inf: Informe }) {
  const { inf } = props;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_goles")}</h2>
      <table>
        <Anchos mm={[13, 16, 15, 42, 20, 20, 17, 40]} />
        <thead>
          <tr>
            <th>{t("ic_min")}</th><th>{t("ic_g_marcador")}</th><th>{t("ic_g_equipo")}</th>
            <th>{t("ic_g_accion")}</th><th>{t("ic_g_goleador")}</th>
            <th>{t("ic_g_asistente")}</th><th>{t("ic_portero")}</th><th>{t("ic_cuarteto")}</th>
          </tr>
        </thead>
        <tbody>
          {inf.goles.map((g, i) => {
            const bg = g.nuestro ? "#EDF7EE" : "#FDECEC";
            const celda = { background: bg };
            const cuarteto = g.nuestro && g.goleador && !g.cuarteto.includes(g.goleador)
              && g.goleador !== g.portero
              ? [...g.cuarteto, g.goleador] : g.cuarteto;
            return (
              <tr key={i}>
                <td style={celda}>{g.minuto}</td>
                <td style={celda}>{g.marcador}</td>
                <td style={celda}>{g.nuestro ? inf.cabecera.nombreCorto : t("ic_rival")}</td>
                <td style={celda}>{nombreAccion(g.accion, g.columna)}</td>
                <td style={celda}>{g.goleador || (g.nuestro && g.enPropia ? t("ic_en_propia") : "")}</td>
                <td style={celda}>{g.asistente}</td>
                <td style={celda}>{g.portero}</td>
                <td style={celda}>{cuarteto.join(" · ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function GolesCinco(props: { inf: Informe }) {
  const { inf } = props;
  const tr = inf.golesPorTramo;
  const W = 1000, H = 440, X0 = 54, X1 = 985, Y0 = 44, Y1 = 390;
  const paso = (X1 - X0) / tr.length;
  const max = Math.max(1, ...tr.map((x) => Math.max(x.nuestros, x.rival)));
  const escala = (Y1 - Y0 - 16) / max;
  const ancho = paso * 0.4;
  const bloques = inf.hayProrroga
    ? [{ d: 0, h: 4, c: "#F1F8F2", e: t("ic_1a_parte"), col: "#558B2F" },
       { d: 4, h: 8, c: "#EEF4FB", e: t("ic_2a_parte"), col: "#1565C0" },
       { d: 8, h: tr.length, c: "#F6EFFA", e: t("ic_prorroga"), col: "#6A1B9A" }]
    : [{ d: 0, h: 4, c: "#F1F8F2", e: t("ic_1a_parte"), col: "#558B2F" },
       { d: 4, h: tr.length, c: "#EEF4FB", e: t("ic_2a_parte"), col: "#1565C0" }];
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <section className="ic-sec" style={{ marginTop: "24pt" }}>
      <h2 style={{ textAlign: "center" }}>{t("ic_sec_5min")}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("ic_sec_5min")}>
        {bloques.map((b) => (
          <g key={b.e}>
            <rect x={X0 + b.d * paso} y={Y0 - 20} width={(b.h - b.d) * paso} height={Y1 - Y0 + 20} fill={b.c} />
            <text x={X0 + ((b.d + b.h) / 2) * paso} y={Y0 - 4} textAnchor="middle"
                  fontSize="15" fontWeight="700" fill={b.col}>{b.e}</text>
          </g>
        ))}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={Y1 - v * escala} y2={Y1 - v * escala}
                  stroke="#ccc" strokeWidth="1" strokeDasharray="2 4" />
            <text x={X0 - 10} y={Y1 - v * escala + 5} textAnchor="end" fontSize="15" fill="#333">{v}</text>
          </g>
        ))}
        {bloques.slice(1).map((b) => (
          <line key={b.e} x1={X0 + b.d * paso} x2={X0 + b.d * paso} y1={Y0 - 20} y2={Y1}
                stroke="#90A4AE" strokeWidth="2" strokeDasharray="7 5" />
        ))}
        {tr.map((x, i) => {
          const cx = X0 + (i + 0.5) * paso;
          const barra = (v: number, xb: number, c: string) => v > 0 && (
            <g>
              <rect x={xb} y={Y1 - v * escala} width={ancho} height={v * escala} fill={c} />
              <text x={xb + ancho / 2} y={Y1 - v * escala - 5} textAnchor="middle"
                    fontSize="16" fontWeight="700" fill="#333">{v}</text>
            </g>
          );
          return (
            <g key={x.desde}>
              {barra(x.nuestros, cx - ancho, "#2E7D32")}
              {barra(x.rival, cx, "#C62828")}
              <text x={cx} y={Y1 + 22} textAnchor="middle" fontSize="15" fill="#333">
                {x.desde}–{x.desde + 5}&apos;
              </text>
            </g>
          );
        })}
        <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="#333" strokeWidth="1.2" />
      </svg>
      <div className="ic-leyenda">
        <span><i style={{ background: "#2E7D32" }} />{inf.cabecera.nombreCorto} ({t("ic_a_favor")})</span>
        <span><i style={{ background: "#C62828" }} />{t("ic_rival")} ({t("ic_en_contra")})</span>
      </div>
    </section>
  );
}

function FilaMx(props: { matriz: Matriz; contra?: boolean }) {
  const { matriz, contra } = props;
  const nCol = COLUMNAS_MATRIZ.length;
  return (
    <table className={`ic-mx${contra ? " contra" : ""}`}>
      <Anchos mm={[6, 25, ...Array(nCol).fill(147 / nCol), 8]} />
      <thead>
        <tr>
          <th>{t("ic_num")}</th>
          <th>{contra ? t("ic_jugador") : t("ic_g_goleador")}</th>
          {COLUMNAS_MATRIZ.map((c) => <th key={c.clave}>{t(`ic_mx_${c.clave}`)}</th>)}
          <th>{t("ic_tot")}</th>
        </tr>
      </thead>
      <tbody>
        {matriz.filas.map((f) => (
          <tr key={f.nombre}>
            <td>{f.dorsal}</td>
            <td className="ic-izq">{f.nombre}</td>
            {f.celdas.map((v, i) => <td key={i}>{vacio(v)}</td>)}
            <td>{vacio(f.total)}</td>
          </tr>
        ))}
        <tr className="tot">
          <td />
          <td className="ic-izq">{t("ic_total_may")}</td>
          {matriz.totales.map((v, i) => <td key={i}>{vacio(v)}</td>)}
          <td>{vacio(matriz.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function MatrizJugadas(props: { inf: Informe }) {
  const { inf } = props;
  return (
    <>
      <h2>{t("ic_sec_matriz")}</h2>
      {inf.matrizFavor.total > 0 ? (
        <section style={{ marginBottom: "10pt" }}>
          <p className="ic-tit"><b>{t("ic_a_favor_cap")}</b></p>
          <FilaMx matriz={inf.matrizFavor} />
        </section>
      ) : <p className="ic-txt"><i>{t("ic_sin_goles_favor")}</i></p>}
      {inf.matrizContra.total > 0 && (
        <section>
          <p className="ic-tit"><b>{t("ic_en_contra_cap")}</b></p>
          <p className="ic-nota" style={{ marginBottom: "3pt" }}>{t("ic_mx_nota")}</p>
          <FilaMx matriz={inf.matrizContra} contra />
        </section>
      )}
      <p className="ic-nota" style={{ marginTop: "6pt", fontSize: "6pt" }}>
        {COLUMNAS_MATRIZ.map((c, i) => (
          <span key={c.clave}>
            {i > 0 ? " · " : ""}<b>{t(`ic_mx_${c.clave}`)}</b>={t(`ic_mxl_${c.clave}`)}
          </span>
        ))}
      </p>
    </>
  );
}

// ── Mapas: la geometría del informe del club (1 m = 25; atacamos a la izquierda)
function CampoZonas(props: { zonas: Record<string, number>; titulo: string }) {
  const { zonas } = props;
  const max = Math.max(1, ...Object.values(zonas));
  const col = (z: string) => colorZona(zonas[z] ?? 0, max);
  const BORDE = "#1B5E20";
  const num = (z: string, x: number, y: number) => (
    <text key={z} x={x} y={y + 11} textAnchor="middle" fontSize="32" fontWeight="700" fill="#000">
      {zonas[z] ?? 0}
    </text>
  );
  return (
    <div className="ic-mapa" style={{ width: "128mm" }}>
      <p>{props.titulo}</p>
      <svg viewBox="-15 -10 1030 520" role="img" aria-label={props.titulo}>
        <rect x="-15" y="-10" width="1030" height="520" fill="#A5D6A7" />
        <rect x="500" y="0" width="500" height="500" fill={col("A11")} />
        <rect x="0" y="0" width="250" height="62.5" fill={col("A6")} />
        <rect x="0" y="437.5" width="250" height="62.5" fill={col("A3")} />
        <rect x="250" y="0" width="250" height="62.5" fill={col("A10")} />
        <rect x="250" y="437.5" width="250" height="62.5" fill={col("A7")} />
        <rect x="250" y="62.5" width="250" height="187.5" fill={col("A9")} />
        <rect x="250" y="250" width="250" height="187.5" fill={col("A8")} />
        <path d="M0 62.5 L250 62.5 L250 250 L150 250 L150 212.5 A150 150 0 0 0 0 62.5 Z" fill={col("A5")} />
        <path d="M0 437.5 L250 437.5 L250 250 L150 250 L150 287.5 A150 150 0 0 1 0 437.5 Z" fill={col("A4")} />
        <path d="M0 62.5 A150 150 0 0 1 150 212.5 L150 250 L0 250 Z" fill={col("A2")} />
        <path d="M0 250 L150 250 L150 287.5 A150 150 0 0 1 0 437.5 Z" fill={col("A1")} />
        <g stroke={BORDE} strokeWidth="1.5" strokeDasharray="6 5" fill="none">
          <line x1="250" y1="0" x2="250" y2="500" />
          <line x1="0" y1="62.5" x2="500" y2="62.5" />
          <line x1="0" y1="437.5" x2="500" y2="437.5" />
          <line x1="0" y1="250" x2="500" y2="250" />
        </g>
        <g stroke={BORDE} strokeWidth="4" fill="none">
          <rect x="0" y="0" width="1000" height="500" />
          <line x1="500" y1="0" x2="500" y2="500" />
          <circle cx="500" cy="250" r="75" />
          <path d="M0 62.5 A150 150 0 0 1 150 212.5 L150 287.5 A150 150 0 0 1 0 437.5" />
        </g>
        <circle cx="500" cy="250" r="5" fill={BORDE} />
        <circle cx="150" cy="250" r="5" fill={BORDE} />
        <circle cx="250" cy="250" r="5" fill={BORDE} />
        <rect x="-5" y="207.5" width="10" height="10" fill="#B71C1C" />
        <rect x="-5" y="282.5" width="10" height="10" fill="#B71C1C" />
        {num("A11", 750, 250)}{num("A6", 125, 31)}{num("A3", 125, 469)}
        {num("A10", 375, 31)}{num("A7", 375, 469)}{num("A9", 375, 156)}
        {num("A8", 375, 343)}{num("A5", 200, 156)}{num("A4", 200, 343)}
        {num("A2", 60, 175)}{num("A1", 60, 325)}
      </svg>
    </div>
  );
}

function PorteriaZonas(props: { zonas: Record<string, number>; titulo: string }) {
  const { zonas } = props;
  const max = Math.max(1, ...Object.values(zonas));
  const X = 30, Y = 18, PW = 300, PH = 200, POSTE = 14;
  const cw = PW / 3, ch = PH / 3;
  const franjas: React.ReactNode[] = [];
  for (let i = 0; i < 6; i += 1) {
    const c = i % 2 === 0 ? "#B71C1C" : "#FFFFFF";
    const y = Y + (i * PH) / 6;
    franjas.push(
      <rect key={`l${i}`} x={X - POSTE} y={y} width={POSTE} height={PH / 6} fill={c} stroke="#7F1010" strokeWidth=".5" />,
      <rect key={`r${i}`} x={X + PW} y={y} width={POSTE} height={PH / 6} fill={c} stroke="#7F1010" strokeWidth=".5" />,
    );
  }
  for (let i = 0; i < 8; i += 1) {
    franjas.push(
      <rect key={`t${i}`} x={X + (i * PW) / 8} y={Y - POSTE} width={PW / 8} height={POSTE}
            fill={i % 2 === 0 ? "#B71C1C" : "#FFFFFF"} stroke="#7F1010" strokeWidth=".5" />,
    );
  }
  return (
    <div className="ic-mapa" style={{ width: "62mm" }}>
      <p>{props.titulo}</p>
      <svg viewBox="0 0 360 232" role="img" aria-label={props.titulo}>
        {Array.from({ length: 9 }, (_, i) => {
          const x = X + (i % 3) * cw;
          const y = Y + Math.floor(i / 3) * ch;
          const v = zonas[`P${i + 1}`] ?? 0;
          return (
            <g key={i}>
              <rect x={x} y={y} width={cw} height={ch} fill={colorZona(v, max)}
                    stroke="#888" strokeWidth=".8" strokeDasharray="4 3" />
              <text x={x + cw / 2} y={y + ch / 2 + 11} textAnchor="middle"
                    fontSize="32" fontWeight="700" fill="#000">{v}</text>
            </g>
          );
        })}
        {franjas}
        <line x1={X - POSTE - 10} x2={X + PW + POSTE + 10} y1={Y + PH + 4} y2={Y + PH + 4}
              stroke="#1B5E20" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ── Pases: la pista del crono (1 m = 20) con NUESTRO ataque a la derecha
const FONDO_PISTA = "#F4F6F3";
const LINEAS_PISTA = "#A3ADA8";
const NEGRO_PASE = "#111111";
const VERDE_ASIST = "#16A34A";

function MapaPases(props: { flechas: FilaPase[] }) {
  const W = 800, H = 400;
  const orden = [...props.flechas].sort(
    (a, b) => Number(a.asistencia) - Number(b.asistencia));
  return (
    <svg viewBox="-12 -12 824 424" role="img" aria-label={t("ic_sec_pases")}>
      <defs>
        <marker id="ic-p-n" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="4"
                markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={NEGRO_PASE} /></marker>
        <marker id="ic-p-v" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="4"
                markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={VERDE_ASIST} /></marker>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="8" fill={FONDO_PISTA} />
      <g fill="none" stroke={LINEAS_PISTA} strokeWidth="2.5">
        <rect x="2" y="2" width={W - 4} height={H - 4} rx="6" strokeWidth="3" />
        <line x1="400" y1="0" x2="400" y2={H} strokeWidth="3" />
        <circle cx="400" cy="200" r="60" strokeWidth="2" />
        <path d="M 800 50 A 120 120 0 0 0 680 170 L 680 230 A 120 120 0 0 0 800 350" />
        <path d="M 0 50 A 120 120 0 0 1 120 170 L 120 230 A 120 120 0 0 1 0 350" />
        <line x1="600" y1="200" x2="680" y2="200" strokeDasharray="4 4" opacity=".55" />
        <line x1="200" y1="200" x2="120" y2="200" strokeDasharray="4 4" opacity=".55" />
        <line x1="600" y1="50" x2="600" y2="350" strokeDasharray="4 4" opacity=".4" />
        <line x1="200" y1="50" x2="200" y2="350" strokeDasharray="4 4" opacity=".4" />
      </g>
      <g fill={LINEAS_PISTA}>
        {[400, 680, 600, 120, 200].map((cx) => <circle key={cx} cx={cx} cy="200" r="3" />)}
        <rect x={W - 4} y="170" width="4" height="60" />
        <rect x="0" y="170" width="4" height="60" />
      </g>
      {orden.map((f, i) => {
        const fl = f.flecha!;
        const grosor = f.asistencia ? 4.2 : 3;
        const color = f.asistencia ? VERDE_ASIST : NEGRO_PASE;
        const x0 = fl.x0 * W, y0 = fl.y0 * H, x1 = fl.x1 * W, y1 = fl.y1 * H;
        const largo = Math.hypot(x1 - x0, y1 - y0);
        let recorte = 0.9 * 4 * grosor;
        if (largo < 1.2 * recorte) recorte = 0.5 * largo;
        const xf = largo > 0 ? x1 - ((x1 - x0) / largo) * recorte : x1;
        const yf = largo > 0 ? y1 - ((y1 - y0) / largo) * recorte : y1;
        return (
          <g key={i}>
            <line x1={x0} y1={y0} x2={xf} y2={yf} stroke={color} strokeWidth={grosor}
                  strokeLinecap="round" markerEnd={`url(#ic-p-${f.asistencia ? "v" : "n"})`} />
            <circle cx={x0} cy={y0} r={f.asistencia ? 5.5 : 4.5} fill={color} stroke="#fff" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}

function Pases(props: { inf: Informe }) {
  const p = props.inf.pases;
  if (!p) return null;
  const rec = [
    `*${p.pasesGol}* ${t(p.pasesGol === 1 ? "ic_rec_pase" : "ic_rec_pases")}`,
    `*${p.asistencias}* ${t(p.asistencias === 1 ? "ic_rec_asist" : "ic_rec_asists")}`,
  ];
  if (p.sinFlecha) {
    rec.push(`*${p.sinFlecha}* ${t(p.sinFlecha === 1 ? "ic_rec_sin" : "ic_rec_sins")}`);
  }
  return (
    <>
      <h2>{t("ic_sec_pases")}</h2>
      <div style={{ width: "170mm", margin: "0 auto" }}><MapaPases flechas={p.flechas} /></div>
      <p className="ic-nota" style={{ fontSize: "8pt" }}>{t("ic_pases_ley")}</p>
      <p style={{ margin: "6pt 0" }}>{conNegrita(rec.join(" · "))}</p>
      <table style={{ width: "156mm" }}>
        <Anchos mm={[26, 14, 16, 34, 34, 32]} />
        <thead>
          <tr>
            <th>{t("ic_pa_tipo")}</th><th>{t("ic_pa_parte")}</th><th>{t("ic_min")}</th>
            <th>{t("ic_pa_pasa")}</th><th>{t("ic_pa_recibe")}</th><th>{t("ic_pa_zonas")}</th>
          </tr>
        </thead>
        <tbody>
          {p.filas.map((f, i) => (
            <tr key={i}>
              <td className="ic-neg" style={{ color: f.asistencia ? VERDE_ASIST : NEGRO_PASE }}>
                {f.asistencia ? t("ic_pa_asistencia") : t("ic_pa_pasegol")}
              </td>
              <td>{nombreParte(f.parte)}</td>
              <td>{f.minuto}</td>
              <td>{f.jugador || "-"}</td>
              <td>{f.asistencia ? (f.receptor || "-") : "-"}</td>
              <td>
                {f.flecha
                  ? [f.zonaOrigen, f.zonaDestino].filter(Boolean).join(` ${t("ic_pa_a")} `) || "-"
                  : <i style={{ color: "#666" }}>{t("ic_pa_sin_flecha")}</i>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.sinFlecha > 0 && <p className="ic-nota">{t("ic_pases_nota")}</p>}
    </>
  );
}

function colorFalta(n: number): string {
  return n <= 4 ? "#F57C00" : n === 5 ? "#E65100" : "#C62828";
}

const COLOR_PARTE: Record<ParteId, { campo: string; portero: string }> = {
  "1T": { campo: "#A5D6A7", portero: "#FFE082" },
  "2T": { campo: "#90CAF9", portero: "#FFCC80" },
  PR1: { campo: "#CE93D8", portero: "#FFCC80" },
  PR2: { campo: "#CE93D8", portero: "#FFCC80" },
};

function CronogramaSvg(props: { c: Cronograma; corto: string }) {
  const { c } = props;
  const W = 1000, X0 = 138, X1 = 948, Y0 = 52, FILA = 27;
  const N = c.jugadores.length;
  const yLinea = Y0 + N * FILA;
  const yNos = yLinea + 22;
  const yRival = yNos + 34;
  const YFin = yRival + 30;
  const H = YFin + 40;
  const total = Math.max(1, c.total);
  const X = (s: number) => X0 + (s / total) * (X1 - X0);
  const yJug = new Map(c.jugadores.map((j, i) => [j.nombre.toUpperCase(), Y0 + i * FILA + FILA / 2]));
  const inicio = new Map(c.partes.map((p) => [p.parte, p.inicio]));
  const ticks: number[] = [];
  for (let m = 0; m * 60 <= total; m += 5) ticks.push(m);
  const badges: { x: number; y: number; nuestro: boolean }[] = [];
  for (const g of [...c.goles].sort((a, b) => a.x - b.x)) {
    const x = X(g.x);
    const ult = badges[badges.length - 1];
    const y = ult && x - ult.x < 44 ? (ult.y === 26 ? 4 : 26) : 26;
    badges.push({ x, y, nuestro: g.nuestro });
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("ic_sec_crono")}>
      {ticks.map((m) => (
        <g key={m}>
          <line x1={X(m * 60)} x2={X(m * 60)} y1={Y0 - 4} y2={YFin} stroke="#CFD8DC" strokeWidth="1" />
          <text x={X(m * 60)} y={YFin + 18} textAnchor="middle" fontSize="12" fill="#333">{m}</text>
        </g>
      ))}
      {c.partes.slice(1).map((p) => (
        <line key={p.parte} x1={X(p.inicio)} x2={X(p.inicio)} y1={Y0 - 4} y2={YFin}
              stroke="#37474F" strokeWidth="3" />
      ))}
      {c.jugadores.map((j, i) => {
        const y = Y0 + i * FILA;
        return (
          <g key={j.nombre}>
            <text x={X0 - 8} y={y + FILA / 2 + 5} textAnchor="end" fontSize="13" fill="#212121">
              #{j.dorsal} {j.nombre}
            </text>
            {j.tramos.map((tr, k) => {
              const base = inicio.get(tr.parte) ?? 0;
              const col = COLOR_PARTE[tr.parte];
              return (
                <rect key={k} x={X(base + tr.desde)} y={y + 4}
                      width={Math.max(1, X(base + tr.hasta) - X(base + tr.desde))}
                      height={FILA - 8} fill={j.portero ? col.portero : col.campo}
                      stroke="#fff" strokeWidth="1" />
              );
            })}
            <text x={X1 + 6} y={y + FILA / 2 + 5} fontSize="12" fill="#212121">{minSeg(j.segTotal)}</text>
          </g>
        );
      })}
      <line x1={X0} x2={X1} y1={yLinea} y2={yLinea} stroke="#B0BEC5" strokeWidth="1.5" />
      <text x={X0 - 8} y={yNos + 5} textAnchor="end" fontSize="12" fill="#212121">
        {t("ic_carril_nos", { corto: props.corto })}
      </text>
      <text x={X0 - 8} y={yRival + 5} textAnchor="end" fontSize="12" fill="#212121">
        {t("ic_carril_rival")}
      </text>
      {c.goles.map((g, i) => (
        <line key={i} x1={X(g.x)} x2={X(g.x)} y1={Y0 - 8} y2={yLinea}
              stroke={g.nuestro ? "#2E7D32" : "#C62828"} strokeWidth="2" strokeDasharray="6 4" opacity=".75" />
      ))}
      {badges.map((b, i) => (
        <g key={i}>
          <rect x={b.x - 20} y={b.y} width="40" height="18" rx="4" fill={b.nuestro ? "#2E7D32" : "#C62828"} />
          <text x={b.x} y={b.y + 13.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            {b.nuestro ? t("ic_crono_gol") : t("ic_crono_gc")}
          </text>
        </g>
      ))}
      {c.faltas.map((f, i) => {
        const y = f.nuestro ? yNos : yRival;
        const cBar = f.nuestro ? yJug.get(f.jugador) : undefined;
        return (
          <g key={i}>
            <circle cx={X(f.x)} cy={y} r="10" fill={colorFalta(f.num)} stroke="#fff" strokeWidth="1" />
            <text x={X(f.x)} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{f.num}</text>
            {cBar !== undefined && (
              <circle cx={X(f.x)} cy={cBar} r="4.5" fill={colorFalta(f.num)} stroke="#fff" strokeWidth=".8" />
            )}
          </g>
        );
      })}
      {c.tarjetas.map((f, i) => {
        const y = f.nuestro ? yNos : yRival;
        const col = f.roja ? "#D32F2F" : "#FBC02D";
        const cBar = f.nuestro ? yJug.get(f.jugador) : undefined;
        const etiqueta = f.jugador === "#CT" ? "CT" : f.jugador.slice(0, 9);
        return (
          <g key={i}>
            <rect x={X(f.x) - 9} y={y - 9} width="18" height="18" fill={col} stroke="#424242" strokeWidth="1" />
            {etiqueta && (
              <text x={X(f.x)} y={y + 21} textAnchor="middle" fontSize="9.5" fill="#212121">{etiqueta}</text>
            )}
            {cBar !== undefined && (
              <rect x={X(f.x) - 5} y={cBar - 5} width="10" height="10" fill={col} stroke="#424242" strokeWidth=".8" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Cronogramas(props: { inf: Informe }) {
  const { inf } = props;
  const conPR = inf.cronograma.partes.some((p) => p.parte === "PR1");
  const hayMarcas = inf.cronograma.faltas.length + inf.cronograma.tarjetas.length > 0;
  return (
    <>
      <h2>{t("ic_sec_crono")}</h2>
      <p className="ic-txt">{conNegrita(t("ic_crono_txt"))}</p>
      <CronogramaSvg c={inf.cronograma} corto={inf.cabecera.nombreCorto} />
      <div className="ic-leyenda">
        <span><i style={{ background: "#A5D6A7" }} />{t("ic_1a_parte")}</span>
        <span><i style={{ background: "#90CAF9" }} />{t("ic_2a_parte")}</span>
        {conPR && <span><i style={{ background: "#CE93D8" }} />{t("ic_prorroga")}</span>}
        <span><i style={{ background: "#FFE082" }} />{t("ic_1a_portero")}</span>
        <span><i style={{ background: "#FFCC80" }} />{t("ic_2a_portero")}</span>
        {hayMarcas && (
          <>
            <span><i className="c" style={{ background: "#F57C00" }} />{t("ic_ley_falta")}</span>
            <span><i style={{ background: "#FBC02D", border: "0.5pt solid #424242" }} />{t("ic_ley_amarilla")}</span>
            <span><i style={{ background: "#D32F2F", border: "0.5pt solid #424242" }} />{t("ic_ley_roja")}</span>
          </>
        )}
      </div>
    </>
  );
}

function Rotaciones(props: { inf: Informe }) {
  const { inf } = props;
  if (!inf.rotaciones.length) return null;
  return (
    <>
      <h2>{t("ic_sec_rotaciones")}</h2>
      <p className="ic-txt ic-ind">
        {t("ic_rot_color")}{" "}
        <span style={{ background: "#BBDEFB" }}>0-1&apos;</span>{" "}
        <span style={{ background: "#C8E6C9" }}>1-2&apos;</span>{" "}
        <span style={{ background: "#FFF59D" }}>2-3&apos;</span>{" "}
        <span style={{ background: "#EF9A9A" }}>&gt;3&apos;</span>
      </p>
      {inf.rotaciones.map((r) => {
        const anchoTurno = Math.min(16, 130 / r.maxTurnos);
        return (
          <section key={r.parte} className="ic-sec" style={{ marginBottom: "8pt" }}>
            <p className="ic-tit"><b>{t(`ic_rot_${r.parte}`)}</b></p>
            <table className={r.maxTurnos > 12 ? "ic-mx" : undefined}
                   style={{ width: `${9 + 28 + 17 + anchoTurno * r.maxTurnos}mm` }}>
              <Anchos mm={[9, 28, ...Array(r.maxTurnos).fill(anchoTurno), 17]} />
              <thead>
                <tr>
                  <th>{t("ic_num")}</th><th>{t("ic_jugador")}</th>
                  {Array.from({ length: r.maxTurnos }, (_, i) => <th key={i}>{ordinal(i + 1)}</th>)}
                  <th>{t("ic_total")}</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f) => (
                  <tr key={f.nombre}>
                    <td>{f.dorsal}</td>
                    <td className="ic-izq">{f.nombre}</td>
                    {Array.from({ length: r.maxTurnos }, (_, i) => (
                      <td key={i} style={colorRotacion(f.turnos[i] ?? 0, f.portero)
                        ? { background: colorRotacion(f.turnos[i] ?? 0, f.portero) } : undefined}>
                        {f.turnos[i] ? minSeg(f.turnos[i]) : ""}
                      </td>
                    ))}
                    <td className="ic-neg">{f.total ? minSeg(f.total) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

function Cuartetos(props: { inf: Informe }) {
  const c = props.inf.cuartetos;
  if (!c.filas.length) return null;
  const bd = c.hayDivididos;
  return (
    <>
      <h2>{t("ic_sec_cuartetos")}</h2>
      <p className="ic-txt">{conNegrita(t("ic_cua_txt"))}</p>
      <table>
        <Anchos mm={bd
          ? [82, 12, 12, 12, 12, 12, 14, 15, 14]
          : [94, 13, 13, 13, 13, 13, 15, 14]} />
        <thead>
          <tr>
            <th>{t("ic_cua_col")}</th><th>{t("ic_min")}</th><th>{t("ic_cua_per")}</th>
            <th>{t("ic_cua_rec")}</th><th>{t("ic_c_rob")}</th><th>{t("ic_c_cor")}</th>
            {bd && <th>{t("ic_cua_bd")}</th>}
            <th>{t("ic_cua_goles")}</th><th>{t("ic_cua_bal")}</th>
          </tr>
        </thead>
        <tbody>
          {c.filas.map((f) => (
            <tr key={f.jugadores.join("|")}>
              <td className="ic-izq">
                {f.jugadores.join(" · ")}
                {f.n >= 5 && <span style={{ color: "#666" }}> ({t("ic_quinteto")})</span>}
              </td>
              <td>{minSeg(f.segundos)}</td>
              <td>{vacio(f.perdidas)}</td><td>{vacio(f.recuperaciones)}</td>
              <td>{vacio(f.robos)}</td><td>{vacio(f.cortes)}</td>
              {bd && <td>{f.bdg || f.bdp ? `${f.bdg}/${f.bdp}` : ""}</td>}
              <td>{f.gf}/{f.gc}</td>
              <td style={{ color: f.balance > 0 ? "#2E7D32" : f.balance < 0 ? "#B71C1C" : undefined }}>
                {entSigno(f.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ic-nota">
        {t("ic_cua_cubre", { min: minSeg(c.segCubiertos), total: minSeg(c.segPartido) })}
        {c.segOtros > 0.5 ? ` ${t("ic_cua_otros", { min: minSeg(c.segOtros) })}` : ""}.
      </p>
    </>
  );
}

function Tanda(props: { inf: Informe }) {
  const { inf } = props;
  const d = inf.tanda;
  if (!d) return null;
  const quien = d.nos > d.rival
    ? t("ic_tanda_gana", { equipo: inf.cabecera.nombreCorto })
    : d.rival > d.nos ? t("ic_tanda_gana_rival") : t("ic_tanda_sin");
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_tanda")}</h2>
      <p className="ic-txt">{conNegrita(t("ic_tanda_txt", { a: d.nos, b: d.rival, quien }))}</p>
      <table style={{ width: "160mm" }}>
        <Anchos mm={[10, 26, 42, 36, 26, 22]} />
        <thead>
          <tr>
            <th>#</th><th>{t("ic_g_equipo")}</th><th>{t("ic_tanda_tirador")}</th>
            <th>{t("ic_portero")}</th><th>{t("ic_tanda_res")}</th><th>{t("ic_g_marcador")}</th>
          </tr>
        </thead>
        <tbody>
          {d.tiros.map((x) => (
            <tr key={x.orden}>
              <td>{x.orden}</td>
              <td>{x.nuestro ? inf.cabecera.nombreCorto : t("ic_rival")}</td>
              <td className="ic-izq">{x.tirador || "—"}</td>
              <td className="ic-izq">{x.portero || "—"}</td>
              <td style={{ color: x.resultado === "GOL" ? "#2E7D32" : "#B71C1C" }}>
                {t(`ic_res_${x.resultado}`)}
              </td>
              <td>{x.marcadorNos}-{x.marcadorRival}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TiemposMuertos(props: { inf: Informe }) {
  const { inf } = props;
  if (!inf.tiemposMuertos.length) return null;
  return (
    <section className="ic-sec">
      <h2>{t("ic_sec_tm")}</h2>
      <p className="ic-txt">{t("ic_tm_txt")}</p>
      <table style={{ width: "88mm" }}>
        <Anchos mm={[20, 20, 28, 20]} />
        <thead>
          <tr>
            <th>{t("ic_pa_parte")}</th><th>{t("ic_min")}</th>
            <th>{t("ic_tm_pide")}</th><th>{t("ic_g_marcador")}</th>
          </tr>
        </thead>
        <tbody>
          {inf.tiemposMuertos.map((x, i) => (
            <tr key={i}>
              <td>{nombreParte(x.parte)}</td>
              <td>{x.minuto}</td>
              <td>{x.nuestro ? inf.cabecera.nombreCorto : t("ic_rival")}</td>
              <td>{x.nos}-{x.rival}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function InformeCompleto() {
  const { partido, cargado } = usePartido();
  useIdioma();     // re-renderiza al cambiar de idioma

  // Con ?imprimir=1 (el botón del resumen) se abre solo el diálogo, con un
  // respiro para que la página esté pintada: si no, en el iPad sale a medias.
  useEffect(() => {
    if (!cargado || !partido) return;
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const id = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(id);
  }, [cargado, partido]);

  if (!cargado) return <main className="p-6 text-zinc-400">{t("inf_cargando")}</main>;

  const inf = partido
    ? construirInformeCompleto(partido, {
        nombreCorto: CLIENTE.nombreCorto,
        nombreLargo: CLIENTE.nombreLargo,
        roster: ROSTER,
      })
    : null;
  if (!inf) {
    return (
      <main className="p-6 text-zinc-300">
        <p>{t("inf_sin_partido")}</p>
        <Link href="/" className="underline" style={{ color: COLOR }}>{t("inf_volver")}</Link>
      </main>
    );
  }

  const ahora = new Date();
  const dosCifras = (x: number) => String(x).padStart(2, "0");
  const generado = `${dosCifras(ahora.getDate())}/${dosCifras(ahora.getMonth() + 1)}/${ahora.getFullYear()}`
    + ` ${dosCifras(ahora.getHours())}:${dosCifras(ahora.getMinutes())}`;

  return (
    <main className="informe ic">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mb-4 flex gap-2 print:hidden">
        <Link href="/resumen" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white">
          ← {t("inf_volver")}
        </Link>
        <button onClick={() => window.print()}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: COLOR }}>
          📄 {t("inf_guardar_pdf")}
        </button>
      </div>
      <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 print:hidden">
        {t("inf_aviso_imprimir")}
      </div>

      <div className="ic-pag">
        <Cabecera inf={inf} />
        <Kpis inf={inf} />
        {inf.titulares.length > 0 && (
          <div style={{ marginBottom: "12pt" }}>
            {inf.titulares.map((x) => (
              <p key={x.clave} className="ic-tit">• {conNegrita(t(x.clave, x.params))}</p>
            ))}
          </div>
        )}
        <Equipo inf={inf} />
      </div>

      <div className="ic-pag">
        <Minutos inf={inf} />
        {!inf.hayVideo && <Individuales inf={inf} />}
      </div>

      {inf.hayVideo && (
        <div className="ic-pag">
          <Individuales inf={inf} />
          <VideoCampo inf={inf} />
          <VideoPorteros inf={inf} />
        </div>
      )}

      <div className="ic-pag">
        <PorteriaTabla inf={inf} />
        <div style={{ height: "14pt" }} />
        <Valoracion inf={inf} />
      </div>

      {inf.goles.length > 0 && (
        <div className="ic-pag">
          <GolesTabla inf={inf} />
          <GolesCinco inf={inf} />
        </div>
      )}

      {inf.goles.length > 0 && (
        <div className="ic-pag"><MatrizJugadas inf={inf} /></div>
      )}

      {inf.mapas && (
        <div className="ic-pag">
          <h2>{t("ic_sec_mapas")}</h2>
          <CampoZonas zonas={inf.mapas.favorCampo} titulo={t("ic_mapa_fc")} />
          <PorteriaZonas zonas={inf.mapas.favorPorteria} titulo={t("ic_mapa_fp")} />
          <CampoZonas zonas={inf.mapas.contraCampo} titulo={t("ic_mapa_cc")} />
          <PorteriaZonas zonas={inf.mapas.contraPorteria} titulo={t("ic_mapa_cp")} />
        </div>
      )}

      {inf.pases && <div className="ic-pag"><Pases inf={inf} /></div>}

      <div className="ic-pag"><Cronogramas inf={inf} /></div>

      {inf.rotaciones.length > 0 && <div className="ic-pag"><Rotaciones inf={inf} /></div>}

      {inf.cuartetos.filas.length > 0 && <div className="ic-pag"><Cuartetos inf={inf} /></div>}

      <div className={inf.tanda ? "ic-pag" : undefined}>
        <Tanda inf={inf} />
        <TiemposMuertos inf={inf} />
        <p className="ic-pie">
          {t("ic_pie", { fecha: generado })}<br />
          {t("ic_pie_origen")}
        </p>
      </div>
    </main>
  );
}
