/**
 * Test de los DISPAROS POR SITUACIÓN (24/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/situacionesNumericas.test.ts
 *
 * Un partido de mentira en el que se sabe a mano cuánto duró cada situación y
 * qué disparos cayeron en ella: nuestro portero-jugador (con el portero
 * volviendo a entrar en medio), el suyo con el botón (uno cerrado y uno que se
 * queda encendido al descanso), una expulsión nuestra cortada por gol y una
 * suya que dura sus 2 minutos y pasa de parte. Y lo que más importa: un
 * partido viejo, sin nada de eso, sigue sin pintar nada.
 */
import type { Evento, Partido } from "./db.ts";
import { readFileSync } from "node:fs";
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
  disparosPorSituacion, tramosSituaciones, pjRivalActivo, unirTramos, minutosSituacion,
  SEG_EXPULSION, CLAVE_SITUACION,
} = await import("./situacionesNumericas.ts");

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

const PORTEROS = new Set(["POR", "POR2"]);
let idEv = 0;
function ev(parte: string, seg: number, tipo: string, resto: Record<string, unknown> = {}): Evento {
  idEv += 1;
  return {
    id: `e${idEv}`, tipo, parte, segundosParte: seg, segundosPartido: seg,
    timestampReal: 1, marcador: { inter: 0, rival: 0 }, ...resto,
  } as unknown as Evento;
}
const tiro = (parte: string, seg: number, equipo: string, resultado = "PUERTA") =>
  ev(parte, seg, "disparo", { equipo, resultado });

function base(eventos: Evento[]): Partido {
  return {
    id: "t", estado: "finalizado", modo: "video",
    config: {
      rival: "RIVAL FS", fecha: "2026-11-29", hora: "18:00", lugar: "Pabellón",
      competicion: "LIGA", local: true, partido_id: "J1",
      convocados: ["POR", "POR2", "A", "B", "C", "D", "E", "F"],
      pista_inicial: { portero: "POR", pista1: "A", pista2: "B", pista3: "C", pista4: "D" },
      duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
      permiteTanda: false, direccionInter1T: "der",
    },
    cronometro: { parteActual: "2T", segundosParte: 1200, ultimoStart: null },
    enPista: [], tiempos: {}, marcador: { inter: 0, rival: 0 },
    stats: {} as Partido["stats"], eventos,
    acciones: { porJugador: {} },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
    actualizado: 1,
  } as unknown as Partido;
}

console.log("── Partido viejo: nada nuevo ──");
{
  const viejo = base([
    tiro("1T", 100, "INTER"), tiro("1T", 200, "RIVAL", "FUERA"),
    ev("1T", 300, "gol", { equipo: "INTER", goleador: "A", cuarteto: [] }),
    ev("1T", 400, "incorporacion_rival", { conDisparo: true }),
    ev("2T", 500, "cambio", { sale: "A", entra: "E" }),
    ev("2T", 600, "amarilla", { equipo: "RIVAL", jugador: "#7" }),
    ev("2T", 700, "roja", { equipo: "INTER", jugador: "#CT" }),   // cuerpo técnico: no resta
  ]);
  igual(disparosPorSituacion(viejo, PORTEROS), null,
        "sin rojas ni portero-jugador → null (el informe no pinta la tabla)");
  igual(pjRivalActivo(viejo.eventos, "2T"), null, "el botón empieza apagado");
}

