/**
 * Test del filtro de Totales: qué competiciones y partidos entran (25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/filtroTotales.test.ts
 *
 * Datos INVENTADOS: solo lo que mira el filtro (id, config.competicion) y,
 * para el caso directo + vídeo, lo que mira lib/duplicadosVideo.ts.
 */
import { readFileSync } from "node:fs";
import type { Partido } from "./db.ts";
import { quitarDuplicadosVideo } from "./duplicadosVideo.ts";
import {
  FILTRO_TODO, alternarCompeticion, alternarPartido, competiciones, describirFiltro, esTodo,
  incluido, leerFiltro, limpiarFiltro, soloCompeticion, type FiltroTotales,
} from "./filtroTotales.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

function partido(id: string, comp: string, o: { modo?: "directo" | "video"; fecha?: string; rival?: string; act?: number } = {}): Partido {
  return {
    id, estado: "finalizado", modo: o.modo, actualizado: o.act ?? 0,
    config: { competicion: comp, partido_id: "", fecha: o.fecha ?? `2026-10-${id.slice(-1).padStart(2, "0")}`, rival: o.rival ?? `Rival ${id}` } as Partido["config"],
  } as Partido;
}
const L1 = partido("l1", "LIGA"), L2 = partido("l2", "LIGA"), L3 = partido("l3", "LIGA");
const C1 = partido("c1", "COPA_REY"), A1 = partido("a1", "AMISTOSO"), A2 = partido("a2", "AMISTOSO");
const todos = [L1, L2, L3, C1, A1, A2];
const dentro = (f: FiltroTotales) => todos.filter((p) => incluido(p, f)).map((p) => p.id).join(",");

console.log("Sin filtro entra todo:");
ok(dentro(FILTRO_TODO) === "l1,l2,l3,c1,a1,a2", "los 6");
ok(esTodo(todos, FILTRO_TODO) && describirFiltro(todos, FILTRO_TODO) === null, "y no hay etiqueta de filtro");

console.log("Casillas de competición:");
{
  const cs = competiciones(todos, FILTRO_TODO);
  ok(cs.map((c) => `${c.codigo}:${c.n}`).join(" ") === "LIGA:3 COPA_REY:1 AMISTOSO:2", "una por competición, con su número y en orden (liga primero)");
  const f = alternarCompeticion(todos, FILTRO_TODO, "AMISTOSO");
  ok(dentro(f) === "l1,l2,l3,c1", "desmarcar Amistoso quita sus 2 partidos");
  ok(competiciones(todos, f).find((c) => c.codigo === "AMISTOSO")!.estado === "ninguno", "y su casilla queda vacía");
  const g = alternarCompeticion(todos, f, "AMISTOSO");
  ok(dentro(g) === dentro(FILTRO_TODO), "volver a marcarla los mete otra vez");
  const d = describirFiltro(todos, f)!;
  ok(d.comps.join("+") === "LIGA+COPA_REY" && d.n === 4 && !d.manual, "etiqueta: Liga + Copa del Rey · 4, sin «a mano»");
}

console.log("Solo liga:");
{
  const f = soloCompeticion(todos, "LIGA");
  ok(dentro(f) === "l1,l2,l3", "solo los 3 de liga");
  const d = describirFiltro(todos, f)!;
  ok(d.comps.join() === "LIGA" && d.n === 3, "etiqueta: Liga · 3");
  const L4 = partido("l4", "LIGA"), A3 = partido("a3", "AMISTOSO");
  ok(incluido(L4, f) && !incluido(A3, f), "un partido NUEVO sigue a su competición (la jornada entra, el amistoso no)");
}

