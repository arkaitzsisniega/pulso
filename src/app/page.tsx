"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Partido } from "@/lib/db";
import { listarPartidos, marcarPartidoActivo, rehacerPartido, borrarPartido } from "@/lib/store";
import { t, useIdioma } from "@/lib/i18n";
import { CLIENTE } from "@/lib/clientes";

export default function Home() {
  useIdioma();
  const router = useRouter();
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargado, setCargado] = useState(false);

  const recargar = async () => {
    const lista = await listarPartidos();
    // Solo los que ya tienen config (descartar el vacío inicial "configurando").
    setPartidos(lista.filter((p) => p.config));
    setCargado(true);
  };
  useEffect(() => { recargar(); }, []);

  const verStats = (id: string) => { marcarPartidoActivo(id); router.push("/resumen"); };
  const continuar = (id: string) => { marcarPartidoActivo(id); router.push("/partido"); };
  const rehacer = async (id: string) => {
    if (!confirm(t("home_rehacer_confirm"))) return;
    const nuevoId = await rehacerPartido(id);
    if (nuevoId) router.push("/partido");
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">{t("home_titulo", { marca: CLIENTE.marcaTitulo })}</h1>
        <p className="text-zinc-400 mb-6">{t("home_subtitulo", { club: CLIENTE.nombreLargo })}</p>

        <Link href="/nuevo"
          className="block w-full py-5 mb-8 bg-green-700 hover:bg-green-600 rounded-xl text-2xl font-bold text-center">
          {t("home_nuevo")}
        </Link>

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
                      </div>
                      <div className="text-base text-zinc-300">
                        <span className="text-emerald-400 font-bold">{CLIENTE.nombreCorto} {p.marcador.inter}</span>
                        <span className="text-zinc-500"> - </span>
                        <span className="text-red-400 font-bold">{p.marcador.rival} {p.config!.rival}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {p.config!.fecha} · {p.config!.competicion}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {enCurso && (
                        <button onClick={() => continuar(p.id)}
                          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-bold">
                          {t("home_continuar")}
                        </button>
                      )}
                      <button onClick={() => verStats(p.id)}
                        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-bold">
                        {t("home_ver_stats")}
                      </button>
                      <button onClick={() => rehacer(p.id)}
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
      </div>
    </div>
  );
}
