"use client";

/**
 * TotalesAmpliados.tsx — Las tablas por jugador de «Totales de la temporada»,
 * en PESTAÑAS (petición del entrenador, 25/11/2026): Resumen, Ataque,
 * Defensa, Porteros, Disciplina y Situaciones.
 *
 * SOLO dibuja: las cuentas vienen hechas de lib/totalesJugador.ts, con el
 * filtro de competiciones y partidos ya aplicado. La misma tabla sirve a los
 * dos aspectos (clásico y nuevo): cambia solo la piel (clase `ta-clasico` o
 * las variables del `.pz` que la envuelve). Estilos en app/tema-nuevo.css
 * (clases ta-*).
 *
 *   · Tocar una cabecera ordena por esa columna (otra vez: al revés).
 *   · «Total / Por partido / Por 40′» cambia las columnas que tiene sentido
 *     pasar a media; las que ya son medias o porcentajes no se tocan.
 *   · Primera columna (el jugador) FIJA y la tabla se desplaza de lado: en el
 *     iPad en vertical no caben todas.
 *   · Fila del EQUIPO al pie.
 *   · Las columnas que solo se apuntan revisando el VÍDEO (1x1, duelos…)
 *     salen solo si algún partido las tiene, marcadas con «*».
 */
import { useMemo, useState } from "react";
import { t, idiomaActivo } from "@/lib/i18n";
import { formatMinutos } from "@/lib/totales";
import {
  disparos, mediaMinutos, normalizar, pct, valoracionMedia,
  type FilaTemporada, type ModoValor, type TotalesAmpliados as Datos,
} from "@/lib/totalesJugador";
import { CLAVE_SITUACION, SITUACIONES_ESPECIALES, minutosSituacion, type SituacionEspecial } from "@/lib/situacionesNumericas";

type Formato = "n" | "dec" | "min" | "mmss" | "media" | "pct" | "signo" | "frac";

interface Col {
  id: string;
  /** Clave i18n de la cabecera corta y (opcional) de su explicación. */
  et: string;
  tit?: string;
  v: (f: FilaTemporada) => number | null;
  /** Para «frac»: el denominador (lanzados), que se escribe «metidos/lanzados». */
  de?: (f: FilaTemporada) => number;
  fmt?: Formato;
  /** Se pasa a «por partido» / «por 40′». */
  norm?: boolean;
  /** Solo se apunta revisando el vídeo. */
  video?: boolean;
  /** Valor de la fila del equipo distinto (o `null` = no se escribe). */
  eq?: (f: FilaTemporada) => number | null;
  fuerte?: boolean;
}

const V = (k: string) => (f: FilaTemporada) => f.video[k] ?? 0;
const nada = () => null;

const RESUMEN: Col[] = [
  { id: "conv", et: "ta_conv", tit: "ta_conv_t", v: (f) => f.convocado },
  { id: "pj", et: "tot_th_pj", tit: "ta_pj_t", v: (f) => f.jugados },
  { id: "tit", et: "ta_tit", tit: "ta_tit_t", v: (f) => f.titular, eq: nada },
  { id: "min", et: "tot_th_min", v: (f) => f.segundos, fmt: "min" },
  { id: "minpj", et: "ta_minpj", tit: "ta_minpj_t", v: mediaMinutos, fmt: "media" },
  { id: "g", et: "ta_g", tit: "tot_goles", v: (f) => f.goles, norm: true, fuerte: true },
  { id: "a", et: "tot_th_asist", v: (f) => f.asistencias, norm: true },
  { id: "ga", et: "ta_ga", tit: "ta_ga_t", v: (f) => f.goles + f.asistencias, norm: true },
  { id: "gf", et: "ta_gf", tit: "ta_gf_t", v: (f) => f.gfPista, norm: true },
  { id: "gc", et: "ta_gc", tit: "ta_gc_t", v: (f) => f.gcPista, norm: true },
  { id: "mm", et: "ta_mm", tit: "ta_mm_t", v: (f) => f.gfPista - f.gcPista, norm: true, fmt: "signo", fuerte: true },
  { id: "val", et: "ta_val", tit: "ta_val_t", v: (f) => (f.partidosValorados ? f.valoracion : null), norm: true, fmt: "dec", eq: nada },
  { id: "valpj", et: "ta_valpj", tit: "ta_valpj_t", v: valoracionMedia, fmt: "dec", eq: nada, fuerte: true },
];

