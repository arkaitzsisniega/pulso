/**
 * Test del orden de los partidos (20/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/ordenPartidos.test.ts
 *
 * La lista va por la FECHA DEL PARTIDO, el último jugado primero; no por el
 * último abierto. Datos inventados.
 */
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
const { compararPartidos, creadoClave, fechaClave, horaClave, ordenarPartidos, ordenarPartidosClub } =
  await import("./ordenPartidos.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

type Extra = { hora?: string; modo?: "directo" | "video"; act?: number; rival?: string };
const p = (id: string, fecha: string | undefined, extra: Extra = {}) => ({
  id, modo: extra.modo, actualizado: extra.act ?? 0,
  config: fecha === undefined && extra.hora === undefined ? { } : { fecha, hora: extra.hora, rival: extra.rival },
});
/** id como los del aparato: `p_<ms en base 36>_xxxxxx`. */
const idDe = (ms: number) => `p_${ms.toString(36)}_abc123`;

console.log("── Orden de los partidos: el último jugado primero ──");

// 1 · Por fecha, aunque el viejo se abriera ayer.
{
  const lista = [
    p("septiembre", "2026-09-13", { act: 9_000 }),     // abierto lo último
    p("noviembre", "2026-11-14", { act: 1_000 }),
    p("octubre", "2026-10-31", { act: 5_000 }),
  ];
  igual(ordenarPartidos(lista).map((x) => x.id), ["noviembre", "octubre", "septiembre"],
        "por fecha del partido, no por el último abierto");
  igual(lista.map((x) => x.id), ["septiembre", "noviembre", "octubre"], "no toca la lista original");
}

// 2 · Mismo día: la hora más tardía primero; sin hora, detrás.
{
  const lista = [
    p("manana", "2026-11-14", { hora: "11:00" }),
    p("sinhora", "2026-11-14"),
    p("tarde", "2026-11-14", { hora: "19:30" }),
  ];
  igual(ordenarPartidos(lista).map((x) => x.id), ["tarde", "manana", "sinhora"], "mismo día: por hora");
}

// 3 · Mismo día y hora: el de vídeo delante del directo.
{
  const lista = [
    p("directo", "2026-11-14", { hora: "18:00", modo: "directo", act: 9 }),
    p("video", "2026-11-14", { hora: "18:00", modo: "video", act: 1 }),
    p("antiguo_sin_modo", "2026-11-14", { hora: "18:00" }),
  ];
  const r = ordenarPartidos(lista).map((x) => x.id);
  ok(r[0] === "video", `el de vídeo primero (${r.join(", ")})`);
}

// 4 · Sin fecha (o ilegible), al final.
{
  const lista = [
    p("sin", undefined),
    p("rara", "pronto"),
    p("vieja", "2025-01-01"),
    { id: "sinconfig", modo: undefined, actualizado: 0, config: null },
  ];
  const r = ordenarPartidos(lista as never[]).map((x: { id: string }) => x.id);
  ok(r[0] === "vieja", `con fecha delante (${r.join(", ")})`);
}

// 5 · Formatos de fecha y hora.
{
  igual(fechaClave("18/11/2026"), "2026-11-18", "dd/mm/aaaa se entiende");
  igual(fechaClave("2026-9-6"), "2026-09-06", "sin ceros se entiende");
  igual(fechaClave(""), "", "vacía → sin fecha");
  igual(horaClave("9:05"), "09:05", "hora sin cero");
  ok(compararPartidos(p("a", "18/11/2026"), p("b", "2026-11-14")) < 0, "mezclando formatos sigue el orden");
}

// 6 · Mismo partido (fecha + rival) aunque el vídeo no tenga hora: vídeo
//     encima y las dos versiones juntas, sin colarse otro partido en medio.
{
  const lista = [
    p("directo", "2026-11-14", { hora: "19:00", modo: "directo", rival: "Valdepeñas", act: 9 }),
    p("otro", "2026-11-14", { hora: "18:00", modo: "directo", rival: "Jaén" }),
    p("video", "2026-11-14", { modo: "video", rival: "VALDEPENAS ", act: 1 }),
  ];
  igual(ordenarPartidos(lista).map((x) => x.id), ["video", "directo", "otro"],
        "vídeo encima del directo del mismo partido, aunque no tenga hora");
}

// 7 · Empate total: el creado más tarde arriba (aunque se tocara antes).
{
  const lista = [
    { ...p("x", "2026-11-14", { rival: "A", act: 900 }), id: idDe(1_000) },
    { ...p("y", "2026-11-14", { rival: "A", act: 100 }), id: idDe(2_000) },
  ];
  igual(ordenarPartidos(lista).map((x) => x.id), [idDe(2_000), idDe(1_000)], "empate: el creado más tarde arriba");
  igual(creadoClave(idDe(123_456)), 123_456, "la creación sale del id");
  igual(creadoClave("raro"), 0, "id sin marca → 0");
}

// 8 · Sin fecha SIEMPRE al final, también con vídeo.
{
  const lista = [
    p("sin_video", "", { modo: "video" }),
    p("nov", "2026-11-01"),
    p("ene", "2025-01-01", { modo: "directo" }),
  ];
  igual(ordenarPartidos(lista).map((x) => x.id), ["nov", "ene", "sin_video"], "los sin fecha al final");
}

// 9 · «Partidos del club» (servidor): misma regla.
{
  const f = (id: string, fecha: string, modo: string, rival = "A") => ({ id, fecha, rival, modo, actualizado: 0 });
  const lista = [f("viejo", "2026-09-01", "video"), f("dir", "2026-11-14", "directo"),
                 f("vid", "2026-11-14", "video"), f("sin", "", "directo")];
  igual(ordenarPartidosClub(lista).map((x) => x.id), ["vid", "dir", "viejo", "sin"], "la lista del servidor, igual");
}

// 10 · Se usa en la lista, en Totales y en «Partidos del club».
{
  const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  ok(/listarPartidos\(\)[\s\S]{0,120}ordenarPartidos\(/.test(store), "listarPartidos ordena por fecha");
  const tot = readFileSync(new URL("./totales.ts", import.meta.url), "utf8");
  ok(tot.includes("ordenarPartidos("), "Totales usa el mismo orden");
  const club = readFileSync(new URL("../components/ServidorClub.tsx", import.meta.url), "utf8");
  ok(club.includes("ordenarPartidosClub("), "«Partidos del club» usa el mismo orden");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