console.log("── Las cuatro situaciones ──");
{
  const p = base([
    // 1T · su portero-jugador con el botón, de 5:00 a 6:00
    ev("1T", 300, "portero_jugador", { equipo: "RIVAL", estado: "inicio" }),
    tiro("1T", 310, "RIVAL", "FUERA"),
    tiro("1T", 330, "INTER", "PUERTA"),                // a puerta vacía
    ev("1T", 360, "portero_jugador", { equipo: "RIVAL", estado: "fin" }),
    tiro("1T", 370, "RIVAL"),                          // ya con portero: normal
    // 1T · expulsión nuestra a las 10:00, cortada por gol suyo en el 11:00
    ev("1T", 600, "roja", { equipo: "INTER", jugador: "A" }),
    ev("1T", 600, "cambio", { sale: "A", entra: "" }),
    tiro("1T", 630, "RIVAL", "BLOQUEADO"),
    ev("1T", 660, "gol", { equipo: "RIVAL" }),
    ev("1T", 665, "cambio", { sale: "", entra: "E" }),
    tiro("1T", 700, "RIVAL", "FUERA"),                 // fuera de la expulsión
    // 1T · su portero-jugador encendido al final: se cierra al descanso
    ev("1T", 1150, "portero_jugador", { equipo: "RIVAL", estado: "inicio" }),
    tiro("1T", 1190, "RIVAL", "PUERTA"),
    // 2T · nuestro portero-jugador desde el 15:00, el portero vuelve 16:00-16:30;
    //      en medio, expulsión suya en el 18:30 que corta nuestro gol del 19:30
    ev("2T", 900, "cambio", { sale: "POR", entra: "F" }),
    tiro("2T", 910, "INTER", "FUERA"),
    ev("2T", 960, "cambio", { sale: "F", entra: "POR" }),
    tiro("2T", 970, "INTER", "PUERTA"),                // con portero: normal
    ev("2T", 990, "cambio", { sale: "POR", entra: "F" }),
    ev("2T", 1110, "roja", { equipo: "RIVAL", jugador: "#5" }),
    tiro("2T", 1150, "INTER", "PUERTA"),               // PJ nuestro + expulsión suya
    ev("2T", 1170, "gol", { equipo: "INTER", goleador: "B", cuarteto: [] }),
    tiro("2T", 1180, "RIVAL", "FUERA"),                // tras el gol: sigue nuestro PJ
  ]);
  const tr = tramosSituaciones(p, PORTEROS);
  igual(tr.pj_rival, [{ desde: 300, hasta: 360 }, { desde: 1150, hasta: 1200 }],
        "su portero-jugador: el tramo del botón y el que se cierra al descanso");
  igual(tr.expulsion_nuestra, [{ desde: 600, hasta: 660 }],
        "nuestra expulsión se corta en el gol del rival (1 min, no 2)");
  igual(tr.pj_nuestro, [{ desde: 2100, hasta: 2160 }, { desde: 2190, hasta: 2400 }],
        "nuestro portero-jugador, sin el rato en que el portero volvió a entrar");
  igual(tr.expulsion_rival, [{ desde: 2310, hasta: 2370 }],
        "la expulsión suya acaba en nuestro gol");

  const c = disparosPorSituacion(p, PORTEROS)!;
  const fila = (k: string) => c.filas.find((f) => f.clave === k)!;
  igual(c.filas.map((f) => f.clave),
        ["pj_nuestro", "pj_rival", "expulsion_nuestra", "expulsion_rival"],
        "salen las cuatro, en orden fijo");
  igual(fila("pj_rival").favor, { disparos: 1, aPuerta: 1, goles: 0 }, "PJ rival · a favor");
  igual(fila("pj_rival").contra, { disparos: 2, aPuerta: 1, goles: 0 }, "PJ rival · en contra");
  igual(fila("pj_rival").segundos, 110, "PJ rival · 1:50 en total");
  igual(fila("expulsion_nuestra").contra, { disparos: 2, aPuerta: 1, goles: 1 },
        "con uno menos: el bloqueado y el gol que la corta");
  igual(fila("pj_nuestro").favor, { disparos: 3, aPuerta: 2, goles: 1 },
        "nuestro PJ: el de fuera, el de puerta y el gol (no el del portero dentro)");
  igual(fila("pj_nuestro").contra, { disparos: 1, aPuerta: 0, goles: 0 }, "nuestro PJ · en contra");
  igual(fila("pj_nuestro").segundos, 270, "nuestro PJ · 4:30 efectivos");
  igual(fila("expulsion_rival").favor, { disparos: 2, aPuerta: 2, goles: 1 },
        "ellos con uno menos: el disparo y el gol");
  ok(c.haySolape, "avisa de que hay disparos que cuentan en dos filas");
  igual(c.resto.favor.disparos, 1, "resto · a favor: solo el del portero dentro");
  igual(c.resto.contra.disparos, 2, "resto · en contra: los dos de juego normal");
  igual(c.resto.segundos, 2400 - 110 - 60 - 270, "resto · el tiempo que no es de ninguna");
  igual(minutosSituacion(270), "4:30", "minutos con m:ss");
}