const ATAQUE: Col[] = [
  { id: "disp", et: "tot_th_disp", tit: "ta_disp_t", v: disparos, norm: true, fuerte: true },
  { id: "pue", et: "ta_puerta", tit: "ta_puerta_t", v: (f) => f.aPuerta, norm: true },
  { id: "fue", et: "ta_fuera", v: (f) => f.fuera, norm: true },
  { id: "pal", et: "ta_palo", v: (f) => f.palo, norm: true },
  { id: "blo", et: "ta_bloq", tit: "ta_bloq_t", v: (f) => f.bloqueados, norm: true },
  { id: "g", et: "ta_g", tit: "tot_goles", v: (f) => f.goles, norm: true, fuerte: true },
  { id: "ppue", et: "ta_ppuerta", tit: "ta_ppuerta_t", v: (f) => pct(f.aPuerta, disparos(f)), fmt: "pct" },
  { id: "pgol", et: "ta_pgol", tit: "ta_pgol_t", v: (f) => pct(f.goles, disparos(f)), fmt: "pct" },
  { id: "pen", et: "ta_pen", tit: "ta_pen_t", v: (f) => f.penG, de: (f) => f.penL, fmt: "frac" },
  { id: "diez", et: "ta_10m", tit: "ta_10m_t", v: (f) => f.diezG, de: (f) => f.diezL, fmt: "frac" },
  { id: "fsb", et: "ta_fsb", tit: "ta_fsb_t", v: (f) => f.fsbG, de: (f) => f.fsbL, fmt: "frac" },
  { id: "a", et: "tot_th_asist", v: (f) => f.asistencias, norm: true },
  { id: "pgo", et: "ta_pasegol", tit: "ta_pasegol_t", v: V("paseGol"), norm: true, video: true },
  { id: "1ag", et: "ta_1x1g", tit: "ta_1x1atq_g_t", v: V("unoAtq_g"), norm: true, video: true },
  { id: "1ap", et: "ta_1x1p", tit: "ta_1x1atq_p_t", v: V("unoAtq_p"), norm: true, video: true },
  { id: "dpg", et: "ta_duelp_g", tit: "ta_duelp_g_t", v: V("duelP_g"), norm: true, video: true },
  { id: "dpp", et: "ta_duelp_p", tit: "ta_duelp_p_t", v: V("duelP_p"), norm: true, video: true },
  { id: "cxp", et: "ta_conex", tit: "ta_conex_t", v: V("conexPivot"), norm: true, video: true },
  { id: "dfp", et: "ta_dfpista", tit: "ta_dfpista_t", v: (f) => f.dfPista, norm: true },
  { id: "dfpp", et: "ta_dfpuerta", tit: "ta_dfpuerta_t", v: (f) => f.dfPuertaPista, norm: true },
];

