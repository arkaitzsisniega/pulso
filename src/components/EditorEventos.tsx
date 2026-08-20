"use client";

/**
 * EditorEventos — modo edición POST-PARTIDO (Fase 2).
 *
 * Lista cronológica de TODAS las acciones del partido. Cada una se puede:
 *   - editar (jugador, tipo, zona, minuto, parte, equipo, resultado…),
 *   - borrar,
 *   - y se pueden añadir nuevas.
 * Todo pasa por editarEvento/borrarEvento/anadirEvento del store, que
 * RE-DERIVAN marcador y estadísticas desde la lista (reconstruir.ts). El
 * usuario no ve recálculos manuales: el marcador del resumen se actualiza solo.
 *
 * Nota minutos (opción D): editar sustituciones aún no recalcula los minutos
 * por jugador; se avisa en la UI. Esa pieza llega aparte.
 */
import { useState } from "react";
import type { Partido, Evento, ParteId } from "@/lib/db";
import { ROSTER, PORTEROS, NOMBRE_CORTO_TC } from "@/lib/clientes";
import { formatMMSS } from "@/lib/utils";
import { t, labelAccionGol, labelResultadoDisparo } from "@/lib/i18n";
import { Campo } from "@/components/Campo";
import { Porteria } from "@/components/Porteria";

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
const TIPOS: Evento["tipo"][] = [
  "gol", "disparo", "falta", "amarilla", "roja", "tiempo_muerto",
  "penalti", "diezm", "cambio", "accion_individual",
];
const ACCIONES_GOL = [
  "Córner", "Banda", "Falta", "5x4", "4x5", "4x3", "3x4", "Contraataque",
  "Robo zona alta", "Salida de presión", "1x1 banda", "Ataque posicional",
  "10m", "Penalti", "2ª jugada", "Otra",
];
const RES_DISPARO = ["PUERTA", "PALO", "FUERA", "BLOQUEADO"];
const RES_PENALTI = ["GOL", "PARADA", "POSTE", "FUERA"];
const ACCIONES_IND = ["pf", "pnf", "robos", "cortes", "bdg", "bdp"];

const NOMBRES = ROSTER.map((j) => j.nombre);
const NOMBRES_PORTERO = PORTEROS.map((j) => j.nombre);

function emoji(tipo: Evento["tipo"]): string {
  return { gol: "⚽", falta: "⚠️", amarilla: "🟨", roja: "🟥", tiempo_muerto: "🛑",
    cambio: "🔄", disparo: "🎯", penalti: "🥅", diezm: "📌", accion_individual: "👤",
    incorporacion_rival: "🧤" }[tipo] ?? "•";
}

function mmssASeg(s: string): number {
  const txt = (s || "").trim();
  if (txt.includes(":")) {
    const [m, sec] = txt.split(":");
    return Math.max(0, (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0));
  }
  return Math.max(0, parseInt(txt, 10) || 0);
}

type Draft = Record<string, any>;

