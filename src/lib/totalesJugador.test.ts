/**
 * Test de los TOTALES AMPLIADOS por jugador (25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/totalesJugador.test.ts
 *
 * Partidos INVENTADOS (nombres de mentira) en los que se sabe a mano lo que
 * tiene que salir: minutos y media, titularidades, goles y asistencias, el ±,
 * disparos por resultado, penaltis y 10 m, faltas cometidas y recibidas, el
 * «por partido» y el «por 40′», la valoración (la del informe), los minutos en
 * nuestro portero-jugador, que el filtro se respeta y que el mismo partido en
 * directo y en vídeo cuenta UNA vez.
 */
import type { Evento, Partido } from "./db.ts";
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const {
  calcularTotalesAmpliados, partidosDeTotales, normalizar, mediaMinutos, valoracionMedia, disparos,
} = await import("./totalesJugador.ts");
const { construirInforme, valorar } = await import("./informe.ts");
const { construirInformeCompleto } = await import("./informeCompleto.ts");
const { incluido, soloCompeticion } = await import("./filtroTotales.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}
const cerca = (a: number | null, b: number, msg: string) =>
  ok(a !== null && Math.abs(a - b) < 1e-6, `${msg} (esperaba ${b}, salió ${a})`);

const ROSTER = [
  { nombre: "POR", dorsal: "1", posicion: "PORTERO" },
  { nombre: "POR2", dorsal: "13", posicion: "PORTERO" },
  { nombre: "ANA", dorsal: "5", posicion: "CAMPO" },
  { nombre: "BEA", dorsal: "7", posicion: "CAMPO" },
  { nombre: "CAR", dorsal: "8", posicion: "CAMPO" },
  { nombre: "DAN", dorsal: "10", posicion: "CAMPO" },
  { nombre: "EVA", dorsal: "11", posicion: "CAMPO" },
];
const CTX = { nombreCorto: "NOS", roster: ROSTER, completo: false };

let idEv = 0;
function ev(parte: string, seg: number, tipo: string, resto: Record<string, unknown> = {}): Evento {
  idEv += 1;
  return {
    id: `e${idEv}`, tipo, parte, segundosParte: seg, segundosPartido: seg,
    timestampReal: 1, marcador: { inter: 0, rival: 0 }, ...resto,
  } as unknown as Evento;
}

/** Un partido de 2×20′. `seg` = segundos totales de cada jugador (lo que lleva
 *  el crono en `tiempos`); los cambios son los que cuadran con eso. */
function partido(id: string, o: {
  comp?: string; modo?: "directo" | "video"; act?: number; pid?: string; fecha?: string;
  marcador: [number, number]; seg: Record<string, number>; eventos: Evento[];
  acciones?: Record<string, Record<string, number>>; pista?: string[];
}): Partido {
  const pista = o.pista ?? ["POR", "ANA", "BEA", "CAR", "DAN"];
  return {
    id, estado: "finalizado", modo: o.modo ?? "directo", actualizado: o.act ?? 1,
    config: {
      rival: `Rival ${id}`, fecha: o.fecha ?? "2026-11-01", hora: "18:00", lugar: "",
      competicion: o.comp ?? "LIGA", local: true, partido_id: o.pid ?? id,
      convocados: Object.keys(o.seg),
      pista_inicial: { portero: pista[0], pista1: pista[1], pista2: pista[2], pista3: pista[3], pista4: pista[4] },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
      permiteTanda: false, direccionInter1T: "der",
    },
    cronometro: { parteActual: "2T", segundosParte: 1200, ultimoStart: null,
      segundosGuardadosPorParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 } },
    enPista: [], tiempos: Object.fromEntries(Object.entries(o.seg).map(([k, v]) => [k, { nombre: k, totalSegundos: v, porParte: { "1T": v / 2, "2T": v / 2, PR1: 0, PR2: 0 } }])),
    marcador: { inter: o.marcador[0], rival: o.marcador[1] },
    stats: { faltas: {}, amarillas: {}, tiemposMuerto: {} },
    eventos: o.eventos,
    acciones: { porJugador: (o.acciones ?? {}) as never },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
  } as unknown as Partido;
}

