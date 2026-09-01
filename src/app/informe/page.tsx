"use client";

/**
 * /informe — El informe del partido, para guardarlo como PDF y mandarlo.
 *
 * Por qué existe: el cuerpo técnico del filial no tiene bot ni panel del club,
 * y Arkaitz no quiere ser el intermediario de nadie. Al acabar el partido dan a
 * "Informe PDF", sale el diálogo de imprimir del iPad y lo guardan o lo
 * comparten desde ahí. Sin servidor, sin cuenta y sin pedirle nada a nadie.
 *
 * Reescrito el 31/8/2026 y completado el 1/9. La primera versión tenía cinco
 * bloques y Arkaitz la describió como *"sencilla y hasta cutre"* comparada con
 * el informe del sistema del club. Tenía razón, y no era un límite del crono:
 * los datos estaban en el aparato sin que nadie los sacara.
 *
 * Hoy lleva TODO lo que lleva el informe del club salvo lo que necesita el
 * GPS, que no está en la tablet: cifras de cabecera, quinteto inicial, goles,
 * estadísticas comparadas, valoración del partido, jugadores, porteros,
 * cronograma, rotaciones individuales, quintetos, cuartetos, goles por tipo de
 * jugada, cuándo se marcaron, mapas de zona, duelos de vídeo, tanda de
 * penaltis y tarjetas.
 *
 * Está pensado para IMPRIMIR: fondo blanco, color solo de acento y todo
 * seguido, en una sola pasada. Es una página aparte y no una pestaña del
 * resumen a propósito — el resumen se mira por pestañas, el papel no.
 */
import Link from "next/link";
import { useEffect } from "react";
import { usePartido } from "@/lib/store";
import { NOMBRE_CORTO_TC, ROSTER } from "@/lib/clientes";
import { CampoMapa } from "@/components/CampoMapa";
import { t, useIdioma } from "@/lib/i18n";
import {
  construirInforme, mmss, type FilaJugador, type Informe,
} from "@/lib/informe";
import { MARCA_INFORME } from "@/lib/marca";

// ──────────────────────────────────────────────────────────────────────────
// Piezas de maquetación
// ──────────────────────────────────────────────────────────────────────────
function Seccion(props: { titulo: string; children: React.ReactNode; corta?: boolean }) {
  return (
    <section className={`${props.corta ? "mb-3" : "mb-5"} break-inside-avoid`}>
      <h2 className="mb-1.5 border-b pb-1 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: MARCA_INFORME.color, borderColor: MARCA_INFORME.color }}>
        {props.titulo}
      </h2>
      {props.children}
    </section>
  );
}

