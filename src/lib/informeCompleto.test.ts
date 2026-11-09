/**
 * Test del informe completo de PULSO (9/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/informeCompleto.test.ts
 *
 * Un número mal en un informe no se nota: parece un dato. Aquí se prueba con un
 * partido de mentira donde el resultado se sabe a mano, sobre todo lo que
 * más fácil se descuadra: que la lista de goles diga lo mismo que el marcador.
 */
import type { ContextoCompleto, GolCompleto } from "./informeCompleto.ts";
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
  construirInformeCompleto, columnaMatriz, COLUMNAS_MATRIZ, orientarNumeros,
  redondear, minSeg, mmss2, zonaMapa,
} = await import("./informeCompleto.ts");
const { ACCIONES_GOL } = await import("./situaciones.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b),
     `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const CTX: ContextoCompleto = {
  nombreCorto: "PULSO", nombreLargo: "CD Pulso",
  roster: [
    { nombre: "POR", dorsal: "1", posicion: "PORTERO", equipo: "PRIMER" },
    { nombre: "POR2", dorsal: "13", posicion: "PORTERO", equipo: "PRIMER" },
    { nombre: "A", dorsal: "2", posicion: "CAMPO", equipo: "PRIMER" },
    { nombre: "B", dorsal: "3", posicion: "CAMPO", equipo: "PRIMER" },
    { nombre: "C", dorsal: "4", posicion: "CAMPO", equipo: "PRIMER" },
    { nombre: "D", dorsal: "5", posicion: "CAMPO", equipo: "PRIMER" },
    { nombre: "E", dorsal: "6", posicion: "CAMPO", equipo: "PRIMER" },
    { nombre: "FIL", dorsal: "31", posicion: "CAMPO", equipo: "FILIAL" },
  ],
};

function tiempo(nombre: string, s1: number, s2: number) {
  return {
    nombre, totalSegundos: s1 + s2,
    porParte: { "1T": s1, "2T": s2, PR1: 0, PR2: 0 },
    segTurnoActual: null, turnoStart: null, ultimaSalida: null,
    segDescansoActual: null, descansoStart: null, segTurnoUltimo: null,
  };
}

let idEv = 0;
function ev(parte: string, seg: number, tipo: string, resto: Record<string, unknown> = {}): Evento {
  idEv += 1;
  return {
    id: `e${idEv}`, tipo, parte, segundosParte: seg, segundosPartido: seg,
    timestampReal: 1, marcador: { inter: 0, rival: 0 }, ...resto,
  } as unknown as Evento;
}

function base(): Partido {
  return {
    id: "t", estado: "finalizado", modo: "directo",
    config: {
      rival: "RIVAL FS", fecha: "2026-09-13", hora: "18:00", lugar: "Pabellón",
      competicion: "LIGA", local: true, partido_id: "J1",
      convocados: ["A", "POR", "B", "C", "D", "E", "POR2", "FIL"],
      pista_inicial: { portero: "POR", pista1: "A", pista2: "B", pista3: "C", pista4: "D" },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
      permiteTanda: false, direccionInter1T: "der",
    },
    cronometro: {
      parteActual: "2T", segundosParte: 0, ultimoStart: null,
      segundosGuardadosPorParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
    },
    enPista: [],
    tiempos: {
      POR: tiempo("POR", 1200, 1200), A: tiempo("A", 600, 600), B: tiempo("B", 1200, 1200),
      C: tiempo("C", 1200, 1200), D: tiempo("D", 1200, 1200), E: tiempo("E", 600, 600),
      POR2: tiempo("POR2", 0, 0), FIL: tiempo("FIL", 0, 0),
    },
    marcador: { inter: 0, rival: 0 },
    stats: {
      faltas: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      amarillas: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
      tiemposMuerto: { "1T": { inter: 0, rival: 0 }, "2T": { inter: 0, rival: 0 }, PR1: { inter: 0, rival: 0 }, PR2: { inter: 0, rival: 0 } },
    },
    eventos: [],
    acciones: { porJugador: {} },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
    actualizado: 1,
  };
}

const contadores = (over: Record<string, number> = {}) => ({
  pf: 0, pnf: 0, robos: 0, cortes: 0, bdg: 0, bdp: 0,
  dpp: 0, dpf: 0, dpa: 0, dpb: 0, golesEncajados: 0, paradas: 0, ...over,
});

function informe(p: Partido) {
  const r = construirInformeCompleto(p, CTX);
  if (!r) throw new Error("sin informe");
  return r;
}

console.log("\n📋 La lista de goles dice lo mismo que el marcador");
{
  const p = base();
  p.marcador = { inter: 2, rival: 1 };
  p.acciones.porJugador = { B: contadores({ dpp: 1 }), C: contadores({ dpp: 1 }), POR: contadores({ golesEncajados: 1 }) };
  p.disparosRival.puerta = 1;
  p.eventos = [
    ev("1T", 100, "gol", { equipo: "INTER", goleador: "B", cuarteto: ["POR", "A", "C", "D"], accion: "Banda" }),
    // Un 10 m metido con SU botón: sin evento `gol`, y el marcador sube igual.
    ev("1T", 300, "diezm", { equipo: "INTER", tirador: "C", portero: "", resultado: "GOL", zonaPorteria: "P5" }),
    // Un penalti del rival con su botón.
    ev("2T", 60, "penalti", { equipo: "RIVAL", tirador: "", portero: "POR", resultado: "GOL" }),
    // Y uno enlazado a su gol, que NO puede contar dos veces.
  ];
  const inf = informe(p);
  igual(inf.goles.length, 3, "los 3 goles están en la lista");
  igual(inf.goles.map((g: GolCompleto) => g.marcador), ["1-0", "2-0", "2-1"], "marcador acumulado");
  igual(inf.goles[1].goleador, "C", "el tirador del 10 m es el goleador");
  igual(inf.goles[1].accion, "10m", "la acción del 10 m");
  igual(inf.goles[2].minuto, "21:00", "minuto absoluto en la 2.ª parte");
  const c = inf.jugadores.find((j) => j.nombre === "C")!;
  igual(c.g, 1, "C suma su gol de 10 m");
  const vc = inf.valoracion.find((v) => v.nombre === "C")!;
  igual([vc.gf, vc.gc], [2, 1], "C: GF/GC en pista cuenta los lanzamientos");
  igual(inf.equipo.goles, { total: 2, partes: [2, 0] }, "goles por parte");
  igual(inf.kpis.dp, { total: 2, partes: [2, 0] }, "el 10 m es un disparo a puerta");
  igual(inf.kpis.dpRival, { total: 1, partes: [0, 1] }, "el penalti rival también");
  igual(inf.golesPorTramo.reduce((a, x) => a + x.nuestros + x.rival, 0), 3, "las barras de 5' suman 3");
  igual(inf.cuartetos.filas.reduce((a, f) => a + f.gf, 0), 2, "cuartetos: goles a favor");
  igual(inf.cuartetos.filas.reduce((a, f) => a + f.gc, 0), 1, "cuartetos: goles en contra");
}
{
  const p = base();
  p.marcador = { inter: 1, rival: 0 };
  p.eventos = [
    ev("1T", 100, "gol", { id: "g1", equipo: "INTER", goleador: "B", cuarteto: [], accion: "Penalti", penaltiId: "p1" }),
    ev("1T", 100, "penalti", { id: "p1", equipo: "INTER", tirador: "B", portero: "", resultado: "GOL", golId: "g1" }),
  ];
  const inf = informe(p);
  igual(inf.goles.length, 1, "un penalti con gol enlazado cuenta una sola vez");
  igual(inf.kpis.dp.total, 1, "y un solo disparo");
  igual(inf.goles[0].cuarteto, ["A", "B", "C", "D"], "sin cuarteto escrito, sale de los cambios");
  igual(inf.goles[0].portero, "POR", "portero en pista");
}

console.log("\n⏱️ Minutos, orden y quién estaba en pista");
{
  const p = base();
  p.eventos = [
    ev("1T", 600, "cambio", { sale: "A", entra: "E" }),
    ev("2T", 600, "cambio", { sale: "E", entra: "A" }),
  ];
  const inf = informe(p);
  igual(inf.jugadores.map((j) => j.nombre),
        ["POR", "POR2", "A", "B", "C", "D", "E", "FIL"], "porteros, campo por dorsal y filial detrás");
  igual(inf.jugadores.find((j) => j.nombre === "A")!.segTotal, 1200, "minutos de A");
  igual(inf.maxMinutos.total, 2400, "el semáforo se escala con el máximo de campo");
  igual(inf.rotaciones.length, 2, "rotaciones de las dos partes");
  const r1 = inf.rotaciones[0].filas.find((f) => f.nombre === "A")!;
  igual(r1.turnos, [600], "turno de A en la 1.ª");
  const r2 = inf.rotaciones[1].filas.find((f) => f.nombre === "E")!;
  igual(r2.turnos, [600], "E sigue en pista al empezar la 2.ª (se arrastra)");
  const cr = inf.cronograma.jugadores.find((j) => j.nombre === "E")!;
  igual(cr.tramos, [{ parte: "1T", desde: 600, hasta: 1200 }, { parte: "2T", desde: 0, hasta: 600 }], "tramos en el cronograma");
  igual(inf.cronograma.jugadores.some((j) => j.nombre === "POR2"), false, "el que no jugó no sale en el cronograma");
  igual(inf.cuartetos.segPartido, 2400, "duración de partido en el cuadro de cuartetos");
}
{
  const p = base();                 // sin ningún cambio en la 2.ª parte
  p.eventos = [ev("1T", 10, "falta", { equipo: "INTER", jugador: "B" }),
               ev("2T", 10, "falta", { equipo: "RIVAL", jugador: "B" })];
  const inf = informe(p);
  igual(inf.cronograma.jugadores.find((j) => j.nombre === "B")!.tramos.length, 2, "una 2.ª parte sin cambios se pinta igual");
  igual(inf.cronograma.faltas.map((f) => f.num), [1, 1], "las faltas se numeran por parte y equipo");
  const b = inf.jugadores.find((j) => j.nombre === "B")!;
  igual([b.fc, b.fr], [1, 1], "falta cometida y recibida");
}

console.log("\n🧮 Valoración (mismos pesos que el club)");
{
  const p = base();
  p.marcador = { inter: 1, rival: 1 };
  p.acciones.porJugador = {
    B: contadores({ dpp: 1, robos: 2, pnf: 1, duelC_g: 1 }),
    POR: contadores({ paradas: 2, golesEncajados: 1 }),
  };
  p.eventos = [
    ev("1T", 100, "gol", { equipo: "INTER", goleador: "B", asistente: "C", cuarteto: ["POR", "A", "C", "D"], accion: "Banda" }),
    ev("2T", 100, "gol", { equipo: "RIVAL", cuarteto: ["POR", "A", "B", "C", "D"] }),
    ev("1T", 500, "amarilla", { equipo: "INTER", jugador: "B" }),
    ev("1T", 501, "falta", { equipo: "INTER", jugador: "B" }),
  ];
  const inf = informe(p);
  const v = inf.valoracion.find((x) => x.nombre === "B")!;
  // gol 3 + a puerta .4 + 2 robos 2 + pnf -1,5 + gf 1 + gc -1 + falta -.25 + amarilla -.5 + vídeo .5
  igual(v.val, 3.7, "B: la suma a mano (3,65 → 3,7)");
  igual(v.video, 0.5, "B: la parte de vídeo");
  igual(v.val40, redondear((3.65 / 40) * 40, 1), "B: ritmo por 40'");
  const por = inf.valoracion.find((x) => x.nombre === "POR")!;
  // parada ,8×2 + encajado -1,5 + gf 1 + gc -1 = 0,1; sin bonus (encajó)
  igual(por.val, 0.1, "portero sin bonus si encaja");
  ok(inf.valoracion.find((x) => x.nombre === "POR2")!.jugo === false, "el que no jugó sale como no jugó");
}
{
  const p = base();
  p.acciones.porJugador = { POR: contadores({ paradas: 1 }) };
  p.eventos = [ev("1T", 1, "disparo", { equipo: "RIVAL", resultado: "BLOQUEADO", portero: "POR" }),
               ev("1T", 2, "disparo", { equipo: "RIVAL", resultado: "PALO" }),
               ev("1T", 3, "penalti", { equipo: "RIVAL", tirador: "", portero: "POR", resultado: "POSTE" })];
  p.disparosRival = { puerta: 1, fuera: 0, palo: 2, bloqueado: 1 };
  const inf = informe(p);
  const f = inf.porteria.find((x) => x.nombre === "POR")!;
  igual([f.paradas, f.golesEncajados, f.bloqueos, f.postes, f.disparos, f.pct], [1, 0, 1, 2, 4, 100],
        "portería: bloqueos y postes salen de los eventos, también con el portero sin escribir");
  const v = inf.valoracion.find((x) => x.nombre === "POR")!;
  igual(v.val, 2.8, "bloqueos y postes NO suman (parada ,8 + portería a cero 2): igual que el club");
}

console.log("\n📊 Repartos: si no cuadran, no se enseñan");
{
  const p = base();
  p.acciones.porJugador = { B: contadores({ robos: 3 }) };
  p.eventos = [ev("1T", 1, "accion_individual", { jugador: "B", accion: "robos" }),
               ev("2T", 1, "accion_individual", { jugador: "B", accion: "robos" })];
  igual(informe(p).kpis.robos, { total: 3, partes: null }, "3 robos y 2 eventos: sin desglose");
  p.acciones.porJugador.B.robos = 2;
  igual(informe(p).kpis.robos, { total: 2, partes: [1, 1] }, "2 robos y 2 eventos: con desglose");
}
{
  const p = base();
  p.incorporacionesRival = { total: 2, conDisparo: 1, sinDisparo: 1 };
  p.eventos = [ev("1T", 1, "incorporacion_rival", { conDisparo: true }),
               ev("2T", 1, "incorporacion_rival", { conDisparo: false })];
  igual(informe(p).kpis.incorporaciones?.partes,
        [{ parte: "1T", con: 1, sin: 0 }, { parte: "2T", con: 0, sin: 1 }], "incorporaciones por parte");
  igual(informe(base()).kpis.incorporaciones, null, "sin incorporaciones no sale la caja");
}

console.log("\n🗞️ Titulares");
{
  const p = base();
  p.marcador = { inter: 2, rival: 2 };
  p.eventos = [
    ev("1T", 1, "gol", { equipo: "INTER", goleador: "B", cuarteto: [] }),
    ev("1T", 2, "gol", { equipo: "INTER", goleador: "B", cuarteto: [] }),
    ev("2T", 1, "gol", { equipo: "RIVAL", cuarteto: [] }),
    ev("2T", 2, "gol", { equipo: "RIVAL", cuarteto: [] }),
  ];
  igual(informe(p).titulares.map((x) => x.clave), ["ic_tit_empate", "ic_tit_se_escapo"], "ir +2 y empatar");
}

console.log("\n🧩 Matriz de jugadas");
{
  for (const a of ACCIONES_GOL) {
    if (a === "Otra") continue;
    ok(columnaMatriz(a) !== "No calificado", `«${a}» tiene columna`);
  }
  igual(columnaMatriz("Otra"), "No calificado", "Otra va a No calificado");
  igual(columnaMatriz("cualquier cosa"), "No calificado", "lo desconocido no se pierde");
  igual(COLUMNAS_MATRIZ.length, 23, "las 23 columnas del club");
  igual(new Set(COLUMNAS_MATRIZ.map((c) => c.clave)).size, 23, "claves sin repetir");
  const p = base();
  p.marcador = { inter: 1, rival: 1 };
  p.eventos = [
    ev("1T", 1, "gol", { equipo: "INTER", goleador: "B", cuarteto: ["POR", "A", "C", "D"], accion: "Banda" }),
    ev("2T", 1, "gol", { equipo: "RIVAL", cuarteto: ["POR", "A", "B", "C", "D"], accion: "Contraataque" }),
  ];
  const inf = informe(p);
  const iBan = COLUMNAS_MATRIZ.findIndex((c) => c.canon === "Banda");
  igual(inf.matrizFavor.filas.find((f) => f.nombre === "B")!.celdas[iBan], 1, "a favor: la columna del goleador");
  igual(inf.matrizFavor.total, 1, "a favor: total");
  const iCtr = COLUMNAS_MATRIZ.findIndex((c) => c.canon === "Contraataque");
  igual(inf.matrizContra.filas.filter((f) => f.celdas[iCtr] === 1).length, 5, "en contra: los cinco que estaban");
  igual(inf.matrizContra.totales[iCtr], 1, "en contra: TOTAL es el gol, no la suma");
}
{
  igual(orientarNumeros("4x3", 3), "3x4", "con 3 de los nuestros es 3x4");
  igual(orientarNumeros("3x4", 4), "4x3", "con 4 de los nuestros es 4x3");
  igual(orientarNumeros("4x3", null), "4x3", "si no se sabe, se queda");
  igual(orientarNumeros("Banda", 4), "Banda", "lo que no es de números no se toca");
}

console.log("\n🎥 Lo que no se contó no sale");
{
  const inf = informe(base());
  igual(inf.hayVideo, false, "directo: sin vídeo");
  igual(inf.mapas, null, "directo: sin mapas");
  igual(inf.pases, null, "directo: sin pases");
  igual(inf.hayDivididos, false, "directo: sin divididos");
  igual(inf.tanda, null, "sin tanda");
}
{
  const p = base();
  p.modo = "video";
  p.marcador = { inter: 2, rival: 0 };
  p.acciones.porJugador = { A: contadores({ paseGol: 1 }), B: contadores({ dpp: 1 }) };
  p.eventos = [
    ev("1T", 5, "accion_individual", { jugador: "A", accion: "paseGol", flecha: { x0: 0.1, y0: 0.5, x1: 0.8, y1: 0.5 } }),
    ev("1T", 60, "gol", { equipo: "INTER", goleador: "B", asistente: "C", cuarteto: [], accion: "Banda", zonaCampo: "D3", zonaPorteria: "P1",
                          flechaAsistencia: { x0: 0.5, y0: 0.5, x1: 0.9, y1: 0.5 } }),
    ev("2T", 60, "gol", { equipo: "INTER", goleador: "D", asistente: "A", cuarteto: [], accion: "Banda" }),
  ];
  const inf = informe(p);
  igual(inf.hayVideo, true, "con vídeo");
  igual(inf.mapas?.favorCampo, { A11: 1 }, "toda D cae en la 11");
  igual(inf.mapas?.favorPorteria, { P1: 1 }, "portería");
  igual([inf.pases?.pasesGol, inf.pases?.asistencias, inf.pases?.sinFlecha], [1, 1, 1], "recuentos de pases");
  igual(inf.pases?.flechas.length, 2, "dos flechas que pintar");
  igual(inf.pases?.filas.length, 3, "tres filas en la lista");
  p.eventos = [ev("1T", 60, "gol", { equipo: "INTER", goleador: "B", asistente: "C", cuarteto: [], accion: "Banda" }),
               ev("1T", 61, "accion_individual", { jugador: "A", accion: "duelC_g" })];
  p.acciones.porJugador = { A: contadores({ duelC_g: 1 }) };
  igual(informe(p).pases, null, "sin ninguna flecha dibujada, la hoja no sale");
}

console.log("\n🥅 Tanda, tiempos muertos y prórroga");
{
  const p = base();
  p.tanda = { activa: false, marcador: { inter: 1, rival: 1 }, tiros: [
    { id: "2", orden: 2, equipo: "RIVAL", resultado: "GOL", tirador: "9", timestampReal: 1 },
    { id: "1", orden: 1, equipo: "INTER", resultado: "GOL", tirador: "b", timestampReal: 1 },
    { id: "3", orden: 3, equipo: "INTER", resultado: "PARADA", timestampReal: 1 },
  ] };
  const inf = informe(p);
  igual(inf.tanda?.tiros.map((x) => `${x.marcadorNos}-${x.marcadorRival}`), ["1-0", "1-1", "1-1"], "marcador acumulado de la tanda");
  igual([inf.tanda?.nos, inf.tanda?.rival], [1, 1], "resultado de la tanda");
}
{
  const p = base();
  p.config!.duracionParte.PR1 = 300;
  p.config!.duracionParte.PR2 = 300;
  p.marcador = { inter: 1, rival: 0 };
  p.tiempos.B.porParte.PR1 = 300;
  p.tiempos.B.totalSegundos += 300;
  p.eventos = [
    ev("1T", 40, "cambio", { sale: "A", entra: "E" }),
    ev("PR1", 10, "gol", { equipo: "INTER", goleador: "B", cuarteto: [] }),
    { ...ev("2T", 30, "tiempo_muerto", { equipo: "RIVAL" }), marcador: { inter: 0, rival: 0 } },
  ];
  const inf = informe(p);
  igual(inf.hayProrroga, true, "detecta la prórroga");
  igual(inf.goles[0].minuto, "40:10", "minuto absoluto en la prórroga");
  igual(inf.equipo.goles, { total: 1, partes: [0, 0, 1] }, "reparto con tres cifras");
  igual(inf.jugadores.find((j) => j.nombre === "B")!.segPR, 300, "minutos de prórroga");
  igual(inf.golesPorTramo.length, 10, "las barras llegan hasta el 50'");
  igual(inf.tiemposMuertos[0], { parte: "2T", minuto: "00:30", nuestro: false, nos: 0, rival: 0 }, "tiempo muerto");
}

console.log("\n🔢 Formatos");
igual(redondear(9.85, 1), 9.9, "9,85 → 9,9");
igual(redondear(-2.25, 1), -2.3, "-2,25 → -2,3");
igual(minSeg(0), "—", "cero minutos");
igual(minSeg(725.4), "12:05", "m:ss");
igual(mmss2(65), "01:05", "mm:ss");
igual(zonaMapa("__skip__"), "", "saltar zona no es una zona");

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo en verde");
process.exit(fallos ? 1 : 0);
