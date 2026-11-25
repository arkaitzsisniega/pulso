/**
 * Test de «Deshacer» tras una expulsión (25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/deshacer.test.ts
 */
import { cuantosDeshacer, deshacerCambio, type EstadoPista } from "./deshacer.ts";
import { registerHooks } from "node:module";
// situacionesNumericas importa sin extensión (estilo Next): se la ponemos.
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const { pjRivalActivo } = await import("./situacionesNumericas.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}

const T0 = 1_700_000_000_000;
let n = 0;
// Un apunte como los del store: mismo toque = mismos milisegundos (± unos pocos).
function ev(tipo: string, extra: Record<string, unknown>, ms: number, seg = 300): any {
  return { id: `e${++n}`, tipo, parte: "1T", segundosParte: seg, segundosPartido: seg,
           timestampReal: T0 + ms, marcador: { inter: 0, rival: 0 }, ...extra };
}
function tiempo(nombre: string, enPista: boolean, turno = 0, total = 0): any {
  return { nombre, totalSegundos: total, porParte: { "1T": total, "2T": 0, PR1: 0, PR2: 0 },
           segTurnoActual: enPista ? turno : null, turnoStart: null,
           ultimaSalida: enPista ? null : T0, segDescansoActual: enPista ? null : 50,
           descansoStart: null, segTurnoUltimo: null };
}
const PISTA = ["PORTERO", "ALA1", "ALA2", "CIERRE", "PIVOT"];
function estadoBase(): EstadoPista {
  const tiempos: Record<string, any> = {};
  for (const j of PISTA) tiempos[j] = tiempo(j, true, 60, 200);
  tiempos.SUPLENTE = tiempo("SUPLENTE", false, 0, 100);
  return { enPista: PISTA.slice(), tiempos,
           cronometro: { parteActual: "1T", segundosParte: 300, ultimoStart: null } };
}

// ─── Lo que hace la pantalla al expulsar a uno que está en pista ──────────
// (expulsarJugadorInter): `roja` + `cambio` que lo saca sin que entre nadie.
// Y lo que hace cambiarJugador con sus relojes al sacarlo.
function expulsarEnPista(p: EstadoPista, eventos: any[], jugador: string, ms: number) {
  eventos.push(ev("roja", { equipo: "INTER", jugador }, ms));
  eventos.push(ev("cambio", { sale: jugador, entra: "" }, ms + 3));
  const t = p.tiempos[jugador];
  p.tiempos[jugador] = { ...t, segTurnoActual: null, ultimaSalida: T0 + ms,
                         segTurnoUltimo: t.segTurnoActual ?? 0, segDescansoActual: 0, descansoStart: null };
  p.enPista = p.enPista.filter((x) => x !== jugador);
}

console.log("Roja directa a uno que está en pista");
{
  const p = estadoBase(); const eventos: any[] = [ev("falta", { equipo: "INTER" }, 0)];
  expulsarEnPista(p, eventos, "ALA1", 5000);
  ok(p.enPista.length === 4, "tras la roja quedan 4 en pista");
  const k = cuantosDeshacer(eventos);
  ok(k === 2, `un toque de Deshacer quita la roja Y el cambio (quita ${k})`);
  // Deshacer: del último al primero, como el store.
  const r = deshacerCambio(p, eventos[eventos.length - 1]);
  const quedan = eventos.slice(0, eventos.length - k);
  ok(quedan.length === 1 && quedan[0].tipo === "falta", "queda solo lo de antes (la falta)");
  ok(!quedan.some((e) => e.tipo === "roja"), "ya no hay roja → ni «EXPULSADO» ni barra de inferioridad");
  ok(r.enPista.length === 5 && r.enPista.includes("ALA1"), "el expulsado vuelve a pista: 5 otra vez");
  ok(!r.enPista.includes(""), "sin huecos fantasma en la pista");
  ok(r.tiempos.ALA1.segTurnoActual === 60, `su turno sigue donde iba (${r.tiempos.ALA1.segTurnoActual})`);
  ok(r.tiempos.ALA1.segDescansoActual === null && r.tiempos.ALA1.ultimaSalida === null, "y ya no cuenta como en el banquillo");
}

console.log("Con el reloj en marcha, el tiempo desde la roja es suyo");
{
  const p = estadoBase(); const eventos: any[] = [];
  expulsarEnPista(p, eventos, "PIVOT", 0);
  // 10 s de reloj después (la roja fue en el 300; el reloj va por el 310 y corre).
  p.cronometro = { parteActual: "1T", segundosParte: 310, ultimoStart: T0 + 20_000 };
  const r = deshacerCambio(p, eventos[1], T0 + 20_000);
  ok(Math.abs((r.tiempos.PIVOT.segTurnoActual ?? 0) - 70) < 1e-6, `turno 60 + 10 = 70 (da ${r.tiempos.PIVOT.segTurnoActual})`);
  ok(Math.abs(r.tiempos.PIVOT.totalSegundos - 210) < 1e-6, `total 200 + 10 = 210 (da ${r.tiempos.PIVOT.totalSegundos})`);
  ok(r.tiempos.PIVOT.turnoStart === T0 + 20_000, "y su reloj de turno vuelve a correr");
}

console.log("Roja a uno del banquillo (no hay cambio)");
{
  const eventos = [ev("gol", { equipo: "INTER" }, 0), ev("roja", { equipo: "INTER", jugador: "SUPLENTE" }, 9000)];
  ok(cuantosDeshacer(eventos) === 1, "Deshacer quita solo la roja");
}

console.log("Segunda amarilla (roja automática)");
{
  const p = estadoBase();
  const eventos: any[] = [ev("amarilla", { equipo: "INTER", jugador: "CIERRE" }, 0)];
  eventos.push(ev("falta", { equipo: "RIVAL" }, 60_000));
  eventos.push(ev("amarilla", { equipo: "INTER", jugador: "CIERRE" }, 120_000));
  expulsarEnPista(p, eventos, "CIERRE", 120_002);
  const k = cuantosDeshacer(eventos);
  ok(k === 3, `quita 2ª amarilla + roja + cambio de una vez (quita ${k})`);
  const quedan = eventos.slice(0, eventos.length - k);
  ok(quedan.filter((e) => e.tipo === "amarilla").length === 1, "le queda la 1ª amarilla");
  ok(quedan[quedan.length - 1].tipo === "falta", "y la falta de en medio no se toca");
  const r = deshacerCambio(p, eventos[eventos.length - 1]);
  ok(r.enPista.includes("CIERRE") && r.enPista.length === 5, "vuelve a pista");
}
{
  // 2ª amarilla a uno del banquillo: amarilla + roja.
  const eventos = [ev("amarilla", { equipo: "INTER", jugador: "SUPLENTE" }, 0),
                   ev("amarilla", { equipo: "INTER", jugador: "SUPLENTE" }, 90_000),
                   ev("roja", { equipo: "INTER", jugador: "SUPLENTE" }, 90_001)];
  ok(cuantosDeshacer(eventos) === 2, "en el banquillo: quita 2ª amarilla + roja");
}
{
  // Una 1ª amarilla que casualmente cae justo antes de una roja directa no se junta.
  const eventos = [ev("amarilla", { equipo: "INTER", jugador: "ALA2" }, 0),
                   ev("roja", { equipo: "INTER", jugador: "ALA2" }, 500),
                   ev("cambio", { sale: "ALA2", entra: "" }, 503)];
  ok(cuantosDeshacer(eventos) === 2, "1ª amarilla + roja directa: la amarilla se queda");
}

console.log("Roja del rival");
{
  const eventos = [ev("amarilla", { equipo: "RIVAL", jugador: "7" }, 0),
                   ev("roja", { equipo: "RIVAL", jugador: "7" }, 3000)];
  ok(cuantosDeshacer(eventos) === 1, "quita solo la roja (la amarilla fue otra pregunta)");
  const quedan = eventos.slice(0, -1);
  ok(!quedan.some((e) => e.tipo === "roja" && e.equipo === "RIVAL"), "sin roja rival → se va la barra de superioridad");
}

console.log("Lo de siempre sigue siendo de uno en uno");
{
  ok(cuantosDeshacer([]) === 0, "lista vacía: nada");
  ok(cuantosDeshacer([ev("amarilla", { equipo: "INTER", jugador: "ALA1" }, 0)]) === 1, "amarilla sola: 1");
  ok(cuantosDeshacer([ev("gol", { equipo: "RIVAL" }, 0)]) === 1, "gol: 1");
  ok(cuantosDeshacer([ev("cambio", { sale: "ALA1", entra: "SUPLENTE" }, 0)]) === 1, "cambio normal: 1");
  // Roja y su cambio separados por más de un toque (no los hizo la misma acción).
  const sueltos = [ev("roja", { equipo: "INTER", jugador: "ALA1" }, 0),
                   ev("cambio", { sale: "ALA1", entra: "" }, 30_000)];
  ok(cuantosDeshacer(sueltos) === 1, "roja y cambio de toques distintos: de uno en uno");
}

console.log("Cambio normal deshecho");
{
  const p = estadoBase();
  // ALA2 (turno 60) sale y entra SUPLENTE; el reloj corre 15 s.
  const e = ev("cambio", { sale: "ALA2", entra: "SUPLENTE" }, 0, 300);
  p.enPista = p.enPista.map((x) => (x === "ALA2" ? "SUPLENTE" : x));
  p.tiempos.ALA2 = { ...p.tiempos.ALA2, segTurnoActual: null, segTurnoUltimo: 60, ultimaSalida: T0, segDescansoActual: 0, descansoStart: T0 };
  p.tiempos.SUPLENTE = { ...p.tiempos.SUPLENTE, segTurnoActual: 0, turnoStart: T0, ultimaSalida: null, segDescansoActual: null };
  p.cronometro = { parteActual: "1T", segundosParte: 300, ultimoStart: T0 };
  const r = deshacerCambio(p, e, T0 + 15_000);
  ok(r.enPista.includes("ALA2") && !r.enPista.includes("SUPLENTE"), "ALA2 vuelve, SUPLENTE al banquillo");
  ok(r.enPista[2] === "ALA2", "y en su mismo sitio de la pista");
  ok(Math.abs((r.tiempos.ALA2.segTurnoActual ?? 0) - 75) < 1e-6, `turno de ALA2 60 + 15 (da ${r.tiempos.ALA2.segTurnoActual})`);
  ok(r.tiempos.ALA2.turnoStart === T0 + 15_000, "y le corre el reloj (antes se quedaba parado en pista)");
  ok(r.tiempos.SUPLENTE.segTurnoActual === null && r.tiempos.SUPLENTE.turnoStart === null, "SUPLENTE deja de contar en pista");
  ok(Math.abs(r.tiempos.SUPLENTE.totalSegundos - 100) < 1e-6, `SUPLENTE no se queda los 15 s (total ${r.tiempos.SUPLENTE.totalSegundos})`);
}

console.log("Gol que corta la expulsión, reincorporación y deshacer");
{
  const p = estadoBase(); const eventos: any[] = [];
  expulsarEnPista(p, eventos, "ALA1", 0);                       // roja en el 300
  eventos.push(ev("gol", { equipo: "RIVAL" }, 40_000, 340));    // el rival marca → se acaba la sanción
  // Se rellena el hueco: reincorporar mete a SUPLENTE (cambio con sale "").
  eventos.push(ev("cambio", { sale: "", entra: "SUPLENTE" }, 45_000, 345));
  p.enPista = [...p.enPista, "SUPLENTE"];
  p.tiempos.SUPLENTE = { ...p.tiempos.SUPLENTE, segTurnoActual: 0, segDescansoActual: null, ultimaSalida: null };
  ok(cuantosDeshacer(eventos) === 1, "deshacer la reincorporación: 1 apunte");
  const r = deshacerCambio(p, eventos[eventos.length - 1]);
  ok(r.enPista.length === 4 && !r.enPista.includes("SUPLENTE") && !r.enPista.includes(""),
     "vuelve el hueco (4 en pista) sin meter un jugador \"\" (antes pasaba)");
  ok(r.tiempos.SUPLENTE.segTurnoActual === null, "SUPLENTE vuelve al banquillo");
  eventos.pop();
  ok(cuantosDeshacer(eventos) === 1 && eventos[eventos.length - 1].tipo === "gol", "luego Deshacer quita SOLO el gol");
  eventos.pop();
  // Sin el gol, la roja vuelve a estar viva: la barra se deriva de los apuntes
  // (rojas sin gol contrario posterior y con menos de 2 min).
  const roja = eventos.find((e) => e.tipo === "roja");
  const golesDespues = eventos.filter((e) => e.tipo === "gol" && e.equipo === "RIVAL" && e.segundosPartido > roja.segundosPartido);
  ok(!!roja && golesDespues.length === 0, "y la roja vuelve a estar activa, con su tiempo (desde el 300)");
}

console.log("Portero-jugador del rival");
{
  const eventos = [ev("portero_jugador", { equipo: "RIVAL", estado: "inicio" }, 0, 100)];
  ok(!!pjRivalActivo(eventos, "1T" as any), "encendido");
  ok(cuantosDeshacer(eventos) === 1, "Deshacer quita el interruptor");
  ok(!pjRivalActivo(eventos.slice(0, -1), "1T" as any), "y se apaga");
  const dos = [...eventos, ev("portero_jugador", { equipo: "RIVAL", estado: "fin" }, 30_000, 130)];
  ok(!pjRivalActivo(dos, "1T" as any), "apagado tras el 2º toque");
  ok(!!pjRivalActivo(dos.slice(0, -1), "1T" as any), "deshacer el apagado lo vuelve a encender");
}

if (fallos) { console.log(`\n❌ ${fallos} fallo(s)`); process.exit(1); }
console.log("\n✅ Todo bien");
