"use client";

/**
 * /informe — El informe del partido, para guardarlo como PDF y mandarlo.
 *
 * Por qué existe: el cuerpo técnico del filial no tiene bot ni panel del club,
 * y Arkaitz no quiere ser el intermediario de nadie. Con esto, al acabar el
 * partido se dan a "Informe PDF", sale el diálogo de imprimir del iPad y lo
 * guardan o lo comparten desde ahí. Sin servidor, sin cuenta y sin pedirle
 * nada a nadie.
 *
 * Es una página aparte y no una pestaña del resumen a propósito: el resumen se
 * mira por pestañas y en papel hace falta TODO seguido, en blanco y en una
 * sola pasada.
 */
import Link from "next/link";
import { useEffect } from "react";
import { usePartido } from "@/lib/store";
import { CLIENTE, NOMBRE_CORTO_TC, ROSTER } from "@/lib/clientes";
import { formatMMSS } from "@/lib/utils";
import { JUGADOR_EQUIPO, type Evento, type ParteId } from "@/lib/db";

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
const NO_JUGADORES = new Set([JUGADOR_EQUIPO, "#CT"]);

function mmss(seg: number): string {
  const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function InformePage() {
  const { partido, cargado } = usePartido();

  // Al llegar con ?imprimir=1 (desde el botón del resumen) se abre solo el
  // diálogo. Con un respiro para que la página esté pintada: si no, en el
  // iPad sale a medias.
  useEffect(() => {
    if (!cargado || !partido) return;
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const id = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(id);
  }, [cargado, partido]);

  if (!cargado) return <main className="p-6 text-zinc-400">Cargando…</main>;
  if (!partido?.config) {
    return (
      <main className="p-6 text-zinc-300">
        <p>No hay ningún partido abierto.</p>
        <Link href="/" className="text-emerald-400 underline">Volver al inicio</Link>
      </main>
    );
  }

  const cfg = partido.config;
  const gf = partido.marcador?.inter ?? 0;
  const gc = partido.marcador?.rival ?? 0;
  const nosotros = CLIENTE.nombreCorto;
  const evs = (partido.eventos ?? []) as Evento[];
  const dorsal = new Map(ROSTER.map((j) => [j.nombre, j.dorsal]));

  const partesJugadas = PARTES.filter((p) => (cfg.duracionParte?.[p] ?? 0) > 0);
  const goles = evs.filter((e) => e.tipo === "gol");
  const tarjetas = evs.filter((e) => e.tipo === "amarilla" || e.tipo === "roja");

  const convocados = (cfg.convocados ?? []).filter((n) => !NO_JUGADORES.has(n));
  const filas = convocados
    .map((n) => ({
      nombre: n,
      dorsal: dorsal.get(n) ?? "",
      seg: partido.tiempos?.[n]?.totalSegundos ?? 0,
      c: partido.acciones?.porJugador?.[n],
      goles: goles.filter((g) => g.equipo === "INTER"
        && (g as never as { goleador?: string }).goleador === n).length,
      asis: goles.filter((g) => g.equipo === "INTER"
        && (g as never as { asistente?: string }).asistente === n).length,
    }))
    .sort((a, b) => b.seg - a.seg);

  const esPortero = new Set(ROSTER.filter((j) => j.posicion === "PORTERO").map((j) => j.nombre));
  const porteros = filas.filter((f) => esPortero.has(f.nombre) && f.seg > 0);

  const suma = (campo: "inter" | "rival", que: "faltas" | "amarillas" | "tiemposMuerto") =>
    PARTES.reduce((a, p) => a + (partido.stats?.[que]?.[p]?.[campo] ?? 0), 0);

  const disparos = filas.reduce((a, f) => ({
    puerta: a.puerta + (f.c?.dpp ?? 0), fuera: a.fuera + (f.c?.dpf ?? 0),
    palo: a.palo + (f.c?.dpa ?? 0), bloq: a.bloq + (f.c?.dpb ?? 0),
  }), { puerta: 0, fuera: 0, palo: 0, bloq: 0 });

  return (
    <main className="informe mx-auto max-w-3xl p-5 text-zinc-100 print:text-black">
      <div className="no-print mb-4 flex gap-2">
        <Link href="/resumen"
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">← Volver</Link>
        <button onClick={() => window.print()}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
          📄 Guardar como PDF
        </button>
      </div>

      <div className="no-print mb-5 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
        Se abrirá el cuadro de imprimir del iPad. Ahí eliges <b>Guardar en
        Archivos</b> o lo compartes por correo o WhatsApp desde el mismo sitio.
      </div>

      <header className="mb-4 border-b-2 border-emerald-700 pb-3 print:border-black">
        <div className="text-[11px] uppercase tracking-widest text-emerald-500 print:text-black">
          {CLIENTE.nombreLargo} · Informe de partido
        </div>
        <h1 className="mt-1 text-2xl font-black">
          {cfg.local ? `${nosotros} ${gf} - ${gc} ${cfg.rival}`
                     : `${cfg.rival} ${gc} - ${gf} ${nosotros}`}
        </h1>
        <div className="mt-1 text-sm text-zinc-400 print:text-zinc-700">
          {cfg.fecha} · {cfg.hora} · {cfg.competicion}
          {cfg.lugar ? ` · ${cfg.lugar}` : ""} · {cfg.local ? "Local" : "Visitante"}
          {" · "}{cfg.partido_id}
          {partido.modo === "video" ? " · revisado con vídeo" : " · en directo"}
        </div>
      </header>

      <section className="mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-emerald-500 print:text-black">Goles</h2>
        {goles.length === 0 ? <p className="text-sm text-zinc-400">Sin goles.</p> : (
          <ul className="text-sm">
            {goles.map((g, i) => {
              const e = g as never as Record<string, string>;
              const suyo = g.equipo === "INTER";
              return (
                <li key={i} className="border-b border-zinc-800 py-1 print:border-zinc-300">
                  <b>{mmss(g.segundosPartido)}</b> · {g.parte} ·{" "}
                  <b>{suyo ? nosotros : cfg.rival}</b>
                  {suyo && e.goleador ? ` — ${e.goleador}` : ""}
                  {suyo && !e.goleador ? " — en propia del rival" : ""}
                  {e.asistente ? ` (asist. ${e.asistente})` : ""}
                  {e.accion ? ` · ${e.accion}` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-emerald-500 print:text-black">Faltas y tarjetas</h2>
          <table className="w-full">
            <tbody>
              <tr><td>Faltas</td><td className="text-right"><b>{suma("inter", "faltas")}</b> · rival {suma("rival", "faltas")}</td></tr>
              <tr><td>Amarillas</td><td className="text-right"><b>{suma("inter", "amarillas")}</b> · rival {suma("rival", "amarillas")}</td></tr>
              <tr><td>Tiempos muertos</td><td className="text-right"><b>{suma("inter", "tiemposMuerto")}</b> · rival {suma("rival", "tiemposMuerto")}</td></tr>
            </tbody>
          </table>
          {tarjetas.length > 0 && (
            <ul className="mt-1 text-xs text-zinc-400 print:text-zinc-700">
              {tarjetas.map((tj, i) => {
                const e = tj as never as Record<string, string>;
                return <li key={i}>{tj.tipo === "roja" ? "🟥" : "🟨"} {mmss(tj.segundosPartido)} · {tj.equipo === "INTER" ? (e.jugador || nosotros) : cfg.rival}</li>;
              })}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-emerald-500 print:text-black">Disparos</h2>
          <table className="w-full">
            <tbody>
              <tr><td>A puerta</td><td className="text-right"><b>{disparos.puerta}</b> · rival {partido.disparosRival?.puerta ?? 0}</td></tr>
              <tr><td>Fuera</td><td className="text-right"><b>{disparos.fuera}</b> · rival {partido.disparosRival?.fuera ?? 0}</td></tr>
              <tr><td>Al palo</td><td className="text-right"><b>{disparos.palo}</b> · rival {partido.disparosRival?.palo ?? 0}</td></tr>
              <tr><td>Bloqueados</td><td className="text-right"><b>{disparos.bloq}</b> · rival {partido.disparosRival?.bloqueado ?? 0}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-emerald-500 print:text-black">
          Jugadores ({partesJugadas.join(" · ")})
        </h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-[10px] uppercase text-zinc-400 print:border-black print:text-black">
              <th className="py-1">Nº</th><th>Jugador</th><th className="text-right">Min</th>
              <th className="text-right">Goles</th><th className="text-right">Asist.</th>
              <th className="text-right">Disp.</th><th className="text-right">Robos</th>
              <th className="text-right">Cortes</th><th className="text-right">Pérd.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre} className="border-b border-zinc-800 print:border-zinc-300">
                <td className="py-1 font-mono text-emerald-500 print:text-black">{f.dorsal}</td>
                <td>{f.nombre}</td>
                <td className="text-right font-mono">{formatMMSS(f.seg)}</td>
                <td className="text-right">{f.goles || ""}</td>
                <td className="text-right">{f.asis || ""}</td>
                <td className="text-right">{((f.c?.dpp ?? 0) + (f.c?.dpf ?? 0) + (f.c?.dpa ?? 0) + (f.c?.dpb ?? 0)) || ""}</td>
                <td className="text-right">{f.c?.robos || ""}</td>
                <td className="text-right">{f.c?.cortes || ""}</td>
                <td className="text-right">{((f.c?.pf ?? 0) + (f.c?.pnf ?? 0)) || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {porteros.length > 0 && (
          <div className="mt-3">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-emerald-500 print:text-black">Porteros</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-[10px] uppercase text-zinc-400 print:border-black print:text-black">
                  <th className="py-1">Nº</th><th>Portero</th><th className="text-right">Min</th>
                  <th className="text-right">Paradas</th><th className="text-right">Encajados</th>
                  <th className="text-right">% parada</th>
                </tr>
              </thead>
              <tbody>
                {porteros.map((f) => {
                  const par = f.c?.paradas ?? 0, enc = f.c?.golesEncajados ?? 0;
                  const tiros = par + enc;
                  return (
                    <tr key={f.nombre} className="border-b border-zinc-800 print:border-zinc-300">
                      <td className="py-1 font-mono text-emerald-500 print:text-black">{f.dorsal}</td>
                      <td>{f.nombre}</td>
                      <td className="text-right font-mono">{formatMMSS(f.seg)}</td>
                      <td className="text-right">{par || ""}</td>
                      <td className="text-right">{enc || ""}</td>
                      <td className="text-right">{tiros ? `${Math.round((par / tiros) * 100)}%` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[10px] text-zinc-500 print:text-zinc-600">
          {NOMBRE_CORTO_TC} · generado desde el crono del banquillo.
        </p>
      </section>
    </main>
  );
}
