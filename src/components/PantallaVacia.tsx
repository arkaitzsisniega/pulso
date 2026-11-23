"use client";

/**
 * PantallaVacia.tsx — Pantallas «sin nada que enseñar» con el aspecto NUEVO
 * (23/11/2026, para el 15/12: todos con el nuevo, lib/aspecto.ts).
 *
 * Hasta ahora, «No hay partido en curso» (directo), «No hay partido para
 * resumir» (resumen), «No hay ningún partido abierto» (informe) y los
 * «Cargando…» de esas páginas salían con el dibujo antiguo (fondo negro,
 * botones grises de Tailwind) aunque todo lo demás ya fuera nuevo.
 *
 * Mismo lenguaje que el inicio (tema-nuevo.css, clases pz-vac-*): icono en un
 * círculo, título en Barlow, una línea de ayuda y DOS salidas claras:
 *   · la principal, rellena con el color del club (como «Partido nuevo»);
 *   · la secundaria, en capa con borde (como «Estadísticas totales»).
 * Respeta el modo Sol y trae su botón. Sin red funciona igual: no carga nada.
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { CLIENTE } from "@/lib/clientes";
import { variablesEquipos } from "@/lib/tema";
import { useModoSol, setModoSol } from "@/lib/aspecto";
import { Ico, sinEmojis } from "@/components/DirectoNuevo";
import { BotonSol, LogoPulso } from "@/components/InicioNuevo";

/** Una salida de la pantalla: a dónde va, su icono y su texto. */
export type SalidaVacia = { href: string; icono: ReactNode; texto: string };

/** Las dos salidas de siempre, para no repetirlas en cada página. */
export const SALIDA_INICIO: SalidaVacia = { href: "/", icono: <Ico.casa />, texto: "inicio" };
export const SALIDA_NUEVO: SalidaVacia = { href: "/nuevo", icono: <Ico.mas />, texto: "vac_empezar" };

/** Fondo, colores del club y modo Sol: lo que comparten la vacía y la de carga. */
function Fondo(props: { sol: boolean; children: ReactNode; cargando?: boolean }) {
  return (
    <div className={`pz pz-vac${props.cargando ? " cargando" : ""}`}
      data-tema={props.sol ? "sol" : undefined}
      data-pantalla-vacia=""
      style={variablesEquipos(CLIENTE.colorPropio, props.sol) as React.CSSProperties}>
      {props.children}
    </div>
  );
}

export function PantallaVacia(props: {
  /** Icono grande de arriba (Ico.*). */
  icono: ReactNode;
  /** Clave i18n del título («No hay partido en curso.»). */
  titulo: string;
  /** Clave i18n de la línea de ayuda. */
  ayuda: string;
  principal: SalidaVacia;
  secundaria: SalidaVacia;
}) {
  const sol = useModoSol();
  const { principal: p, secundaria: s } = props;
  return (
    <Fondo sol={sol}>
      <div className="pz-vac-sol"><BotonSol sol={sol} onCambiar={() => setModoSol(!sol)} /></div>
      <div className="pz-capa pz-vac-caja" role="status">
        <span className="pz-vac-ic">{props.icono}</span>
        <h1 className="pz-vac-tit">{sinEmojis(t(props.titulo)).replace(/\.$/, "")}</h1>
        <p className="pz-vac-ayuda">{t(props.ayuda)}</p>
        <div className="pz-vac-acc">
          <Link href={p.href} className="pz-vac-btn lleno" data-salida={p.href}>
            {p.icono}<span>{sinEmojis(t(p.texto))}</span>
          </Link>
          <Link href={s.href} className="pz-vac-btn" data-salida={s.href}>
            {s.icono}<span>{sinEmojis(t(s.texto))}</span>
          </Link>
        </div>
      </div>
      <p className="pz-vac-pie">
        <LogoPulso className="pz-ini-logo" aro />
        <span>{CLIENTE.nombreLargo}</span>
      </p>
    </Fondo>
  );
}

/** El «Cargando…» de las mismas páginas: un instante, sin botones. */
export function PantallaCargando(props: { texto?: string }) {
  const sol = useModoSol();
  return (
    <Fondo sol={sol} cargando>
      <LogoPulso className="pz-vac-logo" aro />
      <p className="pz-vac-cargando">{t(props.texto ?? "cargando")}</p>
    </Fondo>
  );
}
