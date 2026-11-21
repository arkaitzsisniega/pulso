"use client";

/**
 * ServidorClub.tsx — Lo que se ve del servidor de partidos (fase 2, 21/11/2026).
 *
 *   · SincronizadorServidor: va en el layout (todas las pantallas) y arranca la
 *     subida automática (lib/servidor.ts). Apagado = no hace nada.
 *   · IconoSubida: el iconito de cada partido en el inicio (subido / pendiente
 *     / error / lo apunta otro aparato), en los dos aspectos.
 *   · useServidorClub: la ventana «Partidos del club» — conectar el aparato
 *     con la contraseña del club, desconectarlo, la lista del servidor con
 *     quién apunta cada partido, «Abrir en este aparato» (la misma ventana de
 *     «Importar partido», con su pregunta si ya hay uno con ese id) y «Tomar el
 *     control» con confirmación.
 *
 * La ventana usa el mismo dibujo en los dos aspectos (como la de importar);
 * con el nuevo, los emojis de los títulos pasan a iconos.
 */
import { useEffect, useState, type ReactNode } from "react";
import { type Partido } from "@/lib/db";
import { CLIENTE } from "@/lib/clientes";
import { t } from "@/lib/i18n";
import {
  SERVIDOR_ACTIVO, arrancarSincronizacion, useServidor, conectar, desconectar, partidosDelClub,
  bajarDelClub, tomarControlDe, marcarAbierto, reintentarSubida, nombreAparatoGuardado,
} from "@/lib/servidor";
import type { FichaSubida, PartidoClub } from "@/lib/colaSubida";
import { conIconos, Ico } from "@/components/DirectoNuevo";

export function SincronizadorServidor() {
  useEffect(() => arrancarSincronizacion(), []);
  return null;
}

/** El porqué de un fallo, en el idioma activo. */
export function textoMotivo(codigo: string | undefined): string {
  switch (codigo) {
    case "red": case "respuesta": return t("sv_motivo_red");
    case "sin_llave": return t("sv_motivo_sin_llave");
    case "no_existe": return t("sv_motivo_no_existe");
    case "no_partido": case "id_distinto": case "es_copia": case "no_json": case "vacio": return t("sv_motivo_no_partido");
    case "grande": return t("sv_motivo_grande");
    case "version": return t("sv_motivo_version");
    case "otro_club": return t("sv_motivo_otro_club");
    case "id": return t("sv_motivo_id");
    default: return t("sv_motivo_otro", { codigo: codigo ?? "?" });
  }
}

function textoEstado(f: FichaSubida): string {
  switch (f.estado) {
    case "subido": return t("sv_estado_subido");
    case "subiendo": return t("sv_estado_subiendo");
    case "pendiente": return t("sv_estado_pendiente");
    case "ajeno": return t("sv_estado_ajeno");
    default: return t("sv_estado_error");
  }
}

/** Icono pequeño del estado de subida de un partido. Nada si el servidor está
 *  apagado, si el aparato no está conectado o si ese partido no se sube. Con
 *  error, tocarlo explica el motivo y deja reintentar. */
export function IconoSubida(props: { id: string; nuevo: boolean }) {
  const sv = useServidor();
  const f = sv.fichas[props.id];
  if (!SERVIDOR_ACTIVO || !f || f.estado === "omitido") return null;
  let titulo = textoEstado(f);
  if (f.estado === "pendiente" && f.codigo) titulo += ` — ${textoMotivo(f.codigo)}`;
  if (f.estado === "error") titulo += ` — ${textoMotivo(f.codigo)}`;
  if (f.estado === "ajeno") titulo = f.dueno?.nombre ? t("sv_manda", { aparato: f.dueno.nombre }) : titulo;
  const icono = f.estado === "subido" ? <Ico.nubeOk className="pz-ico mini" />
    : f.estado === "error" ? <Ico.aviso className="pz-ico mini" />
    : f.estado === "ajeno" ? <Ico.ojo className="pz-ico mini" />
    : <Ico.nubeSube className="pz-ico mini" />;
  const alTocar = () => {
    if (f.estado !== "error") { alert(titulo); return; }
    if (confirm(`${titulo}\n\n${t("sv_reintentar")}?`)) void reintentarSubida(f.id);
  };
  const cls = props.nuevo
    ? `pz-chip subida ${f.estado}`
    : `inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        f.estado === "subido" ? "bg-emerald-900 text-emerald-200"
        : f.estado === "error" ? "bg-red-900 text-red-100"
        : f.estado === "ajeno" ? "bg-zinc-700 text-zinc-200"
        : "bg-amber-900 text-amber-100"}`;
  return (
    <button type="button" className={cls} title={titulo} aria-label={titulo} onClick={alTocar}
      data-subida={f.estado} style={{ touchAction: "manipulation" }}>
      {icono}
      {!props.nuevo && <span className="sr-only">{titulo}</span>}
    </button>
  );
}

