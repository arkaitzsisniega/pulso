/**
 * verificar_partido_demo.ts — Comprueba que el partido de ejemplo de la demo no
 * se parece al real y que es un partido coherente (22/11/2026).
 *
 *   node scripts/verificar_partido_demo.ts --origen /ruta/partido_original.json
 * (sin --origen, lo saca de git, del commit 5bfb580). Sale con código 1 si algo falla.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { registerHooks } from "node:module";
import type { Partido, Evento, ParteId } from "../src/lib/db";

registerHooks({
  resolve(esp, ctx, sig) {
    if (esp.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(esp)) {
      try { return sig(`${esp}.ts`, ctx); } catch { /* tal cual */ }
    }
    return sig(esp, ctx);
  },
});
const { reconstruirAgregados, recomputarMinutos } = await import("../src/lib/reconstruir.ts");
const { ROSTER_DEMO } = await import("../src/lib/roster.ts");

const RAIZ = new URL("..", import.meta.url).pathname;
const i = process.argv.indexOf("--origen");
const txtOrig = i > 0 ? readFileSync(process.argv[i + 1], "utf8")
  : execSync(`git -C "${RAIZ}" show 5bfb580:public/_demo_partido.json`, { encoding: "utf8" });
const orig = JSON.parse(txtOrig) as Partido;
const txtNuevo = readFileSync(`${RAIZ}public/_demo_partido.json`, "utf8");
const nuevo = JSON.parse(txtNuevo) as Partido;

let fallos = 0;
function ok(c: boolean, msg: string) { console.log(`  ${c ? "✅" : "❌"} ${msg}`); if (!c) fallos++; }
const esPortero = (n: string) => ROSTER_DEMO.some((j) => j.nombre === n && j.posicion === "PORTERO");

