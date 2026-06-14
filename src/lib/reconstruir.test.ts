/**
 * Test de fidelidad de reconstruirAgregados (Fase 2 — edición post-partido).
 * Ejecutar:  node --experimental-strip-types src/lib/reconstruir.test.ts
 *
 * Verifica que, dada una lista de eventos, los agregados recalculados coinciden
 * con lo que mantendría el motor incremental en vivo (registrarEvento), incluido
 * el NO-doble-conteo del par gol+penalti enlazado y la atribución al portero.
 */
import type { Partido, Evento, ParteId } from "./db";
import { reconstruirAgregados } from "./reconstruir.ts";

const esPortero = (n: string) => n === "HERRERO";

function base(eventos: Evento[]): Partido {
  return {
    id: "test",
    estado: "finalizado",
    config: {
      rival: "RIVAL FC", fecha: "2026-06-13", hora: "18:00", lugar: "X",
      competicion: "LIGA", local: true, partido_id: "TEST", convocados: [],
      pista_inicial: { portero: "HERRERO", pista1: "A", pista2: "B", pista3: "C", pista4: "D" },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
      permiteTanda: false, direccionInter1T: "der",
    },
    cronometro: { parteActual: "2T", segundosParte: 0, ultimoStart: null },
    enPista: [], tiempos: {},
    marcador: { inter: 0, rival: 0 },
    stats: {
      faltas: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      amarillas: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      tiemposMuerto: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
    },
    eventos,
    acciones: { porJugador: {} },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
    actualizado: 0,
  };
}

let ts = 1000;
function ev(parcial: Partial<Evento> & { tipo: Evento["tipo"]; parte: ParteId; segundosParte: number }): Evento {
  return {
    id: parcial.id ?? `e${ts}`,
    segundosPartido: parcial.segundosParte,
    timestampReal: ts++,
    marcador: { inter: 0, rival: 0 },
    ...parcial,
  } as Evento;
}

// Escenario (a propósito DESORDENADO para probar también el orden):
const eventos: Evento[] = [
  ev({ tipo: "roja", parte: "2T", segundosParte: 200, equipo: "INTER", jugador: "D" } as any),
  ev({ tipo: "gol", parte: "1T", segundosParte: 60, equipo: "INTER", goleador: "A", cuarteto: [] } as any),
  ev({ tipo: "falta", parte: "1T", segundosParte: 120, equipo: "INTER", jugador: "B" } as any),
  ev({ tipo: "gol", parte: "1T", segundosParte: 200, equipo: "RIVAL", goleador: "", cuarteto: [] } as any),
  ev({ tipo: "disparo", parte: "1T", segundosParte: 250, equipo: "INTER", jugador: "B", resultado: "FUERA" } as any),
  ev({ tipo: "disparo", parte: "1T", segundosParte: 300, equipo: "RIVAL", resultado: "PUERTA" } as any),
  ev({ id: "g6", tipo: "gol", parte: "1T", segundosParte: 360, equipo: "INTER", goleador: "A", accion: "Penalti", cuarteto: [], penaltiId: "p6" } as any),
  ev({ id: "p6", tipo: "penalti", parte: "1T", segundosParte: 360, equipo: "INTER", tirador: "A", portero: "GK_RIVAL", resultado: "GOL", golId: "g6" } as any),
  ev({ tipo: "accion_individual", parte: "2T", segundosParte: 50, jugador: "C", accion: "robos" } as any),
  ev({ tipo: "cambio", parte: "2T", segundosParte: 100, sale: "A", entra: "E" } as any),
  ev({ tipo: "amarilla", parte: "2T", segundosParte: 150, equipo: "INTER", jugador: "B" } as any),
];

const r = reconstruirAgregados(base(eventos), esPortero);

let fallos = 0;
function check(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.error(`  ✗ ${nombre}: esperado ${JSON.stringify(esperado)}, fue ${JSON.stringify(real)}`); }
  else console.log(`  ✓ ${nombre}`);
}

console.log("Test reconstruirAgregados:");
check("marcador", r.marcador, { inter: 2, rival: 1 });
check("faltas 1T", r.stats.faltas["1T"], { inter: 1, rival: 0 });
check("amarillas 2T", r.stats.amarillas["2T"], { inter: 1, rival: 0 });
check("A.dpp (gol + penalti, sin doble conteo)", r.acciones.porJugador["A"]?.dpp, 2);
check("B.dpf", r.acciones.porJugador["B"]?.dpf, 1);
check("C.robos", r.acciones.porJugador["C"]?.robos, 1);
check("HERRERO.golesEncajados", r.acciones.porJugador["HERRERO"]?.golesEncajados, 1);
check("HERRERO.paradas", r.acciones.porJugador["HERRERO"]?.paradas, 1);
check("disparosRival.puerta", r.disparosRival.puerta, 2);
// El hijo penalti NO debe haber sumado marcador extra (ya contado por el gol).
check("orden: primer evento es 1T@60", `${r.eventos[0].parte}@${r.eventos[0].segundosParte}`, "1T@60");
// El snapshot del gol de penalti (g6) y su hijo (p6) deben ser PRE-gol = 1-1.
const g6 = r.eventos.find((e) => e.id === "g6")!;
const p6 = r.eventos.find((e) => e.id === "p6")!;
check("snapshot g6 (pre-gol)", g6.marcador, { inter: 1, rival: 1 });
check("snapshot p6 = snapshot g6", p6.marcador, { inter: 1, rival: 1 });

if (fallos === 0) { console.log("\n✅ TODO OK (12 checks)"); }
else { console.error(`\n❌ ${fallos} fallo(s)`); process.exit(1); }
