/**
 * Test de «¿este partido ya terminó?» (20/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/finPartido.test.ts
 *
 * Los casos copian la FORMA de la copia real del iPad (22 partidos «en curso»
 * con el reloj de la 2ª parte en 20:00, en directo y en vídeo, uno antiguo sin
 * `modo`), pero los datos son INVENTADOS: el repositorio es público.
 */
import type { Partido, ParteId, TiroTanda } from "./db.ts";
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const { estadoFin, tandaDecidida, marcarFinalizado, repasarSinCerrar } = await import("./finPartido.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const P4 = (n: number) => ({ "1T": n, "2T": n, PR1: n, PR2: n }) as Record<ParteId, number>;
const PAR = () => ({ "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } });

/** Partido inventado con la forma de los de la copia real: 2T con el reloj en
 *  20:00 y lo guardado de la 2T a 0 (la 2T es la parte actual). */
function partido(o: {
  id?: string; parte?: ParteId; seg?: number; corre?: boolean; modo?: "directo" | "video";
  comp?: string; tanda?: boolean; goles?: [number, number]; dur?: Partial<Record<ParteId, number>>;
  tiros?: TiroTanda[]; tandaActiva?: boolean; estado?: Partido["estado"];
} = {}): Partido {
  const p: Partido = {
    id: o.id ?? "p_prueba", estado: o.estado ?? "en_curso",
    config: {
      partido_id: "J1.RIVAL", rival: "CD INVENTADO", fecha: "2026-10-10", hora: "18:00",
      lugar: "Pabellón", competicion: o.comp ?? "LIGA", local: true,
      convocados: ["ANA", "BEA", "CARLA", "DORA", "EVA"],
      pista_inicial: { portero: "ANA", pista1: "BEA", pista2: "CARLA", pista3: "DORA", pista4: "EVA" },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0, ...(o.dur ?? {}) },
      permiteTanda: o.tanda ?? false, direccionInter1T: "der",
    } as Partido["config"],
    cronometro: {
      parteActual: o.parte ?? "2T", segundosParte: o.seg ?? 1200,
      ultimoStart: o.corre ? 1_000 : null,
      segundosGuardadosPorParte: { ...P4(0), "1T": 1200 },
    },
    enPista: ["ANA", "BEA", "CARLA", "DORA", "EVA"],
    tiempos: {},
    marcador: { inter: o.goles?.[0] ?? 3, rival: o.goles?.[1] ?? 1 },
    stats: { faltas: PAR(), amarillas: PAR(), tiemposMuerto: PAR() },
    eventos: [], acciones: { porJugador: {} },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: o.tandaActiva ?? false, tiros: o.tiros ?? [], marcador: { inter: 0, rival: 0 } },
    actualizado: 5_000,
  };
  if (o.modo) p.modo = o.modo;
  return p;
}
const tiro = (equipo: "INTER" | "RIVAL", gol: boolean, i: number): TiroTanda =>
  ({ id: `t${i}`, orden: i, equipo, resultado: gol ? "GOL" : "PARADA", timestampReal: i });

console.log("── Última parte completa ──");
{
  igual(estadoFin(partido()).motivo, "terminado", "2T con el reloj en 20:00 → terminado (directo)");
  igual(estadoFin(partido({ modo: "video" })).motivo, "terminado", "igual en vídeo");
  igual(estadoFin(partido({ modo: undefined })).motivo, "terminado", "igual en uno antiguo sin «modo»");
  igual(estadoFin(partido({ seg: 1199.4 })).motivo, "terminado", "con menos de 1 s de margen, terminado");
  const p = partido({ seg: 0 });
  p.cronometro.segundosGuardadosPorParte!["2T"] = 1200;        // se volvió a la 2T: guardado lleno
  igual(estadoFin(p).motivo, "terminado", "2T con lo guardado de la 2T lleno → terminado");
}

console.log("── Interrumpido: se queda abierto ──");
{
  const r = estadoFin(partido({ seg: 734 }));
  igual([r.terminado, r.motivo, r.seg, r.dur], [false, "parte_sin_acabar", 734, 1200], "2T a medias (12:14) → abierto");
  igual(estadoFin(partido({ parte: "1T", seg: 1200 })).motivo, "en_1t", "acabó la 1ª parte → abierto (descanso)");
  igual(estadoFin(partido({ corre: true })).motivo, "reloj_en_marcha", "reloj corriendo → abierto");
  igual(estadoFin(partido({ dur: { "2T": 0 } })).motivo, "sin_duracion", "sin duración de parte → no se adivina");
  const sin = partido(); sin.config = null;
  igual(estadoFin(sin).motivo, "sin_config", "sin cabecera → abierto");
  igual(estadoFin(partido({ estado: "finalizado" })).motivo, "ya_finalizado", "el finalizado no se toca");
}

console.log("── Prórroga ──");
{
  // Copa con empate al final de la 2T: falta prórroga o penaltis.
  igual(estadoFin(partido({ comp: "COPA_MADRID", tanda: true, goles: [2, 2] })).motivo,
        "empate_pendiente", "copa, empate al acabar la 2T → abierto (prórroga o penaltis)");
  // Copa con ganador en la 2T, aunque la prórroga venga configurada (presets).
  igual(estadoFin(partido({ comp: "COPA_MADRID", tanda: true, goles: [3, 2], dur: { PR1: 300, PR2: 300 } })).motivo,
        "terminado", "copa con ganador en la 2T → terminado (aunque haya prórroga configurada)");
  // Liga/amistoso con empate: terminado.
  igual(estadoFin(partido({ goles: [2, 2] })).motivo, "terminado", "liga con empate → terminado");
  const pr = { comp: "COPA_MADRID", tanda: true, dur: { PR1: 300, PR2: 300 } };
  igual(estadoFin(partido({ ...pr, parte: "PR1", seg: 300, goles: [2, 2] })).motivo, "en_pr1", "acaba la PR1 → abierto");
  igual(estadoFin(partido({ ...pr, parte: "PR2", seg: 120, goles: [2, 2] })).motivo, "parte_sin_acabar", "PR2 a medias → abierto");
  igual(estadoFin(partido({ ...pr, parte: "PR2", seg: 300, goles: [4, 3] })).motivo, "terminado", "PR2 completa con ganador → terminado");
  igual(estadoFin(partido({ ...pr, parte: "PR2", seg: 300, goles: [3, 3] })).motivo, "empate_pendiente", "PR2 completa con empate → falta la tanda");
}

console.log("── Tanda de penaltis ──");
{
  const cinco = [0, 1, 2, 3, 4].flatMap((i) => [tiro("INTER", true, i * 2), tiro("RIVAL", i < 4, i * 2 + 1)]);
  ok(tandaDecidida(cinco), "5 y 5, 5-4 → decidida");
  ok(!tandaDecidida(cinco.slice(0, 8)), "4 y 4, 4-4 → sin decidir");
  ok(tandaDecidida([tiro("INTER", true, 1), tiro("RIVAL", false, 2), tiro("INTER", true, 3), tiro("RIVAL", false, 4),
                    tiro("INTER", true, 5), tiro("RIVAL", false, 6)]), "3-0 tras 3 y 3: el rival ya no llega → decidida");
  const igualados = [...cinco.slice(0, 9), tiro("RIVAL", true, 9)];
  ok(!tandaDecidida(igualados), "5-5 tras 5 y 5 → muerte súbita, sin decidir");
  ok(tandaDecidida([...igualados, tiro("INTER", false, 10), tiro("RIVAL", true, 11)]), "muerte súbita 5-6 → decidida");

  const base = { comp: "COPA_MADRID", tanda: true, goles: [2, 2] as [number, number], parte: "PR2" as ParteId, seg: 300, dur: { PR1: 300, PR2: 300 } };
  igual(estadoFin(partido({ ...base, tandaActiva: true, tiros: cinco.slice(0, 6) })).motivo, "tanda_abierta", "tanda a medias → abierto");
  igual(estadoFin(partido({ ...base, tandaActiva: true, tiros: cinco })).motivo, "terminado_tanda", "tanda decidida (sin cerrar) → terminado");
  igual(estadoFin(partido({ ...base, tandaActiva: false, tiros: cinco.slice(0, 4) })).motivo, "terminado_tanda", "tanda cerrada a mano → terminado");
  igual(estadoFin(partido({ ...base, parte: "2T", seg: 1200, tandaActiva: true, tiros: cinco })).motivo,
        "terminado_tanda", "tanda directa tras la 2T → terminado");
}

console.log("── Darlo por terminado: no se borra nada ──");
{
  const p = partido({ modo: "video" });
  p.eventos = [{ id: "e1", tipo: "gol", equipo: "INTER", parte: "1T", segundosParte: 60, timestampReal: 1 } as never];
  const f = marcarFinalizado(p, "lote", 9_999);
  igual([f.estado, f.cierre], ["finalizado", { el: 9_999, como: "lote" }], "estado finalizado + marca de cierre");
  igual([f.eventos.length, f.marcador, f.modo, f.id, f.actualizado], [1, p.marcador, "video", p.id, 5_000],
        "eventos, marcador, modo, id y orden intactos");
  ok(p.estado === "en_curso", "el original no se toca");
  const corre = partido({ corre: true, seg: 1100 });
  corre.cronometro.ultimoStart = 1_000;
  const fc = marcarFinalizado(corre, "boton", 200_000, 61_000);  // última vez guardado: 60 s después
  igual([fc.cronometro.ultimoStart, fc.cronometro.segundosParte], [null, 1160], "si el reloj corría, se para donde se guardó");
}

console.log("── Repaso de la copia (forma real, datos inventados) ──");
{
  const lista: Partido[] = [];
  for (let i = 0; i < 22; i++) lista.push(partido({ id: `p${i}`, modo: i % 2 ? "video" : "directo" }));
  lista.push(partido({ id: "ya", estado: "finalizado" }));
  lista.push(partido({ id: "medias", seg: 600 }));
  lista.push(partido({ id: "copa", comp: "COPA_MADRID", tanda: true, goles: [1, 1] }));
  const r = repasarSinCerrar(lista);
  igual(r.cerrar.length, 22, "los 22 con la 2T en 20:00 se pueden cerrar");
  igual(r.abiertos.map((a) => [a.partido.id, a.fin.motivo]), [["medias", "parte_sin_acabar"], ["copa", "empate_pendiente"]],
        "se quedan abiertos el interrumpido y el empate de copa, con su porqué");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
