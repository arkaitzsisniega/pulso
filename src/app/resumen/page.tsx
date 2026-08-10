"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { usePartido } from "@/lib/store";
import { ROSTER, CLIENTE, NOMBRE_CORTO_TC } from "@/lib/clientes";
import { formatMMSS } from "@/lib/utils";
import { CampoConteos } from "@/components/CampoConteos";
import { EditorEventos } from "@/components/EditorEventos";
import type { Evento, ParteId, Partido } from "@/lib/db";
import { direccionAtaque, JUGADOR_EQUIPO } from "@/lib/db";
import { t, useIdioma, labelAccionGol, labelResultadoDisparo } from "@/lib/i18n";

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];

// ─── Helpers de presentación ────────────────────────────────────────────

const LBL_ACCION: Record<string, string> = {
  pf: "PF", pnf: "PNF", robos: "Robo", cortes: "Corte",
  bdg: "BDG", bdp: "BDP",
};

function emojiEvento(ev: Evento): string {
  switch (ev.tipo) {
    case "gol":               return "⚽";
    case "falta":             return "⚠️";
    case "amarilla":          return "🟨";
    case "roja":              return "🟥";
    case "tiempo_muerto":     return "🛑";
    case "cambio":            return "🔄";
    case "disparo":           return "🎯";
    case "penalti":           return "🥅";
    case "diezm":             return "📌";
    case "accion_individual": return "👤";
    default:                  return "•";
  }
}

function descripcionEvento(ev: Evento, rival: string): string {
  const equipoTxt = (e: "INTER" | "RIVAL") => e === "INTER" ? CLIENTE.nombreCorto : rival;
  try {
    switch (ev.tipo) {
      case "gol": {
        const quien = ev.equipo === "INTER" ? (ev.goleador || "?") : rival;
        const ext: string[] = [];
        if (ev.asistente) ext.push(`asist. ${ev.asistente}`);
        if (ev.accion)    ext.push(ev.accion);
        if (ev.zonaCampo) ext.push(`desde ${ev.zonaCampo}`);
        if (ev.zonaPorteria) ext.push(`a ${ev.zonaPorteria}`);
        return `Gol ${equipoTxt(ev.equipo)} — ${quien}${ext.length ? ` (${ext.join(", ")})` : ""}`;
      }
      case "falta": {
        const q = ev.jugador ?? (ev.sinAsignar ? "sin asignar" : (ev.rivalMano ? "mano" : "—"));
        const zona = ev.zonaCampo ? ` · ${ev.zonaCampo}` : "";
        return `Falta ${equipoTxt(ev.equipo)} — ${q}${zona}`;
      }
      case "amarilla":
        return `Amarilla ${equipoTxt(ev.equipo)}${ev.jugador ? ` — ${ev.jugador}` : ""}`;
      case "roja":
        return `Roja ${equipoTxt(ev.equipo)}${ev.jugador ? ` — ${ev.jugador}` : ""}`;
      case "tiempo_muerto":
        return `Tiempo muerto ${equipoTxt(ev.equipo)}`;
      case "cambio":
        // entra="" → expulsión/inferioridad (sale sin reemplazo).
        // sale=""  → reincorporación tras inferioridad (entra sin que salga nadie).
        if (!ev.entra && ev.sale) return `Sale ${ev.sale} (inferioridad)`;
        if (ev.entra && !ev.sale) return `Reincorporación — entra ${ev.entra}`;
        return `Cambio — entra ${ev.entra}, sale ${ev.sale}`;
      case "disparo": {
        const ext: string[] = [];
        if (ev.zonaCampo) ext.push(`desde ${ev.zonaCampo}`);
        if (ev.zonaPorteria) ext.push(`a ${ev.zonaPorteria}`);
        const quien = ev.jugador ?? rival;
        return `Disparo ${equipoTxt(ev.equipo)} — ${quien} (${ev.resultado}${ext.length ? `, ${ext.join(", ")}` : ""})`;
      }
      case "penalti":
      case "diezm": {
        const tipoTxt = ev.tipo === "penalti" ? "Penalti" : "10m";
        const ext: string[] = [];
        if (ev.zonaPorteria) ext.push(ev.zonaPorteria);
        return `${tipoTxt} ${equipoTxt(ev.equipo)} — ${ev.tirador || "?"} → ${ev.resultado}${ext.length ? ` (${ext.join(", ")})` : ""}`;
      }
      case "accion_individual": {
        const lbl = LBL_ACCION[ev.accion] ?? ev.accion;
        return `${lbl} — ${ev.jugador}${ev.zonaCampo ? ` (${ev.zonaCampo})` : ""}`;
      }
      default:
        return JSON.stringify(ev);
    }
  } catch {
    return "(evento sin formato)";
  }
}

/**
 * Reconstruye, recorriendo los eventos cronológicamente, la pista en
 * cada momento, y cuenta cuántos goles a favor (gf) y en contra (gc) ha
 * vivido cada jugador, además de goles propios + asistencias.
 */
function calcularResumenIndividual(partido: Partido) {
  const cfg = partido.config!;
  // Estado de pista al inicio
  const pi = cfg.pista_inicial;
  let pista = new Set<string>([pi.portero, pi.pista1, pi.pista2, pi.pista3, pi.pista4]);

  type Reg = { gf: number; gc: number; goles: number; asistencias: number };
  const reg: Record<string, Reg> = {};
  for (const n of cfg.convocados) reg[n] = { gf: 0, gc: 0, goles: 0, asistencias: 0 };

  const eventosOrden = [...partido.eventos].sort(
    (a, b) => (a.timestampReal || 0) - (b.timestampReal || 0)
  );
  for (const ev of eventosOrden) {
    if (ev.tipo === "cambio") {
      pista.delete(ev.sale);
      pista.add(ev.entra);
    } else if (ev.tipo === "gol") {
      // Plus/minus para todos los que estaban en pista
      for (const n of pista) {
        if (!reg[n]) continue;
        if (ev.equipo === "INTER") reg[n].gf += 1;
        else reg[n].gc += 1;
      }
      if (ev.equipo === "INTER") {
        if (ev.goleador && reg[ev.goleador]) reg[ev.goleador].goles += 1;
        if (ev.asistente && reg[ev.asistente]) reg[ev.asistente].asistencias += 1;
      }
    }
  }
  return reg;
}

// Semáforo de minutos para tab Tiempos (excluye porteros del cálculo).
function colorSemaforoMin(seg: number, max: number): string {
  if (max <= 0) return "bg-zinc-800";
  const pct = seg / max;
  if (pct >= 0.85) return "bg-red-700/40";
  if (pct >= 0.65) return "bg-orange-600/40";
  if (pct >= 0.40) return "bg-yellow-600/30";
  if (pct >= 0.20) return "bg-green-700/30";
  return "bg-green-900/30";
}

// ─── Página resumen ─────────────────────────────────────────────────────

