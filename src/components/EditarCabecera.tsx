"use client";

/**
 * EditarCabecera — «Editar datos del partido» desde el resumen (25/11/2026).
 *
 * Ventana con los datos de la cabecera de un partido ya creado: los mismos
 * campos y las mismas comprobaciones que «Nuevo partido» (rival y código
 * obligatorios, la misma lista de competiciones —lib/competiciones.ts—, casa /
 * fuera, duraciones, tanda, hacia dónde atacamos, directo / vídeo). La lógica
 * (qué cambia, qué se valida, quién sería «el mismo partido») vive en
 * lib/editarCabecera.ts, con su test.
 *
 * El estado del formulario es LOCAL y se toma al abrir: el resumen se redibuja
 * cada 250 ms y no debe pisar lo que se está escribiendo. Los dos aspectos
 * comparten el dibujo de las ventanas del editor de acciones (con el nuevo,
 * su cabecera y sus colores; con el clásico, tal cual).
 */
import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Partido, ParteId } from "@/lib/db";
import { PRESETS_COMPETICION } from "@/lib/db";
import { NOMBRE_CORTO_TC } from "@/lib/clientes";
import { t, labelCompeticion, labelCompeticionCorta, labelParte } from "@/lib/i18n";
import { formatMMSS } from "@/lib/utils";
import { opcionesCompeticion } from "@/lib/competiciones";
import {
  cabeceraDe, validarCabecera, aplicarCabecera, hayCambiosCabecera, otrosMismoPartido,
  type CambiosCabecera, type ErrorCabecera,
} from "@/lib/editarCabecera";
import { listarPartidos } from "@/lib/store";
import { PostCtx } from "@/components/ResumenNuevo";
import { CabVentana } from "@/components/EditorEventos";
import { Ico, sinEmojis } from "@/components/DirectoNuevo";

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
const lblCls = "block text-xs text-zinc-400 mb-1";
const inputCls = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-base";