console.log("── Que no se reconozca ──");
{
  // (parte, minuto, tipo, jugador): ¿cuántos eventos nuevos tienen gemelo en el original?
  const quien = (e: Evento) => {
    const r = e as unknown as Record<string, unknown>;
    return e.tipo === "cambio" ? `${e.sale}>${e.entra}` : String(r.jugador ?? r.goleador ?? r.tirador ?? r.equipo ?? "");
  };
  const clave = (e: Evento) => `${e.parte}|${Math.floor(e.segundosParte / 60)}|${e.tipo}|${quien(e)}`;
  const bolsa = new Map<string, number>();
  for (const e of orig.eventos) bolsa.set(clave(e), (bolsa.get(clave(e)) ?? 0) + 1);
  let iguales = 0;
  for (const e of nuevo.eventos) {
    const k = clave(e), n = bolsa.get(k) ?? 0;
    if (n > 0) { iguales++; bolsa.set(k, n - 1); }
  }
  const pct = (100 * iguales) / nuevo.eventos.length;
  ok(pct <= 10, `eventos con el mismo (parte, minuto, tipo, jugador) que el original: ${iguales}/${nuevo.eventos.length} = ${pct.toFixed(1)} % (tope 10 %)`);

  // Ninguna marca de tiempo del original, ni de su mes, ni sus ids.
  const marcasOrig = new Set(txtOrig.match(/\b1[78]\d{11}\b/g) ?? []);
  const marcasNuevo = txtNuevo.match(/\b1[78]\d{11}\b/g) ?? [];
  ok(marcasNuevo.every((m) => !marcasOrig.has(m)), `ninguna de las ${marcasOrig.size} marcas de tiempo del original sigue (${marcasNuevo.length} marcas nuevas)`);
  const dias = new Set(marcasNuevo.map((m) => new Date(Number(m)).toISOString().slice(0, 10)));
  ok([...dias].every((d) => d === nuevo.config!.fecha), `todas las marcas caen el día de la cabecera (${[...dias].join(", ")})`);
  const diasOrig = new Set(orig.eventos.map((e) => new Date(e.timestampReal).toISOString().slice(0, 10)));
  ok([...diasOrig].every((d) => !txtNuevo.includes(d)), `ninguna fecha del original como texto (${[...diasOrig].join(", ")}, ${orig.config!.fecha})`
    + (txtNuevo.includes(orig.config!.fecha) ? " ❗cabecera" : ""));
  ok(!txtNuevo.includes(orig.config!.fecha), "la fecha de la cabecera original no aparece");
  // Los ids llevan la hora en base 36 al final: ninguno del original.
  const idsOrig = new Set(orig.eventos.map((e) => e.id));
  const sufijos = new Set(orig.eventos.map((e) => e.id.slice(8)));
  ok(nuevo.eventos.every((e) => !idsOrig.has(e.id) && !sufijos.has(e.id.slice(8))), "ningún id (ni su parte de hora) del original");
  ok(new Set(nuevo.eventos.map((e) => e.id)).size === nuevo.eventos.length, "ids únicos");
  ok(nuevo.config!.rival !== orig.config!.rival, `rival nuevo: ${nuevo.config!.rival}`);
  const res = (p: Partido) => `${p.marcador.inter}-${p.marcador.rival}`;
  ok(res(nuevo) !== res(orig), `resultado nuevo: ${res(nuevo)} (el original, ${res(orig)})`);
  const minGol = (p: Partido) => p.eventos.filter((e) => e.tipo === "gol").map((e) => `${e.parte} ${Math.floor(e.segundosParte / 60)}′`);
  const mg = new Set(minGol(orig));
  ok(minGol(nuevo).every((m) => !mg.has(m)), `minutos de gol: ${minGol(nuevo).join(", ")} (antes ${[...mg].join(", ")})`);
  const cuenta = (p: Partido, f: (e: Evento) => boolean) => p.eventos.filter(f).length;
  for (const [nombre, f] of [
    ["tiros INTER (con los goles)", (e: Evento) => (e.tipo === "disparo" || e.tipo === "gol") && e.equipo === "INTER"],
    ["tiros RIVAL (con los goles)", (e: Evento) => (e.tipo === "disparo" || e.tipo === "gol") && e.equipo === "RIVAL"],
    ["pérdidas", (e: Evento) => e.tipo === "accion_individual" && (e.accion === "pf" || e.accion === "pnf")],
    ["faltas INTER", (e: Evento) => e.tipo === "falta" && e.equipo === "INTER"],
    ["faltas RIVAL", (e: Evento) => e.tipo === "falta" && e.equipo === "RIVAL"],
  ] as const) {
    const a = cuenta(orig, f), b = cuenta(nuevo, f);
    const d = (100 * (b - a)) / a;
    ok(Math.abs(d) >= 12 && Math.abs(d) <= 30, `${nombre}: ${a} → ${b} (${d > 0 ? "+" : ""}${d.toFixed(0)} %)`);
  }
}