type Importador = {
  abrirTexto: (texto: string, cb?: (p: Partido, copia: boolean) => void | Promise<void>) => Promise<void>;
};

/** La ventana «Partidos del club». `locales` = los partidos de este aparato. */
export function useServidorClub(opts: { nuevo: boolean; importar: Importador; locales: Partido[]; onCambio: () => void }) {
  const sv = useServidor();
  const [abierta, setAbierta] = useState(false);
  const [lista, setLista] = useState<PartidoClub[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [contrasena, setContrasena] = useState("");
  const [aparato, setAparato] = useState("");
  const ic = (txt: string): ReactNode => (opts.nuevo ? conIconos(txt) : txt);

  const recargar = async () => {
    setCargando(true); setError(null);
    const r = await partidosDelClub();
    setCargando(false);
    if (r.ok) setLista(r.datos);
    else { setLista(null); setError(t("sv_err_lista", { motivo: textoMotivo(r.codigo) })); }
  };

  const abrir = () => {
    setAbierta(true); setError(null);
    setAparato((a) => a || nombreAparatoGuardado());
    if (sv.sesion) void recargar();
  };
  const cerrar = () => { if (!trabajando) { setAbierta(false); setContrasena(""); } };

  const enviarConexion = async () => {
    if (trabajando || !contrasena) return;
    setTrabajando("conectar"); setError(null);
    const r = await conectar(contrasena, aparato);
    setTrabajando(null);
    if (r.ok) { setContrasena(""); void recargar(); return; }
    setError(r.codigo === "credenciales" ? t("sv_err_credenciales")
      : r.codigo === "demasiados_intentos" ? t("sv_err_intentos")
      : r.codigo === "red" ? t("sv_err_red") : t("sv_err_otro", { codigo: r.codigo }));
  };

  const quitar = () => {
    if (!confirm(t("sv_desconectar_confirm"))) return;
    desconectar();
    setLista(null);
  };

  /** Bajar la última versión y meterla aquí con la ventana de importar. */
  const traer = async (p: PartidoClub, soyYo: boolean) => {
    const b = await bajarDelClub(p.id);
    if (!b.ok) { setError(t("sv_err_accion", { motivo: textoMotivo(b.codigo) })); return false; }
    const dueno = soyYo && sv.sesion ? { id: sv.sesion.aparato.id, nombre: sv.sesion.aparato.nombre }
      : { id: p.dueno.id, nombre: p.dueno.nombre };
    setAbierta(false);                               // la de importar va encima
    await opts.importar.abrirTexto(b.datos.texto, async (guardado, copia) => {
      if (!copia) await marcarAbierto(guardado.id, guardado.actualizado, b.datos.version, dueno, soyYo);
    });
    return true;
  };

  const abrirAqui = async (p: PartidoClub) => {
    if (trabajando) return;
    setTrabajando(p.id); setError(null);
    try { await traer(p, p.dueno.soy_yo); } finally { setTrabajando(null); }
  };

  const tomar = async (p: PartidoClub) => {
    if (trabajando) return;
    const nombre = p.dueno.nombre || t("sv_otro_aparato");
    if (!confirm(t("sv_tomar_confirm", { partido: `${p.partido_id} · ${p.rival}`, aparato: nombre }))) return;
    setTrabajando(p.id); setError(null);
    try {
      const aqui = opts.locales.some((l) => l.id === p.id);
      const r = await tomarControlDe(p.id, aqui && sv.fichas[p.id]?.version === p.version);
      if (!r.ok) setError(t("sv_err_accion", { motivo: textoMotivo(r.codigo) }));
      opts.onCambio();
      await recargar();
    } finally { setTrabajando(null); }
  };

  const fila = (p: PartidoClub) => {
    const aqui = opts.locales.some((l) => l.id === p.id);
    const f = sv.fichas[p.id];
    // El que manda y ya lo tiene aquí no «trae» nada: lo suyo es lo último (y
    // traerlo mientras sube lo de aquí acabaría en un choque de versiones).
    const alDia = aqui && (f?.version === p.version || p.dueno.soy_yo);
    return (
      <div key={p.id} className="bg-zinc-800 rounded-xl p-3" data-club-partido={p.id}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-white">{p.partido_id}</span>
          <span className="text-zinc-400">· {p.rival} · {p.fecha}</span>
        </div>
        <div className="text-lg font-bold tabular-nums">
          {CLIENTE.nombreCorto} {p.marcador.inter} - {p.marcador.rival} {p.rival}
          <span className="text-xs font-normal text-zinc-400 ml-2">
            {ic(p.modo === "video" ? t("home_modo_video") : t("home_modo_directo"))}
            {" · "}{p.estado === "finalizado" ? t("home_estado_fin") : t("home_estado_curso")}
            {" · "}{t("sv_version", { n: p.version })}
          </span>
        </div>
        <div className="text-sm text-zinc-300 mt-1" data-club-dueno={p.dueno.soy_yo ? "yo" : "otro"}>
          {p.dueno.soy_yo ? t("sv_manda_yo") : t("sv_manda", { aparato: p.dueno.nombre || t("sv_otro_aparato") })}
          <span className="text-zinc-500"> · {aqui ? t("sv_aqui_si") : t("sv_aqui_no")}</span>
        </div>
        <div className="flex gap-2 flex-wrap mt-2">
          {!alDia && (
            <button type="button" disabled={!!trabajando} onClick={() => abrirAqui(p)} data-club-abrir=""
              style={{ touchAction: "manipulation" }}
              className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-bold disabled:opacity-60">
              {aqui ? t("sv_abrir_otra_vez") : t("sv_abrir")}
            </button>
          )}
          {!p.dueno.soy_yo && (
            <button type="button" disabled={!!trabajando} onClick={() => tomar(p)} data-club-tomar=""
              style={{ touchAction: "manipulation" }}
              className="px-3 py-2 rounded-lg bg-amber-800 hover:bg-amber-700 text-sm font-bold disabled:opacity-60">
              {t("sv_tomar")}
            </button>
          )}
          {trabajando === p.id && <span className="text-sm text-zinc-400 self-center">{t("sv_trabajando")}</span>}
        </div>
      </div>
    );
  };

  let cuerpo: ReactNode;
  if (!sv.sesion) {
    cuerpo = (
      <>
        <h3 className="text-2xl font-bold mb-1">{ic(t("sv_conectar_titulo"))}</h3>
        <p className="text-sm text-zinc-400 mb-4">{t("sv_conectar_explica")}</p>
        {sv.caducada && <p className="text-sm text-amber-300 mb-3">{t("sv_caducada")}</p>}
        <form onSubmit={(e) => { e.preventDefault(); void enviarConexion(); }} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-zinc-300">{t("sv_contrasena")}</span>
            <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)}
              autoComplete="current-password" data-club-contrasena=""
              className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-lg" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-zinc-300">{t("sv_aparato")}</span>
            <input type="text" value={aparato} onChange={(e) => setAparato(e.target.value)} maxLength={60}
              placeholder={t("sv_aparato_ejemplo")} data-club-aparato=""
              className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-lg" />
          </label>
          {error && <p className="text-sm text-red-300" data-club-error="">{error}</p>}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button type="button" onClick={cerrar}
              className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
              {t("cancelar")}
            </button>
            <button type="submit" disabled={!contrasena || !!trabajando} data-club-conectar=""
              className="py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-base font-bold disabled:opacity-60">
              {trabajando === "conectar" ? t("sv_conectando") : t("sv_conectar")}
            </button>
          </div>
        </form>
      </>
    );
  } else {
    cuerpo = (
      <>
        <h3 className="text-2xl font-bold mb-1">{ic(t("sv_lista_titulo"))}</h3>
        <p className="text-sm text-zinc-400">{t("sv_lista_explica")}</p>
        <p className="text-sm text-emerald-300 mt-2 mb-4" data-club-conectado="">
          {t("sv_conectado", { aparato: sv.sesion.aparato.nombre })}
        </p>
        {error && <p className="text-sm text-red-300 mb-3" data-club-error="">{error}</p>}
        {cargando ? <p className="text-zinc-400">{t("cargando")}</p>
          : lista && lista.length === 0 ? <p className="text-zinc-400">{t("sv_lista_vacia")}</p>
          : lista ? <div className="grid gap-2">{lista.map(fila)}</div> : null}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button type="button" onClick={() => void recargar()} disabled={cargando || !!trabajando}
            className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
            {t("sv_actualizar")}
          </button>
          <button type="button" onClick={cerrar}
            className="py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-base font-bold">
            {t("imp_cerrar")}
          </button>
        </div>
        <button type="button" onClick={quitar} data-club-desconectar=""
          className="w-full mt-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-red-300">
          {t("sv_desconectar")}
        </button>
      </>
    );
  }

  const ventana = !SERVIDOR_ACTIVO || !abierta ? null : (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={cerrar}>
      <div className="bg-zinc-900 text-zinc-100 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog" aria-modal="true" data-club-ventana={sv.sesion ? "lista" : "conectar"}
        onClick={(e) => e.stopPropagation()}>
        {cuerpo}
      </div>
    </div>
  );

  /** Una línea para debajo del botón: conectado o no. */
  const linea = !SERVIDOR_ACTIVO ? null
    : sv.sesion ? t("sv_conectado", { aparato: sv.sesion.aparato.nombre })
    : sv.caducada ? t("sv_caducada") : t("sv_sin_conectar");

  return { activo: SERVIDOR_ACTIVO, abrir, ventana, linea, conectado: !!sv.sesion };
}