const DEFENSA: Col[] = [
  { id: "rob", et: "tot_th_robos", v: (f) => f.robos, norm: true },
  { id: "cor", et: "tot_th_cortes", tit: "ta_cortes_t", v: (f) => f.cortes, norm: true },
  { id: "rec", et: "ta_recup", tit: "ta_recup_t", v: (f) => f.robos + f.cortes, norm: true, fuerte: true },
  { id: "pf", et: "ta_pf", tit: "ta_pf_t", v: (f) => f.pf, norm: true },
  { id: "pnf", et: "ta_pnf", tit: "ta_pnf_t", v: (f) => f.pnf, norm: true },
  { id: "per", et: "tot_th_perd", tit: "ta_perd_t", v: (f) => f.pf + f.pnf, norm: true, fuerte: true },
  { id: "bal", et: "ta_balance", tit: "ta_balance_t", v: (f) => f.robos + f.cortes - f.pf - f.pnf, norm: true, fmt: "signo" },
  { id: "bdg", et: "ta_bdg", tit: "ta_bdg_t", v: (f) => f.bdg, norm: true },
  { id: "bdp", et: "ta_bdp", tit: "ta_bdp_t", v: (f) => f.bdp, norm: true },
  { id: "1dg", et: "ta_1x1g", tit: "ta_1x1def_g_t", v: V("unoDef_g"), norm: true, video: true },
  { id: "1dp", et: "ta_1x1p", tit: "ta_1x1def_p_t", v: V("unoDef_p"), norm: true, video: true },
  { id: "dcg", et: "ta_duelc_g", tit: "ta_duelc_g_t", v: V("duelC_g"), norm: true, video: true },
  { id: "dcp", et: "ta_duelc_p", tit: "ta_duelc_p_t", v: V("duelC_p"), norm: true, video: true },
  { id: "anb", et: "ta_antb", tit: "ta_antb_t", v: V("antB"), norm: true, video: true },
  { id: "anm", et: "ta_antm", tit: "ta_antm_t", v: V("antM"), norm: true, video: true },
  { id: "ulc", et: "ta_ultcob", tit: "ta_ultcob_t", v: V("ultCob"), norm: true, video: true },
  { id: "dcpi", et: "ta_dcpista", tit: "ta_dcpista_t", v: (f) => f.dcPista, norm: true },
  { id: "dcpp", et: "ta_dcpuerta", tit: "ta_dcpuerta_t", v: (f) => f.dcPuertaPista, norm: true },
  { id: "gc", et: "ta_gc", tit: "ta_gc_t", v: (f) => f.gcPista, norm: true },
];

const PORTEROS: Col[] = [
  { id: "pj", et: "tot_th_pj", tit: "ta_pj_t", v: (f) => f.jugados },
  { id: "tit", et: "ta_tit", tit: "ta_tit_t", v: (f) => f.titular, eq: nada },
  { id: "min", et: "tot_th_min", v: (f) => f.segundos, fmt: "min" },
  { id: "minpj", et: "ta_minpj", tit: "ta_minpj_t", v: mediaMinutos, fmt: "media" },
  { id: "par", et: "tot_th_paradas", v: (f) => f.paradas, norm: true, fuerte: true },
  { id: "enc", et: "tot_th_encajados", tit: "ta_enc_t", v: (f) => f.golesEncajados, norm: true },
  { id: "tir", et: "ta_tirpuerta", tit: "ta_tirpuerta_t", v: (f) => f.paradas + f.golesEncajados, norm: true },
  { id: "ppar", et: "tot_th_pct", v: (f) => pct(f.paradas, f.paradas + f.golesEncajados), fmt: "pct", fuerte: true },
  { id: "cero", et: "ta_cero", tit: "ta_cero_t", v: (f) => f.porteriasCero },
  { id: "lpar", et: "ta_lanzpar", tit: "ta_lanzpar_t", v: (f) => f.lanzParados, de: (f) => f.lanzRecibidos, fmt: "frac" },
  { id: "dcpi", et: "ta_dcpista", tit: "ta_dcpista_t", v: (f) => f.dcPista, norm: true },
  { id: "gc", et: "ta_gc", tit: "ta_gc_t", v: (f) => f.gcPista, norm: true },
  { id: "sqb", et: "ta_saqueb", tit: "ta_saqueb_t", v: V("saqueB"), norm: true, video: true },
  { id: "sqm", et: "ta_saquem", tit: "ta_saquem_t", v: V("saqueM"), norm: true, video: true },
  { id: "pab", et: "ta_paseb", tit: "ta_paseb_t", v: V("paseB"), norm: true, video: true },
  { id: "pam", et: "ta_pasem", tit: "ta_pasem_t", v: V("paseM"), norm: true, video: true },
  { id: "ach", et: "ta_achique", tit: "ta_achique_t", v: V("achique"), norm: true, video: true },
  { id: "cob", et: "ta_cobb", tit: "ta_cobb_t", v: (f) => (f.video.cobBR ?? 0) + (f.video.cobBN ?? 0), norm: true, video: true },
  { id: "com", et: "ta_cobm", tit: "ta_cobm_t", v: (f) => (f.video.cobMR ?? 0) + (f.video.cobMN ?? 0), norm: true, video: true },
  { id: "val", et: "ta_val", tit: "ta_val_t", v: (f) => (f.partidosValorados ? f.valoracion : null), norm: true, fmt: "dec", eq: nada },
  { id: "valpj", et: "ta_valpj", tit: "ta_valpj_t", v: valoracionMedia, fmt: "dec", eq: nada },
];

