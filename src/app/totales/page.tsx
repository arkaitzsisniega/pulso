"use client";

/**
 * /totales — La temporada entera, sumada, y su copia de seguridad.
 *
 * Por qué existe (Arkaitz, 29/8/2026): el cuerpo técnico del filial no tiene
 * bot ni panel del club y no puede depender de nadie para ver cómo va su
 * temporada. Todo está ya guardado partido a partido en el iPad; aquí se suma.
 *
 * Y por qué lleva copia de seguridad: los partidos viven SOLO en este aparato.
 * Si cambian de iPad o lo borran, se pierde la temporada. Con "Guardar copia"
 * se llevan un fichero y con "Restaurar copia" lo abren en el nuevo. Sin
 * servidor, sin cuenta y sin mandarle el fichero a nadie.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { listarPartidos, cerrarTerminados } from "@/lib/store";
import { repasarSinCerrar } from "@/lib/finPartido";
import { BloqueCerrarTerminados, textoMotivoFin, nombrePartido, type InformeCierre } from "@/components/FinPartido";
import { db, type Partido } from "@/lib/db";
import { CLIENTE, ROSTER } from "@/lib/clientes";
import { calcularTotales, partidosQueCuentan } from "@/lib/totales";
import { ordenarPartidos } from "@/lib/ordenPartidos";
import {
  type FiltroTotales as Filtro, describirFiltro, incluido, leerFiltro, limpiarFiltro, FILTRO_TODO,
} from "@/lib/filtroTotales";
import { FiltroTotales, textoFiltro } from "@/components/FiltroTotales";
import { t, useIdioma, labelCompeticionCorta } from "@/lib/i18n";
import { useAspecto, useModoSol, setModoSol } from "@/lib/aspecto";
import { TotalesNuevo } from "@/components/TotalesNuevo";
import { TotalesAmpliados } from "@/components/TotalesAmpliados";
import { calcularTotalesAmpliados, partidosDeTotales } from "@/lib/totalesJugador";

/** «*texto*» del catálogo → negrita. */
function conNegritas(frase: string) {
  return frase.split("*").map((trozo, i) => (i % 2 ? <b key={i}>{trozo}</b> : trozo));
}

/** La última elección del filtro, en ESTE aparato y para ESTE equipo. */
const CLAVE_FILTRO = `${CLIENTE.id}_crono_totales_filtro`;

