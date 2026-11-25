"use client";

/**
 * NuevoPartidoNuevo.tsx — Pantalla de PARTIDO NUEVO con el aspecto NUEVO
 * (rediseño PULSO, tanda 3 · 18/11/2026). Maqueta:
 * PULSO/comercial/crono/maquetas/nuevo.html.
 *
 * SOLO dibuja. Todo el estado (rival, fecha, duraciones, convocados, quinteto…)
 * y el botón de empezar viven en app/nuevo/page.tsx y son los MISMOS que usa el
 * aspecto clásico: misma página, mismas secciones y en el mismo orden, mismas
 * comprobaciones al empezar. Los pasos 1-2-3 de arriba solo llevan a cada
 * sección (como en la maqueta: «mismas secciones de hoy, más abajo»).
 *
 * Estilos en app/tema-nuevo.css (clases pz-np-*).
 */
import { CONVOCATORIA_HABITUAL } from "@/lib/convocatoria";
import { type ReactNode } from "react";
import { ROSTER, NOMBRE_CORTO_TC, CLIENTE } from "@/lib/clientes";
import { PRESETS_COMPETICION } from "@/lib/db";
import { COMPETICIONES } from "@/lib/competiciones";
import { t, labelCompeticion, labelCompeticionCorta } from "@/lib/i18n";
import { variablesEquipos } from "@/lib/tema";
import { Ico, sinEmojis, partirTitulo } from "@/components/DirectoNuevo";
import { BotonSol } from "@/components/InicioNuevo";
import { Escudo } from "@/components/Escudo";

type Jugador = (typeof ROSTER)[number];

export interface FormNuevoPartido {
  rival: string; setRival: (v: string) => void;
  partidoId: string; setPartidoId: (v: string) => void;
  fecha: string; setFecha: (v: string) => void;
  hora: string; setHora: (v: string) => void;
  lugar: string; setLugar: (v: string) => void;
  competicion: string; onCompChange: (c: string) => void;
  local: boolean; setLocal: (v: boolean) => void;
  dur1T: number; setDur1T: (v: number) => void;
  dur2T: number; setDur2T: (v: number) => void;
  durPR1: number; setDurPR1: (v: number) => void;
  durPR2: number; setDurPR2: (v: number) => void;
  permiteTanda: boolean; setPermiteTanda: (v: boolean) => void;
  direccionInter1T: "izq" | "der"; setDireccionInter1T: (v: "izq" | "der") => void;
  modo: "directo" | "video"; setModo: (v: "directo" | "video") => void;
  convocados: string[]; toggleConvocado: (n: string) => void;
  porterosConv: Jugador[]; campoConv: Jugador[];
  portero: string; setPortero: (v: string) => void;
  pista1: string; setPista1: (v: string) => void;
  pista2: string; setPista2: (v: string) => void;
  pista3: string; setPista3: (v: string) => void;
  pista4: string; setPista4: (v: string) => void;
  empezando: boolean; empezar: () => void;
  irInicio: () => void;
}


/** «← Izquierda» / «Derecha →» sin la flecha (va dibujada). */
const sinFlecha = (txt: string) => txt.replace(/[←→]/g, "").trim();

function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

function Seccion(props: { n: number; id: string; titulo: string; ayuda?: string; hecho?: boolean; children: ReactNode }) {
  return (
    <section id={props.id} className="pz-np-sec">
      <h2 className="pz-np-h">
        <span className={`nro ${props.hecho ? "hecho" : ""}`}>{props.hecho ? <Ico.check /> : props.n}</span>
        <b>{props.titulo}</b>
        {props.ayuda && <span className="ayuda">{props.ayuda}</span>}
      </h2>
      {props.children}
    </section>
  );
}

function Campo(props: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`pz-np-campo ${props.className ?? ""}`}>
      <span className="etq">{props.label}</span>
      {props.children}
    </label>
  );
}