console.log("── Expulsión que cambia de parte ──");
{
  const p = base([
    ev("1T", 1150, "roja", { equipo: "RIVAL", jugador: "#9" }),
    tiro("2T", 30, "INTER"),                          // 1:20 después: sigue
    tiro("2T", 80, "INTER", "FUERA"),                 // 2:10 después: ya no
  ]);
  const c = disparosPorSituacion(p, PORTEROS)!;
  igual(c.filas[0].tramos, [{ desde: 1150, hasta: 1150 + SEG_EXPULSION }],
        "los 2 minutos siguen corriendo en la 2.ª parte");
  igual(c.filas[0].favor.disparos, 1, "solo el disparo de dentro de los 2 minutos");
}

console.log("── El botón de la pantalla ──");
{
  const evs = [
    ev("2T", 100, "portero_jugador", { equipo: "RIVAL", estado: "inicio" }),
  ];
  igual(pjRivalActivo(evs, "2T"), { desde: 100 }, "encendido tras «inicio»");
  igual(pjRivalActivo(evs, "PR1"), null, "en la parte siguiente sale apagado");
  evs.push(ev("2T", 160, "portero_jugador", { equipo: "RIVAL", estado: "fin" }));
  igual(pjRivalActivo(evs, "2T"), null, "apagado tras «fin»");
  igual(unirTramos([{ desde: 5, hasta: 10 }, { desde: 0, hasta: 6 }, { desde: 20, hasta: 20 }]),
        [{ desde: 0, hasta: 10 }], "unir tramos: se juntan los que se pisan y fuera los vacíos");
  // Sin portero en el quinteto inicial no se calcula nuestro PJ: sería todo el partido.
  const sinPor = base([tiro("1T", 10, "INTER")]);
  (sinPor.config.pista_inicial as unknown as Record<string, string>).portero = "";
  igual(tramosSituaciones(sinPor, PORTEROS).pj_nuestro, [],
        "sin portero inicial no hay PJ nuestro inventado");
}

console.log("── Textos y pantalla ──");
{
  const i18n = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
  for (const k of [...Object.values(CLAVE_SITUACION), "btn_pj_rival", "btn_pj_rival_on",
                   "inf_sec_situaciones", "sit_nota", "sit_nota_solape", "part_pj_rival",
                   "ud_pj_rival_inicio", "ud_pj_rival_fin"]) {
    ok(new RegExp(`\\b${k}: \\{`).test(i18n), `i18n tiene «${k}»`);
  }
  const partido = readFileSync(new URL("../app/partido/page.tsx", import.meta.url), "utf8");
  ok((partido.match(/btn_pj_rival/g) ?? []).length >= 2,
     "el botón está en los dos aspectos (clásico y nuevo)");
  ok(/tipo: "portero_jugador", equipo: "RIVAL"/.test(partido),
     "el botón guarda un evento `portero_jugador` del RIVAL");
  const informe = readFileSync(new URL("../app/informe/page.tsx", import.meta.url), "utf8");
  ok(/disparosPorSituacion/.test(informe), "el informe del Inter pinta la tabla");
  const completo = readFileSync(new URL("../components/InformeCompleto.tsx", import.meta.url), "utf8");
  ok(/disparosPorSituacion/.test(completo), "y el informe completo (PULSO) también");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo en verde");
process.exit(fallos ? 1 : 0);