const DISCIPLINA: Col[] = [
  { id: "pj", et: "tot_th_pj", tit: "ta_pj_t", v: (f) => f.jugados },
  { id: "min", et: "tot_th_min", v: (f) => f.segundos, fmt: "min" },
  { id: "fc", et: "ta_fc", tit: "ta_fc_t", v: (f) => f.faltas, norm: true, fuerte: true },
  { id: "fr", et: "ta_fr", tit: "ta_fr_t", v: (f) => f.faltasRecibidas, norm: true, fuerte: true },
  { id: "dif", et: "ta_fdif", tit: "ta_fdif_t", v: (f) => f.faltasRecibidas - f.faltas, norm: true, fmt: "signo" },
  { id: "ta", et: "ta_ama", tit: "inf_amarillas", v: (f) => f.amarillas, norm: true },
  { id: "tr", et: "ta_roja", tit: "ta_roja_t", v: (f) => f.rojas, norm: true },
];

const sitCols = (s: SituacionEspecial, eqSeg: number): Col[] => [
  { id: "seg", et: "ta_sit_min", tit: "ta_sit_min_t", v: (f) => f.sit[s].seg, fmt: "mmss", fuerte: true },
  { id: "pct", et: "ta_sit_pct", tit: "ta_sit_pct_t", v: (f) => pct(f.sit[s].seg, eqSeg), fmt: "pct", eq: nada },
  { id: "df", et: "ta_sit_df", tit: "ta_sit_df_t", v: (f) => f.sit[s].df },
  { id: "dfp", et: "ta_sit_dfp", tit: "ta_sit_dfp_t", v: (f) => f.sit[s].dfPuerta },
  { id: "gf", et: "ta_gf", tit: "ta_sit_gf_t", v: (f) => f.sit[s].gf, fuerte: true },
  { id: "dc", et: "ta_sit_dc", tit: "ta_sit_dc_t", v: (f) => f.sit[s].dc },
  { id: "dcp", et: "ta_sit_dcp", tit: "ta_sit_dcp_t", v: (f) => f.sit[s].dcPuerta },
  { id: "gc", et: "ta_gc", tit: "ta_sit_gc_t", v: (f) => f.sit[s].gc, fuerte: true },
  { id: "mm", et: "ta_mm", tit: "ta_sit_mm_t", v: (f) => f.sit[s].gf - f.sit[s].gc, fmt: "signo" },
];

type Pestana = "resumen" | "ataque" | "defensa" | "porteros" | "disciplina" | "situaciones";
const PESTANAS: Pestana[] = ["resumen", "ataque", "defensa", "porteros", "disciplina", "situaciones"];

