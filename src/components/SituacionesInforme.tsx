"use client";

/**
 * SituacionesInforme — la tabla «Disparos por situación» del informe
 * imprimible (24/11/2026). Las cuentas viven en `lib/situacionesNumericas.ts`;
 * aquí solo se pinta. La usan los dos informes: el del Inter / filial / juvenil
 * (`app/informe/page.tsx`) y el completo de PULSO (`InformeCompleto.tsx`), en
 * los dos aspectos (clásico y nuevo): es una tabla en blanco y negro con el
 * color del club solo en la cabecera, que sale bien en papel con cualquiera.
 *
 * Si el partido no tuvo ninguna situación especial no se llama: el informe de
 * un partido viejo sale igual que antes.
 */
import React from "react";
import { t } from "@/lib/i18n";
import {
  CLAVE_SITUACION, minutosSituacion, type CuadroSituaciones, type FilaSituacion,
} from "@/lib/situacionesNumericas";

export function TablaSituaciones(props: {
  cuadro: CuadroSituaciones; nos: string; rival: string; color: string;
  /** Clase extra de la tabla (el informe completo usa la suya). */
  clase?: string;
}) {
  const { cuadro, nos, rival, color } = props;
  const filas: FilaSituacion[] = [...cuadro.filas, cuadro.resto];
  const th = "py-1 px-1 font-semibold text-right";
  const td = "py-[3px] px-1 text-right tabular-nums";
  return (
    <>
      <table className={`w-full border-collapse text-[10px] ${props.clase ?? ""}`}>
        <thead>
          <tr className="text-[8.5px] uppercase tracking-wide">
            <th />
            <th />
            <th colSpan={3} className="px-1 text-center font-bold" style={{ color }}>
              {t("sit_favor")} · {nos}
            </th>
            <th colSpan={3} className="px-1 text-center font-bold text-zinc-600">
              {t("sit_contra")} · {rival.slice(0, 18)}
            </th>
          </tr>
          <tr className="border-b border-zinc-300 text-[8.5px] uppercase tracking-wide text-zinc-500">
            <th className="py-1 text-left font-semibold">{t("sit_situacion")}</th>
            <th className={th}>{t("sit_tiempo")}</th>
            <th className={th}>{t("sit_cab_disp")}</th>
            <th className={th}>{t("sit_cab_puerta")}</th>
            <th className={th}>{t("sit_cab_goles")}</th>
            <th className={th}>{t("sit_cab_disp")}</th>
            <th className={th}>{t("sit_cab_puerta")}</th>
            <th className={th}>{t("sit_cab_goles")}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const resto = f.clave === "resto";
            return (
              <tr key={f.clave}
                  className={`border-b border-zinc-100${resto ? " text-zinc-500" : ""}`}>
                <td className={`py-[3px] text-left${resto ? "" : " font-semibold"}`}>
                  {t(CLAVE_SITUACION[f.clave])}
                </td>
                <td className={td}>{minutosSituacion(f.segundos)}</td>
                <td className={`${td} font-bold`}>{f.favor.disparos}</td>
                <td className={td}>{f.favor.aPuerta}</td>
                <td className={td}>{f.favor.goles}</td>
                <td className={`${td} font-bold`}>{f.contra.disparos}</td>
                <td className={td}>{f.contra.aPuerta}</td>
                <td className={td}>{f.contra.goles}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[8px] text-zinc-500">
        {t("sit_nota")}{cuadro.haySolape ? ` ${t("sit_nota_solape")}` : ""}
      </p>
    </>
  );
}
