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
import { useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { CLIENTE } from "@/lib/clientes";
import { variablesEquipos } from "@/lib/tema";
import { useModoSol, setModoSol } from "@/lib/aspecto";
import { Ico, sinEmojis } from "@/components/DirectoNuevo";
import { BotonSol, LogoPulso } from "@/components/InicioNuevo";
import { Escudo } from "@/components/Escudo";

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

/**
 * La pantalla de CONTRASEÑA con el aspecto nuevo (23/11/2026).
 *
 * SOLO dibuja: el texto escrito, el error, el «comprobando» y el envío llegan
 * de AuthGate, que sigue haciendo la comprobación de siempre (SHA-256 contra
 * los hashes del club y la marca en localStorage). Nada de esto toca la red:
 * el escudo es un fichero del propio crono, guardado para usar sin conexión.
 *
 * Pensada para el iPad: campo grande (dedo y teclado), sin mayúscula ni
 * corrector automáticos, «Ir» del teclado = Entrar, y un botón para ver lo
 * escrito. El error sale en un recuadro amable que dice qué revisar.
 */
export function PantallaClave(props: {
  valor: string;
  onValor: (v: string) => void;
  error: string;
  comprobando: boolean;
  onEntrar: (e?: React.FormEvent) => void;
}) {
  const sol = useModoSol();
  const [ver, setVer] = useState(false);
  const vacio = !props.valor.trim();
  return (
    <Fondo sol={sol}>
      <div className="pz-vac-sol"><BotonSol sol={sol} onCambiar={() => setModoSol(!sol)} /></div>
      <div className="pz-capa pz-vac-caja pz-clave" data-pantalla-clave="">
        <Escudo className="pz-clave-escudo" />
        <h1 className="pz-vac-tit">{sinEmojis(t("login_titulo", { marca: CLIENTE.marcaTitulo }))}</h1>
        <p className="pz-vac-ayuda">{t("login_subtitulo")}</p>
        <form className="pz-clave-form" onSubmit={props.onEntrar}>
          <div className={`pz-clave-campo${props.error ? " mal" : ""}`}>
            <Ico.candado className="pz-ico pz-clave-candado" />
            <input type={ver ? "text" : "password"}
              value={props.valor}
              onChange={(e) => props.onValor(e.target.value)}
              placeholder={t("login_placeholder")}
              aria-label={t("login_placeholder")}
              aria-invalid={props.error ? true : undefined}
              autoComplete="current-password"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              enterKeyHint="go"
              autoFocus />
            <button type="button" className="pz-clave-ver" onClick={() => setVer(!ver)}
              aria-label={ver ? t("login_ocultar") : t("login_mostrar")}
              title={ver ? t("login_ocultar") : t("login_mostrar")}>
              {ver ? <Ico.ojoNo /> : <Ico.ojo />}
            </button>
          </div>
          {props.error && (
            <div className="pz-clave-error" role="alert">
              <Ico.aviso className="pz-ico" />
              <div><b>{props.error}</b><span>{t("login_reintentar")}</span></div>
            </div>
          )}
          <button type="submit" className="pz-vac-btn lleno pz-clave-entrar"
            disabled={vacio || props.comprobando}>
            <span>{props.comprobando ? t("login_comprobando") : t("login_entrar")}</span>
            {!props.comprobando && <Ico.flechaDer />}
          </button>
        </form>
        <p className="pz-clave-olvido">{t("login_olvidada")}</p>
      </div>
      <p className="pz-vac-pie">
        <LogoPulso className="pz-ini-logo" aro />
        <span>{t("login_sin_red")}</span>
      </p>
    </Fondo>
  );
}