// ──────────────────────────────────────────────────────────────────────────
function numero(x: number, dec: number): string {
  return x.toLocaleString(idiomaActivo(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Lo que se escribe en la celda. Los ceros van en blanco, como siempre en
 *  Totales (se lee mejor una tabla grande), salvo en ± y balances. */
function texto(c: Col, f: FilaTemporada, valor: number | null, modo: ModoValor): string {
  if (valor === null) return "";
  const fmt = c.fmt ?? "n";
  if (fmt === "frac") {
    const de = c.de?.(f) ?? 0;
    return de ? `${valor}/${de}` : "";
  }
  if (fmt === "min") return valor ? formatMinutos(valor) : "";
  if (fmt === "mmss") return valor ? minutosSituacion(valor) : "";
  if (fmt === "media") return `${numero(valor, 1)}'`;
  if (fmt === "pct") return `${Math.round(valor)}%`;
  const enMedia = c.norm && modo !== "total";
  if (fmt === "signo") {
    if (enMedia) return `${valor > 0 ? "+" : ""}${numero(valor, 2)}`;
    return `${valor > 0 ? "+" : ""}${valor}`;
  }
  // La valoración sí escribe su cero: 0,0 es una nota, no «nada».
  if (fmt === "dec") return enMedia ? numero(valor, 2) : numero(valor, 1);
  if (!valor) return "";
  if (enMedia) return numero(valor, 2);
  return String(valor);
}

function valorCol(c: Col, f: FilaTemporada, modo: ModoValor, esEquipo: boolean): number | null {
  const crudo = esEquipo && c.eq ? c.eq(f) : c.v(f);
  if (crudo === null) return null;
  if (c.norm && modo !== "total") return normalizar(crudo, f, modo);
  return crudo;
}

export function TotalesAmpliados(props: { datos: Datos; nuevo: boolean }) {
  const { datos, nuevo } = props;
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [modo, setModo] = useState<ModoValor>("total");
  const [orden, setOrden] = useState<{ col: string; asc: boolean } | null>(null);
  const sitDadas = SITUACIONES_ESPECIALES.filter((s) => datos.equipo.sit[s].seg > 0 || datos.equipo.sit[s].df + datos.equipo.sit[s].dc > 0);
  const [sitElegida, setSit] = useState<SituacionEspecial | null>(null);
  const sit = sitElegida && sitDadas.includes(sitElegida) ? sitElegida : sitDadas[0] ?? "pj_nuestro";
  const pestanas = PESTANAS.filter((p) => p !== "situaciones" || sitDadas.length > 0);
  const actual = pestanas.includes(pestana) ? pestana : "resumen";

  const cols = useMemo(() => {
    const base = actual === "resumen" ? RESUMEN : actual === "ataque" ? ATAQUE
      : actual === "defensa" ? DEFENSA : actual === "porteros" ? PORTEROS
      : actual === "disciplina" ? DISCIPLINA : sitCols(sit, datos.equipo.sit[sit].seg);
    // Las de vídeo, solo si algún partido las trae (y alguien tiene algo).
    return base.filter((c) => !c.video || (datos.hayVideo && datos.jugadores.some((f) => (c.v(f) ?? 0) !== 0)));
  }, [actual, sit, datos]);

  const filas = useMemo(() => {
    let l = datos.jugadores;
    if (actual === "porteros") l = l.filter((f) => f.portero || f.paradas + f.golesEncajados > 0);
    else if (actual === "situaciones") l = l.filter((f) => f.sit[sit].seg > 0);
    else if (actual !== "resumen") l = l.filter((f) => f.jugados > 0);
    if (!orden) return l;
    const m = modo;
    const clave = (f: FilaTemporada): number | string | null => {
      if (orden.col === "_nombre") return f.nombre;
      const c = cols.find((x) => x.id === orden.col);
      if (!c) return null;
      const v = valorCol(c, f, actual === "situaciones" ? "total" : m, false);
      // «metidos/lanzados»: a igualdad de metidos, el que más ha tirado.
      return v === null ? null : c.de ? v * 1000 + c.de(f) : v;
    };
    return [...l].sort((a, b) => {
      const x = clave(a), y = clave(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;                  // los vacíos siempre al final
      if (y === null) return -1;
      const d = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
      return orden.asc ? d : -d;
    });
  }, [datos, actual, sit, orden, modo, cols]);

  const tocar = (col: string) => {
    setOrden((o) => (o && o.col === col
      ? { col, asc: !o.asc }
      // Primer toque: el nombre de la A a la Z; los números, de mayor a menor.
      : { col, asc: col === "_nombre" }));
  };
  const modoReal: ModoValor = actual === "situaciones" ? "total" : modo;
  const hayVideoVisible = cols.some((c) => c.video);
  const flecha = (col: string) => (orden?.col === col ? (orden.asc ? " ▲" : " ▼") : "");

  return (
    <section className={`ta ${nuevo ? "pz-capa ta-nuevo" : "ta-clasico"}`}>
      <div className="ta-cab">
        <h2 className="ta-h2">{t("tot_por_jugador")}</h2>
        {actual !== "situaciones" && (
          <div className="ta-modo" role="group" aria-label={t("ta_modo")}>
            {(["total", "partido", "p40"] as ModoValor[]).map((x) => (
              <button key={x} type="button" className={modo === x ? "on" : ""} onClick={() => setModo(x)}>
                {t(`ta_modo_${x}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ta-pest" role="tablist">
        {pestanas.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={actual === p}
                  className={actual === p ? "on" : ""}
                  onClick={() => { setPestana(p); setOrden(null); }}>
            {t(`ta_p_${p}`)}
          </button>
        ))}
      </div>

      {actual === "situaciones" && (
        <>
          <div className="ta-scroll">
            <table className="ta-tabla ta-sit-eq">
              <thead>
                <tr>
                  <th className="izq">{t("ta_sit_situacion")}</th>
                  <th>{t("ta_sit_min")}</th>
                  <th title={t("ta_sit_df_eq_t")}>{t("ta_sit_df")}</th><th>{t("ta_sit_dfp")}</th><th>{t("ta_gf")}</th>
                  <th title={t("ta_sit_dc_eq_t")}>{t("ta_sit_dc")}</th><th>{t("ta_sit_dcp")}</th><th>{t("ta_gc")}</th>
                </tr>
              </thead>
              <tbody>
                {sitDadas.map((s) => {
                  const e = datos.equipo.sit[s];
                  return (
                    <tr key={s} className={s === sit ? "elegida" : ""} onClick={() => setSit(s)}>
                      <td className="izq nombre">{t(CLAVE_SITUACION[s])}</td>
                      <td>{minutosSituacion(e.seg)}</td>
                      <td>{e.df}</td><td>{e.dfPuerta}</td><td className="fuerte">{e.gf}</td>
                      <td>{e.dc}</td><td>{e.dcPuerta}</td><td className="fuerte">{e.gc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ta-chips">
            {sitDadas.map((s) => (
              <button key={s} type="button" className={s === sit ? "on" : ""}
                      onClick={() => { setSit(s); setOrden(null); }}>
                {t(CLAVE_SITUACION[s])}
              </button>
            ))}
          </div>
        </>
      )}

      {filas.length === 0 ? (
        <p className="ta-nota">{t("ta_sin_filas")}</p>
      ) : (
        <div className="ta-scroll">
          <table className="ta-tabla">
            <thead>
              <tr>
                <th className="izq fija">
                  <button type="button" onClick={() => tocar("_nombre")}>{t("tot_th_jugador")}{flecha("_nombre")}</button>
                </th>
                {cols.map((c) => (
                  <th key={c.id} title={c.tit ? t(c.tit) : undefined}
                      aria-sort={orden?.col === c.id ? (orden.asc ? "ascending" : "descending") : undefined}>
                    <button type="button" onClick={() => tocar(c.id)}>
                      {t(c.et)}{c.video ? "*" : ""}{flecha(c.id)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre}>
                  <td className="izq fija nombre">
                    <span className="dorsal">{f.dorsal}</span>{f.nombre}
                  </td>
                  {cols.map((c) => {
                    const v = valorCol(c, f, modoReal, false);
                    const s = texto(c, f, v, modoReal);
                    const signo = c.fmt === "signo" && v !== null ? (v > 0 ? " mas" : v < 0 ? " menos" : "") : "";
                    return <td key={c.id} className={(c.fuerte ? "fuerte" : "") + signo}>{s}</td>;
                  })}
                </tr>
              ))}
            </tbody>
            {(
              <tfoot>
                <tr>
                  <td className="izq fija nombre">{t("ta_equipo")}</td>
                  {cols.map((c) => {
                    const v = valorCol(c, datos.equipo, modoReal, true);
                    return <td key={c.id}>{texto(c, datos.equipo, v, modoReal)}</td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <p className="ta-nota">
        {t(`ta_nota_${actual}`)}{" "}
        {actual !== "situaciones" && modo !== "total" && t(modo === "partido" ? "ta_nota_partido" : "ta_nota_p40")}{" "}
        {hayVideoVisible && t("ta_nota_video")}{" "}
        {t("ta_nota_orden")}
      </p>
    </section>
  );
}