export default function ResumenPage() {
  useIdioma();
  const router = useRouter();
  const { partido, cargado, editarEvento, borrarEvento, anadirEvento, recalcularMinutos, setMinutosJugador } = usePartido();
  const [tab, setTab] = useState<"general" | "tiempos" | "individual" | "cronograma" | "disparos" | "analisis" | "editar">("general");

  if (!cargado) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">{t("cargando")}</div>;
  }
  if (!partido.config) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <p>{t("res_no_partido")}</p>
        <Link href="/" className="px-6 py-3 bg-zinc-800 rounded-lg">{t("inicio")}</Link>
      </div>
    );
  }

  const cfg = partido.config;
  const partesJugadas = PARTES.filter((p) => (cfg.duracionParte[p] ?? 0) > 0);

  // Eventos por parte (orden cronológico)
  const eventosOrdenados = [...partido.eventos].sort((a, b) => {
    const pa = PARTES.indexOf(a.parte);
    const pb = PARTES.indexOf(b.parte);
    if (pa !== pb) return pa - pb;
    return (a.segundosParte || 0) - (b.segundosParte || 0);
  });

  // Stats por parte
  const stats = partido.stats;

  // Tiempos por jugador
  const filasTiempos = cfg.convocados.map((nombre) => {
    const t = partido.tiempos[nombre];
    const enPista = partido.enPista.includes(nombre);
    const liveExtra = (enPista && t?.turnoStart != null && partido.cronometro.ultimoStart != null)
      ? (Date.now() - t.turnoStart) / 1000 : 0;
    const porParte: Record<ParteId, number> = t
      ? { ...t.porParte, [partido.cronometro.parteActual]: (t.porParte[partido.cronometro.parteActual] ?? 0) + liveExtra }
      : { "1T": 0, "2T": 0, PR1: 0, PR2: 0 };
    const total = (t?.totalSegundos ?? 0) + liveExtra;
    const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
    return { nombre, total, porParte, esPortero, enPista };
  });
  filasTiempos.sort((a, b) => {
    if (a.enPista !== b.enPista) return a.enPista ? -1 : 1;
    return b.total - a.total;
  });

  // Para semáforo: máximo de minutos jugados entre jugadores NO portero
  const maxMinJugados = filasTiempos
    .filter((f) => !f.esPortero)
    .reduce((m, f) => Math.max(m, f.total), 0);

  // Plus/minus + goles + asistencias por jugador
  const regIndiv = calcularResumenIndividual(partido);

  // Filas individuales para la tabla de la pestaña "Individual"
  const filasIndiv = cfg.convocados.map((nombre) => {
    const c = partido.acciones.porJugador[nombre] || null;
    const r = regIndiv[nombre] || { gf: 0, gc: 0, goles: 0, asistencias: 0 };
    const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
    return { nombre, c, r, esPortero };
  });

  // Totales del equipo por JUGADOR (sin las acciones colectivas #EQUIPO).
  const totalesEquipo = filasIndiv.reduce((acc, f) => ({
    dpp: acc.dpp + (f.c?.dpp || 0),
    dpa: acc.dpa + (f.c?.dpa || 0),
    dpf: acc.dpf + (f.c?.dpf || 0),
    dpb: acc.dpb + (f.c?.dpb || 0),
    pf:  acc.pf  + (f.c?.pf  || 0),
    pnf: acc.pnf + (f.c?.pnf || 0),
    robos:  acc.robos  + (f.c?.robos  || 0),
    cortes: acc.cortes + (f.c?.cortes || 0),
    bdg: acc.bdg + (f.c?.bdg || 0),
    bdp: acc.bdp + (f.c?.bdp || 0),
  }), { dpp:0,dpa:0,dpf:0,dpb:0,pf:0,pnf:0,robos:0,cortes:0,bdg:0,bdp:0 });
  // Acciones COLECTIVAS de equipo (pseudo-jugador #EQUIPO), mostradas APARTE:
  // recuperación de equipo = robos; pérdida de equipo = pf (forzada).
  const _cEquipo = partido.acciones.porJugador[JUGADOR_EQUIPO];
  const recEquipo = _cEquipo?.robos ?? 0;
  const perdEquipo = _cEquipo?.pf ?? 0;

  // Marcador final (incluye tanda si la hubo)
  const tanda = partido.tanda;
  const huboTanda = tanda && tanda.tiros.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.push("/partido")}
            className="text-base text-zinc-400 hover:text-zinc-200">
            {t("res_volver_partido")}
          </button>
          <h1 className="text-3xl font-bold">{t("res_titulo")}</h1>
          <Link href="/" className="text-base text-zinc-400 hover:text-zinc-200">
            {t("res_inicio_flecha")}
          </Link>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="text-base text-zinc-400 mb-1">
            {cfg.partido_id} · {cfg.competicion} · {cfg.fecha} {cfg.hora} · {cfg.lugar || "—"}
          </div>
          <div className="text-4xl font-bold tabular-nums flex items-center justify-center gap-3">
            <span className="text-emerald-400">{CLIENTE.nombreCorto}</span>
            <span className="text-5xl">{partido.marcador.inter}</span>
            <span className="text-zinc-500">-</span>
            <span className="text-5xl">{partido.marcador.rival}</span>
            <span className="text-red-400">{cfg.rival}</span>
          </div>
          {huboTanda && (
            <div className="text-center mt-2 text-pink-400 text-base">
              {t("res_tanda_penaltis")} <strong>{tanda.marcador.inter} - {tanda.marcador.rival}</strong>
              {" "}{t("res_tiros", { n: tanda.tiros.length })}
            </div>
          )}
          <div className="mt-3 text-base text-zinc-500 text-center">
            {t("res_estado")} <strong className="text-zinc-300">{partido.estado}</strong>
            {" · "}
            {t("res_partes_jugadas")} <strong className="text-zinc-300">{partesJugadas.join(", ")}</strong>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {[
          { id: "general",    lbl: t("res_tab_general") },
          { id: "tiempos",    lbl: t("res_tab_tiempos") },
          { id: "individual", lbl: t("res_tab_individual") },
          { id: "cronograma", lbl: t("res_tab_cronograma") },
          { id: "disparos",   lbl: t("res_tab_disparos") },
          { id: "analisis",   lbl: t("res_tab_analisis") },
          { id: "editar",     lbl: t("res_tab_editar") },
        ].map((tabItem) => (
          <button key={tabItem.id}
            onClick={() => setTab(tabItem.id as any)}
            className={`px-4 py-2 rounded-lg text-base font-semibold whitespace-nowrap ${
              tab === tabItem.id ? "bg-emerald-700" : "bg-zinc-800 hover:bg-zinc-700"
            }`}>{tabItem.lbl}</button>
        ))}
      </div>

      {/* TAB: GENERAL */}
      {tab === "general" && (
        <div className="space-y-4">
          {/* CABECERA: Disparos NUESTROS vs RIVAL */}
          <div className="bg-zinc-900 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-zinc-300 mb-4">{t("res_disparos")}</h3>
            <div className="grid grid-cols-2 gap-5">
              {/* INTER */}
              <div className="bg-emerald-900/30 rounded-lg p-5">
                <div className="text-xl text-emerald-300 font-bold mb-3">{CLIENTE.nombreCorto}</div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-lg">
                  <div className="flex justify-between"><span>{t("res_puerta")}</span><strong>{totalesEquipo.dpp}</strong></div>
                  <div className="flex justify-between"><span>{t("res_palo")}</span><strong>{totalesEquipo.dpa}</strong></div>
                  <div className="flex justify-between"><span>{t("res_fuera")}</span><strong>{totalesEquipo.dpf}</strong></div>
                  <div className="flex justify-between"><span>{t("res_bloqueados")}</span><strong>{totalesEquipo.dpb}</strong></div>
                </div>
                <div className="border-t border-emerald-700/50 mt-4 pt-3 flex justify-between text-emerald-200 text-2xl font-bold">
                  <span>{t("res_total")}</span>
                  <strong>{totalesEquipo.dpp+totalesEquipo.dpa+totalesEquipo.dpf+totalesEquipo.dpb}</strong>
                </div>
              </div>
              {/* RIVAL */}
              <div className="bg-red-900/30 rounded-lg p-5">
                <div className="text-xl text-red-300 font-bold mb-3">{cfg.rival}</div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-lg">
                  <div className="flex justify-between"><span>{t("res_puerta")}</span><strong>{partido.disparosRival.puerta}</strong></div>
                  <div className="flex justify-between"><span>{t("res_palo")}</span><strong>{partido.disparosRival.palo}</strong></div>
                  <div className="flex justify-between"><span>{t("res_fuera")}</span><strong>{partido.disparosRival.fuera}</strong></div>
                  <div className="flex justify-between"><span>{t("res_bloqueados")}</span><strong>{partido.disparosRival.bloqueado}</strong></div>
                </div>
                <div className="border-t border-red-700/50 mt-4 pt-3 flex justify-between text-red-200 text-2xl font-bold">
                  <span>{t("res_total")}</span>
                  <strong>{partido.disparosRival.puerta+partido.disparosRival.palo+partido.disparosRival.fuera+partido.disparosRival.bloqueado}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* SEGUNDA FILA — Pérdidas, Recuperaciones, Divididos del INTER */}
          <div className="bg-zinc-900 rounded-xl p-6">
            <h3 className="text-2xl font-bold text-zinc-300 mb-4">{t("res_stats_inter", { corto: CLIENTE.nombreCorto })}</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Pérdidas */}
              <div className="bg-red-900/30 rounded-lg p-5">
                <div className="text-xl text-red-300 font-bold mb-3">{t("res_perdidas")}</div>
                <div className="text-lg space-y-2">
                  <div className="flex justify-between"><span>{t("res_forzada")}</span><strong>{totalesEquipo.pf}</strong></div>
                  <div className="flex justify-between"><span>{t("res_no_forzada")}</span><strong>{totalesEquipo.pnf}</strong></div>
                  <div className="flex justify-between text-red-300/90"><span>{t("res_de_equipo")}</span><strong>{perdEquipo}</strong></div>
                  <div className="border-t border-red-700/50 mt-3 pt-3 flex justify-between text-red-200 text-xl font-bold">
                    <span>{t("res_total")}</span><strong>{totalesEquipo.pf+totalesEquipo.pnf+perdEquipo}</strong>
                  </div>
                </div>
              </div>
              {/* Recuperaciones */}
              <div className="bg-green-900/30 rounded-lg p-5">
                <div className="text-xl text-green-300 font-bold mb-3">{t("res_recuperaciones")}</div>
                <div className="text-lg space-y-2">
                  <div className="flex justify-between"><span>{t("res_robos")}</span><strong>{totalesEquipo.robos}</strong></div>
                  <div className="flex justify-between"><span>{t("res_cortes")}</span><strong>{totalesEquipo.cortes}</strong></div>
                  <div className="flex justify-between text-green-300/90"><span>{t("res_de_equipo")}</span><strong>{recEquipo}</strong></div>
                  <div className="border-t border-green-700/50 mt-3 pt-3 flex justify-between text-green-200 text-xl font-bold">
                    <span>{t("res_total")}</span><strong>{totalesEquipo.robos+totalesEquipo.cortes+recEquipo}</strong>
                  </div>
                </div>
              </div>
              {/* Balones divididos */}
              <div className="bg-purple-900/30 rounded-lg p-5">
                <div className="text-xl text-purple-300 font-bold mb-3">{t("res_divididos")}</div>
                <div className="text-lg space-y-2">
                  <div className="flex justify-between"><span>{t("res_ganados")}</span><strong>{totalesEquipo.bdg}</strong></div>
                  <div className="flex justify-between"><span>{t("res_no_ganados")}</span><strong>{totalesEquipo.bdp}</strong></div>
                  <div className="border-t border-purple-700/50 mt-3 pt-3 flex justify-between text-purple-200 text-xl font-bold">
                    <span>{t("res_ratio")}</span>
                    <strong>{(totalesEquipo.bdg + totalesEquipo.bdp) > 0
                      ? `${Math.round(totalesEquipo.bdg / (totalesEquipo.bdg + totalesEquipo.bdp) * 100)}%`
                      : "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ORDEN DE FALTAS DEL EQUIPO — quién comete la 1ª, 2ª, 3ª... falta
              de cada parte, para detectar tendencias (¿siempre el mismo hace la
              5ª?). El nº de orden se deriva ordenando las faltas INTER de la
              parte por tiempo. Pedido Arkaitz 10/8/2026. */}
          <div className="bg-zinc-900 rounded-xl p-5">
            <h3 className="text-lg font-bold text-zinc-300 mb-4">{t("res_orden_faltas")}</h3>
            {(() => {
              const partesConFaltas = partesJugadas.filter((p) =>
                partido.eventos.some((e) => e.tipo === "falta" && e.equipo === "INTER" && e.parte === p)
              );
              if (partesConFaltas.length === 0) {
                return <p className="text-base text-zinc-500">{t("res_sin_faltas")}</p>;
              }
              return (
                <div className="space-y-3">
                  {partesConFaltas.map((p) => {
                    const faltas = partido.eventos
                      .filter((e) => e.tipo === "falta" && e.equipo === "INTER" && e.parte === p)
                      .sort((a, b) => (a.segundosParte || 0) - (b.segundosParte || 0));
                    return (
                      <div key={p}>
                        <div className="text-sm text-zinc-500 mb-1.5">{p} · {faltas.length}</div>
                        <div className="flex flex-wrap gap-2">
                          {faltas.map((f: any, i) => {
                            const quien = f.jugador
                              ?? (f.sinAsignar ? t("sin_asignar") : (f.rivalMano ? t("mf_rival_mano") : "—"));
                            // 6ª falta en adelante = ya son de doble penalti (10 m).
                            const acumulada = i + 1 >= 6;
                            return (
                              <span key={f.id}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-base ${acumulada ? "bg-red-800" : "bg-zinc-800"}`}>
                                <strong className="font-mono text-zinc-400">{i + 1}</strong>
                                <span className="font-bold">{quien}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* CRONOLOGÍA DE GOLES */}
          <div className="bg-zinc-900 rounded-xl p-5">
            <h3 className="text-lg font-bold text-zinc-300 mb-4">{t("res_goles_partido")}</h3>
            {(() => {
              // Incluye goles normales (tipo "gol") Y los penaltis/10 m que
              // acabaron en GOL metidos por el botón PEN/10M (eventos
              // "penalti"/"diezm" SIN golId; los que tienen golId son el
              // gemelo auto-creado de un gol y ya van como "gol"). Se
              // normalizan a forma de gol (tirador→goleador, accion).
              const goles = eventosOrdenados
                .filter((ev: any) => ev.tipo === "gol"
                  || ((ev.tipo === "penalti" || ev.tipo === "diezm")
                      && ev.resultado === "GOL" && !ev.golId))
                .map((ev: any) => ev.tipo === "gol" ? ev : {
                  ...ev,
                  goleador: ev.tirador || ev.goleador || "",
                  accion: ev.tipo === "penalti" ? "Penalti" : "10 m",
                });
              if (goles.length === 0) {
                return <p className="text-base text-zinc-500">{t("res_sin_goles")}</p>;
              }
              return (
                <ol className="space-y-2">
                  {goles.map((ev: any) => {
                    const esInter = ev.equipo === "INTER";
                    const accion = ev.accion || "";
                    const m = ev.marcador;
                    const marcadorPostGol = m && typeof m.inter === "number"
                      ? `${m.inter + (esInter ? 1 : 0)}-${m.rival + (esInter ? 0 : 1)}`
                      : "";
                    // Cuarteto en pista (4 jugadores con el goleador): solo si INTER y se grabó
                    const cuarteto: string[] = Array.isArray(ev.cuarteto) ? ev.cuarteto : [];
                    return (
                      <li key={ev.id}
                        className={`p-4 rounded-lg ${
                          esInter ? "bg-green-900/25 border border-green-700/30"
                                  : "bg-red-900/25 border border-red-700/30"
                        }`}>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-zinc-400 text-base font-mono w-16 shrink-0">
                            {ev.parte} {formatMMSS(ev.segundosParte || 0)}
                          </span>
                          <span className={`text-base font-bold ${esInter ? "text-green-300" : "text-red-300"}`}>
                            {esInter ? "INTER" : cfg.rival}
                          </span>
                          {marcadorPostGol && (
                            <span className="text-base text-zinc-300 tabular-nums">
                              ({marcadorPostGol})
                            </span>
                          )}
                          {accion && (
                            <span className="text-lg font-semibold text-yellow-300 ml-auto">
                              {labelAccionGol(accion)}
                            </span>
                          )}
                        </div>
                        {esInter && (
                          <div className="text-xl">
                            <strong className="text-white">⚽ {ev.goleador}</strong>
                            {ev.asistente && (
                              <span className="text-zinc-300"> · {t("res_asist")} <strong>{ev.asistente}</strong></span>
                            )}
                            {(ev.zonaCampo || ev.zonaPorteria) && (
                              <div className="text-base text-zinc-400 mt-1">
                                {ev.zonaCampo && <span>{t("res_desde", { zona: ev.zonaCampo })}</span>}
                                {ev.zonaCampo && ev.zonaPorteria && " → "}
                                {ev.zonaPorteria && <span>{t("res_a_zona", { zona: ev.zonaPorteria })}</span>}
                              </div>
                            )}
                          </div>
                        )}
                        {!esInter && (
                          <div className="text-xl text-zinc-300">
                            {t("res_gol_rival")}
                            {ev.zonaPorteria && (
                              <span className="text-base text-zinc-400"> · {t("res_a_zona", { zona: ev.zonaPorteria })}</span>
                            )}
                          </div>
                        )}
                        {cuarteto.length > 0 && (
                          <div className="text-base text-zinc-300 mt-2 pt-2 border-t border-white/10">
                            <span className="text-base text-zinc-500 uppercase tracking-wide">{t("res_en_pista")}</span>
                            {" "}
                            {cuarteto.join(", ")}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              );
            })()}
          </div>

          {/* Tanda (si hubo) */}
          {huboTanda && (
            <div className="bg-zinc-900 rounded-xl p-4">
              <h3 className="text-base font-bold text-zinc-300 mb-2">{t("res_tanda_titulo")}</h3>
              <div className="text-base space-y-1">
                {tanda.tiros.map((ti) => (
                  <div key={ti.id} className="flex items-center gap-2">
                    <span className="text-zinc-500 w-6">#{ti.orden}</span>
                    <span className={ti.equipo === "INTER" ? "text-emerald-400" : "text-red-400"}>
                      {ti.equipo === "INTER" ? "INTER" : cfg.rival}
                    </span>
                    <span className="font-bold flex-1">{ti.tirador || "—"}</span>
                    <span className={ti.resultado === "GOL" ? "text-green-400 font-bold" : "text-yellow-400"}>
                      {labelResultadoDisparo(ti.resultado)}
                    </span>
                    {ti.zonaPorteria && <span className="text-base text-zinc-500">{ti.zonaPorteria}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: TIEMPOS */}
      {tab === "tiempos" && (
        <div className="bg-zinc-900 rounded-xl p-5 overflow-x-auto">
          <h3 className="text-lg font-bold text-zinc-300 mb-2">{t("res_tiempo_jugado")}</h3>
          <p className="text-base text-zinc-500 mb-4">
            {t("res_tiempo_nota")}
          </p>
          <table className="w-full text-xl">
            <thead className="text-lg text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="text-left py-3 px-3">{t("res_jugador")}</th>
                <th className="text-right px-3">{t("res_tiempos_total")}</th>
                {partesJugadas.map((p) => (
                  <th key={p} className="text-right px-3">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasTiempos.map((f) => {
                const colorFila = f.esPortero
                  ? "bg-zinc-800/30"
                  : colorSemaforoMin(f.total, maxMinJugados);
                return (
                  <tr key={f.nombre} className={`border-b border-zinc-900 ${colorFila}`}>
                    <td className="py-2.5 px-3">
                      <span className={`${f.esPortero ? "text-yellow-400" : ""} font-bold`}>
                        {f.nombre}
                      </span>
                      {f.enPista && <span className="ml-2 text-base bg-green-700 px-2 py-0.5 rounded">{t("res_en_pista_badge")}</span>}
                      {f.esPortero && <span className="ml-2 text-base text-zinc-500">🥅</span>}
                    </td>
                    <td className="text-right font-mono tabular-nums px-3 font-bold text-xl">
                      {formatMMSS(f.total)}
                    </td>
                    {partesJugadas.map((p) => (
                      <td key={p} className="text-right font-mono tabular-nums px-3 text-zinc-300">
                        {formatMMSS(f.porParte[p] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-base text-zinc-500 border-t border-zinc-800">
              <tr>
                <td className="pt-3 px-3 italic">{t("res_total_acumulado")}</td>
                <td className="text-right font-mono tabular-nums px-3 font-bold pt-3 text-lg">
                  {formatMMSS(filasTiempos.reduce((s, f) => s + f.total, 0))}
                </td>
                {partesJugadas.map((p) => (
                  <td key={p} className="text-right font-mono tabular-nums px-3 pt-3">
                    {formatMMSS(filasTiempos.reduce((s, f) => s + (f.porParte[p] ?? 0), 0))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TAB: INDIVIDUAL — bloques de colores */}
      {tab === "individual" && (
        <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
          <h3 className="text-lg font-bold text-zinc-300 mb-3">{t("res_stats_indiv")}</h3>
          <p className="text-base text-zinc-500 mb-4">
            {t("res_indiv_nota")}
          </p>
          <table className="text-base min-w-[780px] w-full">
            <thead className="text-base border-b border-zinc-700">
              <tr className="text-zinc-400">
                <th rowSpan={2} className="text-left py-2 px-2 align-bottom border-r border-zinc-800">{t("res_col_jug")}</th>
                <th colSpan={5} className="text-center px-1 bg-emerald-900/30 text-emerald-300 text-base font-bold">{t("res_col_disparos")}</th>
                <th colSpan={2} className="text-center px-1 bg-red-900/30 text-red-300 text-base font-bold">{t("res_col_perd")}</th>
                <th colSpan={2} className="text-center px-1 bg-green-900/30 text-green-300 text-base font-bold">{t("res_col_recup")}</th>
                <th colSpan={2} className="text-center px-1 bg-purple-900/30 text-purple-300 text-base font-bold">{t("res_col_div")}</th>
                <th colSpan={4} className="text-center px-1 bg-yellow-900/30 text-yellow-300 text-base font-bold">{t("res_col_goles")}</th>
              </tr>
              <tr className="text-zinc-500 text-base">
                <th className="text-center px-1 bg-emerald-900/10" title={t("res_title_puerta")}>{t("res_th_puer")}</th>
                <th className="text-center px-1 bg-emerald-900/10" title={t("res_title_palo")}>{t("res_th_palo")}</th>
                <th className="text-center px-1 bg-emerald-900/10" title={t("res_title_fuera")}>{t("res_th_fuera")}</th>
                <th className="text-center px-1 bg-emerald-900/10" title={t("res_title_bloqueado")}>{t("res_th_bloq")}</th>
                <th className="text-center px-1 bg-emerald-900/20 font-bold" title={t("res_title_total_disp")}>Σ</th>
                <th className="text-center px-1 bg-red-900/10" title={t("res_title_forzada")}>PF</th>
                <th className="text-center px-1 bg-red-900/10" title={t("res_title_no_forzada")}>PNF</th>
                <th className="text-center px-1 bg-green-900/10">{t("res_th_robos")}</th>
                <th className="text-center px-1 bg-green-900/10">{t("res_th_cortes")}</th>
                <th className="text-center px-1 bg-purple-900/10" title={t("res_title_ganados")}>BDG</th>
                <th className="text-center px-1 bg-purple-900/10" title={t("res_title_perdidos")}>BDP</th>
                <th className="text-center px-1 bg-yellow-900/10" title={t("res_title_goles_marcados")}>{t("res_abbr_g")}</th>
                <th className="text-center px-1 bg-yellow-900/10" title={t("res_title_asistencias")}>{t("res_abbr_a")}</th>
                <th className="text-center px-1 bg-yellow-900/10" title={t("res_title_gf")}>{t("res_abbr_gf")}</th>
                <th className="text-center px-1 bg-yellow-900/10" title={t("res_title_gc")}>{t("res_abbr_gc")}</th>
              </tr>
            </thead>
            <tbody>
              {filasIndiv.map(({ nombre, c, r, esPortero }) => {
                const sumDisp = (c?.dpp || 0) + (c?.dpa || 0) + (c?.dpf || 0) + (c?.dpb || 0);
                return (
                  <tr key={nombre} className="border-b border-zinc-800">
                    <td className={`py-2 px-2 border-r border-zinc-800 ${esPortero ? "text-yellow-400" : ""} font-bold text-lg`}>
                      {nombre}{esPortero ? " 🥅" : ""}
                    </td>
                    {/* Disparos */}
                    <td className="text-center font-mono tabular-nums px-1 bg-emerald-900/10">{c?.dpp ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-emerald-900/10">{c?.dpa ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-emerald-900/10">{c?.dpf ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-emerald-900/10">{c?.dpb ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-emerald-900/20 font-bold text-emerald-200 text-lg">{sumDisp}</td>
                    {/* Pérdidas */}
                    <td className="text-center font-mono tabular-nums px-1 bg-red-900/10">{c?.pf ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-red-900/10">{c?.pnf ?? 0}</td>
                    {/* Recuperaciones */}
                    <td className="text-center font-mono tabular-nums px-1 bg-green-900/10">{c?.robos ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-green-900/10">{c?.cortes ?? 0}</td>
                    {/* Divididos */}
                    <td className="text-center font-mono tabular-nums px-1 bg-purple-900/10">{c?.bdg ?? 0}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-purple-900/10">{c?.bdp ?? 0}</td>
                    {/* Goles + presencia */}
                    <td className="text-center font-mono tabular-nums px-1 bg-yellow-900/10 font-bold text-lg">{r.goles}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-yellow-900/10">{r.asistencias}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-yellow-900/10 text-green-400">+{r.gf}</td>
                    <td className="text-center font-mono tabular-nums px-1 bg-yellow-900/10 text-red-400">-{r.gc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-base text-zinc-500">
            {t("res_indiv_leyenda")}
          </div>
        </div>
      )}

      {/* TAB: CRONOGRAMA */}
      {tab === "cronograma" && (
        <Cronograma partido={partido} partesJugadas={partesJugadas} />
      )}

      {/* TAB: DISPAROS */}
      {tab === "disparos" && (
        <PestanaDisparos partido={partido} partesJugadas={partesJugadas} />
      )}

      {/* TAB: ANÁLISIS — datos derivados de los eventos del partido */}
      {tab === "analisis" && (
        <PestanaAnalisis partido={partido} partesJugadas={partesJugadas} />
      )}

      {/* TAB: EDITAR — edición post-partido (Fase 2) */}
      {tab === "editar" && (
        <EditorEventos partido={partido} partesJugadas={partesJugadas}
          editarEvento={editarEvento} borrarEvento={borrarEvento} anadirEvento={anadirEvento}
          recalcularMinutos={recalcularMinutos} setMinutosJugador={setMinutosJugador} />
      )}

      {/* FOOTER — acciones */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <button onClick={() => router.push("/partido")}
          className="py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-base">
          {t("res_volver_partido")}
        </button>
        <button onClick={() => exportarJSON(partido)}
          className="py-3 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-base font-bold">
          {t("res_exportar_json")}
        </button>
        <Link href="/"
          className="py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-base text-center">
          {t("inicio")}
        </Link>
      </div>
      <p className="text-[11px] text-zinc-600 mt-2 text-center">
        {t("res_footer_json")}
      </p>
    </div>
  );
}

// ─── Cronograma del partido ─────────────────────────────────────────────
// Timeline horizontal: arriba eventos (goles grandes, faltas/tarjetas medianos,
// disparos pequeños). Debajo, una tira por jugador con barras de "en pista".

// Nombres de parte traducidos. Se calcula con el idioma activo en el momento
// de render (los componentes de página llaman a useIdioma() → re-render).
function nombreParte(p: ParteId): string {
  return t(`parte_${p.toLowerCase()}`);
}

function Cronograma(props: { partido: Partido; partesJugadas: ParteId[] }) {
  const { partido, partesJugadas } = props;
  const cfg = partido.config!;

  // Filtro: "todo" muestra todas las partes juntas, o una sola parte.
  const [filtro, setFiltro] = useState<"todo" | ParteId>("todo");

  // duracionParte ya está EN SEGUNDOS (cfg.duracionParte[p] = 1200 para 20').
  // Calculamos offsets absolutos del partido COMPLETO (todas las partes jugadas).
  const duracionesAbs: Record<string, number> = {};
  const offsetsAbs: Record<string, number> = {};
  let totalAbs = 0;
  for (const p of partesJugadas) {
    offsetsAbs[p] = totalAbs;
    const d = cfg.duracionParte[p] ?? 0;
    duracionesAbs[p] = d;
    totalAbs += d;
  }
  if (totalAbs === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 text-zinc-400 text-center">
        {t("res_crono_sin_partes")}
      </div>
    );
  }

  // Ventana visible según el filtro.
  const winStart = filtro === "todo" ? 0 : offsetsAbs[filtro];
  const winEnd = filtro === "todo"
    ? totalAbs
    : offsetsAbs[filtro] + duracionesAbs[filtro];
  const winLen = winEnd - winStart;

  // Helper: segundo absoluto → % dentro de la ventana visible.
  const xPct = (xAbs: number) => ((xAbs - winStart) / winLen) * 100;
  // ¿Cae en la ventana?
  const enVentana = (xAbs: number) => xAbs >= winStart && xAbs <= winEnd;

  // Helper: pasar (parte, segParte) → x absoluto.
  const toAbs = (parte: ParteId, segParte: number): number =>
    (offsetsAbs[parte] ?? 0) + Math.min(segParte, duracionesAbs[parte] ?? 0);

  // ─── Reconstrucción de tramos por jugador ───
  // Recorremos eventos "cambio" para saber quién entró/salió en cada momento.
  type Tramo = { inicio: number; fin: number };
  const tramos: Record<string, Tramo[]> = {};
  const abierto: Record<string, number | null> = {};
  for (const j of cfg.convocados) {
    tramos[j] = [];
    abierto[j] = null;
  }
  // Plantilla inicial = 5 jugadores en pista desde t=0.
  const pi = cfg.pista_inicial || ({} as any);
  for (const j of [pi.portero, pi.pista1, pi.pista2, pi.pista3, pi.pista4]) {
    if (j && abierto[j] !== undefined) abierto[j] = 0;
  }
  const eventosOrden = [...partido.eventos].sort((a, b) => {
    const pa = partesJugadas.indexOf(a.parte);
    const pb = partesJugadas.indexOf(b.parte);
    if (pa !== pb) return pa - pb;
    return (a.segundosParte || 0) - (b.segundosParte || 0);
  });
  for (const ev of eventosOrden) {
    if (ev.tipo !== "cambio") continue;
    const t = toAbs(ev.parte, ev.segundosParte);
    const sale = (ev as any).sale as string;
    const entra = (ev as any).entra as string;
    if (sale && abierto[sale] != null) {
      tramos[sale].push({ inicio: abierto[sale]!, fin: t });
      abierto[sale] = null;
    }
    if (entra && abierto[entra] == null) {
      abierto[entra] = t;
    }
  }
  // Cerrar tramos abiertos al final del partido.
  for (const j of cfg.convocados) {
    if (abierto[j] != null) {
      tramos[j].push({ inicio: abierto[j]!, fin: totalAbs });
    }
  }

  // Orden de jugadores: porteros arriba, luego por minutos en pista descendente.
  const jugadoresOrden = [...cfg.convocados].sort((a, b) => {
    const ap = ROSTER.find((r) => r.nombre === a)?.posicion === "PORTERO";
    const bp = ROSTER.find((r) => r.nombre === b)?.posicion === "PORTERO";
    if (ap !== bp) return ap ? -1 : 1;
    const ta = tramos[a].reduce((s, t) => s + (t.fin - t.inicio), 0);
    const tb = tramos[b].reduce((s, t) => s + (t.fin - t.inicio), 0);
    return tb - ta;
  });

  // Eventos clasificados por importancia (afecta tamaño/altura del marcador).
  type Marca = { x: number; tipo: string; equipo: "INTER" | "RIVAL" | "—"; etiqueta: string; tooltip: string; clase: string; alturaPct: number };
  const marcas: Marca[] = [];
  for (const ev of eventosOrden) {
    const x = toAbs(ev.parte, ev.segundosParte);
    if (!enVentana(x)) continue;
    const eq = (ev as any).equipo as "INTER" | "RIVAL" | undefined;
    const colorEq = eq === "INTER" ? "bg-emerald-500" : eq === "RIVAL" ? "bg-red-500" : "bg-zinc-500";
    if (ev.tipo === "gol") {
      const jug = (ev as any).goleador || "—";
      marcas.push({
        x, tipo: "gol", equipo: eq || "—",
        etiqueta: "⚽",
        tooltip: `${formatMMSS(ev.segundosParte)} ${ev.parte} · ${t("res_crono_tt_gol")} ${eq === "INTER" ? NOMBRE_CORTO_TC : cfg.rival} (${jug})`,
        clase: `${colorEq} ring-2 ring-white/50`,
        alturaPct: 95,
      });
    } else if (ev.tipo === "amarilla" || ev.tipo === "roja") {
      const jug = (ev as any).jugador || "—";
      marcas.push({
        x, tipo: ev.tipo, equipo: eq || "—",
        etiqueta: ev.tipo === "amarilla" ? "🟨" : "🟥",
        tooltip: `${formatMMSS(ev.segundosParte)} ${ev.parte} · ${ev.tipo} ${eq === "INTER" ? jug : cfg.rival}`,
        clase: ev.tipo === "amarilla" ? "bg-yellow-500" : "bg-red-600",
        alturaPct: 70,
      });
    } else if (ev.tipo === "falta") {
      const jug = (ev as any).jugador || "—";
      marcas.push({
        x, tipo: "falta", equipo: eq || "—",
        etiqueta: "F",
        tooltip: `${formatMMSS(ev.segundosParte)} ${ev.parte} · ${t("res_crono_tt_falta")} ${eq === "INTER" ? NOMBRE_CORTO_TC + " (" + jug + ")" : cfg.rival}`,
        clase: `${colorEq} opacity-80`,
        alturaPct: 55,
      });
    } else if (ev.tipo === "disparo" || ev.tipo === "penalti" || ev.tipo === "diezm") {
      const jug = (ev as any).jugador || (ev as any).tirador || "—";
      const res = (ev as any).resultado || "";
      marcas.push({
        x, tipo: "disparo", equipo: eq || "—",
        etiqueta: "•",
        tooltip: `${formatMMSS(ev.segundosParte)} ${ev.parte} · ${t("res_crono_tt_disparo")} ${eq === "INTER" ? NOMBRE_CORTO_TC + " (" + jug + ")" : cfg.rival} → ${res}`,
        clase: `${colorEq} opacity-60`,
        alturaPct: 30,
      });
    }
  }

  // Render. Si filtro es una sola parte, no hace falta tanto ancho.
  const ANCHO_PX = filtro === "todo" ? 1400 : 900;

  // Partes que se solapan con la ventana visible (para etiquetas/divisores).
  const partesVisibles = partesJugadas.filter((p) => {
    const a = offsetsAbs[p];
    const b = a + duracionesAbs[p];
    return b > winStart && a < winEnd;
  });

  // Selector de filtro: solo ofrece partes con minutos > 0.
  const opcionesFiltro: Array<{ id: "todo" | ParteId; lbl: string }> = [
    { id: "todo", lbl: t("res_crono_todo") },
    ...partesJugadas.map((p) => ({ id: p, lbl: nombreParte(p) })),
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-base font-bold text-zinc-300">{t("res_crono_titulo")}</h3>
        <div className="flex gap-1 flex-wrap">
          {opcionesFiltro.map((o) => (
            <button key={o.id}
              onClick={() => setFiltro(o.id)}
              className={`px-3 py-1 rounded text-base font-semibold ${
                filtro === o.id ? "bg-emerald-700" : "bg-zinc-800 hover:bg-zinc-700"
              }`}>{o.lbl}</button>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-[11px] mb-2 text-zinc-400">
        <span><span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm align-middle mr-1"></span>{NOMBRE_CORTO_TC}</span>
        <span><span className="inline-block w-3 h-3 bg-red-500 rounded-sm align-middle mr-1"></span>{cfg.rival}</span>
        <span><span className="inline-block w-3 h-3 bg-emerald-600/70 rounded-sm align-middle mr-1"></span>{t("res_crono_tramo_pista")}</span>
        <span className="text-zinc-600">{t("res_crono_leyenda_iconos")}</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: ANCHO_PX }} className="relative">
          {/* Cada fila comparte layout: w-28 (label izda) + flex-1 (lienzo) + w-14 (label dcha).
              Así las verticales del lienzo coinciden entre eventos / jugadores / eje. */}

          {/* ── Banda de partes (etiquetas) ── */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-28 shrink-0" />
            <div className="relative flex-1 h-5 text-[10px] text-zinc-500">
            {partesVisibles.map((p) => {
              const a = Math.max(offsetsAbs[p], winStart);
              const b = Math.min(offsetsAbs[p] + duracionesAbs[p], winEnd);
              const dura = duracionesAbs[p];
              return (
                <div key={p}
                  className="absolute top-0 h-full border-l border-zinc-700 pl-1"
                  style={{ left: `${xPct(a)}%`, width: `${xPct(b) - xPct(a)}%` }}>
                  {nombreParte(p)} ({formatMMSS(dura)})
                </div>
              );
            })}
            </div>
            <div className="w-14 shrink-0" />
          </div>

          {/* ── Carril de EVENTOS ── */}
          <div className="flex items-center gap-2">
            <div className="w-28 shrink-0 text-[10px] text-zinc-500 text-right pr-1">{t("res_crono_eventos")}</div>
            <div className="relative flex-1 h-24 bg-zinc-950/60 border border-zinc-800 rounded">
            {/* divisores entre partes */}
            {partesVisibles.slice(1).map((p) => (
              <div key={p}
                className="absolute top-0 bottom-0 w-px bg-zinc-700/80"
                style={{ left: `${xPct(offsetsAbs[p])}%` }} />
            ))}
            {/* línea base */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-zinc-700/50" />
            {/* GUÍAS verticales para goles (cruzan hasta el carril de jugadores) */}
            {marcas.filter((m) => m.tipo === "gol").map((m, i) => (
              <div key={`g${i}`}
                className={`absolute top-0 bottom-0 w-px ${m.equipo === "INTER" ? "bg-emerald-500/40" : "bg-red-500/40"}`}
                style={{ left: `${xPct(m.x)}%` }} />
            ))}
            {/* marcas (asc por importancia para que las grandes queden arriba) */}
            {marcas.map((m, i) => {
              const top = m.tipo === "gol" ? "5%"
                        : (m.tipo === "amarilla" || m.tipo === "roja") ? "18%"
                        : m.tipo === "falta" ? "40%"
                        : "65%";
              const tamano = m.tipo === "gol" ? "w-6 h-6 text-base"
                          : (m.tipo === "amarilla" || m.tipo === "roja") ? "w-5 h-5 text-base"
                          : m.tipo === "falta" ? "w-4 h-4 text-[10px]"
                          : "w-2.5 h-2.5 text-[8px]";
              return (
                <div key={i}
                  title={m.tooltip}
                  className={`absolute -translate-x-1/2 rounded-full flex items-center justify-center font-bold text-white ${tamano} ${m.clase}`}
                  style={{ left: `${xPct(m.x)}%`, top }}>
                  {m.etiqueta}
                </div>
              );
            })}
            </div>
            <div className="w-14 shrink-0" />
          </div>

          {/* ── Carril de JUGADORES ── */}
          <div className="mt-3 space-y-0.5">
            {jugadoresOrden.map((j) => {
              const dorsal = ROSTER.find((r) => r.nombre === j)?.dorsal || "";
              const esPortero = ROSTER.find((r) => r.nombre === j)?.posicion === "PORTERO";
              const totalEnPista = tramos[j].reduce((s, t) => s + (t.fin - t.inicio), 0);
              return (
                <div key={j} className="flex items-center gap-2 text-[11px]">
                  <div className={`w-28 shrink-0 truncate ${esPortero ? "text-yellow-300" : "text-zinc-300"}`}>
                    {dorsal && <span className="text-zinc-500 mr-1">#{dorsal}</span>}
                    {j}{esPortero ? " 🥅" : ""}
                  </div>
                  <div className="relative flex-1 h-4 bg-zinc-950/40 border border-zinc-800 rounded">
                    {/* divisores partes (solo entre partes visibles) */}
                    {partesVisibles.slice(1).map((p) => (
                      <div key={p}
                        className="absolute top-0 bottom-0 w-px bg-zinc-700/60"
                        style={{ left: `${xPct(offsetsAbs[p])}%` }} />
                    ))}
                    {/* GUÍAS verticales de goles cruzando esta fila */}
                    {marcas.filter((m) => m.tipo === "gol").map((m, i) => (
                      <div key={`g${i}`}
                        className={`absolute top-0 bottom-0 w-px ${m.equipo === "INTER" ? "bg-emerald-500/40" : "bg-red-500/40"}`}
                        style={{ left: `${xPct(m.x)}%` }} />
                    ))}
                    {/* tramos en pista — clipados a la ventana visible */}
                    {tramos[j]
                      .map((t) => ({ ini: Math.max(t.inicio, winStart), fin: Math.min(t.fin, winEnd) }))
                      .filter((t) => t.fin > t.ini)
                      .map((t, i) => (
                        <div key={i}
                          title={`${formatMMSS(t.ini)} → ${formatMMSS(t.fin)} (${formatMMSS(t.fin - t.ini)})`}
                          className={`absolute top-0 bottom-0 ${esPortero ? "bg-yellow-600/70" : "bg-emerald-600/70"} rounded-sm`}
                          style={{ left: `${xPct(t.ini)}%`, width: `${xPct(t.fin) - xPct(t.ini)}%` }} />
                      ))}
                  </div>
                  <div className="w-14 shrink-0 text-right font-mono tabular-nums text-zinc-400">
                    {formatMMSS(totalEnPista)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* eje minutos (mm:ss, cada 5' dentro de cada parte) */}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-28 shrink-0" />
            <div className="relative flex-1 h-5 text-[9px] text-zinc-500">
            {partesVisibles.map((p) => {
              const inicioP = offsetsAbs[p];
              const marcasEje: number[] = [];
              for (let s = 0; s <= duracionesAbs[p]; s += 300) marcasEje.push(s);
              if (marcasEje[marcasEje.length - 1] !== duracionesAbs[p]) marcasEje.push(duracionesAbs[p]);
              return marcasEje.map((s) => {
                const xAbs = inicioP + s;
                if (xAbs < winStart || xAbs > winEnd) return null;
                return (
                  <div key={`${p}-${s}`}
                    className="absolute top-0 -translate-x-1/2 text-center"
                    style={{ left: `${xPct(xAbs)}%` }}>
                    <div className="w-px h-1 bg-zinc-600 mx-auto"></div>
                    <div className="font-mono tabular-nums">{formatMMSS(s)}</div>
                  </div>
                );
              });
            })}
            </div>
            <div className="w-14 shrink-0" />
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-zinc-500">
        {t("res_crono_nota")}
      </div>
    </div>
  );
}

// ─── Pestaña Disparos (zona campo + zona portería × parte × equipo) ─────

// Tipos de resultado de disparo posibles.
type ResD = "GOL" | "PUERTA" | "PALO" | "FUERA" | "BLOQUEADO";

// Color por resultado (consistente en mapas y tablas).
const COLOR_RES: Record<ResD, string> = {
  GOL:       "bg-emerald-500 text-white",
  PUERTA:    "bg-orange-500 text-white",   // a puerta pero NO gol → parada del portero
  PALO:      "bg-yellow-500 text-zinc-900",
  BLOQUEADO: "bg-zinc-500 text-white",
  FUERA:     "bg-red-500/70 text-white",
};
// Etiqueta de resultado traducida (OJO: PUERTA se muestra como "Parada"/"Save"
// en el contexto del resumen — disparo a puerta NO gol = parada del portero).
const CLAVE_LABEL_RES: Record<ResD, string> = {
  GOL: "resd_res_gol",
  PUERTA: "resd_res_parada",
  PALO: "resd_res_palo",
  BLOQUEADO: "resd_res_bloqueado",
  FUERA: "resd_res_fuera",
};
function labelRes(r: ResD): string {
  return t(CLAVE_LABEL_RES[r]);
}
// Orden estable de columnas.
const ORDEN_RES: ResD[] = ["GOL", "PUERTA", "PALO", "BLOQUEADO", "FUERA"];

// Zonas del campo (tal cual están en Campo.tsx — A1 a A11).
const ZONAS_CAMPO: string[] = ["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10","A11"];
// Zonas portería 3x3 (de arriba a abajo, de izda a dcha — vista atacante).
const ZONAS_PORT: string[][] = [
  ["P1","P2","P3"],
  ["P4","P5","P6"],
  ["P7","P8","P9"],
];

function PestanaDisparos(props: { partido: Partido; partesJugadas: ParteId[] }) {
  const { partido, partesJugadas } = props;
  const cfg = partido.config!;

  const [equipo, setEquipo] = useState<"INTER" | "RIVAL">("INTER");
  const [filtroParte, setFiltroParte] = useState<"todo" | ParteId>("todo");

  const partesFiltro: ParteId[] = filtroParte === "todo" ? partesJugadas : [filtroParte];

  // ─── Recolecto disparos del partido (incluye disparos directos, penaltis y 10m
  //     porque también acaban a puerta/gol/etc.) ───
  type Tiro = { equipo: "INTER" | "RIVAL"; parte: ParteId; res: ResD; zonaCampo?: string; zonaPort?: string };
  const tiros: Tiro[] = [];

  for (const ev of partido.eventos) {
    if (!partesFiltro.includes(ev.parte)) continue;
    const eq = (ev as any).equipo as "INTER" | "RIVAL" | undefined;
    if (!eq) continue;

    if (ev.tipo === "disparo") {
      // El resultado puede ser PUERTA y haber un golId enlazado → eso es GOL.
      const r = (ev as any).resultado as ResultadoDisparoLocal;
      const golId = (ev as any).golId as string | undefined;
      const res: ResD = golId ? "GOL"
        : r === "PUERTA" ? "PUERTA"
        : r === "PALO" ? "PALO"
        : r === "BLOQUEADO" ? "BLOQUEADO"
        : "FUERA";
      tiros.push({
        equipo: eq, parte: ev.parte, res,
        zonaCampo: (ev as any).zonaCampo,
        zonaPort: (ev as any).zonaPorteria,
      });
    } else if (ev.tipo === "penalti" || ev.tipo === "diezm") {
      const r = (ev as any).resultado as "GOL" | "PARADA" | "POSTE" | "FUERA";
      const res: ResD = r === "GOL" ? "GOL"
        : r === "PARADA" ? "PUERTA"
        : r === "POSTE" ? "PALO"
        : "FUERA";
      tiros.push({
        equipo: eq, parte: ev.parte, res,
        zonaCampo: undefined,
        zonaPort: (ev as any).zonaPorteria,
      });
    }
  }

  const tirosEq = tiros.filter((t) => t.equipo === equipo);

  // Conteo total por resultado.
  const totalesRes: Record<ResD, number> = { GOL: 0, PUERTA: 0, PALO: 0, BLOQUEADO: 0, FUERA: 0 };
  for (const t of tirosEq) totalesRes[t.res]++;
  const totalTiros = tirosEq.length;

  // Conteo por zona campo × resultado.
  type ContZona = Record<ResD, number> & { total: number };
  const contCampo: Record<string, ContZona> = {};
  for (const z of ZONAS_CAMPO) {
    contCampo[z] = { GOL: 0, PUERTA: 0, PALO: 0, BLOQUEADO: 0, FUERA: 0, total: 0 };
  }
  for (const t of tirosEq) {
    if (!t.zonaCampo || !contCampo[t.zonaCampo]) continue;
    contCampo[t.zonaCampo][t.res]++;
    contCampo[t.zonaCampo].total++;
  }
  // Conteo por zona portería × resultado (solo eventos que apuntan a puerta tienen zonaPort).
  const contPort: Record<string, ContZona> = {};
  for (const fila of ZONAS_PORT) for (const z of fila) {
    contPort[z] = { GOL: 0, PUERTA: 0, PALO: 0, BLOQUEADO: 0, FUERA: 0, total: 0 };
  }
  for (const t of tirosEq) {
    if (!t.zonaPort || !contPort[t.zonaPort]) continue;
    contPort[t.zonaPort][t.res]++;
    contPort[t.zonaPort].total++;
  }
  const maxPort = Math.max(1, ...Object.values(contPort).map((c) => c.total));

  // Disparos sin zona campo (no se localizaron al apuntar).
  const sinZonaCampo = tirosEq.filter((t) => !t.zonaCampo).length;
  const sinZonaPort = tirosEq.filter((t) => !t.zonaPort).length;

  // Filas: una por parte, columnas = resultados.
  const conteoPorParte: Array<{ p: ParteId | "TOTAL"; counts: Record<ResD, number>; total: number }> = [];
  for (const p of partesJugadas) {
    const tt = tirosEq.filter((t) => t.parte === p);
    if (filtroParte !== "todo" && p !== filtroParte) continue;
    const counts: Record<ResD, number> = { GOL: 0, PUERTA: 0, PALO: 0, BLOQUEADO: 0, FUERA: 0 };
    for (const t of tt) counts[t.res]++;
    conteoPorParte.push({ p, counts, total: tt.length });
  }
  // Fila total.
  conteoPorParte.push({
    p: "TOTAL",
    counts: totalesRes,
    total: totalTiros,
  });

  // ─── Render ───
  return (
    <div className="space-y-4">
      {/* Selectores: equipo + parte */}
      <div className="bg-zinc-900 rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          <button onClick={() => setEquipo("INTER")}
            className={`px-4 py-2 rounded text-base font-bold ${equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800 hover:bg-zinc-700"}`}>
            {NOMBRE_CORTO_TC}
          </button>
          <button onClick={() => setEquipo("RIVAL")}
            className={`px-4 py-2 rounded text-base font-bold ${equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800 hover:bg-zinc-700"}`}>
            {cfg.rival}
          </button>
        </div>
        <div className="text-zinc-500 text-base">·</div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFiltroParte("todo")}
            className={`px-3 py-1.5 rounded text-base font-semibold ${filtroParte === "todo" ? "bg-zinc-600" : "bg-zinc-800 hover:bg-zinc-700"}`}>{t("res_crono_todo")}</button>
          {partesJugadas.map((p) => (
            <button key={p} onClick={() => setFiltroParte(p)}
              className={`px-3 py-1.5 rounded text-base font-semibold ${filtroParte === p ? "bg-zinc-600" : "bg-zinc-800 hover:bg-zinc-700"}`}>
              {nombreParte(p)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-base text-zinc-400">
          <strong className="text-xl text-white tabular-nums">{totalTiros}</strong> {t("resd_disparos_lbl")}
        </div>
      </div>

      {/* Resumen por parte */}
      <div className="bg-zinc-900 rounded-xl p-3">
        <h3 className="text-base font-bold text-zinc-300 mb-2">{t("resd_resumen_parte")}</h3>
        <table className="text-base w-full">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="text-left py-1 px-2">{t("resd_parte")}</th>
              {ORDEN_RES.map((r) => (
                <th key={r} className={`text-center px-2 py-1 ${COLOR_RES[r].replace("bg-", "text-").replace("text-zinc-900", "text-zinc-300")}`}>
                  {labelRes(r)}
                </th>
              ))}
              <th className="text-right px-2 py-1">{t("resd_total")}</th>
            </tr>
          </thead>
          <tbody>
            {conteoPorParte.map(({ p, counts, total }) => (
              <tr key={p} className={`border-b border-zinc-800 ${p === "TOTAL" ? "font-bold bg-zinc-800/40" : ""}`}>
                <td className="py-1.5 px-2">{p === "TOTAL" ? "TOTAL" : nombreParte(p as ParteId)}</td>
                {ORDEN_RES.map((r) => (
                  <td key={r} className="text-center font-mono tabular-nums px-2 py-1.5">
                    {counts[r] || ""}
                  </td>
                ))}
                <td className="text-right font-mono tabular-nums px-2 py-1.5 text-emerald-200">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-zinc-500 mt-2">
          {t("resd_leyenda")}
        </p>
      </div>

      {/* Mapa campo (SVG real) */}
      <div className="bg-zinc-900 rounded-xl p-3">
        <h3 className="text-base font-bold text-zinc-300 mb-2">{t("resd_mapa_campo")}</h3>
        <p className="text-[11px] text-zinc-500 mb-2">
          {t("resd_mapa_campo_nota")}
        </p>
        <div className="max-w-3xl mx-auto">
          <CampoConteos
            conteos={contCampo}
            direccion={direccionAtaque("1T", equipo, cfg)}
            nombreAtacante={equipo === "INTER" ? NOMBRE_CORTO_TC : cfg.rival} />
        </div>
        {sinZonaCampo > 0 && (
          <p className="text-[10px] text-zinc-500 mt-2 italic text-center">
            {t("resd_sin_zona_campo", { n: sinZonaCampo })}
          </p>
        )}
      </div>

      {/* Mapa portería 3x3 */}
      <div className="bg-zinc-900 rounded-xl p-3">
        <h3 className="text-base font-bold text-zinc-300 mb-2">{t("resd_mapa_porteria")}</h3>
        <p className="text-[11px] text-zinc-500 mb-2">
          {t("resd_mapa_porteria_nota")}
        </p>
        <div className="mx-auto max-w-md">
          <div className="aspect-[5/3] border-4 border-white/80 rounded-md p-1 bg-zinc-800/50">
            <div className="grid grid-cols-3 grid-rows-3 gap-1 h-full">
              {ZONAS_PORT.flat().map((z) => {
                const c = contPort[z];
                const pct = c.total / maxPort;
                const op = c.total === 0 ? 0.1 : 0.25 + 0.6 * pct;
                const tooltip = c.total === 0 ? t("resd_sin_disparos_zona")
                  : `${z}: ${c.total} · ${ORDEN_RES.filter((r) => c[r]).map((r) => `${labelRes(r)}: ${c[r]}`).join(" · ")}`;
                // Color base: si hay GOL en esta zona, dominante verde; si no, naranja (paradas) o gris.
                const dominante: ResD | null = c.GOL > 0 ? "GOL" : c.PUERTA > 0 ? "PUERTA" : c.PALO > 0 ? "PALO" : c.BLOQUEADO > 0 ? "BLOQUEADO" : c.FUERA > 0 ? "FUERA" : null;
                const rgb = dominante === "GOL" ? "16,185,129"
                          : dominante === "PUERTA" ? "249,115,22"
                          : dominante === "PALO" ? "234,179,8"
                          : dominante === "BLOQUEADO" ? "113,113,122"
                          : dominante === "FUERA" ? "239,68,68"
                          : "100,116,139";
                return (
                  <div key={z}
                    title={tooltip}
                    className="rounded relative flex flex-col items-center justify-center border border-white/20 py-2"
                    style={{ background: `rgba(${rgb},${op})` }}>
                    <span className="text-4xl font-bold tabular-nums leading-none">{c.total || ""}</span>
                    {c.total > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center mt-1.5">
                        {ORDEN_RES.map((r) => c[r] > 0 && (
                          <span key={r} className={`${COLOR_RES[r]} text-base px-1.5 py-0.5 rounded font-bold`}>
                            {labelRes(r).charAt(0)}{c[r]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {sinZonaPort > 0 && (
          <p className="text-[10px] text-zinc-500 mt-2 italic text-center">
            {t("resd_sin_zona_porteria", {
              n: sinZonaPort,
              extra: equipo === "RIVAL" ? t("resd_sin_zona_porteria_rival") : "",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// Alias local para no chocar con el tipo de db.ts en el archivo.
type ResultadoDisparoLocal = "PUERTA" | "PALO" | "FUERA" | "BLOQUEADO";

// ─── Helper de exportación ──────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// PESTAÑA ANÁLISIS — datos derivados de los eventos del partido
// ────────────────────────────────────────────────────────────────

function PestanaAnalisis(props: { partido: Partido; partesJugadas: ParteId[] }) {
  const { partido, partesJugadas } = props;
  const cfg = partido.config!;
  const evs = partido.eventos;

  // ── 1) Quintetos iniciales por parte ──────────────────────────
  // Para 1T: cfg.pista_inicial.
  // Para partes posteriores: reconstruir aplicando todos los cambios
  // de las partes anteriores al enPista inicial.
  const quintetoInicialParte = (parte: ParteId): string[] => {
    const inicial = [
      cfg.pista_inicial.portero,
      cfg.pista_inicial.pista1,
      cfg.pista_inicial.pista2,
      cfg.pista_inicial.pista3,
      cfg.pista_inicial.pista4,
    ];
    if (parte === "1T") return inicial;
    const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
    const idxActual = PARTES.indexOf(parte);
    const partesPrevias = PARTES.slice(0, idxActual);
    const pista = [...inicial];
    // Aplicar cambios en orden cronológico de las partes previas
    const cambiosPrevios = evs
      .filter((e: any) => e.tipo === "cambio" && partesPrevias.includes(e.parte as ParteId))
      .sort((a: any, b: any) => (a.segundosPartido || 0) - (b.segundosPartido || 0));
    for (const c of cambiosPrevios as any[]) {
      const i = pista.indexOf(c.sale);
      if (i === -1) continue;
      if (c.entra === "") pista.splice(i, 1);
      else pista.splice(i, 1, c.entra);
    }
    return pista;
  };

  // ── 2) Asistencias por jugador (y pareja goleador-asistente más frecuente)
  const asistenciasPorJugador: Record<string, number> = {};
  const parejas: Record<string, number> = {};
  for (const e of evs as any[]) {
    if (e.tipo === "gol" && e.equipo === "INTER" && e.asistente) {
      asistenciasPorJugador[e.asistente] = (asistenciasPorJugador[e.asistente] || 0) + 1;
      const key = `${e.asistente}→${e.goleador}`;
      parejas[key] = (parejas[key] || 0) + 1;
    }
  }
  const topAsistentes = Object.entries(asistenciasPorJugador)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topParejas = Object.entries(parejas)
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── 3) Eficiencia ofensiva por jugador (sobre acciones.porJugador) ──
  type EficiencaRow = {
    nombre: string; disparos: number; puerta: number;
    goles: number; efectividad: number; punteria: number;
  };
  const efic: EficiencaRow[] = [];
  for (const nombre of cfg.convocados) {
    const c = partido.acciones?.porJugador?.[nombre];
    if (!c) continue;
    const disparos = (c.dpp || 0) + (c.dpa || 0) + (c.dpf || 0) + (c.dpb || 0);
    if (disparos === 0) continue;
    const puerta = c.dpp || 0;
    // Goles del jugador: contamos eventos gol con goleador = nombre
    const goles = evs.filter((e: any) =>
      e.tipo === "gol" && e.equipo === "INTER" && e.goleador === nombre
    ).length;
    efic.push({
      nombre,
      disparos,
      puerta,
      goles,
      efectividad: disparos > 0 ? (goles / disparos) * 100 : 0,
      punteria: disparos > 0 ? (puerta / disparos) * 100 : 0,
    });
  }
  efic.sort((a, b) => b.disparos - a.disparos);

  // ── 4) Cuartetos más letales (combinaciones de 4 sin portero) ──
  // Para cada gol INTER, miramos el cuarteto que estaba en pista
  // (excluyendo portero). Sumamos +1 a favor. Para goles RIVAL,
  // -1 al cuarteto que estaba en pista. Output: top 5 por +/- neto
  // con MÍNIMO 2 goles totales para que sea relevante.
  const cuartetos: Record<string, { gf: number; gc: number; jugadores: string[] }> = {};
  const idPortero = new Set(
    cfg.convocados.filter((n) => {
      const j = ROSTER.find((r) => r.nombre === n);
      return j?.posicion === "PORTERO";
    })
  );
  for (const e of evs as any[]) {
    if (e.tipo !== "gol") continue;
    const cuarteto: string[] = Array.isArray(e.cuarteto) ? e.cuarteto : [];
    if (cuarteto.length === 0) continue;
    // Excluir porteros del cuarteto
    const soloCampo = cuarteto.filter((n) => !idPortero.has(n));
    if (soloCampo.length !== 4) continue;
    const key = [...soloCampo].sort().join(" + ");
    if (!cuartetos[key]) {
      cuartetos[key] = { gf: 0, gc: 0, jugadores: [...soloCampo].sort() };
    }
    if (e.equipo === "INTER") cuartetos[key].gf++;
    else cuartetos[key].gc++;
  }
  const topCuartetos = Object.entries(cuartetos)
    .map(([k, v]) => ({ key: k, jugadores: v.jugadores, gf: v.gf, gc: v.gc, plus: v.gf - v.gc }))
    .filter((c) => c.gf + c.gc >= 1)
    .sort((a, b) => b.plus - a.plus)
    .slice(0, 5);

  // ── 5) Transiciones (recuperación → gol nuestro / pérdida → gol rival)
  // Ventana de 20 segundos.
  const evsOrdenados = [...evs].sort(
    (a: any, b: any) => (a.segundosPartido || 0) - (b.segundosPartido || 0)
  );
  let recuperaciones = 0, recupAGol = 0;
  let perdidas = 0, perdidasAGol = 0;
  for (let i = 0; i < evsOrdenados.length; i++) {
    const e = evsOrdenados[i] as any;
    if (e.tipo === "accion_individual") {
      const t = e.segundosPartido || 0;
      if (e.accion === "robos" || e.accion === "cortes") {
        recuperaciones++;
        // Buscar gol nuestro en los próximos 20s
        for (let j = i + 1; j < evsOrdenados.length; j++) {
          const e2 = evsOrdenados[j] as any;
          if ((e2.segundosPartido || 0) - t > 20) break;
          if (e2.tipo === "gol" && e2.equipo === "INTER") {
            recupAGol++;
            break;
          }
        }
      } else if (e.accion === "pf" || e.accion === "pnf") {
        perdidas++;
        for (let j = i + 1; j < evsOrdenados.length; j++) {
          const e2 = evsOrdenados[j] as any;
          if ((e2.segundosPartido || 0) - t > 20) break;
          if (e2.tipo === "gol" && e2.equipo === "RIVAL") {
            perdidasAGol++;
            break;
          }
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* 1) Quintetos iniciales */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-xl font-bold text-zinc-300 mb-3">{t("resa_quintetos")}</h3>
        <p className="text-base text-zinc-500 mb-3">
          {t("resa_quintetos_nota")}
        </p>
        <div className="grid grid-cols-1 gap-3">
          {partesJugadas.map((p) => {
            const q = quintetoInicialParte(p);
            return (
              <div key={p} className="bg-zinc-950 rounded-lg p-3">
                <div className="text-base text-emerald-300 font-bold mb-2">{p}</div>
                <div className="flex flex-wrap gap-2">
                  {q.length === 0 ? (
                    <span className="text-zinc-500 text-base italic">{t("resa_sin_datos")}</span>
                  ) : (
                    q.map((n, i) => (
                      <span key={`${n}-${i}`}
                        className={`px-2.5 py-1 rounded text-base font-semibold ${
                          idPortero.has(n) ? "bg-yellow-700" : "bg-emerald-800"
                        }`}>
                        {n || "—"}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2) Asistencias */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-xl font-bold text-zinc-300 mb-3">{t("resa_asistencias")}</h3>
        {topAsistentes.length === 0 ? (
          <p className="text-base text-zinc-500 italic">{t("resa_sin_asistencias")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {topAsistentes.map(([n, c]) => (
                <div key={n} className="flex justify-between bg-zinc-950 rounded px-3 py-2">
                  <span className="font-bold">{n}</span>
                  <span className="text-emerald-300 font-mono">{c}</span>
                </div>
              ))}
            </div>
            {topParejas.length > 0 && (
              <>
                <h4 className="text-base font-bold text-zinc-400 mt-3 mb-2">{t("resa_parejas")}</h4>
                <ul className="space-y-1 text-base">
                  {topParejas.map(([k, n]) => (
                    <li key={k} className="flex justify-between bg-zinc-950 rounded px-3 py-1">
                      <span>{k}</span><strong className="text-emerald-300">{n}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* 3) Eficiencia ofensiva */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-xl font-bold text-zinc-300 mb-3">{t("resa_eficiencia")}</h3>
        {efic.length === 0 ? (
          <p className="text-base text-zinc-500 italic">{t("resa_sin_disparos")}</p>
        ) : (
          <table className="w-full text-base">
            <thead className="text-base text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-2">{t("res_jugador")}</th>
                <th className="text-right px-2">{t("resa_disparos")}</th>
                <th className="text-right px-2">{t("resa_a_puerta")}</th>
                <th className="text-right px-2">{t("resa_goles")}</th>
                <th className="text-right px-2" title={t("resa_title_pct_gol")}>{t("resa_pct_gol")}</th>
                <th className="text-right px-2" title={t("resa_title_pct_puerta")}>{t("resa_pct_puerta")}</th>
              </tr>
            </thead>
            <tbody>
              {efic.map((f) => (
                <tr key={f.nombre} className="border-b border-zinc-900">
                  <td className="py-1.5 px-2 font-bold">{f.nombre}</td>
                  <td className="text-right font-mono tabular-nums px-2">{f.disparos}</td>
                  <td className="text-right font-mono tabular-nums px-2">{f.puerta}</td>
                  <td className="text-right font-mono tabular-nums px-2 text-emerald-300 font-bold">{f.goles}</td>
                  <td className="text-right font-mono tabular-nums px-2">{f.efectividad.toFixed(0)}%</td>
                  <td className="text-right font-mono tabular-nums px-2">{f.punteria.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4) Cuartetos */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-xl font-bold text-zinc-300 mb-3">{t("resa_cuartetos")}</h3>
        {topCuartetos.length === 0 ? (
          <p className="text-base text-zinc-500 italic">
            {t("resa_sin_cuartetos")}
          </p>
        ) : (
          <div className="space-y-2">
            {topCuartetos.map((c) => (
              <div key={c.key}
                className={`rounded-lg p-3 ${
                  c.plus > 0 ? "bg-emerald-900/30 border border-emerald-700/30"
                  : c.plus < 0 ? "bg-red-900/30 border border-red-700/30"
                  : "bg-zinc-800"
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-base">{c.jugadores.join(" · ")}</span>
                  <span className={`font-mono font-bold ${
                    c.plus > 0 ? "text-emerald-300" : c.plus < 0 ? "text-red-300" : ""
                  }`}>
                    +{c.gf} −{c.gc} = {c.plus > 0 ? "+" : ""}{c.plus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5) Transiciones */}
      <div className="bg-zinc-900 rounded-xl p-5">
        <h3 className="text-xl font-bold text-zinc-300 mb-3">{t("resa_transiciones")}</h3>
        <p className="text-base text-zinc-500 mb-3">
          {t("resa_transiciones_nota")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-900/30 rounded-lg p-4">
            <div className="text-base text-green-300 mb-1">{t("resa_recup_gol")}</div>
            <div className="text-4xl font-bold tabular-nums">
              {recuperaciones === 0 ? "—" : `${Math.round((recupAGol / recuperaciones) * 100)}%`}
            </div>
            <div className="text-base text-zinc-400 mt-1">
              {t("resa_recup_de", { a: recupAGol, b: recuperaciones })}
            </div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4">
            <div className="text-base text-red-300 mb-1">{t("resa_perdida_gol")}</div>
            <div className="text-4xl font-bold tabular-nums">
              {perdidas === 0 ? "—" : `${Math.round((perdidasAGol / perdidas) * 100)}%`}
            </div>
            <div className="text-base text-zinc-400 mt-1">
              {t("resa_perdidas_de", { a: perdidasAGol, b: perdidas })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function exportarJSON(partido: any) {
  try {
    const blob = new Blob([JSON.stringify(partido, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const pid = partido.config?.partido_id || "partido";
    const fecha = partido.config?.fecha || new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${fecha}_${pid}_crono.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(t("res_export_error", { detalle: String(e) }));
  }
}
