/**
 * Test del informe de partido (31/8/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/informe.test.ts
 *
 * Lo que aquí se comprueba acaba impreso y mandado a una directiva o a otro
 * club, así que un número mal no se nota: parece un dato. Se prueba con un
 * partido de mentira donde el resultado se sabe a mano.
 */
import {
  construirInforme, tramosDePista, mmss, type ContextoInforme,
} from "./informe.ts";
import type { Partido } from "./db.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const CTX: ContextoInforme = {
  nombreCorto: "PULSO",
  roster: [
    { nombre: "POR", dorsal: "1", posicion: "PORTERO" },
    { nombre: "A", dorsal: "2", posicion: "CAMPO" },
    { nombre: "B", dorsal: "3", posicion: "CAMPO" },
    { nombre: "C", dorsal: "4", posicion: "CAMPO" },
    { nombre: "D", dorsal: "5", posicion: "CAMPO" },
    { nombre: "E", dorsal: "6", posicion: "CAMPO" },
  ],
};

function base(): Partido {
  return {
    id: "t", estado: "finalizado", modo: "video",
    config: {
      rival: "RIVAL", fecha: "2026-09-13", hora: "18:00", lugar: "Pabellón",
      competicion: "LIGA", local: true, partido_id: "J1",
      convocados: ["POR", "A", "B", "C", "D", "E"],
      pista_inicial: { portero: "POR", pista1: "A", pista2: "B", pista3: "C", pista4: "D" },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
      permiteTanda: false, direccionInter1T: "der",
    },
    cronometro: {
      parteActual: "2T", segundosParte: 0, ultimoStart: null,
      segundosGuardadosPorParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
    },
    enPista: ["POR", "A", "B", "C", "D"],
    tiempos: Object.fromEntries(["POR", "A", "B", "C", "D", "E"].map((n) => [
      n, { nombre: n, totalSegundos: n === "E" ? 600 : 2400, porParte: {}, },
    ])),
    marcador: { inter: 2, rival: 1 },
    stats: {
      faltas: { "1T": { inter: 3, rival: 1 }, "2T": { inter: 2, rival: 4 },
                PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      amarillas: { "1T": { inter: 1, rival: 0 }, "2T": { inter: 0, rival: 0 },
                   PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      tiemposMuerto: { "1T": { inter: 0, rival: 1 }, "2T": { inter: 1, rival: 0 },
                       PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
    },
    disparosRival: { puerta: 4, fuera: 2, palo: 1, bloqueado: 1 },
    acciones: {
      porJugador: {
        A: { pf: 1, pnf: 1, robos: 3, cortes: 2, bdg: 2, bdp: 1,
             dpp: 2, dpf: 1, dpa: 0, dpb: 1, golesEncajados: 0, paradas: 0,
             unoAtq_g: 2, unoAtq_p: 1 },
        POR: { pf: 0, pnf: 0, robos: 0, cortes: 0, bdg: 0, bdp: 0,
               dpp: 0, dpf: 0, dpa: 0, dpb: 0, golesEncajados: 1, paradas: 4,
               saqueB: 5, saqueM: 1 },
      },
    },
    eventos: [
      { id: "g1", tipo: "gol", equipo: "INTER", parte: "1T", segundosParte: 300,
        segundosPartido: 300, timestampReal: 1, marcador: { inter: 0, rival: 0 },
        goleador: "A", asistente: "B", cuarteto: [], accion: "Banda",
        zonaCampo: "A5", zonaPorteria: "P3" },
      { id: "c1", tipo: "cambio", parte: "1T", segundosParte: 600,
        segundosPartido: 600, timestampReal: 2, marcador: { inter: 1, rival: 0 },
        sale: "D", entra: "E" },
      { id: "g2", tipo: "gol", equipo: "RIVAL", parte: "2T", segundosParte: 120,
        segundosPartido: 120, timestampReal: 3, marcador: { inter: 1, rival: 0 },
        cuarteto: [], goleador: "", accion: "Contraataque", zonaPorteria: "P1" },
      { id: "g3", tipo: "gol", equipo: "INTER", parte: "2T", segundosParte: 600,
        segundosPartido: 600, timestampReal: 4, marcador: { inter: 1, rival: 1 },
        goleador: "A", cuarteto: [], accion: "Banda",
        zonaCampo: "A5", zonaPorteria: "P5" },
    ],
  } as unknown as Partido;
}

console.log("── Informe de partido ──");

// 1 · Cabecera y goles
{
  const inf = construirInforme(base(), CTX)!;
  igual(inf.cabecera.gf, 2, "goles a favor");
  igual(inf.cabecera.gc, 1, "goles en contra");
  igual(inf.cabecera.duracionTotal, 2400, "duración total del partido");
  igual(inf.goles.length, 3, "número de goles");
  igual(inf.goles.map((g) => g.marcador), ["1-0", "1-1", "2-1"],
        "el marcador se acumula en orden");
  igual(inf.goles[0].asistente, "B", "asistente del primer gol");
}

// 2 · El orden NO puede salir de segundosPartido
{
  // El gol de la 2ª parte lleva segundosPartido=120, MENOR que el de la 1ª
  // (300). Si se ordenara por ese campo, el marcador saldría al revés. Es lo
  // que pasa en los partidos rehechos con vídeo.
  const inf = construirInforme(base(), CTX)!;
  igual(inf.goles.map((g) => g.parte), ["1T", "2T", "2T"],
        "los goles van en orden real de partido, no por segundosPartido");
}

// 3 · Tramos de pista y ±
{
  const inf = construirInforme(base(), CTX)!;
  const tr = tramosDePista(base());
  igual(tr.length, 2, "un cambio parte el partido en dos tramos");
  igual(tr[0].enPista.sort(), ["A", "B", "C", "D", "POR"], "quinteto inicial");
  igual(tr[1].enPista.sort(), ["A", "B", "C", "E", "POR"], "quinteto tras el cambio");

  const a = inf.jugadores.find((j) => j.nombre === "A")!;
  igual([a.gfPista, a.gcPista, a.masMenos], [2, 1, 1], "± de quien juega entero");
  const d = inf.jugadores.find((j) => j.nombre === "D")!;
  igual([d.gfPista, d.gcPista], [1, 0], "D solo estaba en el primer gol");
}

// 4 · Estadísticas de equipo
{
  const inf = construirInforme(base(), CTX)!;
  igual(inf.nosotros.faltas, 5, "faltas nuestras (3+2)");
  igual(inf.rival.faltas, 5, "faltas del rival (1+4)");
  igual(inf.rival.disparos, 8, "disparos del rival (4+2+1+1)");
  igual(inf.nosotros.disparos, 4, "disparos nuestros, de los contadores");
  igual(inf.nosotros.tiemposMuerto, 1, "tiempos muertos nuestros");
}

// 5 · Porteros
{
  const inf = construirInforme(base(), CTX)!;
  igual(inf.porteros.length, 1, "un portero");
  const p = inf.porteros[0];
  igual([p.paradas, p.golesEncajados, p.pctParada], [4, 1, 80],
        "paradas, encajados y % de parada");
  igual(inf.jugadores.some((j) => j.nombre === "POR"), false,
        "el portero no sale en la tabla de jugadores de campo");
}

// 6 · Quintetos
{
  const inf = construirInforme(base(), CTX)!;
  igual(inf.quintetos.length, 2, "dos quintetos distintos");
  const total = inf.quintetos.reduce((a, q) => a + q.segundos, 0);
  igual(total, 2400, "los minutos de los quintetos suman el partido entero");
  igual(inf.quintetos.reduce((a, q) => a + q.gf, 0), 2,
        "los goles a favor se reparten entre los quintetos");
}

// 7 · Vídeo: no se enseña lo que nadie contó
{
  const inf = construirInforme(base(), CTX)!;
  ok(inf.hayVideo, "con métricas de vídeo, la sección se enseña");

  const sinVideo = base();
  sinVideo.acciones = { porJugador: {
    A: { pf: 0, pnf: 0, robos: 0, cortes: 0, bdg: 0, bdp: 0, dpp: 0, dpf: 0,
         dpa: 0, dpb: 0, golesEncajados: 0, paradas: 0 },
  } } as never;
  const inf2 = construirInforme(sinVideo, CTX)!;
  ok(!inf2.hayVideo,
     "en directo NO se enseña la tabla de duelos: un cero ahí sería mentira");
}

// 8 · Zonas
{
  const inf = construirInforme(base(), CTX)!;
  igual(inf.zonasPorteria, { P3: 1, P5: 1 }, "cuadrantes de portería a favor");
  igual(inf.zonasPorteriaRival, { P1: 1 }, "cuadrantes en contra");
  igual(inf.zonasCampo, { A5: 2 }, "zonas de disparo a favor");
}

// 9 · Goles por tipo de jugada
{
  const inf = construirInforme(base(), CTX)!;
  const banda = inf.golesPorJugada.find((g) => g.jugada === "Banda")!;
  igual([banda.nuestros, banda.rival], [2, 0], "dos goles nuestros de banda");
}

// 10 · Partido sin configurar
{
  const vacio = { ...base(), config: null } as unknown as Partido;
  ok(construirInforme(vacio, CTX) === null, "sin config no hay informe");
}

// 11 · mmss
igual(mmss(0), "0:00", "mmss de cero");
igual(mmss(125), "2:05", "mmss redondea hacia abajo");

console.log(fallos ? `\n❌ Informe: ${fallos} fallo(s)` : "\n✅ Informe OK (0 fallos)");
process.exit(fallos ? 1 : 0);