// ── PARTIDO 1 (liga): 3-1. EVA entra por DAN en el 1T 10:00 y DAN vuelve por
// EVA en el 2T 10:00 → DAN 30′, EVA 10′... los minutos los da `tiempos`.
const P1 = partido("p1", {
  marcador: [3, 1],
  seg: { POR: 2400, ANA: 2400, BEA: 2400, CAR: 2400, DAN: 1800, EVA: 600, POR2: 0 },
  eventos: [
    ev("1T", 600, "cambio", { sale: "DAN", entra: "EVA" }),
    ev("1T", 300, "gol", { equipo: "INTER", goleador: "ANA", asistente: "BEA", cuarteto: [] }),
    ev("1T", 700, "gol", { equipo: "RIVAL", goleador: "", cuarteto: [] }),          // EVA en pista, DAN no
    ev("1T", 800, "disparo", { equipo: "RIVAL", resultado: "FUERA" }),
    ev("2T", 600, "cambio", { sale: "EVA", entra: "DAN" }),
    ev("2T", 900, "penalti", { equipo: "INTER", tirador: "ANA", portero: "", resultado: "GOL", golId: "gp" }),
    { ...ev("2T", 900, "gol", { equipo: "INTER", goleador: "ANA", cuarteto: [], penaltiId: "x" }), id: "gp" } as Evento,
    ev("2T", 1000, "gol", { equipo: "INTER", goleador: "CAR", asistente: "ANA", cuarteto: [] }),
    ev("2T", 1100, "diezm", { equipo: "INTER", tirador: "BEA", portero: "", resultado: "PARADA" }),
    ev("1T", 100, "falta", { equipo: "INTER", jugador: "BEA" }),
    ev("1T", 150, "falta", { equipo: "RIVAL", jugador: "ANA" }),
    ev("2T", 150, "falta", { equipo: "RIVAL", jugador: "ANA" }),
    ev("2T", 200, "amarilla", { equipo: "INTER", jugador: "BEA" }),
  ],
  acciones: {
    ANA: { dpp: 2, dpf: 1, robos: 2 },
    BEA: { dpp: 1, dpb: 1, pf: 1, pnf: 1 },
    CAR: { dpp: 1, dpa: 1, cortes: 3 },
    POR: { paradas: 4, golesEncajados: 1 },
  },
});

// ── PARTIDO 2 (amistoso): 0-2, DAN no juega; nuestro portero-jugador el
// último minuto (POR sale por EVA en el 2T 19:00).
const P2 = partido("p2", {
  comp: "AMISTOSO", marcador: [0, 2], fecha: "2026-11-08",
  seg: { POR: 2340, ANA: 2400, BEA: 2400, CAR: 2400, EVA: 2400, DAN: 60 },
  pista: ["POR", "ANA", "BEA", "CAR", "EVA"],
  eventos: [
    ev("1T", 500, "gol", { equipo: "RIVAL", goleador: "", cuarteto: [] }),
    ev("2T", 1140, "cambio", { sale: "POR", entra: "DAN" }),
    ev("2T", 1150, "disparo", { equipo: "INTER", jugador: "ANA", resultado: "PUERTA" }),
    ev("2T", 1170, "gol", { equipo: "RIVAL", goleador: "", cuarteto: [] }),
    ev("2T", 1180, "falta", { equipo: "INTER", jugador: "ANA" }),
  ],
  acciones: { ANA: { dpp: 1 }, POR: { paradas: 2, golesEncajados: 1 } },
});

// ── PARTIDO 1 OTRA VEZ, revisado con VÍDEO (mismo partido_id, más reciente) y
// con un robo más de ANA: debe contar ESTE y no el directo.
const P1V = partido("p1v", {
  modo: "video", act: 5, pid: "p1",
  marcador: [3, 1],
  seg: { POR: 2400, ANA: 2400, BEA: 2400, CAR: 2400, DAN: 1800, EVA: 600, POR2: 0 },
  eventos: P1.eventos,
  acciones: {
    ANA: { dpp: 2, dpf: 1, robos: 3, unoAtq_g: 2 },
    BEA: { dpp: 1, dpb: 1, pf: 1, pnf: 1 },
    CAR: { dpp: 1, dpa: 1, cortes: 3 },
    POR: { paradas: 4, golesEncajados: 1 },
  },
});