function SelectJugadorNuevo(props: {
  label: string; value: string; setValue: (v: string) => void;
  opciones: { nombre: string; dorsal: string }[]; portero?: boolean;
}) {
  return (
    <Campo label={<>{props.portero ? <Ico.guante className="pz-ico mini" /> : <Ico.persona className="pz-ico mini" />}{sinEmojis(props.label)}</>}
      className={`pz-np-q ${props.value ? "lleno" : ""}`}>
      <select className="pz-in" value={props.value}
        onChange={(e) => props.setValue(e.target.value)}>
        <option value="">{t("nuevo_elige")}</option>
        {props.opciones.map((j) => (
          <option key={j.nombre} value={j.nombre}>
            {j.dorsal ? `#${j.dorsal} ` : ""}{j.nombre}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function NuevoPartidoNuevo(props: { f: FormNuevoPartido; sol: boolean; onSol: () => void }) {
  const { f } = props;
  const quinteto = [f.portero, f.pista1, f.pista2, f.pista3, f.pista4];
  const paso1 = !!f.rival.trim() && !!f.partidoId.trim();
  const paso2 = f.porterosConv.length > 0 && f.campoConv.length >= 4;
  const paso3 = quinteto.every(Boolean) && new Set(quinteto).size === 5;
  const preset = PRESETS_COMPETICION[f.competicion];
  const [dirTit, dirAyuda] = partirTitulo(t("nuevo_direccion_pregunta", { equipo: NOMBRE_CORTO_TC }));
  const [convTit, convAyuda] = partirTitulo(t("nuevo_convocados"));
  const durTit = t("nuevo_duracion_titulo").replace(/[\s—:-]*preset:?\s*$/i, "").trim();

  const pasos: Array<[string, string, boolean]> = [
    ["pz-np-1", f.rival.trim() ? f.rival.trim().toUpperCase() : t("nuevo_rival"), paso1],
    ["pz-np-2", t("nuevo_convocados_count", { n: f.convocados.length }), paso2],
    ["pz-np-3", t("nuevo_pista_inicial"), paso3],
  ];

  return (
    <div className="pz pz-np" data-tema={props.sol ? "sol" : undefined}
      style={variablesEquipos(CLIENTE.colorPropio, props.sol) as React.CSSProperties}>
      {/* ── Cabecera: título, pasos, Sol e inicio ── */}
      <div className="pz-np-top">
        <Escudo className="pz-np-escudo" />
        <h1>{sinEmojis(t("nuevo_titulo"))}</h1>
        <nav className="pz-np-pasos">
          {pasos.map(([id, txt, hecho], i) => (
            <span key={id} className="paso-y-raya">
              {i > 0 && <span className="raya" />}
              <button type="button" className={hecho ? "hecho" : ""} onClick={() => irA(id)}>
                <b>{hecho ? <Ico.check className="pz-ico" /> : i + 1}</b>
                <span className="txt">{txt}</span>
              </button>
            </span>
          ))}
        </nav>
        <div className="pz-np-top-der">
          <BotonSol sol={props.sol} onCambiar={props.onSol} />
          <button type="button" onClick={f.irInicio} className="pz-btn">
            <Ico.casa />{sinEmojis(t("inicio"))}
          </button>
        </div>
      </div>

      {/* ── 1 · Datos del partido ── */}
      <Seccion n={1} id="pz-np-1" titulo={t("nuevo_modo")} hecho={paso1}>
        <div className="pz-np-modos">
          {(["directo", "video"] as const).map((m) => (
            <button key={m} type="button" onClick={() => f.setModo(m)}
              className={`pz-np-modo ${m} ${f.modo === m ? "on" : ""}`}>
              <span className="ic">{m === "directo" ? <Ico.directo /> : <Ico.video />}</span>
              <span className="txt">
                <b>{m === "directo" ? t("nuevo_modo_directo") : t("nuevo_modo_video")}</b>
                <small>{m === "directo" ? t("nuevo_modo_directo_sub") : t("nuevo_modo_video_sub")}</small>
              </span>
              <span className="check" />
            </button>
          ))}
        </div>

        <div className="pz-capa pz-np-panel pz-np-datos">
          <Campo label={t("nuevo_rival")}>
            <input className="pz-in rival" value={f.rival}
              onChange={(e) => f.setRival(e.target.value)} placeholder={t("nuevo_rival_ph")} />
          </Campo>
          <Campo label={t("nuevo_competicion")}>
            <select className="pz-in" value={f.competicion}
              onChange={(e) => f.onCompChange(e.target.value)}>
              {COMPETICIONES.map((c) => (
                <option key={c} value={CLIENTE.demo ? c : undefined}>{labelCompeticionCorta(c)}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("nuevo_fecha")}>
            <input type="date" className="pz-in" value={f.fecha}
              onChange={(e) => f.setFecha(e.target.value)} />
          </Campo>
          <Campo label={t("nuevo_hora")}>
            <input className="pz-in pz-num-in" value={f.hora}
              onChange={(e) => f.setHora(e.target.value)} placeholder="18:00" />
          </Campo>
          <Campo label={t("nuevo_lugar")}>
            <input className="pz-in" value={f.lugar}
              onChange={(e) => f.setLugar(e.target.value)} placeholder={t("nuevo_lugar_ph")} />
          </Campo>
          <Campo label={t("nuevo_id_partido")}>
            <input className="pz-in pz-num-in" value={f.partidoId}
              onChange={(e) => f.setPartidoId(e.target.value.toUpperCase())} placeholder={t("nuevo_id_ph")} />
          </Campo>
          {/* Local / Visitante en dos botones (Arkaitz, 18/11/2026). Mismo dato
              (f.local) que el interruptor de antes: solo cambia cómo se elige. */}
          <div className="pz-np-lv dos" role="group" aria-label={t("nuevo_jugamos_como")}>
            <span className="pz-np-lv-t">{t("nuevo_jugamos_como")}</span>
            <button type="button" className={f.local ? "on" : ""} aria-pressed={f.local}
              onClick={() => f.setLocal(true)}>{t("nuevo_local")}</button>
            <button type="button" className={!f.local ? "on" : ""} aria-pressed={!f.local}
              onClick={() => f.setLocal(false)}>{t("nuevo_visitante")}</button>
          </div>
        </div>

        <div className="pz-np-fila2">
          <div className="pz-capa pz-np-panel">
            <h3 className="pz-np-h3">
              <b>{durTit}</b>
              <span className="preset">{preset ? labelCompeticion(f.competicion, preset.label) : f.competicion}</span>
            </h3>
            <div className="pz-np-mini">
              {([
                [t("nuevo_1a_parte"), f.dur1T, f.setDur1T],
                [t("nuevo_2a_parte"), f.dur2T, f.setDur2T],
                [t("nuevo_prorroga1_no"), f.durPR1, f.setDurPR1],
                [t("nuevo_prorroga2_no"), f.durPR2, f.setDurPR2],
              ] as Array<[string, number, (v: number) => void]>).map(([lab, val, set]) => (
                <Campo key={lab} label={lab}>
                  <input type="number" min={0} step={1} value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="pz-in pz-num-in" />
                </Campo>
              ))}
            </div>
            <label className="pz-np-tg">
              <input type="checkbox" className="pz-sw" checked={f.permiteTanda}
                onChange={(e) => f.setPermiteTanda(e.target.checked)} />
              <span>{t("nuevo_permite_tanda")}</span>
            </label>
          </div>

          <div className="pz-capa pz-np-panel">
            <h3 className="pz-np-h3"><b>{dirTit}</b>{dirAyuda && <span>{dirAyuda}</span>}</h3>
            <div className="pz-np-pista">
              {(["izq", "der"] as const).map((d) => (
                <button key={d} type="button" onClick={() => f.setDireccionInter1T(d)}
                  className={`lado ${f.direccionInter1T === d ? "on" : ""}`}>
                  {d === "izq" && <Ico.flechaIzq />}
                  {sinFlecha(d === "izq" ? t("nuevo_izquierda") : t("nuevo_derecha"))}
                  {d === "der" && <Ico.flechaDer />}
                </button>
              ))}
            </div>
            <p className="pz-np-nota">{t("nuevo_direccion_nota", { equipo: NOMBRE_CORTO_TC })}</p>
          </div>
        </div>
      </Seccion>

      {/* ── 2 · Convocatoria ── */}
      <Seccion n={2} id="pz-np-2" titulo={convTit} ayuda={convAyuda} hecho={paso2}>
        <div className="pz-capa pz-np-panel">
          <div className="pz-np-conv">
            {ROSTER.map((j) => {
              const on = f.convocados.includes(j.nombre);
              const tipo = j.posicion === "PORTERO" ? "por" : j.equipo === "PRIMER" ? "" : "otro";
              return (
                <button key={j.nombre} type="button"
                  onClick={() => f.toggleConvocado(j.nombre)}
                  className={`pz-np-j ${tipo} ${on ? "on" : ""}`}>
                  <span className="d pz-num">{j.dorsal || "–"}</span>
                  <span className="n">{j.nombre}</span>
                  {j.posicion === "PORTERO" && <Ico.guante className="pz-ico g" />}
                  <span className="ok">{on && <Ico.check className="pz-ico" />}</span>
                </button>
              );
            })}
          </div>
          <p className="pz-np-cuenta">
            <b className="pz-num">{f.convocados.length}</b>
            {t("nuevo_convocados_count", { n: f.convocados.length }).replace(String(f.convocados.length), "").trim()}
          </p>
          {f.convocados.length > 0 && f.convocados.length !== CONVOCATORIA_HABITUAL && (
            <p className="pz-np-aviso14" role="status"><Ico.aviso className="pz-ico" />{t("nuevo_aviso_14", { n: f.convocados.length })}</p>
          )}
        </div>
      </Seccion>

      {/* ── 3 · Quinteto inicial ── */}
      <Seccion n={3} id="pz-np-3" titulo={t("nuevo_pista_inicial")} hecho={paso3}>
        <div className="pz-capa pz-np-panel pz-np-quinteto">
          <SelectJugadorNuevo label={t("nuevo_portero")} value={f.portero} setValue={f.setPortero}
            opciones={f.porterosConv} portero />
          <SelectJugadorNuevo label={t("nuevo_pista_n", { n: 1 })} value={f.pista1} setValue={f.setPista1}
            opciones={f.campoConv} />
          <SelectJugadorNuevo label={t("nuevo_pista_n", { n: 2 })} value={f.pista2} setValue={f.setPista2}
            opciones={f.campoConv} />
          <SelectJugadorNuevo label={t("nuevo_pista_n", { n: 3 })} value={f.pista3} setValue={f.setPista3}
            opciones={f.campoConv} />
          <SelectJugadorNuevo label={t("nuevo_pista_n", { n: 4 })} value={f.pista4} setValue={f.setPista4}
            opciones={f.campoConv} />
        </div>
      </Seccion>

      {/* ── Pie: resumen y empezar ── */}
      <div className="pz-np-pie">
        <div className="resumen">
          <b>{sinEmojis(t(f.modo === "video" ? "home_modo_video" : "home_modo_directo"))}</b>
          {" · "}{labelCompeticionCorta(f.competicion)}
          {" · "}<b><span className="nos">{CLIENTE.nombreCorto}</span> – <span className="riv">{f.rival.trim() ? f.rival.trim().toUpperCase() : "…"}</span></b>
          {f.fecha && <>{" · "}{f.fecha}, {f.hora}</>}
        </div>
        <button onClick={f.empezar}
          disabled={f.empezando}
          className="pz-np-go">
          {f.empezando ? sinEmojis(t("nuevo_iniciando")) : <>{sinEmojis(t("nuevo_empezar"))}<Ico.flechaDer /></>}
        </button>
      </div>
    </div>
  );
}
