"use client";

/**
 * FiltroTotales.tsx — Casillas de «qué partidos entran» en Totales
 * (25/11/2026). La lógica vive en lib/filtroTotales.ts; esto solo dibuja, con
 * el aspecto clásico (Tailwind) o el nuevo (clases pz-tot-filtro-* de
 * app/tema-nuevo.css).
 *
 * Arriba, una casilla por competición con su número de partidos y los atajos
 * «Todas» y «Solo liga». Debajo, plegada, la lista de partidos (el más
 * reciente arriba, el vídeo encima de su directo: lib/ordenPartidos.ts) con
 * casilla para cada uno. Las versiones repetidas (directo con su vídeo) salen
 * en la lista sin casilla y diciendo por qué no cuentan.
 */
import { useEffect, useRef } from "react";
import type { Partido } from "@/lib/db";
import { CLIENTE } from "@/lib/clientes";
import { sinEmojis } from "@/components/DirectoNuevo";
import { t, nombreCompeticion } from "@/lib/i18n";
import {
  type FiltroTotales as Filtro, alternarCompeticion, alternarPartido, competiciones,
  competicionDe, incluido, soloCompeticion, FILTRO_TODO,
} from "@/lib/filtroTotales";

/** Casilla con estado «a medias» (competición con unos partidos sí y otros no). */
function Casilla(props: { marcada: boolean; aMedias?: boolean; onCambio?: () => void; disabled?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!props.aMedias; }, [props.aMedias]);
  return (
    <input ref={ref} type="checkbox" checked={props.marcada} disabled={props.disabled}
           onChange={() => props.onCambio?.()} className={props.className} />
  );
}