const todos = [P1, P2, P1V];

console.log("── Selección: directo + vídeo cuenta una vez ──");
{
  const sel = partidosDeTotales(todos);
  igual(sel.map((p) => p.id).sort(), ["p1v", "p2"], "entran el vídeo y el amistoso, no el directo");
  const noFin = { ...P2, id: "p9", estado: "en_curso", config: { ...P2.config!, partido_id: "p9" } } as Partido;
  igual(partidosDeTotales([...todos, noFin]).length, 2, "uno sin finalizar no entra");
}

const tot = calcularTotalesAmpliados(partidosDeTotales(todos), CTX);
const J = (n: string) => tot.jugadores.find((j) => j.nombre === n)!;

console.log("── Resumen ──");
{
  igual(tot.partidos, 2, "2 partidos");
  const ana = J("ANA");
  igual([ana.convocado, ana.jugados, ana.titular], [2, 2, 2], "ANA: 2 convocada, 2 jugados, 2 titular");
  igual(ana.segundos, 4800, "ANA: 80′");
  cerca(mediaMinutos(ana), 40, "ANA: media 40′ por partido");
  const dan = J("DAN");
  igual([dan.convocado, dan.jugados, dan.titular], [2, 2, 1], "DAN: convocado 2, juega 2 (entra en el PJ), titular 1");
  const eva = J("EVA");
  igual([eva.jugados, eva.segundos], [2, 3000], "EVA: 2 PJ, 50′");
  cerca(mediaMinutos(eva), 25, "EVA: media 25′");
  igual([ana.goles, ana.asistencias], [2, 1], "ANA: 2 goles (uno de penalti) y 1 asistencia");
  igual(J("CAR").goles, 1, "CAR: 1 gol");
  igual(J("POR2").jugados, 0, "el portero que no juega: 0 PJ");
  ok(mediaMinutos(J("POR2")) === null, "sin jugar no hay media de minutos");
}

console.log("── ± con él en pista (el del informe) ──");
{
  // P1: goles 1T 5:00 (ANA,BEA,CAR,DAN,POR), rival 1T 11:40 (EVA por DAN),
  //     2T 15:00 y 16:40 (DAN de vuelta). P2: rival 1T y 2T 19:30 (DAN por POR).
  igual([J("ANA").gfPista, J("ANA").gcPista], [3, 3], "ANA: 3 a favor, 3 en contra");
  igual([J("DAN").gfPista, J("DAN").gcPista], [3, 1], "DAN: 3 a favor, 1 en contra (el de P2 con él)");
  igual([J("EVA").gfPista, J("EVA").gcPista], [0, 3], "EVA: 0 a favor, 3 en contra");
  igual([J("POR").gfPista, J("POR").gcPista], [3, 2], "POR: 3-2 (el último de P2 ya no estaba)");
  igual([tot.equipo.gfPista, tot.equipo.gcPista], [3, 3], "equipo: 3-3 (los marcadores)");
}

console.log("── Ataque ──");
{
  const ana = J("ANA");
  igual([ana.aPuerta, ana.fuera, disparos(ana)], [3, 1, 4], "ANA: 3 a puerta, 1 fuera, 4 disparos");
  igual([ana.penL, ana.penG], [1, 1], "ANA: 1 penalti tirado y metido");
  igual([J("BEA").diezL, J("BEA").diezG], [1, 0], "BEA: un 10 m tirado y parado");
  igual([tot.equipo.penL, tot.equipo.diezL], [1, 1], "equipo: 1 penalti y 1 10 m");
  igual(ana.video.unoAtq_g, 2, "lo del vídeo entra (1x1 ganados de ANA)");
  ok(tot.hayVideo, "hay vídeo");
  igual(ana.robos, 3, "ANA: 3 robos (los del VÍDEO, no 2+3)");
  igual([J("EVA").dcPista, J("EVA").dcPuertaPista], [4, 3], "EVA: 4 disparos rivales en pista (3 a puerta: los goles)");
}

