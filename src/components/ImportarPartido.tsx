"use client";

/**
 * ImportarPartido.tsx — «Importar partido» de la pantalla de inicio
 * (19/11/2026). La lógica (validar, club, reloj, choque) está en
 * lib/importarPartido.ts; aquí van el selector de archivo y la ventana.
 *
 * Lo usan los DOS aspectos: cada uno dibuja su botón y llama a `abrir`; el
 * selector y la ventana son los mismos (como la de «Rehacer con vídeo»), y con
 * el aspecto nuevo los emojis de los títulos pasan a iconos.
 *
 * iPad: el selector es un <input type="file"> normal, que en iOS abre
 * «Archivos» (y desde ahí iCloud, Descargas, lo guardado de AirDrop, Mail o
 * WhatsApp). iOS a veces no filtra por tipo y deja elegir cualquier cosa: por
 * eso el contenido se valida entero y lo que no es un partido no entra.
 * Todo pasa en el aparato: sin internet funciona igual.
 */
import { useRef, useState, type ReactNode } from "react";
import { type Partido } from "@/lib/db";
import { partidoGuardado, guardarPartidoImportado } from "@/lib/store";
import { validarArchivo, contarAcciones, TAMANO_MAXIMO, type ResultadoValidacion } from "@/lib/importarPartido";
import { estadoFin, marcarFinalizado } from "@/lib/finPartido";
import { CLIENTE, CLIENTE_ID, ROSTER, nombreClub } from "@/lib/clientes";
import { t, labelEstadoPartido } from "@/lib/i18n";
import { conIconos } from "@/components/DirectoNuevo";

type Paso =
  | { k: "nada" }
  | { k: "leyendo" }
  | { k: "choque"; nuevo: Partido; aqui: Partido; info: Extract<ResultadoValidacion, { ok: true }> }
  | { k: "hecho"; p: Partido; copia: boolean; info: Extract<ResultadoValidacion, { ok: true }>; n?: number; total?: number }
  | { k: "error"; msg: string };

/** El texto de un fallo de validación, en el idioma activo. */
function mensajeError(r: Extract<ResultadoValidacion, { ok: false }>): string {
  switch (r.error) {
    case "vacio": return t("imp_err_vacio");
    case "grande": return t("imp_err_grande");
    case "no_json": return t("imp_err_no_json");
    case "es_copia": return t("imp_err_es_copia");
    case "version": return t("imp_err_version");
    case "otro_club": return t("imp_err_otro_club", { club: nombreClub(r.detalle ?? "") });
    case "otro_roster": return t("imp_err_otro_roster", { club: CLIENTE.nombreLargo, n: r.n ?? 0, total: r.total ?? 0 });
    case "no_partido": return t("imp_err_no_partido", { detalle: r.detalle ?? "?" });
  }
}