function Etq(p: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${p.className ?? ""}`}>
      <span className={lblCls}>{p.label}</span>
      {p.children}
    </label>
  );
}

function textoError(e: ErrorCabecera): string {
  if (e.clave === "edc_err_parte_cero") return t(e.clave, { parte: labelParte(e.parte) });
  if (e.clave === "edc_err_parte_corta") return t(e.clave, { parte: labelParte(e.parte), min: formatMMSS(e.usados) });
  return t(e.clave);
}

export function EditarCabecera(props: {
  partido: Partido;
  onGuardar: (cambios: CambiosCabecera) => void;
  onCerrar: () => void;
}) {
  const nuevo = useContext(PostCtx);
  // Foto del partido al abrir: lo que se edita y contra lo que se valida.
  const [inicial] = useState(() => cabeceraDe(props.partido));
  const [rival, setRival] = useState(inicial.rival);
  const [partidoId, setPartidoId] = useState(inicial.partido_id);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [lugar, setLugar] = useState(inicial.lugar);
  const [competicion, setCompeticion] = useState(inicial.competicion);
  const [local, setLocal] = useState(inicial.local);
  const [dur, setDur] = useState<Record<ParteId, number>>(() => {
    const d = {} as Record<ParteId, number>;
    for (const p of PARTES) d[p] = (inicial.duracionParte[p] ?? 0) / 60;
    return d;
  });
  const [permiteTanda, setPermiteTanda] = useState(inicial.permiteTanda);
  const [direccion, setDireccion] = useState(inicial.direccionInter1T);
  const [modo, setModo] = useState(inicial.modo);
  const [error, setError] = useState<string | null>(null);

  // Los demás partidos del aparato, para avisar si con los datos nuevos este
  // pasa a ser «el mismo partido» que otro (Totales cuenta solo el de vídeo).
  const [todos, setTodos] = useState<Partido[]>([]);
  useEffect(() => { listarPartidos().then(setTodos).catch(() => setTodos([])); }, []);

  const cambios: CambiosCabecera = {
    rival, partido_id: partidoId, fecha, hora, lugar, competicion, local,
    duracionParte: Object.fromEntries(PARTES.map((p) => [p, Math.round((dur[p] || 0) * 60)])) as Record<ParteId, number>,
    permiteTanda, direccionInter1T: direccion, modo,
  };
  const claveCambios = JSON.stringify(cambios);
  const mismos = useMemo(() => {
    const editado = aplicarCabecera(props.partido, cambios);
    return otrosMismoPartido(editado, todos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCambios, todos]);
  const codigoCambiado = partidoId.trim().toUpperCase() !== (inicial.partido_id ?? "").trim().toUpperCase();

  const guardar = () => {
    const e = validarCabecera(props.partido, cambios);
    if (e) { setError(textoError(e)); return; }
    if (hayCambiosCabecera(props.partido, cambios)) props.onGuardar(cambios);
    props.onCerrar();
  };

  const competiciones = opcionesCompeticion(inicial.competicion);
  const preset = PRESETS_COMPETICION[competicion];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3"
      onClick={props.onCerrar} data-editar-cabecera="">
      <div className={`bg-zinc-900 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto ${nuevo ? "pz-panel" : "p-4"}`}
        onClick={(e) => e.stopPropagation()}>
        {nuevo ? (
          <CabVentana icono={<Ico.lapiz className="pz-ico" />} titulo={t("edc_titulo")} onCerrar={props.onCerrar} />
        ) : (
          <h3 className="text-lg font-bold mb-1">{t("edc_titulo")}</h3>
        )}
        <div className={`space-y-3 ${nuevo ? "pz-edc-cuerpo" : ""}`}>
          <p className="text-sm text-zinc-400">{t("edc_explica")}</p>

          {/* Modo de captura */}
          <Etq label={t("nuevo_modo")}>
            <ModoBotones modo={modo} setModo={setModo} />
          </Etq>
          {modo !== inicial.modo && <p className="text-xs text-zinc-500">{t("edc_modo_nota")}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Etq label={t("nuevo_rival")}>
              <input className={inputCls} value={rival} data-edc="rival"
                onChange={(e) => setRival(e.target.value)} placeholder={t("nuevo_rival_ph")} />
            </Etq>
            <Etq label={t("nuevo_competicion")}>
              <select className={inputCls} value={competicion} data-edc="competicion"
                onChange={(e) => setCompeticion(e.target.value)}>
                {competiciones.map((c) => (
                  <option key={c} value={c}>{labelCompeticionCorta(c)}</option>
                ))}
              </select>
            </Etq>
            <Etq label={t("nuevo_fecha")}>
              <input type="date" className={inputCls} value={fecha} data-edc="fecha"
                onChange={(e) => setFecha(e.target.value)} />
            </Etq>
            <Etq label={t("nuevo_hora")}>
              <input className={inputCls} value={hora} data-edc="hora"
                onChange={(e) => setHora(e.target.value)} placeholder="18:00" />
            </Etq>
            <Etq label={t("nuevo_lugar")}>
              <input className={inputCls} value={lugar} data-edc="lugar"
                onChange={(e) => setLugar(e.target.value)} placeholder={t("nuevo_lugar_ph")} />
            </Etq>
            <Etq label={t("nuevo_id_partido")}>
              <input className={inputCls} value={partidoId} data-edc="partido_id"
                onChange={(e) => setPartidoId(e.target.value.toUpperCase())} placeholder={t("nuevo_id_ph")} />
            </Etq>
          </div>
          {codigoCambiado && <p className="text-xs text-amber-400">⚠ {t("edc_aviso_codigo")}</p>}

          <Etq label={t("nuevo_jugamos_como")}>
            <Elegir valor={local} onElegir={setLocal} etiqueta={t("nuevo_jugamos_como")}
              opciones={[[true, t("nuevo_local")], [false, t("nuevo_visitante")]]} />
          </Etq>

          {/* Duraciones: NO siguen a la competición (el partido ya se jugó). */}
          <div className="bg-zinc-950/50 rounded-lg p-3 space-y-2">
            <div className="text-sm font-semibold text-zinc-300">
              {t("nuevo_duracion_titulo").replace(/[\s—:-]*preset:?\s*$/i, "").trim()}
              {preset && <span className="text-emerald-300 font-normal"> · {labelCompeticion(competicion, preset.label)}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PARTES.map((p) => (
                <Etq key={p} label={t({ "1T": "nuevo_1a_parte", "2T": "nuevo_2a_parte", PR1: "nuevo_prorroga1_no", PR2: "nuevo_prorroga2_no" }[p])}>
                  <input type="number" min={0} step={1} className={inputCls} value={dur[p]} data-edc={`dur_${p}`}
                    onChange={(e) => setDur((d) => ({ ...d, [p]: Math.max(0, Number(e.target.value) || 0) }))} />
                </Etq>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-5 h-5" checked={permiteTanda}
                onChange={(e) => setPermiteTanda(e.target.checked)} />
              <span className="text-sm">{t("nuevo_permite_tanda")}</span>
            </label>
            {competicion !== inicial.competicion && (
              <p className="text-xs text-zinc-500">{t("edc_duraciones_nota")}</p>
            )}
          </div>

          <Etq label={sinEmojis(t("nuevo_direccion_pregunta", { equipo: NOMBRE_CORTO_TC }))}>
            <Elegir valor={direccion} onElegir={setDireccion}
              opciones={[["izq", t("nuevo_izquierda")], ["der", t("nuevo_derecha")]]} />
          </Etq>

          {mismos.length > 0 && (
            <p className="text-xs text-amber-400" data-edc-aviso-mismo="">
              ⚠ {t("edc_aviso_mismo", {
                lista: mismos.map((o) => [o.config?.partido_id, o.config?.rival, o.config?.fecha,
                  o.modo === "video" ? t("nuevo_modo_video") : t("nuevo_modo_directo")]
                  .filter(Boolean).join(" · ")).join("; "),
              })}
            </p>
          )}

          {error && <p className="text-sm text-red-400 font-semibold" role="alert">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={props.onCerrar}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold">{t("ed_cancelar")}</button>
            <button type="button" onClick={guardar} data-edc="guardar"
              className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-bold">{t("ed_guardar")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Elegir<T extends string | boolean>(p: {
  valor: T; onElegir: (v: T) => void; opciones: Array<[T, ReactNode]>; etiqueta?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={p.etiqueta}>
      {p.opciones.map(([v, txt]) => (
        <button key={String(v)} type="button" aria-pressed={p.valor === v}
          onClick={() => p.onElegir(v)}
          className={`py-2 rounded-lg text-base font-bold ${p.valor === v ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-300"}`}>
          {txt}
        </button>
      ))}
    </div>
  );
}

function ModoBotones(p: { modo: "directo" | "video"; setModo: (m: "directo" | "video") => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group">
      {(["directo", "video"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={p.modo === m} onClick={() => p.setModo(m)}
          className={`py-2 rounded-lg text-base font-bold border-2 ${p.modo === m
            ? (m === "directo" ? "bg-red-800 border-red-400 text-white" : "bg-sky-800 border-sky-400 text-white")
            : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
          {m === "directo" ? t("nuevo_modo_directo") : t("nuevo_modo_video")}
        </button>
      ))}
    </div>
  );
}