console.log("── Disciplina ──");
{
  igual([J("BEA").faltas, J("BEA").amarillas], [1, 1], "BEA: 1 falta y 1 amarilla");
  igual(J("ANA").faltas, 1, "ANA: 1 falta cometida");
  igual(J("ANA").faltasRecibidas, 2, "ANA: 2 faltas recibidas");
  igual(tot.equipo.faltasRecibidas, 2, "equipo: 2 faltas recibidas");
}

console.log("── Porteros ──");
{
  const por = J("POR");
  igual([por.paradas, por.golesEncajados, por.portero], [6, 2, true], "POR: 6 paradas, 2 encajados");
  igual(por.porteriasCero, 0, "POR: ninguna portería a cero");
}

console.log("── Por partido y por 40′ ──");
{
  const ana = J("ANA");
  cerca(normalizar(disparos(ana), ana, "partido"), 2, "ANA: 2 disparos por partido");
  cerca(normalizar(disparos(ana), ana, "p40"), 2, "ANA: 2 disparos por 40′ (80′ jugados)");
  const eva = J("EVA");
  cerca(normalizar(eva.dcPista, eva, "p40"), 3.2, "EVA: 4 en contra en 50′ → 3,2 por 40′");
  ok(normalizar(3, { jugados: 1, segundos: 60 }, "p40") === null, "con 1′ jugado no hay por 40′");
  ok(normalizar(3, { jugados: 0, segundos: 0 }, "partido") === null, "sin jugar no hay por partido");
}

console.log("── Valoración: la suma de la del informe ──");
{
  const sel = partidosDeTotales(todos);
  let esperado = 0, n = 0;
  for (const p of sel) {
    const inf = construirInforme(p, { nombreCorto: "NOS", roster: ROSTER })!;
    const f = [...inf.jugadores, ...inf.porteros].find((x) => x.nombre === "ANA")!;
    esperado += valorar(f).puntos; n += 1;
  }
  cerca(J("ANA").valoracion, Math.round(esperado * 10) / 10, "ANA: valoración = suma de sus dos informes");
  cerca(valoracionMedia(J("ANA")), Math.round(esperado * 10) / 10 / n, "ANA: valoración media");
  igual(J("POR2").partidosValorados, 0, "quien no juega no se valora");

  // Con el informe COMPLETO (PULSO) sale la del informe completo.
  const totC = calcularTotalesAmpliados(sel, { ...CTX, completo: true });
  let espC = 0;
  for (const p of sel) {
    const inf = construirInformeCompleto(p, { nombreCorto: "NOS", nombreLargo: "NOS", roster: ROSTER })!;
    espC += inf.valoracion.find((v) => v.nombre === "ANA")!.val;
  }
  cerca(totC.jugadores.find((j) => j.nombre === "ANA")!.valoracion, Math.round(espC * 10) / 10, "PULSO: la valoración del informe completo");
}

console.log("── Situaciones: nuestro portero-jugador ──");
{
  ok(tot.haySituaciones, "hay situaciones");
  igual(tot.equipo.sit.pj_nuestro.seg, 60, "equipo: 1′ de portero-jugador");
  igual(J("DAN").sit.pj_nuestro.seg, 60, "DAN: ese minuto en pista");
  igual(J("POR").sit.pj_nuestro.seg, 0, "POR: 0 (estaba sentado)");
  igual([J("ANA").sit.pj_nuestro.df, J("ANA").sit.pj_nuestro.gc], [1, 1], "ANA: 1 disparo a favor y 1 gol en contra en él");
}

console.log("── El filtro se respeta ──");
{
  const sel = partidosDeTotales(todos, (p) => incluido(p, soloCompeticion(partidosDeTotales(todos), "LIGA")));
  igual(sel.map((p) => p.id), ["p1v"], "solo liga: entra solo el vídeo del partido 1");
  const t2 = calcularTotalesAmpliados(sel, CTX);
  igual(t2.partidos, 1, "1 partido");
  igual(t2.jugadores.find((j) => j.nombre === "ANA")!.segundos, 2400, "ANA: 40′");
  ok(!t2.haySituaciones, "sin el amistoso no hay portero-jugador");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