export function EditorEventos(props: {
  partido: Partido;
  partesJugadas: ParteId[];
  editarEvento: (id: string, cambios: Partial<Evento>) => void;
  borrarEvento: (id: string) => void;
  anadirEvento: (datos: Omit<Evento, "id" | "segundosPartido" | "timestampReal" | "marcador">) => void;
  recalcularMinutos: () => void;
  setMinutosJugador: (nombre: string, porParte: Record<ParteId, number>) => void;
}) {
  const { partido, partesJugadas } = props;
  const rival = partido.config?.rival ?? "RIVAL";
  const partes = partesJugadas.length ? partesJugadas : (["1T", "2T"] as ParteId[]);
  const convocados = partido.config?.convocados ?? [];
  const [recalcKey, setRecalcKey] = useState(0);

  const [draft, setDraft] = useState<Draft | null>(null);   // edición/añadido en curso
  const [esNuevo, setEsNuevo] = useState(false);
  const [minStr, setMinStr] = useState("00:00");
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [zonaPicker, setZonaPicker] = useState<null | "campo" | "porteria">(null);

  const eventos = [...partido.eventos].sort((a, b) => {
    const dp = PARTES.indexOf(a.parte) - PARTES.indexOf(b.parte);
    if (dp !== 0) return dp;
    return (a.segundosParte || 0) - (b.segundosParte || 0);
  });

  const equipoTxt = (e?: string) => (e === "INTER" ? NOMBRE_CORTO_TC : rival);

  function descripcion(ev: Evento): string {
    const e = (ev as any).equipo as string | undefined;
    switch (ev.tipo) {
      case "gol": return `${equipoTxt(e)} · ${ev.goleador || "?"}${ev.accion ? ` (${labelAccionGol(ev.accion)})` : ""}`;
      case "falta": return `${equipoTxt(e)}${ev.jugador ? " · " + ev.jugador : ""}`;
      case "amarilla":
      case "roja": return `${equipoTxt(e)}${ev.jugador ? " · " + ev.jugador : ""}`;
      case "tiempo_muerto": return equipoTxt(e);
      case "cambio": return `${ev.sale || "—"} → ${ev.entra || "—"}`;
      case "disparo": return `${equipoTxt(e)}${ev.jugador ? " · " + ev.jugador : ""} · ${labelResultadoDisparo(ev.resultado)}`;
      case "penalti":
      case "diezm": return `${equipoTxt(e)}${ev.tirador ? " · " + ev.tirador : ""} · ${ev.resultado}`;
      case "accion_individual": return `${ev.jugador} · ${ev.accion.toUpperCase()}`;
      default: return "";
    }
  }

  function abrirEditar(ev: Evento) {
    setEsNuevo(false);
    setDraft({ ...ev });
    setMinStr(formatMMSS(ev.segundosParte || 0));
  }

  function abrirNuevo() {
    setEsNuevo(true);
    setDraft(nuevoDraft("gol", partes[0]));
    setMinStr("00:00");
  }

  function nuevoDraft(tipo: Evento["tipo"], parte: ParteId): Draft {
    const base: Draft = { tipo, parte, segundosParte: 0 };
    if (tipo === "gol") return { ...base, equipo: "INTER", goleador: "", asistente: "", accion: "", cuarteto: [] };
    if (tipo === "falta") return { ...base, equipo: "INTER", jugador: "" };
    if (tipo === "amarilla" || tipo === "roja") return { ...base, equipo: "INTER", jugador: "" };
    if (tipo === "tiempo_muerto") return { ...base, equipo: "INTER" };
    if (tipo === "disparo") return { ...base, equipo: "INTER", jugador: "", resultado: "PUERTA" };
    if (tipo === "penalti" || tipo === "diezm") return { ...base, equipo: "INTER", tirador: "", portero: "", resultado: "GOL" };
    if (tipo === "cambio") return { ...base, sale: "", entra: "" };
    if (tipo === "accion_individual") return { ...base, jugador: NOMBRES[0] ?? "", accion: "robos" };
    return base;
  }

  function guardar() {
    if (!draft) return;
    const seg = mmssASeg(minStr);
    const datos: Draft = { ...draft, segundosParte: seg };
    if (esNuevo) {
      props.anadirEvento(datos as any);
    } else {
      const { id, ...cambios } = datos;
      props.editarEvento(id, { ...cambios, segundosPartido: seg } as Partial<Evento>);
    }
    setDraft(null);
  }

  // ── helpers de UI ────────────────────────────────────────────────────────
  const lblCls = "block text-xs text-zinc-400 mb-1";
  const inputCls = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-base";

  function Campo2<T extends string>(p: { label: string; value: string | undefined; onChange: (v: string) => void; opciones: { v: string; lbl: string }[] }) {
    return (
      <label className="block">
        <span className={lblCls}>{p.label}</span>
        <select className={inputCls} value={p.value ?? ""} onChange={(e) => p.onChange(e.target.value)}>
          {p.opciones.map((o) => <option key={o.v} value={o.v}>{o.lbl}</option>)}
        </select>
      </label>
    );
  }

  const optEquipo = [{ v: "INTER", lbl: NOMBRE_CORTO_TC }, { v: "RIVAL", lbl: rival }];
  const optJugador = (conVacio: boolean) =>
    (conVacio ? [{ v: "", lbl: t("sin_asignar_min") }] : []).concat(NOMBRES.map((n) => ({ v: n, lbl: n })));
  const optPortero = [{ v: "", lbl: t("sin_asignar_min") }].concat(NOMBRES_PORTERO.map((n) => ({ v: n, lbl: n })));

  function ZonaBtn(p: { label: string; valor?: string; onClick: () => void }) {
    return (
      <div>
        <span className={lblCls}>{p.label}</span>
        <button onClick={p.onClick}
          className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-2 text-base text-left">
          {p.valor || <span className="text-zinc-500">{t("ed_sin_zona")}</span>} <span className="text-emerald-400 text-sm">· {t("ed_cambiar")}</span>
        </button>
      </div>
    );
  }

  const set = (k: string, v: any) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900 rounded-xl p-4">
        <h3 className="text-lg font-bold mb-1">{t("ed_titulo")}</h3>
        <p className="text-sm text-zinc-400">{t("ed_nota")}</p>
        <button onClick={abrirNuevo}
          className="mt-3 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-semibold">
          {t("ed_anadir")}
        </button>
      </div>

      {eventos.length === 0 && (
        <p className="text-zinc-500 text-center py-6">{t("ed_sin_acciones")}</p>
      )}

      <div className="space-y-1.5">
        {eventos.map((ev) => (
          <div key={ev.id} className="bg-zinc-900 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xl shrink-0">{emoji(ev.tipo)}</span>
            <div className="w-20 shrink-0 text-xs text-zinc-500 tabular-nums">
              {ev.parte} · {formatMMSS(ev.segundosParte || 0)}
            </div>
            <div className="flex-1 text-sm truncate">{descripcion(ev)}</div>
            <button onClick={() => abrirEditar(ev)}
              className="shrink-0 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm">✏️</button>
            <button onClick={() => setConfirmarBorrar(ev.id)}
              className="shrink-0 px-2.5 py-1.5 bg-red-900/60 hover:bg-red-800 rounded text-sm">🗑</button>
          </div>
        ))}
      </div>

      {/* MINUTOS POR JUGADOR (opción D: recálculo aprox. + edición a mano) */}
      <div className="bg-zinc-900 rounded-xl p-4 mt-3">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h3 className="text-lg font-bold">{t("ed_min_titulo")}</h3>
          <button onClick={() => { props.recalcularMinutos(); setRecalcKey((k) => k + 1); }}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold whitespace-nowrap">
            {t("ed_min_recalcular")}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">{t("ed_min_nota")}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 px-1">
            <div className="flex-1">{t("ed_jugador")}</div>
            {partes.map((p) => <div key={p} className="w-14 text-center">{p}</div>)}
            <div className="w-14 text-center">{t("ed_min_total")}</div>
          </div>
          {convocados.map((n) => (
            <FilaMinutos key={n + ":" + recalcKey} nombre={n} partes={partes}
              porParte={partido.tiempos[n]?.porParte} onCommit={(pp) => props.setMinutosJugador(n, pp)} />
          ))}
        </div>
      </div>

      {/* MODAL EDITAR / AÑADIR */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3"
          onClick={() => setDraft(null)}>
          <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-md max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{esNuevo ? t("ed_nueva_accion") : t("ed_editar_accion")}</h3>
            <div className="space-y-3">
              {esNuevo && (
                <Campo2 label={t("ed_tipo")} value={draft.tipo}
                  onChange={(v) => { setDraft(nuevoDraft(v as Evento["tipo"], draft.parte)); }}
                  opciones={TIPOS.map((tp) => ({ v: tp, lbl: t("ed_t_" + tp) }))} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={lblCls}>{t("ed_minuto")}</span>
                  <input className={inputCls} value={minStr} onChange={(e) => setMinStr(e.target.value)}
                    inputMode="numeric" placeholder="mm:ss" />
                </label>
                <Campo2 label={t("ed_parte")} value={draft.parte}
                  onChange={(v) => set("parte", v)}
                  opciones={partes.map((p) => ({ v: p, lbl: p }))} />
              </div>

              {/* equipo (todos menos cambio/accion_individual) */}
              {!["cambio", "accion_individual"].includes(draft.tipo) && (
                <Campo2 label={t("ed_equipo")} value={draft.equipo} onChange={(v) => set("equipo", v)} opciones={optEquipo} />
              )}

              {draft.tipo === "gol" && (
                <>
                  <Campo2 label={t("ed_goleador")} value={draft.goleador} onChange={(v) => set("goleador", v)} opciones={optJugador(true)} />
                  <Campo2 label={t("ed_asistente")} value={draft.asistente} onChange={(v) => set("asistente", v)} opciones={optJugador(true)} />
                  <Campo2 label={t("ed_tipo_gol")} value={draft.accion} onChange={(v) => set("accion", v)}
                    opciones={[{ v: "", lbl: "—" }].concat(ACCIONES_GOL.map((a) => ({ v: a, lbl: labelAccionGol(a) })))} />
                  <ZonaBtn label={t("ed_zona_campo")} valor={draft.zonaCampo} onClick={() => setZonaPicker("campo")} />
                  <ZonaBtn label={t("ed_zona_porteria")} valor={draft.zonaPorteria} onClick={() => setZonaPicker("porteria")} />
                </>
              )}

              {draft.tipo === "disparo" && (
                <>
                  <Campo2 label={t("ed_jugador")} value={draft.jugador} onChange={(v) => set("jugador", v)} opciones={optJugador(true)} />
                  <Campo2 label={t("ed_resultado")} value={draft.resultado} onChange={(v) => set("resultado", v)}
                    opciones={RES_DISPARO.map((r) => ({ v: r, lbl: labelResultadoDisparo(r as any) }))} />
                  <ZonaBtn label={t("ed_zona_campo")} valor={draft.zonaCampo} onClick={() => setZonaPicker("campo")} />
                  <ZonaBtn label={t("ed_zona_porteria")} valor={draft.zonaPorteria} onClick={() => setZonaPicker("porteria")} />
                </>
              )}

              {(draft.tipo === "falta") && (
                <>
                  <Campo2 label={t("ed_jugador")} value={draft.jugador} onChange={(v) => set("jugador", v)} opciones={optJugador(true)} />
                  <ZonaBtn label={t("ed_zona_campo")} valor={draft.zonaCampo} onClick={() => setZonaPicker("campo")} />
                </>
              )}

              {(draft.tipo === "amarilla" || draft.tipo === "roja") && (
                <Campo2 label={t("ed_jugador")} value={draft.jugador} onChange={(v) => set("jugador", v)} opciones={optJugador(true)} />
              )}

              {(draft.tipo === "penalti" || draft.tipo === "diezm") && (
                <>
                  <Campo2 label={t("ed_tirador")} value={draft.tirador} onChange={(v) => set("tirador", v)} opciones={optJugador(true)} />
                  <Campo2 label={t("ed_portero")} value={draft.portero} onChange={(v) => set("portero", v)} opciones={optPortero} />
                  <Campo2 label={t("ed_resultado")} value={draft.resultado} onChange={(v) => set("resultado", v)}
                    opciones={RES_PENALTI.map((r) => ({ v: r, lbl: r }))} />
                  <ZonaBtn label={t("ed_zona_porteria")} valor={draft.zonaPorteria} onClick={() => setZonaPicker("porteria")} />
                </>
              )}

              {draft.tipo === "cambio" && (
                <>
                  <Campo2 label={t("ed_sale")} value={draft.sale} onChange={(v) => set("sale", v)} opciones={optJugador(true)} />
                  <Campo2 label={t("ed_entra")} value={draft.entra} onChange={(v) => set("entra", v)} opciones={optJugador(true)} />
                  <p className="text-xs text-amber-400/80">{t("ed_nota_min_cambio")}</p>
                </>
              )}

              {draft.tipo === "accion_individual" && (
                <>
                  <Campo2 label={t("ed_jugador")} value={draft.jugador} onChange={(v) => set("jugador", v)} opciones={optJugador(false)} />
                  <Campo2 label={t("ed_accion_tipo")} value={draft.accion} onChange={(v) => set("accion", v)}
                    opciones={ACCIONES_IND.map((a) => ({ v: a, lbl: a.toUpperCase() }))} />
                  <ZonaBtn label={t("ed_zona_campo")} valor={draft.zonaCampo} onClick={() => setZonaPicker("campo")} />
                </>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setDraft(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold">{t("ed_cancelar")}</button>
              <button onClick={guardar}
                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-bold">{t("ed_guardar")}</button>
            </div>
          </div>

          {/* SUB-MODAL: picker de zona (campo o portería) */}
          {zonaPicker && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
              onClick={(e) => { e.stopPropagation(); setZonaPicker(null); }}>
              <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-base font-bold mb-3 text-center">
                  {zonaPicker === "campo" ? t("ed_zona_campo") : t("ed_zona_porteria")}
                </h4>
                {zonaPicker === "campo"
                  ? <Campo seleccionada={draft.zonaCampo} onSelect={(z) => { set("zonaCampo", z); setZonaPicker(null); }} />
                  : <Porteria seleccionada={draft.zonaPorteria} onSelect={(z) => { set("zonaPorteria", z); setZonaPicker(null); }} />}
                <button onClick={() => setZonaPicker(null)}
                  className="w-full mt-3 py-2 bg-zinc-800 rounded-lg">{t("ed_cancelar")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMAR BORRADO */}
      {confirmarBorrar && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setConfirmarBorrar(null)}>
          <div className="bg-zinc-900 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-base mb-4">{t("ed_borrar_confirm")}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarBorrar(null)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold">{t("ed_cancelar")}</button>
              <button onClick={() => { props.borrarEvento(confirmarBorrar); setConfirmarBorrar(null); }}
                className="flex-1 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-bold">{t("ed_confirmar_borrar")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fila editable de minutos de un jugador (mm:ss por parte + total). El estado
 *  local arranca de los props y se confirma al salir del campo (onBlur). Se
 *  remonta (key con recalcKey) cuando se pulsa "Recalcular" para reflejar los
 *  nuevos valores. */
function FilaMinutos(props: {
  nombre: string;
  partes: ParteId[];
  porParte?: Record<ParteId, number>;
  onCommit: (porParte: Record<ParteId, number>) => void;
}) {
  const inicial: Record<string, string> = {};
  for (const p of props.partes) inicial[p] = formatMMSS(props.porParte?.[p] ?? 0);
  const [val, setVal] = useState<Record<string, string>>(inicial);
  const total = props.partes.reduce((s, p) => s + mmssASeg(val[p] ?? "0"), 0);
  const commit = () => {
    const pp: Record<ParteId, number> = { "1T": 0, "2T": 0, PR1: 0, PR2: 0 };
    for (const p of props.partes) pp[p] = mmssASeg(val[p] ?? "0");
    props.onCommit(pp);
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-sm truncate">{props.nombre}</div>
      {props.partes.map((p) => (
        <input key={p} value={val[p] ?? "0:00"} inputMode="numeric"
          onChange={(e) => setVal((v) => ({ ...v, [p]: e.target.value }))} onBlur={commit}
          className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-center text-sm tabular-nums" />
      ))}
      <div className="w-14 text-center text-sm tabular-nums text-zinc-400">{formatMMSS(total)}</div>
    </div>
  );
}
