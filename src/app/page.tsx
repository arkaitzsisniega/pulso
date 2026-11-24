"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Partido } from "@/lib/db";
import { listarPartidos, marcarPartidoActivo, rehacerPartido, borrarPartido,
         cerrarActivoSiTerminado, finalizarGuardado } from "@/lib/store";
import { estadoFin } from "@/lib/finPartido";
import { textoMotivoFin, nombrePartido } from "@/components/FinPartido";
import { jugabamosEnCasa } from "@/lib/rehacer";
import { t, useIdioma, labelCompeticionCorta } from "@/lib/i18n";
import { ID_PARTIDO_EJEMPLO, sembrarPartidoEjemplo } from "@/lib/partidoEjemplo";
import { CLIENTE, VERSION_CRONO } from "@/lib/clientes";
import { useAspecto, setAspecto, useModoSol, setModoSol } from "@/lib/aspecto";
import { InicioNuevo } from "@/components/InicioNuevo";
import { conIconos } from "@/components/DirectoNuevo";
import { useImportarPartido } from "@/components/ImportarPartido";
import { useServidorClub, IconoSubida } from "@/components/ServidorClub";
import { SERVIDOR_ACTIVO } from "@/lib/clientes";

export default function Home() {
  useIdioma();
  const router = useRouter();
  const aspecto = useAspecto();
  const modoSol = useModoSol();
  // Aspecto NUEVO (tanda 3 · 18/11/2026): misma lista y mismos manejadores,
  // otro dibujo (components/InicioNuevo.tsx). En la ventana de rehacer, con el
  // nuevo los emojis pasan a iconos; con el clásico el texto llega tal cual.
  const nuevo = aspecto === "nuevo";
  const ic = (txt: string): React.ReactNode => (nuevo ? conIconos(txt) : txt);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargado, setCargado] = useState(false);

  const recargar = async () => {
    await sembrarPartidoEjemplo();
    // Volver al inicio = salir del partido. Si el que se estaba apuntando ya
    // tiene la última parte completa, cuenta como terminado (lib/finPartido.ts).
    // Uno interrumpido se queda abierto. Solo el activo: los viejos, desde
    // Totales («Dar por terminados…») o con «Finalizar» aquí.
    try { await cerrarActivoSiTerminado(); } catch { /* que no tumbe el inicio */ }
    const lista = await listarPartidos();
    // Solo los que ya tienen config (descartar el vacío inicial "configurando").
    setPartidos(lista.filter((p) => p.config));
    setCargado(true);
  };
  useEffect(() => { recargar(); }, []);

  const verStats = (id: string) => { marcarPartidoActivo(id); router.push("/resumen"); };
  const continuar = (id: string) => { marcarPartidoActivo(id); router.push("/partido"); };

  // «Importar partido» (19/11/2026): el JSON de «Exportar JSON» de otro
  // aparato entra como un partido más (components/ImportarPartido.tsx).
  const importar = useImportarPartido({ nuevo, onHecho: () => { void recargar(); }, onVer: verStats });
  // «Partidos del club» (servidor de partidos, fase 2 · 21/11/2026): solo con
  // `servidor` encendido para el club (SERVIDOR_ACTIVO); si no, ni botón.
  const club = useServidorClub({ nuevo, importar, locales: partidos, onCambio: () => { void recargar(); },
    onContinuar: continuar });

  // Rehacer con vídeo (26/9/2026): antes era un confirm() que copiaba la
  // cabecera tal cual, y si el partido estaba apuntado en casa siendo fuera no
  // había dónde cambiarlo. Ahora sale una ventana con EN CASA / FUERA, con lo
  // del original ya marcado (lib/rehacer.ts).
  const [aRehacer, setARehacer] = useState<Partido | null>(null);
  const [enCasa, setEnCasa] = useState(false);
  const [rehaciendo, setRehaciendo] = useState(false);
  const abrirRehacer = (p: Partido) => {
    setARehacer(p);
    setEnCasa(jugabamosEnCasa(p.config));
    setRehaciendo(false);
  };
  const confirmarRehacer = async () => {
    if (!aRehacer || rehaciendo) return;       // anti-doble-toque en el iPad
    setRehaciendo(true);
    const nuevoId = await rehacerPartido(aRehacer.id, { local: enCasa });
    if (nuevoId) { router.push("/partido"); return; }
    setRehaciendo(false);
    setARehacer(null);
  };
  // «Finalizar» de la lista (20/11/2026): cualquier partido abierto, con
  // confirmación. Si el reloj dice que no acabó, se avisa en la pregunta.
  const finalizar = async (p: Partido) => {
    const fin = estadoFin(p);
    let txt = t("home_finalizar_confirm", { partido: nombrePartido(p) });
    if (!fin.terminado) txt += "\n\n" + t("home_finalizar_abierto", { motivo: textoMotivoFin(fin) });
    if (!confirm(txt)) return;
    await finalizarGuardado(p.id, "boton");
    recargar();
  };
  const borrar = async (id: string) => {
    if (!confirm(t("home_borrar_confirm"))) return;
    await borrarPartido(id);
    recargar();
  };

  const badgeModo = (p: Partido) =>
    (p.modo ?? "directo") === "video"
      ? { txt: t("home_modo_video"), cls: "bg-sky-800 text-sky-100" }
      : { txt: t("home_modo_directo"), cls: "bg-red-800 text-red-100" };
  const badgeEstado = (p: Partido) =>
    p.estado === "finalizado"
      ? { txt: t("home_estado_fin"), cls: "bg-zinc-700 text-zinc-200" }
      : { txt: t("home_estado_curso"), cls: "bg-emerald-800 text-emerald-100" };

  const ventanaRehacer = (
    <>
      {aRehacer && aRehacer.config && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => { if (!rehaciendo) setARehacer(null); }}>
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-1">{ic(t("home_rehacer"))}</h3>
            <p className="text-lg font-bold text-white">
              {aRehacer.config.partido_id}
              <span className="font-normal text-zinc-400"> · {aRehacer.config.rival} · {aRehacer.config.fecha}</span>
            </p>
            <p className="text-sm text-zinc-400 mt-2 mb-5">{t("home_rehacer_explica")}</p>

            <p className="text-base font-semibold text-zinc-200 mb-2">{t("home_rehacer_donde")}</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("home_rehacer_donde")}>
              {[true, false].map((casa) => {
                const elegido = enCasa === casa;
                return (
                  <button key={String(casa)} type="button" role="radio" aria-checked={elegido}
                    data-rehacer-local={casa ? "casa" : "fuera"}
                    onClick={() => setEnCasa(casa)}
                    style={{ touchAction: "manipulation" }}
                    className={`py-5 rounded-xl text-xl font-bold border-2 ${
                      elegido ? "bg-emerald-700 border-emerald-300 text-white"
                              : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                    {ic(casa ? t("home_rehacer_casa") : t("home_rehacer_fuera"))}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-2">{t("home_rehacer_nota")}</p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setARehacer(null)} disabled={rehaciendo}
                className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-base font-semibold">
                {t("cancelar")}
              </button>
              <button type="button" onClick={confirmarRehacer} disabled={rehaciendo}
                style={{ touchAction: "manipulation" }}
                className={`py-3 rounded-xl text-base font-bold ${
                  rehaciendo ? "bg-zinc-700 opacity-60" : "bg-sky-700 hover:bg-sky-600"}`}>
                {rehaciendo ? t("home_rehacer_creando") : ic(t("home_rehacer_ok"))}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (nuevo) {
    return (
      <InicioNuevo partidos={partidos} cargado={cargado} aspecto={aspecto}
        sol={modoSol} onSol={() => setModoSol(!modoSol)} onAspecto={setAspecto}
        onContinuar={continuar} onStats={verStats} onRehacer={abrirRehacer} onBorrar={borrar}
        onFinalizar={finalizar}
        onImportar={importar.abrir}
        servidor={SERVIDOR_ACTIVO ? { onAbrir: club.abrir, linea: club.linea } : null}
        ventana={<>{ventanaRehacer}{importar.selector}{importar.ventana}{club.ventana}</>} />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-4xl font-bold">{t("home_titulo", { marca: CLIENTE.marcaTitulo })}</h1>
          <span className="text-xs font-mono text-zinc-500 whitespace-nowrap">
            v{VERSION_CRONO}
          </span>
        </div>
        <p className="text-zinc-400 mb-6">{t("home_subtitulo", { club: CLIENTE.nombreLargo })}</p>

        <Link href="/nuevo"
          className="block w-full py-5 mb-8 bg-green-700 hover:bg-green-600 rounded-xl text-2xl font-bold text-center">
          {t("home_nuevo")}
        </Link>

        <Link href="/totales"
          className="block w-full py-3 mb-8 -mt-6 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center font-bold text-zinc-200">
          {t("home_totales")}
        </Link>

        <button type="button" onClick={importar.abrir} data-importar-boton=""
          className="block w-full py-3 mb-8 -mt-6 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center font-bold text-zinc-200">
          {t("home_importar")}
        </button>

        {SERVIDOR_ACTIVO && (
          <div className="-mt-6 mb-8">
            <button type="button" onClick={club.abrir} data-club-boton=""
              className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center font-bold text-zinc-200">
              {t("sv_club")}
            </button>
            <p className="text-xs text-zinc-500 text-center mt-1" data-club-linea="">{club.linea}</p>
          </div>
        )}

        <h2 className="text-lg font-bold text-zinc-300 mb-3">{t("home_guardados")}</h2>

        {!cargado ? (
          <p className="text-zinc-500">{t("cargando")}</p>
        ) : partidos.length === 0 ? (
          <p className="text-zinc-500">{t("home_sin_partidos")}</p>
        ) : (
          <div className="space-y-3">
            {partidos.map((p) => {
              const bm = badgeModo(p);
              const be = badgeEstado(p);
              const enCurso = p.estado !== "finalizado";
              return (
                <div key={p.id} className="bg-zinc-900 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <strong className="text-white text-lg">{p.config!.partido_id}</strong>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${bm.cls}`}>{bm.txt}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${be.cls}`}>{be.txt}</span>
                        {CLIENTE.partidoEjemplo && p.id === ID_PARTIDO_EJEMPLO && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-700 text-amber-100">{t("home_ejemplo")}</span>
                        )}
                        <IconoSubida id={p.id} nuevo={false} />
                        {p.importado && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-800 text-violet-100" data-importado="">
                            {p.importado.copia ? t("home_importado_copia") : t("home_importado")}
                          </span>
                        )}
                      </div>
                      <div className="text-base text-zinc-300">
                        <span className="text-emerald-400 font-bold">{CLIENTE.nombreCorto} {p.marcador.inter}</span>
                        <span className="text-zinc-500"> - </span>
                        <span className="text-red-400 font-bold">{p.marcador.rival} {p.config!.rival}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {p.config!.fecha} · {labelCompeticionCorta(p.config!.competicion)}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {enCurso && (
                        <button onClick={() => continuar(p.id)}
                          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-bold">
                          {t("home_continuar")}
                        </button>
                      )}
                      {enCurso && (
                        <button onClick={() => finalizar(p)} data-finalizar-partido=""
                          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold">
                          {t("home_finalizar")}
                        </button>
                      )}
                      <button onClick={() => verStats(p.id)}
                        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-bold">
                        {t("home_ver_stats")}
                      </button>
                      <button onClick={() => abrirRehacer(p)}
                        className="px-3 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-bold">
                        {t("home_rehacer")}
                      </button>
                      <button onClick={() => borrar(p.id)}
                        className="px-3 py-2 bg-zinc-800 hover:bg-red-800 rounded-lg text-sm"
                        title={t("home_borrar")}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-xs text-zinc-500 text-center">
          {t("home_offline")}
        </div>

        {/* Interruptor del ASPECTO (rediseño 16/11/2026). Aquí, en la pantalla
            de inicio, y no en la del partido: para que no se cambie sin querer
            con el reloj corriendo. Se guarda en el aparato (lib/aspecto.ts). */}
        <div className="mt-4 flex items-center justify-center gap-3 flex-wrap text-xs text-zinc-500">
          <span>{t("pz_aspecto_titulo")}</span>
          <div className="inline-flex rounded-lg overflow-hidden border border-zinc-700" role="radiogroup"
            aria-label={t("pz_aspecto_titulo")}>
            {(["clasico", "nuevo"] as const).map((a) => (
              <button key={a} type="button" role="radio" aria-checked={aspecto === a}
                data-aspecto={a}
                onClick={() => setAspecto(a)}
                className={`px-4 py-2 text-sm font-bold ${
                  aspecto === a ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900 text-zinc-400"}`}>
                {a === "nuevo" ? t("pz_aspecto_nuevo") : t("pz_aspecto_clasico")}
              </button>
            ))}
          </div>
          <span className="basis-full text-center text-zinc-600">{t("pz_aspecto_nota")}</span>
        </div>
      </div>

      {ventanaRehacer}
      {importar.selector}
      {importar.ventana}
      {club.ventana}
    </div>
  );
}
