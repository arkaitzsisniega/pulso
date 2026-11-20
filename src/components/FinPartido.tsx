"use client";

/**
 * FinPartido.tsx — Piezas de pantalla de «dar por terminado» (20/11/2026).
 * La regla vive en lib/finPartido.ts; aquí solo se cuenta en palabras.
 */
import type { Partido } from "@/lib/db";
import { mmss, type EstadoFin } from "@/lib/finPartido";
import { t, labelParte } from "@/lib/i18n";

/** Por qué un partido se queda abierto, en palabras. */
export function textoMotivoFin(fin: EstadoFin): string {
  if (fin.motivo === "parte_sin_acabar") {
    return t("fin_motivo_parte_sin_acabar", {
      parte: labelParte(fin.parte ?? "2T"), seg: mmss(fin.seg ?? 0), dur: mmss(fin.dur ?? 0),
    });
  }
  return t(`fin_motivo_${fin.motivo}`);
}

/** «J5.RIVAL · RIVAL · 2026-10-10» para nombrar un partido en una lista. */
export function nombrePartido(p: Partido): string {
  const c = p.config;
  if (!c) return p.id;
  return [c.partido_id, c.rival, c.fecha].filter(Boolean).join(" · ");
}

/** Lo que se enseña tras «Dar por terminados los que ya acabaron». */
export interface InformeCierre {
  hechos: number;
  abiertos: { nombre: string; motivo: string }[];
}

/**
 * Totales: el botón «Dar por terminados los que ya acabaron (N)» y, después,
 * el informe (cuántos se cerraron y cuáles siguen abiertos y por qué). Mismo
 * contenido en los dos aspectos; el clásico con sus clases de siempre.
 */
export function BloqueCerrarTerminados(props: {
  nuevo: boolean;
  cerrables: number;
  cerrando: boolean;
  informe: InformeCierre | null;
  onCerrar: () => void;
}) {
  const { nuevo, cerrables, informe } = props;
  if (!cerrables && !informe) return null;
  const sinIco = (s: string) => (nuevo ? s.replace(/^\p{Extended_Pictographic}️?\s*/u, "") : s);
  return (
    <div data-cerrar-terminados="" className={nuevo ? "pz-capa pz-tot-cerrar" : "mb-4 rounded-xl bg-zinc-900 p-3"}>
      {cerrables > 0 && (
        <>
          <button type="button" onClick={props.onCerrar} disabled={props.cerrando}
            style={{ touchAction: "manipulation" }}
            className={nuevo ? "pz-btn pz-tot-cerrar-btn"
              : "w-full rounded-xl bg-emerald-700 py-3 text-base font-bold hover:bg-emerald-600 disabled:opacity-60"}>
            {sinIco(t("tot_cerrar_btn", { n: cerrables }))}
          </button>
          <p className={nuevo ? "pz-tot-cerrar-nota" : "mt-2 text-xs text-zinc-400"}>{t("tot_cerrar_explica")}</p>
        </>
      )}
      {informe && (
        <div className={nuevo ? "pz-tot-cerrar-inf" : "mt-3 text-sm"} data-cerrar-informe="">
          <p className={nuevo ? "ok" : "font-bold text-emerald-300"}>
            {informe.hechos > 0 ? sinIco(t("tot_cerrar_hecho", { n: informe.hechos })) : t("tot_cerrar_ninguno")}
          </p>
          {informe.abiertos.length > 0 && (
            <>
              <p className={nuevo ? "" : "mt-2 text-zinc-300"}>{t("tot_cerrar_abiertos", { n: informe.abiertos.length })}</p>
              <ul className={nuevo ? "" : "mt-1 list-disc pl-5 text-zinc-400"}>
                {informe.abiertos.map((a, i) => (
                  <li key={i}><b>{a.nombre}</b> — {a.motivo}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