console.log("Exclusión manual de un partido:");
{
  let f = alternarPartido(L2, FILTRO_TODO);
  ok(dentro(f) === "l1,l3,c1,a1,a2", "quitar uno a mano lo saca solo a él");
  const liga = competiciones(todos, f).find((c) => c.codigo === "LIGA")!;
  ok(liga.estado === "algunos" && liga.dentro === 2, "la casilla de Liga queda a medias (2 de 3)");
  ok(describirFiltro(todos, f)!.manual, "y la etiqueta dice «selección a mano»");
  f = alternarPartido(L2, f);
  ok(Object.keys(f.sueltos).length === 0 && dentro(f) === dentro(FILTRO_TODO), "volver a marcarlo deja el filtro limpio");
  // Competición a medias: su casilla la completa y borra las excepciones.
  f = alternarCompeticion(todos, alternarPartido(L2, FILTRO_TODO), "LIGA");
  ok(dentro(f) === dentro(FILTRO_TODO) && !Object.keys(f.sueltos).length, "liga a medias + casilla de Liga = todos los de liga dentro");
  // Meter a mano un partido de una competición desmarcada.
  f = alternarPartido(A1, soloCompeticion(todos, "LIGA"));
  ok(dentro(f) === "l1,l2,l3,a1", "con «Solo liga», se puede meter un amistoso suelto");
  f = alternarCompeticion(todos, f, "AMISTOSO");
  ok(dentro(f) === "l1,l2,l3,a1,a2", "amistoso a medias + su casilla = los dos dentro");
  f = alternarCompeticion(todos, f, "AMISTOSO");
  ok(dentro(f) === "l1,l2,l3", "y otra vez = ninguno (las excepciones se van)");
}

console.log("Directo + vídeo no cuenta doble (y el filtro va después):");
{
  const D = partido("d9", "LIGA", { modo: "directo", fecha: "2026-11-01", rival: "Rival X", act: 1 });
  const V = partido("v9", "LIGA", { modo: "video", fecha: "2026-11-01", rival: "rival x", act: 2 });
  const dup = quitarDuplicadosVideo([...todos, D, V]);
  ok(dup.cuentan.some((p) => p.id === "v9") && !dup.cuentan.some((p) => p.id === "d9"), "entre los elegibles está solo el vídeo");
  const cs = competiciones(dup.cuentan, FILTRO_TODO);
  ok(cs.find((c) => c.codigo === "LIGA")!.n === 4, "Liga cuenta 4 (no 5)");
  const f = soloCompeticion(dup.cuentan, "LIGA");
  ok(dup.cuentan.filter((p) => incluido(p, f)).length === 4, "con «Solo liga» entran 4");
}

console.log("Sin competición y competiciones desconocidas:");
{
  const S = partido("s1", ""), X = partido("x1", "TORNEO_VERANO");
  const cs = competiciones([L1, S, X, A1], FILTRO_TODO).map((c) => c.codigo);
  ok(cs.join() === "LIGA,AMISTOSO,TORNEO_VERANO,", "las conocidas en su orden, luego las otras, «sin competición» al final");
}

console.log("Guardado en el aparato:");
{
  ok(dentro(leerFiltro("roto{")) === dentro(FILTRO_TODO), "un texto roto = todo dentro");
  ok(dentro(leerFiltro(null)) === dentro(FILTRO_TODO), "nada guardado = todo dentro");
  const f = leerFiltro(JSON.stringify({ compsFuera: ["AMISTOSO", 3], sueltos: { l1: false, raro: "sí" } }));
  ok(f.compsFuera.join() === "AMISTOSO" && Object.keys(f.sueltos).join() === "l1", "solo se queda lo que tiene sentido");
  const g = limpiarFiltro([L2], { compsFuera: [], sueltos: { l1: false, l2: false } });
  ok(Object.keys(g.sueltos).join() === "l2", "las excepciones de partidos borrados se van");
}

console.log("La pantalla usa el filtro y lo recuerda con try/catch:");
{
  const pag = readFileSync(new URL("../app/totales/page.tsx", import.meta.url), "utf8");
  ok(/calcularTotales\(todos, \(p\) => incluido\(p, filtroVivo\)\)/.test(pag), "las cifras salen solo de los marcados");
  ok(/try \{ setFiltroEstado\(leerFiltro\(localStorage\.getItem/.test(pag) && /try \{ localStorage\.setItem/.test(pag), "localStorage siempre dentro de try");
  ok((pag.match(/filtroUI\((true|false)\)/g) ?? []).length === 2, "el filtro sale en los dos aspectos");
  const tot = readFileSync(new URL("./totales.ts", import.meta.url), "utf8");
  ok(/partidosQueCuentan\(todos\)[\s\S]{0,200}dup\.cuentan\.filter\(incluir\)/.test(tot), "el filtro se aplica DESPUÉS de quitar duplicados");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