export default function TotalesPage() {
  useIdioma();
  const [todos, setTodos] = useState<Partido[] | null>(null);
  // Qué competiciones y partidos entran (25/11/2026, lib/filtroTotales.ts).
  const [filtro, setFiltroEstado] = useState<Filtro>(FILTRO_TODO);
  useEffect(() => {
    try { setFiltroEstado(leerFiltro(localStorage.getItem(CLAVE_FILTRO))); } catch { /* sin almacenamiento: todo */ }
  }, []);
  const setFiltro = (f: Filtro) => {
    setFiltroEstado(f);
    try { localStorage.setItem(CLAVE_FILTRO, JSON.stringify(f)); } catch { /* no pasa nada: solo no se recuerda */ }
  };
  const dup = useMemo(() => (todos ? partidosQueCuentan(todos) : null), [todos]);
  const filtroVivo = useMemo(() => (dup ? limpiarFiltro(dup.cuentan, filtro) : filtro), [dup, filtro]);
  const tot = useMemo(
    () => (todos ? calcularTotales(todos, (p) => incluido(p, filtroVivo)) : null),
    [todos, filtroVivo],
  );
  // Las tablas por jugador, en pestañas (25/11/2026, lib/totalesJugador.ts):
  // los MISMOS partidos que arriba (filtro incluido), sumando el informe de
  // cada uno.
  const amp = useMemo(
    () => (todos ? calcularTotalesAmpliados(
      partidosDeTotales(todos, (p) => incluido(p, filtroVivo)),
      { nombreCorto: CLIENTE.nombreCorto, nombreLargo: CLIENTE.nombreLargo, roster: ROSTER, completo: CLIENTE.informeCompleto },
    ) : null),
    [todos, filtroVivo],
  );
  const listaFiltro = useMemo(
    () => (dup ? ordenarPartidos([...dup.cuentan, ...dup.directosFuera, ...dup.videosFuera]) : []),
    [dup],
  );
  const fuera = useMemo(() => {
    const m = new Map<string, "directo" | "video">();
    dup?.directosFuera.forEach((p) => m.set(p.id, "directo"));
    dup?.videosFuera.forEach((p) => m.set(p.id, "video"));
    return m;
  }, [dup]);
  const subtitulo = dup && dup.cuentan.length
    ? textoFiltro(describirFiltro(dup.cuentan, filtroVivo), dup.cuentan.length) : "";
  const hayPartidos = !!dup?.cuentan.length;
  const filtroUI = (nuevo: boolean) => dup && (
    <FiltroTotales nuevo={nuevo} lista={listaFiltro} cuentan={dup.cuentan} fuera={fuera}
      filtro={filtroVivo} onCambiar={setFiltro} />
  );
  const [aviso, setAviso] = useState("");
  // Partidos guardados que NO están finalizados: no entran en estos totales
  // (uno a medias falsearía medias y resultados). El problema es que hasta el
  // 31/8/2026 desaparecían sin decir nada, y los dos amistosos revisados ese
  // día estaban así: quien mirara la temporada la vería vacía sin saber por qué.
  const [sinCerrar, setSinCerrar] = useState(0);
  // De los sin finalizar, los que YA acabaron según el reloj (20/11/2026,
  // lib/finPartido.ts): se pueden cerrar de una vez con el botón.
  const [cerrables, setCerrables] = useState(0);
  const [cerrando, setCerrando] = useState(false);
  const [informe, setInforme] = useState<InformeCierre | null>(null);
  const fichero = useRef<HTMLInputElement>(null);
  const aspecto = useAspecto();
  const modoSol = useModoSol();

  const recargar = async () => {
    const lista = await listarPartidos();
    setTodos(lista);
    setSinCerrar(lista.filter((p) => p.estado !== "finalizado" && p.config).length);
    setCerrables(repasarSinCerrar(lista).cerrar.length);
  };

  const cerrarLosAcabados = async () => {
    if (cerrando) return;                       // anti-doble-toque en el iPad
    setCerrando(true);
    try {
      const r = await cerrarTerminados();
      setInforme({
        hechos: r.cerrar.length,
        abiertos: r.abiertos.map((a) => ({ nombre: nombrePartido(a.partido), motivo: textoMotivoFin(a.fin) })),
      });
      await recargar();
    } catch (e) {
      setAviso(t("tot_error_fichero", { detalle: (e as Error).message }));
    } finally {
      setCerrando(false);
    }
  };
  const bloqueCerrar = (nuevo: boolean) => (
    <BloqueCerrarTerminados nuevo={nuevo} cerrables={cerrables} cerrando={cerrando}
      informe={informe} onCerrar={() => { void cerrarLosAcabados(); }} />
  );
  useEffect(() => { void recargar(); }, []);

  const guardarCopia = async () => {
    try {
      const partidos = await listarPartidos();
      const copia = {
        formato: "crono-copia-v1",
        cliente: CLIENTE.id,
        hecha: new Date().toISOString(),
        partidos,
      };
      const blob = new Blob([JSON.stringify(copia)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `copia_${CLIENTE.id}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setAviso(t("tot_copia_ok", { n: partidos.length }));
    } catch (e) {
      setAviso(t("tot_copia_error", { detalle: (e as Error).message }));
    }
  };

  const restaurar = async (f: File) => {
    try {
      const datos = JSON.parse(await f.text());
      const lista: Partido[] = Array.isArray(datos) ? datos : datos?.partidos;
      if (!Array.isArray(lista) || !lista.length) {
        setAviso(t("tot_no_es_copia")); return;
      }
      if (datos?.cliente && datos.cliente !== CLIENTE.id) {
        // Cada equipo tiene su crono y su base: mezclarlos sería justo lo que
        // no puede pasar.
        setAviso(t("tot_otro_equipo", { equipo: datos.cliente }));
        return;
      }
      const antes = (await listarPartidos()).length;
      let nuevos = 0;
      for (const p of lista) {
        if (!p?.id || !p?.config) continue;
        // Se AÑADE lo que falte; nunca se pisa un partido que ya esté aquí,
        // no vaya a ser que una copia vieja borre el de esta tarde.
        if (await db.partidos.get(p.id)) continue;
        await db.partidos.put(p);
        nuevos += 1;
      }
      await recargar();
      setAviso(nuevos
        ? t("tot_restaurados", { n: nuevos, antes })
        : t("tot_nada_nuevo"));
    } catch (e) {
      setAviso(t("tot_error_fichero", { detalle: (e as Error).message }));
    }
  };

  // Aspecto NUEVO (tanda 4 · 18/11/2026): los MISMOS totales y la MISMA copia
  // de seguridad (guardarCopia / restaurar), otro dibujo.
  if (aspecto === "nuevo") {
    return (
      <TotalesNuevo tot={tot} ampliados={amp && <TotalesAmpliados nuevo datos={amp} />} sinCerrar={sinCerrar} aviso={aviso} cerrar={bloqueCerrar(true)}
        filtro={filtroUI(true)} subtitulo={subtitulo} hayPartidos={hayPartidos}
        sol={modoSol} onSol={() => setModoSol(!modoSol)}
        onGuardar={guardarCopia} onRestaurar={() => fichero.current?.click()}
        fichero={
          <input ref={fichero} type="file" accept=".json,application/json"
                 className="hidden"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) void restaurar(f);
                   e.target.value = "";
                 }} />
        } />
    );
  }

  if (!tot) return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-400">{t("cargando")}</div>
  );
  const { equipo: eq, partidos } = tot;

  return (
    // El fondo oscuro va FUERA del ancho máximo: sin él, esta pantalla salía
    // con texto casi blanco sobre blanco y la tabla de jugadores no se leía
    // (31/8/2026). El resto de pantallas ya lo tenían.
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
    <main className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{t("tot_titulo")}</h1>
          {subtitulo && <p className="text-sm text-emerald-400">{subtitulo}</p>}
        </div>
        <Link href="/" className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">{t("inicio")}</Link>
      </div>

      {sinCerrar > 0 && (
        <p className="mb-4 rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
          {conNegritas(sinCerrar > 1 ? t("tot_sin_cerrar_n", { n: sinCerrar }) : t("tot_sin_cerrar_1"))}
        </p>
      )}
      {tot && tot.directosFuera > 0 && (
        <p className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300">
          {conNegritas(tot.directosFuera > 1 ? t("tot_dup_directo_n", { n: tot.directosFuera }) : t("tot_dup_directo_1"))}
        </p>
      )}
      {tot && tot.videosFuera > 0 && (
        <p className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300">
          {conNegritas(tot.videosFuera > 1 ? t("tot_dup_video_n", { n: tot.videosFuera }) : t("tot_dup_video_1"))}
        </p>
      )}
      {bloqueCerrar(false)}
      {filtroUI(false)}

      {eq.partidos === 0 ? (
        <p className="text-zinc-400">
          {hayPartidos ? t("tot_filtro_ninguno") : t("tot_vacio")}
        </p>
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t("tot_partidos"), String(eq.partidos)],
              [t("tot_gep"), `${eq.ganados} · ${eq.empatados} · ${eq.perdidos}`],
              [t("tot_goles"), t("tot_goles_val", { f: eq.golesFavor, c: eq.golesContra })],
              [t("tot_disparos"), t("tot_disparos_val", { d: eq.disparos, p: eq.aPuerta })],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-900 p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
                <div className="mt-1 text-lg font-bold">{v}</div>
              </div>
            ))}
          </section>

          {amp && <TotalesAmpliados nuevo={false} datos={amp} />}

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-500">
              {t("tot_por_partido")}
            </h2>
            <ul className="text-sm">
              {partidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2 border-b border-zinc-900 py-1">
                  <span className={"w-5 text-center font-bold "
                    + (p.resultado === "G" ? "text-emerald-400"
                      : p.resultado === "E" ? "text-zinc-400" : "text-red-400")}>
                    {t(`tot_res_${p.resultado}`)}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{p.fecha}</span>
                  <span className="flex-1">
                    {p.local ? `${CLIENTE.nombreCorto} ${p.golesFavor} - ${p.golesContra} ${p.rival}`
                             : `${p.rival} ${p.golesContra} - ${p.golesFavor} ${CLIENTE.nombreCorto}`}
                  </span>
                  <span className="text-[10px] uppercase text-zinc-600">{labelCompeticionCorta(p.competicion)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-500">
          {t("tot_copia")}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          {conNegritas(t("tot_copia_txt"))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={guardarCopia}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
            {t("tot_guardar")}
          </button>
          <button onClick={() => fichero.current?.click()}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-bold text-white">
            {t("tot_restaurar")}
          </button>
          <input ref={fichero} type="file" accept=".json,application/json"
                 className="hidden"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) void restaurar(f);
                   e.target.value = "";
                 }} />
        </div>
        {aviso && <p className="mt-3 text-xs text-amber-300">{aviso}</p>}
      </section>
    </main>
    </div>
  );
}