const cuando = (ms: number) => {
  try {
    return new Date(ms).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

export function useImportarPartido(opts: { nuevo: boolean; onHecho: () => void; onVer: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState<Paso>({ k: "nada" });
  const [guardando, setGuardando] = useState(false);
  const ic = (txt: string): ReactNode => (opts.nuevo ? conIconos(txt) : txt);

  // Se abre el selector DENTRO del toque (iOS no abre «Archivos» si no).
  const abrir = () => { input.current?.click(); };

  // Quien abre desde «Partidos del club» quiere saber qué se guardó (para no
  // volver a subirlo). Con un fichero no hay nadie esperando.
  const alGuardar = useRef<((p: Partido, copia: boolean) => void | Promise<void>) | null>(null);

  const guardar = async (p: Partido, copia: boolean, info: Extract<ResultadoValidacion, { ok: true }>) => {
    if (guardando) return;                       // anti-doble-toque
    setGuardando(true);
    try {
      const id = await guardarPartidoImportado(p, copia);
      const final: Partido = copia ? { ...p, id } : p;
      try { await alGuardar.current?.(final, copia); } catch { /* que no tumbe lo guardado */ }
      setPaso({ k: "hecho", p: final, copia, info });
      opts.onHecho();
    } catch (e) {
      setPaso({ k: "error", msg: t("imp_err_guardar", { detalle: (e as Error).message }) });
    } finally {
      setGuardando(false);
    }
  };

  const leer = async (f: File) => {
    alGuardar.current = null;
    setPaso({ k: "leyendo" });
    try {
      if (f.size > TAMANO_MAXIMO) { setPaso({ k: "error", msg: t("imp_err_grande") }); return; }
      await procesar(await f.text());
    } catch (e) {
      setPaso({ k: "error", msg: t("imp_err_leer", { detalle: (e as Error).message }) });
    }
  };

  /** Lo mismo que con un fichero, con el texto ya en la mano (lo que devuelve
   *  el servidor del club es exactamente lo de «Exportar JSON»). */
  const abrirTexto = async (texto: string, cb?: (p: Partido, copia: boolean) => void | Promise<void>) => {
    alGuardar.current = cb ?? null;
    setPaso({ k: "leyendo" });
    try { await procesar(texto); }
    catch (e) { setPaso({ k: "error", msg: t("imp_err_leer", { detalle: (e as Error).message }) }); }
  };

  const procesar = async (texto: string) => {
    {
      let r = validarArchivo(texto, { cliente: CLIENTE_ID, roster: ROSTER.map((j) => j.nombre) });
      if (!r.ok) { setPaso({ k: "error", msg: mensajeError(r) }); return; }
      // La misma regla que en el aparato (lib/finPartido.ts, 20/11/2026): si
      // llega «en curso» pero con la última parte completa, ya acabó y entra
      // terminado. Uno interrumpido entra abierto, para «Continuar».
      if (r.partido.estado !== "finalizado" && estadoFin(r.partido).terminado) {
        r = { ...r, partido: marcarFinalizado(r.partido, "importar", Date.now()), enCurso: false };
      }
      const aqui = await partidoGuardado(r.partido.id);
      if (aqui) { setPaso({ k: "choque", nuevo: r.partido, aqui, info: r }); return; }
      await guardar(r.partido, false, r);
    }
  };

  const cerrar = () => { if (!guardando) setPaso({ k: "nada" }); };

  const selector = (
    <input ref={input} type="file" accept="application/json,.json" className="hidden"
      data-importar-input=""
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";                     // así se puede elegir el mismo otra vez
        if (f) void leer(f);
      }} />
  );

  const cabecera = (p: Partido) => (
    <>
      <span className="font-bold text-white">{p.config?.partido_id}</span>
      <span className="text-zinc-400"> · {p.config?.rival} · {p.config?.fecha}</span>
    </>
  );
  const fila = (titulo: string, p: Partido) => (
    <div className="bg-zinc-800 rounded-xl p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">{titulo}</div>
      <div className="text-base">{cabecera(p)}</div>
      <div className="text-lg font-bold tabular-nums mt-1">
        {CLIENTE.nombreCorto} {p.marcador.inter} - {p.marcador.rival} {p.config?.rival}
        <span className="text-xs font-normal text-zinc-400 ml-2">
          {ic((p.modo ?? "directo") === "video" ? t("home_modo_video") : t("home_modo_directo"))}
        </span>
      </div>
      <div className="text-sm text-zinc-400">
        {t("imp_choque_fila", { acciones: contarAcciones(p), estado: labelEstadoPartido(p.estado), cuando: cuando(p.actualizado) })}
      </div>
    </div>
  );

  let cuerpo: ReactNode = null;
  if (paso.k === "leyendo") {
    cuerpo = <p className="text-lg text-zinc-300">{t("imp_leyendo")}</p>;
  } else if (paso.k === "error") {
    cuerpo = (
      <>
        <h3 className="text-2xl font-bold mb-3">{ic(t("imp_no_titulo"))}</h3>
        <p className="text-base text-zinc-200" data-importar-error="">{paso.msg}</p>
        <div className="mt-6">
          <button type="button" onClick={cerrar}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
            {t("imp_cerrar")}
          </button>
        </div>
      </>
    );
  } else if (paso.k === "choque") {
    cuerpo = (
      <>
        <h3 className="text-2xl font-bold mb-1">{ic(t("imp_choque_titulo"))}</h3>
        <p className="text-sm text-zinc-400 mb-4">{t("imp_choque_explica")}</p>
        <div className="grid gap-2">
          {fila(t("imp_choque_aqui"), paso.aqui)}
          {fila(t("imp_choque_archivo"), paso.nuevo)}
        </div>
        <div className="grid gap-3 mt-5">
          <button type="button" data-importar="ambos" disabled={guardando}
            onClick={() => guardar(paso.nuevo, true, paso.info)}
            style={{ touchAction: "manipulation" }}
            className="py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-left">
            <div className="text-base font-bold">{t("imp_ambos")}</div>
            <div className="text-xs text-emerald-100/80">{t("imp_ambos_nota")}</div>
          </button>
          <button type="button" data-importar="reemplazar" disabled={guardando}
            onClick={() => guardar(paso.nuevo, false, paso.info)}
            style={{ touchAction: "manipulation" }}
            className="py-3 px-4 rounded-xl bg-red-900 hover:bg-red-800 text-left">
            <div className="text-base font-bold">{t("imp_reemplazar")}</div>
            <div className="text-xs text-red-100/80">{t("imp_reemplazar_nota")}</div>
          </button>
          <button type="button" data-importar="cancelar" disabled={guardando} onClick={cerrar}
            className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
            {t("cancelar")}
          </button>
        </div>
      </>
    );
  } else if (paso.k === "hecho") {
    const { p, copia, info } = paso;
    const plantilla = info.club === "plantilla" && p.config
      ? (() => {
          const set = new Set(ROSTER.map((j) => j.nombre));
          const conv = [...new Set(p.config.convocados)];
          return t("imp_ok_plantilla", { n: conv.filter((x) => set.has(x)).length, total: conv.length });
        })()
      : null;
    cuerpo = (
      <>
        <h3 className="text-2xl font-bold mb-2">{ic(t("imp_ok"))}</h3>
        <p className="text-lg">{cabecera(p)}</p>
        <p className="text-xl font-bold tabular-nums mt-1">
          {CLIENTE.nombreCorto} {p.marcador.inter} - {p.marcador.rival} {p.config?.rival}
        </p>
        <div className="text-sm text-zinc-300 mt-3 space-y-1" data-importar-ok="">
          <p>{t("imp_ok_detalle", { acciones: contarAcciones(p) })}</p>
          {copia && <p>{t("imp_ok_copia")}</p>}
          {info.enCurso && <p>{t("imp_ok_en_curso")}</p>}
          {p.cierre?.como === "importar" && <p data-importar-cerrado="">{t("imp_ok_cerrado")}</p>}
          {info.relojParado && <p>{t("imp_ok_reloj")}</p>}
          {plantilla && <p className="text-zinc-400">{plantilla}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button type="button" onClick={cerrar}
            className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
            {t("imp_cerrar")}
          </button>
          <button type="button" onClick={() => { setPaso({ k: "nada" }); opts.onVer(p.id); }}
            className="py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-base font-bold">
            {ic(t("home_ver_stats"))}
          </button>
        </div>
      </>
    );
  }

  const ventana = paso.k === "nada" ? null : (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={() => { if (paso.k !== "choque" && paso.k !== "leyendo") cerrar(); }}>
      <div className="bg-zinc-900 text-zinc-100 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog" aria-modal="true" data-importar-ventana={paso.k}
        onClick={(e) => e.stopPropagation()}>
        {cuerpo}
      </div>
    </div>
  );

  return { abrir, abrirTexto, selector, ventana };
}
