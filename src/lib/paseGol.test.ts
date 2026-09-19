/**
 * Test del aviso «pase de gol pegado a un gol» (18/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/paseGol.test.ts
 *
 * Con gol solo cuenta la asistencia. Si la misma jugada se apunta como pase
 * de gol Y como asistencia, el jugador se lleva +2 de más sin que nadie lo vea.
 */
import type { Evento } from "./db.ts";
import {
  VENTANA_PASE_GOL_SEG, esGolNuestro, golNuestroCerca, pasesGolCerca,
} from "./paseGol.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

let n = 0;
function ev(e: Partial<Evento> & { tipo: Evento["tipo"] }): Evento {
  n += 1;
  return { id: `e${n}`, parte: "1T", segundosParte: 0, segundosPartido: 0,
           timestampReal: n, marcador: { inter: 0, rival: 0 }, ...e } as Evento;
}
const pase = (parte: "1T" | "2T", s: number, jugador = "RAUL") =>
  ev({ tipo: "accion_individual", parte, segundosParte: s, jugador, accion: "paseGol" } as never);
const golNuestro = (parte: "1T" | "2T", s: number, goleador = "PANI", asistente?: string) =>
  ev({ tipo: "gol", equipo: "INTER", parte, segundosParte: s, goleador, asistente, cuarteto: [] } as never);

console.log("── Pase de gol pegado a un gol ──");

igual(VENTANA_PASE_GOL_SEG, 20, "la ventana es de 20 segundos");

// 1 · Al guardar un gol: pases de gol en los 20 s anteriores
{
  const evs = [
    pase("1T", 748),                // 12:28, 2 s antes del gol de las 12:30
    pase("1T", 730, "CECILIO"),     // 20 s justos antes
    pase("1T", 729, "RAYA"),        // 21 s antes: ya es otra jugada
    pase("2T", 748, "PIRATA"),      // mismo minuto, OTRA parte
    pase("1T", 755, "TONI"),        // después del gol: otro saque, otra jugada
    ev({ tipo: "accion_individual", parte: "1T", segundosParte: 749, jugador: "RAUL", accion: "robos" } as never),
  ];
  const cerca = pasesGolCerca(evs, "1T", 750);
  igual(cerca.map((e) => (e as { jugador: string }).jugador), ["RAUL", "CECILIO"],
        "salen el de 2 s antes y el de 20 s justos, el más reciente primero");
  igual(pasesGolCerca(evs, "1T", 900), [], "un gol de mucho después no ve ninguno");
  igual(pasesGolCerca([], "1T", 750), [], "un partido sin pases de gol, sin aviso");
}

// 2 · Al guardar un pase de gol: un gol nuestro a ±20 s
{
  const evs = [
    golNuestro("1T", 750, "PANI", "RAUL"),
    ev({ tipo: "gol", equipo: "RIVAL", parte: "1T", segundosParte: 700, goleador: "", cuarteto: [] } as never),
  ];
  ok(golNuestroCerca(evs, "1T", 735)?.id === evs[0].id, "un pase 15 s antes del gol lo ve");
  ok(golNuestroCerca(evs, "1T", 770)?.id === evs[0].id, "y uno 20 s después también (se apuntó al revés)");
  igual(golNuestroCerca(evs, "1T", 771), null, "a 21 s ya no");
  igual(golNuestroCerca(evs, "2T", 750), null, "en la otra parte, no");
  igual(golNuestroCerca(evs, "1T", 705), null, "un gol del rival no es nuestra jugada");
  // Si hay dos, el más cercano
  const dos = [golNuestro("1T", 740, "A"), golNuestro("1T", 758, "B")];
  igual((golNuestroCerca(dos, "1T", 755) as { goleador: string }).goleador, "B", "con dos goles cerca, el más cercano");
}

// 3 · Qué cuenta como gol nuestro
{
  ok(esGolNuestro(golNuestro("1T", 1)), "el gol del botón GOL");
  ok(esGolNuestro(ev({ tipo: "penalti", equipo: "INTER", resultado: "GOL", tirador: "RAYA", portero: "" } as never)),
     "un penalti metido con su botón (no tiene evento gol)");
  ok(!esGolNuestro(ev({ tipo: "penalti", equipo: "INTER", resultado: "GOL", tirador: "RAYA", portero: "", golId: "g1" } as never)),
     "el gemelo de un gol no se cuenta dos veces");
  ok(!esGolNuestro(ev({ tipo: "diezm", equipo: "INTER", resultado: "PARADA", tirador: "RAYA", portero: "" } as never)),
     "un 10 m parado no es gol");
  ok(!esGolNuestro(ev({ tipo: "disparo", equipo: "INTER", resultado: "PUERTA", jugador: "RAYA" } as never)),
     "un disparo no es gol");
}

console.log(fallos ? `\n❌ Pase de gol: ${fallos} fallo(s)` : "\n✅ Pase de gol OK (0 fallos)");
process.exit(fallos ? 1 : 0);