console.log("── Que sea un partido coherente ──");
{
  // Los agregados son exactamente los que salen de los eventos.
  const r = reconstruirAgregados(nuevo, esPortero);
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  ok(igual(r.marcador, nuevo.marcador), "marcador = goles de la lista de eventos");
  ok(igual(r.stats, nuevo.stats), "faltas, amarillas y tiempos muertos por parte = eventos");
  ok(igual(r.acciones, nuevo.acciones), "acciones por jugador = eventos (cada gol también es disparo a puerta)");
  ok(igual(r.disparosRival, nuevo.disparosRival), "disparos del rival = eventos (sus goles, a puerta)");
  ok(igual(r.eventos.map((e) => e.marcador), nuevo.eventos.map((e) => e.marcador)), "el marcador de cada evento, bien sellado");
  ok(igual(recomputarMinutos(nuevo), nuevo.tiempos), "minutos de cada jugador = rotaciones");
  const dps = Object.values(nuevo.acciones.porJugador).reduce((s, c) => s + (c.dpp ?? 0), 0);
  const golesI = nuevo.eventos.filter((e) => e.tipo === "gol" && e.equipo === "INTER").length;
  const pIn = nuevo.eventos.filter((e) => e.tipo === "disparo" && e.equipo === "INTER" && e.resultado === "PUERTA").length;
  ok(dps === golesI + pIn, `a puerta nuestros = disparos a puerta (${pIn}) + goles (${golesI}) = ${dps}`);

  // En pista: portero + 4 siempre; cada uno que actúa, en pista.
  const pi = nuevo.config!.pista_inicial;
  let pista = [pi.portero, pi.pista1, pi.pista2, pi.pista3, pi.pista4];
  let malPista = 0, fueraDePista: string[] = [], cuartetoMal = 0;
  for (const e of r.eventos) {
    if (e.tipo === "cambio") {
      pista = pista.map((n) => (n === e.sale ? e.entra : n));
      if (pista.length !== 5 || pista.filter(esPortero).length !== 1 || new Set(pista).size !== 5) malPista++;
      continue;
    }
    const actor = e.tipo === "accion_individual" ? e.jugador
      : e.tipo === "disparo" && e.equipo === "INTER" ? e.jugador
        : e.tipo === "falta" ? e.jugador : e.tipo === "gol" && e.equipo === "INTER" ? e.goleador : "";
    if (actor && !actor.startsWith("#") && !pista.includes(actor)) fueraDePista.push(`${e.tipo} ${actor} ${e.parte} ${Math.floor(e.segundosParte)}`);
    if (e.tipo === "gol" && e.equipo === "INTER") {
      const cinco = [...e.cuarteto, e.goleador].sort();
      if (!igual(cinco, [...pista].sort())) cuartetoMal++;
      if (e.asistente && !pista.includes(e.asistente)) cuartetoMal++;
    }
  }
  ok(malPista === 0, "tras cada cambio: 5 distintos en pista y 1 portero");
  ok(fueraDePista.length === 0, `todo el que actúa está en pista${fueraDePista.length ? ": " + fueraDePista.slice(0, 5).join(" | ") : ""}`);
  ok(cuartetoMal === 0, "en cada gol nuestro, cuarteto + goleador = los 5 en pista (y el asistente, en pista)");
  for (const p of ["1T", "2T"] as ParteId[]) {
    const tot = Object.values(nuevo.tiempos).reduce((s, t) => s + t.porParte[p], 0);
    ok(Math.abs(tot - 5 * nuevo.config!.duracionParte[p]) < 0.01, `${p}: minutos sumados = 5 × la parte (${(tot / 60).toFixed(1)}′)`);
  }
  // Faltas: la 6.ª trae el 10 m; nadie pasa de 6 sin 10 m.
  for (const p of ["1T", "2T"] as ParteId[]) {
    for (const eq of ["INTER", "RIVAL"] as const) {
      const fs = r.eventos.filter((e) => e.tipo === "falta" && e.equipo === eq && e.parte === p);
      const dz = r.eventos.filter((e) => e.tipo === "diezm" && e.equipo !== eq && e.parte === p);
      const extra = Math.max(0, fs.length - 5);
      const bien = dz.length === extra && dz.every((d, k) => d.segundosParte >= fs[5 + k].segundosParte);
      ok(bien, `${eq} ${p}: ${fs.length} faltas, ${dz.length} 10 m del otro equipo${extra ? " (tras la 6.ª)" : ""}`);
    }
  }
  const limites = r.eventos.every((e) => e.segundosParte > 0 && e.segundosParte < nuevo.config!.duracionParte[e.parte]
    && e.segundosPartido === e.segundosParte);
  ok(limites, "todos los eventos dentro de su parte");
  const ts = r.eventos.map((e) => e.timestampReal);
  ok(ts.every((t, k) => k === 0 || t > ts[k - 1]), "la hora real crece con el orden del partido");
  ok(nuevo.config!.convocados.every((n) => ROSTER_DEMO.some((j) => j.nombre === n)), "convocados: todos de la plantilla demo");
  const dorsales = ROSTER_DEMO.map((j) => j.dorsal);
  ok(new Set(dorsales).size === dorsales.length, "dorsales de la plantilla demo sin repetir");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ todo en orden");
process.exit(fallos ? 1 : 0);