function Tabla(props: { cols: string[]; alinearDerecha?: number;
                        filas: React.ReactNode[][]; nota?: string }) {
  const { cols, filas, alinearDerecha = 2 } = props;
  return (
    <>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-zinc-300 text-[8.5px] uppercase tracking-wide text-zinc-500">
            {cols.map((c, i) => (
              <th key={c + i}
                  className={`py-1 font-semibold ${i >= alinearDerecha ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-zinc-100">
              {f.map((v, j) => (
                <td key={j}
                    className={`py-[3px] ${j >= alinearDerecha ? "text-right tabular-nums" : ""} `
                      + (j === 0 ? "pr-2 font-mono font-bold" : "")}
                    style={j === 0 ? { color: MARCA_INFORME.color } : undefined}>
                  {v === 0 ? "" : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {props.nota && <p className="mt-1 text-[8px] text-zinc-500">{props.nota}</p>}
    </>
  );
}

/** Comparativa nosotros / rival con una barra proporcional en medio. */
function Comparativa(props: { filas: { etiqueta: string; a: number; b: number }[] }) {
  return (
    <div className="space-y-1">
      {props.filas.map((f) => {
        const total = f.a + f.b;
        const pct = total ? (f.a / total) * 100 : 50;
        return (
          <div key={f.etiqueta} className="flex items-center gap-2 text-[10px]">
            <span className="w-7 text-right font-bold tabular-nums">{f.a}</span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-sm bg-zinc-200">
              <div style={{ width: `${pct}%`, backgroundColor: MARCA_INFORME.color }} />
              <div style={{ width: `${100 - pct}%`, backgroundColor: MARCA_INFORME.colorRival }} />
            </div>
            <span className="w-7 tabular-nums font-semibold"
                  style={{ color: MARCA_INFORME.colorRival }}>{f.b}</span>
            <span className="w-36 text-right text-[9px] uppercase tracking-wide text-zinc-500">
              {f.etiqueta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Portería 3×3 (P1..P9, de arriba a abajo y de izquierda a derecha). */
function Porteria(props: { cuadrantes: Record<string, number>; titulo: string;
                          color?: string }) {
  const color = props.color ?? MARCA_INFORME.color;
  const max = Math.max(1, ...Object.values(props.cuadrantes));
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-500">{props.titulo}</p>
      <svg viewBox="0 0 120 84" className="w-full max-w-[180px]" role="img">
        <rect x="1" y="1" width="118" height="82" fill="none" stroke="#111" strokeWidth="2" />
        {[0, 1, 2].map((fila) =>
          [0, 1, 2].map((col) => {
            const idx = fila * 3 + col + 1;
            const v = props.cuadrantes[`P${idx}`] ?? 0;
            const alpha = v ? 0.15 + 0.75 * (v / max) : 0;
            return (
              <g key={idx}>
                <rect x={1 + col * 39.33} y={1 + fila * 27.33}
                      width="39.33" height="27.33"
                      fill={color} fillOpacity={alpha}
                      stroke="#d4d4d8" strokeWidth="0.5" />
                <text x={20.6 + col * 39.33} y={19 + fila * 27.33}
                      textAnchor="middle" fontSize="12" fontWeight="700"
                      fill={v ? "#111" : "#d4d4d8"}>{v || "·"}</text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

/** Zonas del campo como barras ordenadas. Dibujar la pista entera pediría la
 *  geometría del componente Campo; con la lista se entiende igual y no se
 *  inventa nada. */
function ZonasCampo(props: { zonas: Record<string, number>; titulo: string }) {
  const filas = Object.entries(props.zonas).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...filas.map(([, v]) => v));
  if (!filas.length) return null;
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-500">{props.titulo}</p>
      <div className="space-y-[3px]">
        {filas.map(([z, v]) => (
          <div key={z} className="flex items-center gap-1.5 text-[9px]">
            <span className="w-6 font-mono font-bold">{z}</span>
            <div className="h-2 flex-1 rounded-sm bg-zinc-100">
              <div className="h-2 rounded-sm"
                   style={{ width: `${(v / max) * 100}%`, backgroundColor: MARCA_INFORME.color }} />
            </div>
            <span className="w-4 text-right tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cronograma: una barra por jugador con los tramos en pista. */
function Cronograma(props: { inf: Informe }) {
  const { inf } = props;
  const total = Math.max(1, inf.cabecera.duracionTotal);
  const todos = [...inf.porteros, ...inf.jugadores].filter((j) => j.jugo);
  return (
    <div className="space-y-[2px]">
      {todos.map((j) => (
        <div key={j.nombre} className="flex items-center gap-1.5">
          <span className="w-6 text-right font-mono text-[9px] font-bold"
                style={{ color: MARCA_INFORME.color }}>{j.dorsal}</span>
          <span className="w-20 truncate text-[9px]">{j.nombre}</span>
          <div className="relative h-2.5 flex-1 bg-zinc-100">
            {inf.tramos
              .filter((tr) => tr.enPista.includes(j.nombre))
              .map((tr, i) => (
                <div key={i} className="absolute top-0 h-2.5"
                     style={{
                       left: `${(tr.desde / total) * 100}%`,
                       width: `${Math.max(0.4, ((tr.hasta - tr.desde) / total) * 100)}%`,
                       backgroundColor: MARCA_INFORME.color,
                     }} />
              ))}
          </div>
          <span className="w-9 text-right font-mono text-[9px] tabular-nums">
            {mmss(j.segundos)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Un número que se lee por el color: verde si suma, rojo si resta. */
function Puntos(props: { v: number; fuerte?: boolean }) {
  const { v, fuerte } = props;
  return (
    <span className={fuerte ? "font-bold tabular-nums" : "tabular-nums"}
          style={{ color: v > 0 ? MARCA_INFORME.color
                   : v < 0 ? MARCA_INFORME.colorRival : "#71717a" }}>
      {v.toFixed(1).replace(".", ",")}
    </span>
  );
}

/** Franja de cifras para leer el partido de un vistazo, antes de las tablas. */
function Kpis(props: { inf: Informe }) {
  const { inf } = props;
  const cajas: [string, string][] = [
    [t("inf_kpi_disparos"), `${inf.nosotros.disparos} - ${inf.rival.disparos}`],
    [t("inf_kpi_apuerta"), `${inf.nosotros.aPuerta} - ${inf.rival.aPuerta}`],
    [t("inf_kpi_faltas"), `${inf.nosotros.faltas} - ${inf.rival.faltas}`],
    [t("inf_kpi_duracion"), mmss(inf.cabecera.duracionTotal)],
  ];
  const efectividad = inf.nosotros.aPuerta
    ? Math.round((inf.cabecera.gf / inf.nosotros.aPuerta) * 100)
    : null;
  if (efectividad !== null) cajas.push([t("inf_kpi_efectividad"), `${efectividad} %`]);
  return (
    <div className="mb-4 grid grid-cols-5 gap-[3px]">
      {cajas.map(([et, v]) => (
        <div key={et} className="bg-zinc-50 px-2 py-1.5 text-center">
          <p className="text-[13px] font-black leading-tight tabular-nums"
             style={{ color: MARCA_INFORME.color }}>{v}</p>
          <p className="text-[7.5px] uppercase leading-tight tracking-wide text-zinc-500">{et}</p>
        </div>
      ))}
    </div>
  );
}

/** Goles repartidos en tramos de cinco minutos: cuándo se decidió el partido. */
function GolesTramo(props: { tramos: Informe["golesPorTramo"] }) {
  const max = Math.max(1, ...props.tramos.map((x) => Math.max(x.nuestros, x.rival)));
  return (
    <div className="flex items-end gap-[3px]">
      {props.tramos.map((x) => (
        <div key={x.etiqueta} className="flex-1 text-center">
          <div className="flex h-12 items-end justify-center gap-[2px]">
            <div className="w-2" title={`${x.nuestros}`}
                 style={{ height: `${(x.nuestros / max) * 100}%`,
                          backgroundColor: MARCA_INFORME.color }} />
            <div className="w-2" title={`${x.rival}`}
                 style={{ height: `${(x.rival / max) * 100}%`,
                          backgroundColor: MARCA_INFORME.colorRival }} />
          </div>
          <p className="mt-[2px] text-[7px] text-zinc-500">{x.etiqueta}</p>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function InformePage() {
  const { partido, cargado } = usePartido();
  useIdioma();     // re-renderiza al cambiar de idioma

  // Al llegar con ?imprimir=1 (desde el botón del resumen) se abre solo el
  // diálogo. Con un respiro para que la página esté pintada: si no, en el
  // iPad sale a medias.
  useEffect(() => {
    if (!cargado || !partido) return;
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const id = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(id);
  }, [cargado, partido]);

  if (!cargado) return <main className="p-6 text-zinc-400">{t("inf_cargando")}</main>;

  const inf = partido ? construirInforme(partido, { nombreCorto: NOMBRE_CORTO_TC, roster: ROSTER }) : null;
  if (!inf) {
    return (
      <main className="p-6 text-zinc-300">
        <p>{t("inf_sin_partido")}</p>
        <Link href="/" className="underline" style={{ color: MARCA_INFORME.color }}>
          {t("inf_volver")}
        </Link>
      </main>
    );
  }

  const c = inf.cabecera;
  const totalDivididos = (inf.nosotros.divididosGanados ?? 0)
    + (inf.nosotros.divididosPerdidos ?? 0);
  const local = c.local;
  const izq = local ? c.nosotros : c.rival;
  const der = local ? c.rival : c.nosotros;
  const golIzq = local ? c.gf : c.gc;
  const golDer = local ? c.gc : c.gf;

  return (
    // La clase `informe` es la que engancha el CSS de impresión de globals.css.
    // Sin ella, el ancho de lectura de pantalla (820px) se llevaba las tablas
    // anchas fuera del papel: la última columna salía cortada.
    <main className="informe mx-auto max-w-[820px] bg-white p-5 text-zinc-900 print:p-0">
      {/* Botonera: fuera del papel */}
      <div className="mb-4 flex gap-2 print:hidden">
        <Link href="/resumen" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white">
          ← {t("inf_volver")}
        </Link>
        <button onClick={() => window.print()}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: MARCA_INFORME.color }}>
          📄 {t("inf_guardar_pdf")}
        </button>
      </div>
      <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 print:hidden">
        {t("inf_aviso_imprimir")}
      </div>

      {/* ── Cabecera ─────────────────────────────────────────────────── */}
      <header className="mb-5 border-b-2 pb-3" style={{ borderColor: MARCA_INFORME.color }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              {MARCA_INFORME.nombre} · {t("inf_titulo")}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              {izq} <span style={{ color: MARCA_INFORME.color }}>{golIzq} - {golDer}</span> {der}
            </h1>
            <p className="mt-1 text-[10px] text-zinc-600">
              {[c.fecha, c.hora, c.competicion, c.lugar,
                local ? t("inf_local") : t("inf_visitante"),
                c.partidoId,
                c.modo === "video" ? t("inf_con_video") : t("inf_en_directo")]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          {MARCA_INFORME.escudo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={MARCA_INFORME.escudo} alt={MARCA_INFORME.nombre}
                 className="ml-4 h-12 w-auto object-contain" />
          )}
        </div>
      </header>

      <Kpis inf={inf} />

      {/* Quinteto inicial: lo primero que mira cualquiera que no vio el partido */}
      {inf.titulares.portero && (
        <p className="mb-4 text-[10px] text-zinc-600">
          <span className="font-bold uppercase tracking-wide text-zinc-500">
            {t("inf_titulares")}:
          </span>{" "}
          {[inf.titulares.portero, ...inf.titulares.campo].join(" · ")}
        </p>
      )}

      {/* ── 1 · Goles ─────────────────────────────────────────────────── */}
      <Seccion titulo={t("inf_sec_goles")}>
        {inf.goles.length === 0
          ? <p className="text-[10px] text-zinc-500">{t("inf_sin_goles")}</p>
          : (
            <div className="space-y-[3px]">
              {inf.goles.map((g, i) => (
                <div key={i} className="flex items-baseline gap-2 border-b border-zinc-100 py-[3px] text-[10px]">
                  <span className="w-14 font-mono font-bold tabular-nums">{g.minuto}</span>
                  <span className="w-6 text-zinc-500">{g.parte}</span>
                  <span className="w-10 font-mono font-bold tabular-nums">{g.marcador}</span>
                  <span className="font-bold"
                        style={{ color: g.nuestro ? MARCA_INFORME.color : "#b91c1c" }}>
                    {g.nuestro ? c.nosotros : c.rival}
                  </span>
                  {g.goleador && <span className="font-semibold">{g.goleador}</span>}
                  {g.asistente && (
                    <span className="text-zinc-500">({t("inf_asist")} {g.asistente})</span>
                  )}
                  {g.accion && <span className="text-zinc-600">· {g.accion}</span>}
                  {g.quinteto.length > 0 && (
                    <span className="ml-auto text-[8.5px] text-zinc-400">
                      {g.quinteto.join(" · ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
      </Seccion>

      {/* ── 2 · Estadísticas de equipo ────────────────────────────────── */}
      <Seccion titulo={t("inf_sec_equipo")}>
        <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide">
          <span className="w-7 text-right" style={{ color: MARCA_INFORME.color }}>
            {c.nosotros}
          </span>
          <span className="flex-1" />
          <span className="w-7 text-zinc-500">{c.rival}</span>
          <span className="w-36" />
        </div>
        <Comparativa filas={[
          { etiqueta: t("inf_disparos"), a: inf.nosotros.disparos, b: inf.rival.disparos },
          { etiqueta: t("inf_a_puerta"), a: inf.nosotros.aPuerta, b: inf.rival.aPuerta },
          { etiqueta: t("inf_fuera"), a: inf.nosotros.fuera, b: inf.rival.fuera },
          { etiqueta: t("inf_palo"), a: inf.nosotros.palo, b: inf.rival.palo },
          { etiqueta: t("inf_bloqueados"), a: inf.nosotros.bloqueados, b: inf.rival.bloqueados },
          { etiqueta: t("inf_faltas"), a: inf.nosotros.faltas, b: inf.rival.faltas },
          { etiqueta: t("inf_amarillas"), a: inf.nosotros.amarillas, b: inf.rival.amarillas },
          { etiqueta: t("inf_tm"), a: inf.nosotros.tiemposMuerto, b: inf.rival.tiemposMuerto },
        ]} />
        <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
          {([
            [t("inf_robos"), String(inf.nosotros.robos ?? 0)],
            [t("inf_cortes"), String(inf.nosotros.cortes ?? 0)],
            [t("inf_perdidas"), String(inf.nosotros.perdidas ?? 0)],
            // Los divididos solo se cuentan revisando el vídeo: si nadie los
            // contó, la caja no se pinta en vez de enseñar un 0/0 que parece
            // que se pierden todos.
            ...(totalDivididos > 0
              ? [[t("inf_divididos"),
                  `${inf.nosotros.divididosGanados}/${totalDivididos}`] as [string, string]]
              : []),
          ] as [string, string][]).map(([k, v], i) => (
            <div key={i} className="rounded border border-zinc-200 px-2 py-1">
              <div className="text-[8px] uppercase tracking-wide text-zinc-500">{k}</div>
              <div className="text-sm font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </Seccion>

      {/* ── Valoración del partido ────────────────────────────────────── */}
      {inf.valoraciones.length > 0 && (
        <Seccion titulo={t("inf_sec_valoracion")}>
          <Tabla
            alinearDerecha={2}
            cols={["", t("inf_jugador"), t("inf_min"), t("inf_val"),
                   t("inf_val_40"), t("inf_val_video")]}
            filas={inf.valoraciones.map((v) => [
              v.dorsal, v.nombre + (v.portero ? " (P)" : ""), mmss(v.segundos),
              <Puntos key="p" v={v.puntos} fuerte />,
              v.por40 === null ? "" : <Puntos key="r" v={v.por40} />,
              inf.hayVideo && v.puntosVideo
                ? <Puntos key="v" v={v.puntosVideo} /> : "",
            ])}
            nota={inf.hayVideo ? t("inf_nota_val") : t("inf_nota_val_directo")}
          />
        </Seccion>
      )}

      {/* ── 3 · Jugadores de campo ────────────────────────────────────── */}
      <Seccion titulo={`${t("inf_sec_jugadores")} (${c.partesJugadas.join(" · ")})`}>
        <Tabla
          cols={["Nº", t("inf_jugador"), t("inf_min"), "⚽", t("inf_asist_col"),
                 t("inf_disp"), t("inf_pta"), t("inf_robos"), t("inf_cortes"),
                 t("inf_perd"), ...(totalDivididos > 0 ? [t("inf_bd")] : []),
                 t("inf_faltas"), "±"]}
          filas={inf.jugadores.map((j) => [
            j.dorsal, j.nombre, mmss(j.segundos), j.goles, j.asistencias,
            j.disparos, j.aPuerta, j.robos, j.cortes, j.perdidas,
            ...(totalDivididos > 0
              ? [`${j.divididosGanados}/${j.divididosGanados + j.divididosPerdidos}`]
              : []),
            j.faltas,
            j.masMenos > 0 ? `+${j.masMenos}` : j.masMenos,
          ])}
          nota={t("inf_nota_masmenos")}
        />
      </Seccion>

      {/* ── 4 · Porteros ──────────────────────────────────────────────── */}
      {inf.porteros.length > 0 && (
        <Seccion titulo={t("inf_sec_porteros")} corta>
          <Tabla
            cols={["Nº", t("inf_portero"), t("inf_min"), t("inf_paradas"),
                   t("inf_encajados"), t("inf_pct_parada")]}
            filas={inf.porteros.map((p) => [
              p.dorsal, p.nombre, mmss(p.segundos), p.paradas, p.golesEncajados,
              p.pctParada === null ? "—" : `${p.pctParada}%`,
            ])}
          />
        </Seccion>
      )}

      {/* ── 5 · Cronograma de rotaciones ──────────────────────────────── */}
      {inf.tramos.length > 1 && (
        <Seccion titulo={t("inf_sec_cronograma")}>
          <Cronograma inf={inf} />
          <p className="mt-1 text-[8px] text-zinc-500">{t("inf_nota_cronograma")}</p>
        </Seccion>
      )}

      {/* ── Rotaciones individuales: cuándo entró y salió cada uno ────── */}
      {inf.rotaciones.some((r) => r.tramos.length > 1) && (
        <Seccion titulo={t("inf_sec_rotaciones")}>
          <Tabla
            alinearDerecha={3}
            cols={["", t("inf_jugador"), t("inf_periodos"), t("inf_veces"), t("inf_min")]}
            filas={inf.rotaciones.map((r) => [
              r.dorsal, r.nombre,
              r.tramos.map((x) => `${mmss(x.desde)}–${mmss(x.hasta)}`).join("  "),
              r.tramos.length, mmss(r.segundos),
            ])}
            nota={t("inf_nota_rotaciones")}
          />
        </Seccion>
      )}

      {/* ── 6 · Quintetos ─────────────────────────────────────────────── */}
      {inf.quintetos.length > 0 && (
        <Seccion titulo={t("inf_sec_quintetos")}>
          <Tabla
            alinearDerecha={1}
            cols={[t("inf_quinteto"), t("inf_min"), t("inf_gf"), t("inf_gc"), "±"]}
            filas={inf.quintetos.slice(0, 10).map((q) => [
              q.jugadores.join(" · "), mmss(q.segundos), q.gf, q.gc,
              q.masMenos > 0 ? `+${q.masMenos}` : q.masMenos,
            ])}
            nota={t("inf_nota_quintetos")}
          />
        </Seccion>
      )}

      {/* ── Cuartetos: los cuatro de campo, sin el portero ────────────── */}
      {inf.cuartetos.length > 1 && (
        <Seccion titulo={t("inf_sec_cuartetos")}>
          <Tabla
            alinearDerecha={1}
            cols={[t("inf_cuarteto"), t("inf_min"), t("inf_gf"), t("inf_gc"), "±"]}
            filas={inf.cuartetos.slice(0, 10).map((q) => [
              q.jugadores.join(" · "), mmss(q.segundos), q.gf, q.gc,
              q.masMenos > 0 ? `+${q.masMenos}` : q.masMenos,
            ])}
            nota={t("inf_nota_cuartetos")}
          />
        </Seccion>
      )}

      {/* ── 7 · Goles por tipo de jugada ──────────────────────────────── */}
      {inf.golesPorJugada.length > 0 && (
        <Seccion titulo={t("inf_sec_jugadas")} corta>
          <Tabla
            alinearDerecha={1}
            cols={[t("inf_jugada"), c.nosotros, c.rival]}
            filas={inf.golesPorJugada.map((g) => [g.jugada, g.nuestros, g.rival])}
          />
        </Seccion>
      )}

      {/* ── Cuándo se marcaron los goles ──────────────────────────────── */}
      {inf.goles.length > 0 && (
        <Seccion titulo={t("inf_sec_tramos")} corta>
          <GolesTramo tramos={inf.golesPorTramo} />
          <p className="mt-1 text-[8px] text-zinc-500">{t("inf_nota_tramos")}</p>
        </Seccion>
      )}

      {/* ── Tanda de penaltis, solo si se llegó a tirar ────────────────── */}
      {inf.tanda && (
        <Seccion titulo={`${t("inf_sec_tanda")} · ${inf.tanda.marcador.inter} - ${inf.tanda.marcador.rival}`}>
          <Tabla
            alinearDerecha={4}
            cols={["#", t("inf_equipo"), t("inf_tirador"), t("inf_portero"),
                   t("inf_resultado")]}
            filas={inf.tanda.tiros.map((x) => [
              String(x.orden), x.nuestro ? c.nosotros : c.rival,
              x.tirador ?? "", x.portero ?? "", x.resultado,
            ])}
          />
        </Seccion>
      )}

      {/* ── 8 · Mapas de zona ─────────────────────────────────────────── */}
      {(Object.keys(inf.zonasPorteria).length > 0
        || Object.keys(inf.zonasCampo).length > 0) && (
        <Seccion titulo={t("inf_sec_zonas")}>
          <div className="grid grid-cols-2 gap-4">
            <CampoMapa zonas={inf.zonasCampo} titulo={t("inf_z_campo_favor")}
                       color={MARCA_INFORME.color} direccion={inf.direccion1T} />
            {/* MISMO sentido que el mapa de al lado. Espejar el del rival
                obliga a girar la cabeza para comparar dos campos que son el
                mismo campo. */}
            <CampoMapa zonas={inf.zonasCampoRival} titulo={t("inf_z_campo_contra")}
                       color={MARCA_INFORME.colorRival} direccion={inf.direccion1T} />
          </div>
          <p className="mt-1 text-[8px] text-zinc-500">{t("inf_nota_campo")}</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Porteria cuadrantes={inf.zonasPorteria} titulo={t("inf_z_porteria_favor")}
                      color={MARCA_INFORME.color} />
            <Porteria cuadrantes={inf.zonasPorteriaRival} titulo={t("inf_z_porteria_contra")}
                      color={MARCA_INFORME.colorRival} />
          </div>
        </Seccion>
      )}

      {/* ── Dónde se recupera y dónde se pierde ───────────────────────── */}
      {(Object.keys(inf.zonasRecuperaciones).length > 0
        || Object.keys(inf.zonasPerdidas).length > 0
        || Object.keys(inf.zonasFaltas).length > 0) && (
        <Seccion titulo={t("inf_sec_mapas_juego")}>
          <div className="grid grid-cols-3 gap-3">
            <CampoMapa zonas={inf.zonasRecuperaciones} titulo={t("inf_m_recuperaciones")}
                       color={MARCA_INFORME.color} direccion={inf.direccion1T} />
            <CampoMapa zonas={inf.zonasPerdidas} titulo={t("inf_m_perdidas")}
                       color={MARCA_INFORME.colorRival} direccion={inf.direccion1T} />
            <CampoMapa zonas={inf.zonasFaltas} titulo={t("inf_m_faltas")}
                       color={MARCA_INFORME.colorAcento} direccion={inf.direccion1T} />
          </div>
          <p className="mt-1 text-[8px] text-zinc-500">{t("inf_nota_mapas_juego")}</p>
        </Seccion>
      )}

      {/* ── 9 · Métricas de vídeo ─────────────────────────────────────── */}
      {inf.hayVideo && (
        <Seccion titulo={t("inf_sec_video")}>
          <TablaVideo jugadores={inf.jugadores} />
          {inf.porteros.some((p) => Object.keys(p.video).length > 0) && (
            <div className="mt-3">
              <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-500">
                {t("inf_video_porteros")}
              </p>
              <Tabla
                cols={["Nº", t("inf_portero"), t("inf_saques"), t("inf_achiques"),
                       t("inf_cob_balon"), t("inf_cob_hombre"), t("inf_pases")]}
                filas={inf.porteros
                  .filter((p) => Object.keys(p.video).length > 0)
                  .map((p) => [
                  p.dorsal, p.nombre,
                  `${p.video.saqueB ?? 0}/${(p.video.saqueB ?? 0) + (p.video.saqueM ?? 0)}`,
                  p.video.achique ?? 0,
                  `${p.video.cobBR ?? 0}+${p.video.cobBN ?? 0}`,
                  `${p.video.cobMR ?? 0}+${p.video.cobMN ?? 0}`,
                  `${p.video.paseB ?? 0}/${(p.video.paseB ?? 0) + (p.video.paseM ?? 0)}`,
                ])}
              />
            </div>
          )}
        </Seccion>
      )}

      {/* ── 10 · Penaltis, tiempos muertos y tarjetas ─────────────────── */}
      {(inf.penaltis.length > 0 || inf.tarjetas.length > 0) && (
        <Seccion titulo={t("inf_sec_otros")} corta>
          <div className="grid grid-cols-2 gap-4 text-[10px]">
            <div>
              {inf.penaltis.length > 0 && (
                <>
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-500">
                    {t("inf_penaltis")}
                  </p>
                  {inf.penaltis.map((p, i) => (
                    <div key={i} className="border-b border-zinc-100 py-[2px]">
                      <span className="font-mono font-bold">{p.minuto}</span>{" "}
                      <span className="text-zinc-500">{p.parte}</span>{" "}
                      {p.tipo} · {p.nuestro ? c.nosotros : c.rival}
                      {p.tirador ? ` — ${p.tirador}` : ""} · {p.resultado}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div>
              {inf.tarjetas.length > 0 && (
                <>
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-zinc-500">
                    {t("inf_tarjetas")}
                  </p>
                  {inf.tarjetas.map((tj, i) => (
                    <div key={i} className="border-b border-zinc-100 py-[2px]">
                      <span className="font-mono font-bold">{tj.minuto}</span>{" "}
                      <span className="text-zinc-500">{tj.parte}</span>{" "}
                      {tj.roja ? "🟥" : "🟨"} {tj.nuestro ? c.nosotros : c.rival}
                      {tj.jugador ? ` — ${tj.jugador}` : ""}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </Seccion>
      )}

      <footer className="mt-6 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2 text-[8px] text-zinc-500">
        <span>{MARCA_INFORME.pie}</span>
        <span>{MARCA_INFORME.origen}</span>
      </footer>
    </main>
  );
}

/** Tabla de duelos y 1x1 de los jugadores de campo. Solo se pinta si hay
 *  partido revisado con vídeo: en directo no da tiempo a contar esto y una
 *  tabla a cero diría que lo hacen fatal, cuando dice que nadie lo contó. */
function TablaVideo(props: { jugadores: FilaJugador[] }) {
  const con = props.jugadores.filter((j) => Object.keys(j.video).length > 0);
  if (!con.length) return null;
  const par = (g?: number, p?: number) => {
    const total = (g ?? 0) + (p ?? 0);
    return total ? `${g ?? 0}/${total}` : "";
  };
  return (
    <Tabla
      cols={["Nº", t("inf_jugador"), t("inf_duelo_c"), t("inf_duelo_p"),
             t("inf_1x1_atq"), t("inf_1x1_def"), t("inf_ult_cob"),
             t("inf_corte_conex"), t("inf_conex_pivot"), t("inf_recibe_pivot")]}
      filas={con.map((j) => [
        j.dorsal, j.nombre,
        par(j.video.duelC_g, j.video.duelC_p),
        par(j.video.duelP_g, j.video.duelP_p),
        par(j.video.unoAtq_g, j.video.unoAtq_p),
        par(j.video.unoDef_g, j.video.unoDef_p),
        j.video.ultCob ?? 0, j.video.corteConex ?? 0,
        j.video.conexPivot ?? 0, j.video.recibePivot ?? 0,
      ])}
      nota={t("inf_nota_video")}
    />
  );
}