export function FiltroTotales(props: {
  nuevo: boolean;
  /** Todos los finalizados (los que cuentan y los repetidos), ya ordenados. */
  lista: Partido[];
  /** Los que cuentan (sin duplicados de vídeo): entre ellos se elige. */
  cuentan: Partido[];
  /** id → por qué NO cuenta (repetido). */
  fuera: Map<string, "directo" | "video">;
  filtro: Filtro;
  onCambiar: (f: Filtro) => void;
}) {
  const { nuevo, lista, cuentan, fuera, filtro, onCambiar } = props;
  if (!cuentan.length) return null;
  const comps = competiciones(cuentan, filtro);
  const hayLiga = comps.some((c) => c.codigo === "LIGA");
  const dentro = cuentan.filter((p) => incluido(p, filtro)).length;
  const soloLiga = hayLiga && comps.every((c) => (c.codigo === "LIGA" ? c.estado === "todos" : c.estado === "ninguno"));
  const todas = dentro === cuentan.length;

  const marcador = (p: Partido) => {
    const c = p.config!;
    const gf = p.marcador?.inter ?? 0, gc = p.marcador?.rival ?? 0;
    return c.local ? `${CLIENTE.nombreCorto} ${gf} - ${gc} ${c.rival}` : `${c.rival} ${gc} - ${gf} ${CLIENTE.nombreCorto}`;
  };

  if (nuevo) {
    return (
      <section className="pz-capa pz-tot-sec pz-tot-filtro">
        <h2 className="pz-res-h3">{t("tot_filtro_titulo")}</h2>
        <div className="atajos">
          <button type="button" className={"pz-tot-fbtn" + (todas ? " on" : "")}
                  onClick={() => onCambiar({ ...FILTRO_TODO, sueltos: {} })}>{t("tot_filtro_todas")}</button>
          {hayLiga && comps.length > 1 && (
            <button type="button" className={"pz-tot-fbtn" + (soloLiga ? " on" : "")}
                    onClick={() => onCambiar(soloCompeticion(cuentan, "LIGA"))}>{t("tot_filtro_solo_liga")}</button>
          )}
          {comps.map((c) => (
            <label key={c.codigo} className={"pz-tot-fcomp" + (c.estado !== "ninguno" ? " on" : "")}>
              <Casilla marcada={c.estado === "todos"} aMedias={c.estado === "algunos"}
                       onCambio={() => onCambiar(alternarCompeticion(cuentan, filtro, c.codigo))} />
              <span>{nombreCompeticion(c.codigo)}</span>
              <span className="n pz-num">{c.estado === "algunos" ? `${c.dentro}/${c.n}` : c.n}</span>
            </label>
          ))}
        </div>
        <details className="pz-tot-flista">
          <summary>{t("tot_filtro_elegir", { n: dentro, total: cuentan.length })}</summary>
          <ul>
            {lista.map((p) => {
              const porque = fuera.get(p.id);
              return (
                <li key={p.id} className={porque ? "fuera" : incluido(p, filtro) ? "" : "no"}>
                  <label>
                    <Casilla marcada={!porque && incluido(p, filtro)} disabled={!!porque}
                             onCambio={() => onCambiar(alternarPartido(p, filtro))} />
                    <span className="fecha pz-num">{p.config?.fecha}</span>
                    <span className="marc">{marcador(p)}</span>
                    {p.modo === "video" && <span className="pz-chip">{sinEmojis(t("home_modo_video"))}</span>}
                    <span className="pz-chip">{nombreCompeticion(competicionDe(p))}</span>
                  </label>
                  {porque && <span className="porque">{t(porque === "directo" ? "tot_filtro_fuera_directo" : "tot_filtro_fuera_video")}</span>}
                </li>
              );
            })}
          </ul>
          <p className="pz-tot-nota">{t("tot_filtro_dup")}</p>
        </details>
      </section>
    );
  }

  const btn = (on: boolean) => "rounded-lg px-3 py-2 text-sm font-bold " + (on ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-300");
  return (
    <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-500">{t("tot_filtro_titulo")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn(todas)} onClick={() => onCambiar({ ...FILTRO_TODO, sueltos: {} })}>{t("tot_filtro_todas")}</button>
        {hayLiga && comps.length > 1 && (
          <button type="button" className={btn(soloLiga)} onClick={() => onCambiar(soloCompeticion(cuentan, "LIGA"))}>{t("tot_filtro_solo_liga")}</button>
        )}
        {comps.map((c) => (
          <label key={c.codigo} className={"flex items-center gap-2 rounded-lg px-3 py-2 text-sm "
            + (c.estado !== "ninguno" ? "bg-zinc-800 text-zinc-100" : "bg-zinc-900 text-zinc-500")}>
            <Casilla marcada={c.estado === "todos"} aMedias={c.estado === "algunos"} className="h-4 w-4 accent-emerald-600"
                     onCambio={() => onCambiar(alternarCompeticion(cuentan, filtro, c.codigo))} />
            {nombreCompeticion(c.codigo)}
            <span className="font-mono text-xs text-zinc-400">{c.estado === "algunos" ? `${c.dentro}/${c.n}` : c.n}</span>
          </label>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-zinc-300">{t("tot_filtro_elegir", { n: dentro, total: cuentan.length })}</summary>
        <ul className="mt-2 text-sm">
          {lista.map((p) => {
            const porque = fuera.get(p.id);
            const si = !porque && incluido(p, filtro);
            return (
              <li key={p.id} className={"border-b border-zinc-900 py-1 " + (si ? "" : "text-zinc-500")}>
                <label className="flex items-center gap-2">
                  <Casilla marcada={si} disabled={!!porque} className="h-4 w-4 accent-emerald-600"
                           onCambio={() => onCambiar(alternarPartido(p, filtro))} />
                  <span className="font-mono text-xs text-zinc-500">{p.config?.fecha}</span>
                  <span className="flex-1">{marcador(p)}</span>
                  {p.modo === "video" && <span className="text-[10px] uppercase text-sky-400">{t("home_modo_video")}</span>}
                  <span className="text-[10px] uppercase text-zinc-600">{nombreCompeticion(competicionDe(p))}</span>
                </label>
                {porque && <span className="ml-6 text-[11px] italic text-zinc-500">{t(porque === "directo" ? "tot_filtro_fuera_directo" : "tot_filtro_fuera_video")}</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[10px] text-zinc-500">{t("tot_filtro_dup")}</p>
      </details>
    </section>
  );
}

/** «Liga · 9 partidos», «Liga + Copa del Rey · 12 partidos», «… · selección a mano». */
export function textoFiltro(d: { comps: string[]; manual: boolean; n: number } | null, total: number): string {
  const nn = (n: number) => (n === 1 ? t("tot_filtro_n_1") : t("tot_filtro_n", { n }));
  if (!d) return `${t("tot_filtro_todas_comp")} · ${nn(total)}`;
  if (!d.n) return nn(0);
  const partes = [d.comps.map(nombreCompeticion).join(" + "), nn(d.n)];
  if (d.manual) partes.push(t("tot_filtro_manual"));
  return partes.join(" · ");
}
