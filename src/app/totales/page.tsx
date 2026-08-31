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
import { useEffect, useRef, useState } from "react";
import { listarPartidos } from "@/lib/store";
import { db, type Partido } from "@/lib/db";
import { CLIENTE } from "@/lib/clientes";
import { calcularTotales, formatMinutos, type Totales } from "@/lib/totales";

export default function TotalesPage() {
  const [tot, setTot] = useState<Totales | null>(null);
  const [aviso, setAviso] = useState("");
  // Partidos guardados que NO están finalizados: no entran en estos totales
  // (uno a medias falsearía medias y resultados). El problema es que hasta el
  // 31/8/2026 desaparecían sin decir nada, y los dos amistosos revisados ese
  // día estaban así: quien mirara la temporada la vería vacía sin saber por qué.
  const [sinCerrar, setSinCerrar] = useState(0);
  const fichero = useRef<HTMLInputElement>(null);

  const recargar = async () => {
    const todos = await listarPartidos();
    setTot(calcularTotales(todos));
    setSinCerrar(todos.filter((p) => p.estado !== "finalizado" && p.config).length);
  };
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
      setAviso(`Copia con ${partidos.length} partido(s). Guárdala en Archivos o `
               + `mándatela a ti mismo: es lo que hay que abrir en el iPad nuevo.`);
    } catch (e) {
      setAviso(`No he podido hacer la copia: ${(e as Error).message}`);
    }
  };

  const restaurar = async (f: File) => {
    try {
      const datos = JSON.parse(await f.text());
      const lista: Partido[] = Array.isArray(datos) ? datos : datos?.partidos;
      if (!Array.isArray(lista) || !lista.length) {
        setAviso("Ese fichero no parece una copia del crono."); return;
      }
      if (datos?.cliente && datos.cliente !== CLIENTE.id) {
        // Cada equipo tiene su crono y su base: mezclarlos sería justo lo que
        // no puede pasar.
        setAviso(`Esa copia es de otro equipo (${datos.cliente}). No la abro.`);
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
        ? `Restaurados ${nuevos} partido(s) (ya había ${antes}).`
        : `Esa copia no traía ningún partido que no estuviera ya aquí.`);
    } catch (e) {
      setAviso(`No he podido leer el fichero: ${(e as Error).message}`);
    }
  };

  if (!tot) return <main className="p-6 text-zinc-400">Cargando…</main>;
  const { equipo: eq, jugadores, partidos } = tot;

  return (
    <main className="mx-auto max-w-4xl p-4 text-zinc-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black">📊 Totales de la temporada</h1>
        <Link href="/" className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">🏠 Inicio</Link>
      </div>

      {sinCerrar > 0 && (
        <p className="mb-4 rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
          ⚠️ Hay <b>{sinCerrar} partido{sinCerrar > 1 ? "s" : ""} sin finalizar</b> en
          este aparato y aquí no cuenta{sinCerrar > 1 ? "n" : ""}. Ábrelo desde el
          inicio y dale a <b>Finalizar partido</b> para que entre en la temporada.
        </p>
      )}

      {eq.partidos === 0 ? (
        <p className="text-zinc-400">
          Aún no hay ningún partido terminado en este aparato. En cuanto cierres
          uno, aparece aquí.
        </p>
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Partidos", String(eq.partidos)],
              ["G · E · P", `${eq.ganados} · ${eq.empatados} · ${eq.perdidos}`],
              ["Goles", `${eq.golesFavor} a favor · ${eq.golesContra} en contra`],
              ["Disparos", `${eq.disparos} (${eq.aPuerta} a puerta)`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-900 p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
                <div className="mt-1 text-lg font-bold">{v}</div>
              </div>
            ))}
          </section>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-500">
              Por jugador
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-[10px] uppercase text-zinc-500">
                    <th className="py-1">Nº</th><th>Jugador</th>
                    <th className="text-right">PJ</th><th className="text-right">Min</th>
                    <th className="text-right">⚽</th><th className="text-right">Asist.</th>
                    <th className="text-right">Disp.</th><th className="text-right">Robos</th>
                    <th className="text-right">Cortes</th><th className="text-right">Pérd.</th>
                    <th className="text-right">🟨</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map((j) => (
                    <tr key={j.nombre} className="border-b border-zinc-900">
                      <td className="py-1 font-mono text-emerald-500">{j.dorsal}</td>
                      <td>{j.nombre}</td>
                      <td className="text-right">{j.jugados}</td>
                      <td className="text-right font-mono">{formatMinutos(j.segundos)}</td>
                      <td className="text-right">{j.goles || ""}</td>
                      <td className="text-right">{j.asistencias || ""}</td>
                      <td className="text-right">
                        {(j.aPuerta + j.fuera + j.palo + j.bloqueados) || ""}
                      </td>
                      <td className="text-right">{j.robos || ""}</td>
                      <td className="text-right">{j.cortes || ""}</td>
                      <td className="text-right">{j.perdidas || ""}</td>
                      <td className="text-right">{j.amarillas || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              PJ = partidos en los que llegó a saltar a pista. Solo cuentan los
              partidos terminados.
            </p>
          </section>

          {jugadores.some((j) => j.paradas + j.golesEncajados > 0) && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-500">
                Porteros
              </h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-[10px] uppercase text-zinc-500">
                    <th className="py-1">Nº</th><th>Portero</th>
                    <th className="text-right">PJ</th><th className="text-right">Min</th>
                    <th className="text-right">Paradas</th>
                    <th className="text-right">Encajados</th>
                    <th className="text-right">% parada</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.filter((j) => j.paradas + j.golesEncajados > 0).map((j) => {
                    const tiros = j.paradas + j.golesEncajados;
                    return (
                      <tr key={j.nombre} className="border-b border-zinc-900">
                        <td className="py-1 font-mono text-emerald-500">{j.dorsal}</td>
                        <td>{j.nombre}</td>
                        <td className="text-right">{j.jugados}</td>
                        <td className="text-right font-mono">{formatMinutos(j.segundos)}</td>
                        <td className="text-right">{j.paradas}</td>
                        <td className="text-right">{j.golesEncajados}</td>
                        <td className="text-right">
                          {tiros ? `${Math.round((j.paradas / tiros) * 100)}%` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-500">
              Partido a partido
            </h2>
            <ul className="text-sm">
              {partidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2 border-b border-zinc-900 py-1">
                  <span className={"w-5 text-center font-bold "
                    + (p.resultado === "G" ? "text-emerald-400"
                      : p.resultado === "E" ? "text-zinc-400" : "text-red-400")}>
                    {p.resultado}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{p.fecha}</span>
                  <span className="flex-1">
                    {p.local ? `${CLIENTE.nombreCorto} ${p.golesFavor} - ${p.golesContra} ${p.rival}`
                             : `${p.rival} ${p.golesContra} - ${p.golesFavor} ${CLIENTE.nombreCorto}`}
                  </span>
                  <span className="text-[10px] uppercase text-zinc-600">{p.competicion}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-500">
          Copia de seguridad
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Los partidos se guardan <b>solo en este aparato</b>. Guarda una copia de
          vez en cuando: es lo único que hace falta para pasarlo todo a otro iPad.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={guardarCopia}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
            💾 Guardar copia
          </button>
          <button onClick={() => fichero.current?.click()}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-bold text-white">
            📂 Restaurar copia
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
  );
}
