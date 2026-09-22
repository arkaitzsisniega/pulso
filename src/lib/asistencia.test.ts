/**
 * Test de la flecha de la asistencia (22/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/asistencia.test.ts
 *
 * El club importa estos tres campos del JSON del partido y con ellos pinta el
 * mapa de pases de gol. Un campo que se queda colgado (la flecha de un gol que
 * luego se apuntó como del rival, un "__skip__"…) no da error: da una flecha
 * pintada donde no toca.
 */

// asistencia.ts importa la geometría como lo hace el resto de la app, sin la
// extensión (así lo quiere el build). Node no busca extensiones al importar,
// así que aquí se le enseña a probar con ".ts" antes de cargarlo.
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
  golAdmiteFlecha, pideFlechaAsistencia, flechaAsistenciaDe, faltaFlechaAsistencia,
  camposFlechaAsistencia, conFlechaAsistencia, sinFlechaAsistencia,
  asistenciaAlGuardar, recuentoFlechasAsistencia,
} = await import("./asistencia.ts");
const { zonasDeFlecha, largoFlechaM } = await import("./geometriaCampo.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

/** Un gol nuestro con asistente, de juego (ni en propia ni de penalti). */
const gol = (extra: Record<string, unknown> = {}) => ({
  id: "g1", tipo: "gol", equipo: "INTER", goleador: "GOLEADOR", asistente: "ASISTENTE",
  accion: "Contraataque", cuarteto: [], parte: "1T", segundosParte: 600,
  marcador: { inter: 0, rival: 0 }, ...extra,
});
/** De la zona 8 del rival al área (la mitad de arriba): "A8 → A1". */
const FLECHA = { x0: 0.62, y0: 0.3, x1: 0.93, y1: 0.46 };
/** Las claves de la asistencia que quedan en el JSON exportado. */
const enJSON = (g: object) => Object.keys(JSON.parse(JSON.stringify(g)))
  .filter((k) => ["flechaAsistencia", "zonaAsistencia", "zonaAsistenciaDestino"].includes(k));

console.log("── Flecha de la asistencia ──");

// 1 · Cuándo se pide: vídeo, gol nuestro, con asistente, ni en propia ni penalti/10 m
{
  ok(pideFlechaAsistencia(gol(), "video"), "gol nuestro con asistente en vídeo: se pide");
  ok(!pideFlechaAsistencia(gol(), "directo"), "en directo no (no da tiempo)");
  ok(!pideFlechaAsistencia(gol(), undefined), "un partido sin modo es de directo, como en db.ts");
  ok(!pideFlechaAsistencia(gol({ equipo: "RIVAL" }), "video"), "un gol del rival, no");
  ok(!pideFlechaAsistencia(gol({ asistente: undefined }), "video"), "sin asistente, no");
  ok(!pideFlechaAsistencia(gol({ asistente: "" }), "video"), "con el asistente vacío (el «sin asignar» del editor), no");
  ok(!pideFlechaAsistencia(gol({ enPropia: true, goleador: "", asistente: undefined }), "video"), "en propia del rival, no");
  ok(!pideFlechaAsistencia(gol({ accion: "Penalti" }), "video"), "de penalti, no: no hay pase");
  ok(!pideFlechaAsistencia(gol({ accion: "10m" }), "video"), "de 10 m, tampoco");
  ok(pideFlechaAsistencia(gol({ accion: undefined }), "video"), "sin acción apuntada sí (no es penalti)");
  ok(!pideFlechaAsistencia(gol({ tipo: "disparo" }), "video"), "algo que no es un gol, no");
  ok(pideFlechaAsistencia({ equipo: "INTER", asistente: "ASISTENTE", accion: "Córner" }, "video"),
     "lo que lleva elegido el modal del gol (aún sin tipo) también vale");
  ok(golAdmiteFlecha(gol()) && !golAdmiteFlecha(null), "golAdmiteFlecha no mira el modo del partido");
}

// 2 · Los tres campos salen de la flecha, en el sistema del pase de gol
{
  const c = camposFlechaAsistencia(FLECHA);
  igual(c.flechaAsistencia, FLECHA, "la flecha se guarda tal cual (0–1, 3 decimales)");
  igual([c.zonaAsistencia, c.zonaAsistenciaDestino], ["A8", "A1"], "salida A8 y llegada A1");
  igual([c.zonaAsistencia, c.zonaAsistenciaDestino],
        [zonasDeFlecha(FLECHA).origen, zonasDeFlecha(FLECHA).destino],
        "las mismas zonas que el pase de gol saca de esa flecha");
  const larga = camposFlechaAsistencia({ x0: 0.123456, y0: 1.7, x1: -0.2, y1: 0.98765 });
  igual(larga.flechaAsistencia, { x0: 0.123, y0: 1, x1: 0, y1: 0.988 },
        "con 3 decimales y dentro del campo aunque llegue un número de más");
  const desdeCasa = camposFlechaAsistencia({ x0: 0.1, y0: 0.9, x1: 0.55, y1: 0.8 });
  igual([desdeCasa.zonaAsistencia, desdeCasa.zonaAsistenciaDestino], ["D6", "A9"],
        "un pase largo desde nuestra mitad sale de una D");
}

// 3 · Poner y quitar la flecha, sin tocar el gol original
{
  const g = gol();
  const con = conFlechaAsistencia(g, FLECHA);
  igual(enJSON(con), ["flechaAsistencia", "zonaAsistencia", "zonaAsistenciaDestino"], "con flecha van los tres");
  ok(!("flechaAsistencia" in g), "el gol de partida no se toca");
  ok(flechaAsistenciaDe(con) !== null && !faltaFlechaAsistencia(con, "video"), "y ya no falta");
  const sin = sinFlechaAsistencia(con);
  igual(enJSON(sin), [], "al quitarla no queda ninguno en el JSON");
  ok(faltaFlechaAsistencia(sin, "video"), "y vuelve a faltar");
  // editarEvento mezcla los cambios sobre el evento: la clave a undefined es
  // lo que quita el valor que había.
  const mezclado = { ...con, ...sinFlechaAsistencia({}) };
  igual(enJSON(mezclado), [], "mezclado sobre el evento guardado (lo que hace editarEvento), también se van");
}

// 4 · Largo mínimo: 1 m sobre la pista de 40 × 20
{
  const corta = { x0: 0.5, y0: 0.5, x1: 0.52, y1: 0.5 };      // 0,8 m
  const justa = { x0: 0.5, y0: 0.5, x1: 0.525, y1: 0.5 };     // 1 m
  ok(largoFlechaM(corta) < 1 && flechaAsistenciaDe(gol({ flechaAsistencia: corta })) === null,
     "una flecha de 0,8 m no vale");
  ok(flechaAsistenciaDe(gol({ flechaAsistencia: justa })) !== null, "una de 1 m, sí");
  ok(flechaAsistenciaDe(gol({ flechaAsistencia: { x0: 0.5, y0: NaN, x1: 0.9, y1: 0.5 } })) === null,
     "con un número roto, no");
}

// 5 · Al guardar un gol editado
{
  const con = conFlechaAsistencia(gol(), FLECHA);
  igual(enJSON(asistenciaAlGuardar({ ...con, equipo: "RIVAL" })), [], "pasa a ser del rival: fuera los tres");
  igual(enJSON(asistenciaAlGuardar({ ...con, asistente: "" })), [], "se queda sin asistente: fuera");
  igual(enJSON(asistenciaAlGuardar({ ...con, accion: "Penalti" })), [], "pasa a penalti: fuera");
  igual(enJSON(asistenciaAlGuardar({ ...con, accion: "10m" })), [], "pasa a 10 m: fuera");
  igual(enJSON(asistenciaAlGuardar({ ...con, enPropia: true })), [], "pasa a en propia: fuera");
  const retocado = asistenciaAlGuardar({ ...con, zonaAsistencia: "D3", zonaAsistenciaDestino: "A5" });
  igual([retocado.zonaAsistencia, retocado.zonaAsistenciaDestino], ["A8", "A1"],
        "las zonas se vuelven a sacar de la flecha, que es el dato");
  igual(enJSON(asistenciaAlGuardar({ ...con, asistente: "OTRO" })),
        ["flechaAsistencia", "zonaAsistencia", "zonaAsistenciaDestino"],
        "cambiar de asistente no se lleva la flecha");
  igual(enJSON(asistenciaAlGuardar(gol({ flechaAsistencia: { x0: 0.5, y0: 0.5, x1: 0.51, y1: 0.5 },
                                           zonaAsistencia: "A8", zonaAsistenciaDestino: "A8" }))), [],
        "con una flecha que no vale, fuera los tres (sus zonas tampoco valen)");
  igual(enJSON(asistenciaAlGuardar(gol({ zonaAsistencia: "__skip__" }))), [],
        "el \"__skip__\" del botón de saltar de antes no se guarda nunca");
  const viejo = asistenciaAlGuardar(gol({ zonaAsistencia: "A7", zonaAsistenciaDestino: "A2" }));
  igual([viejo.zonaAsistencia, enJSON(viejo)], ["A7", ["zonaAsistencia"]],
        "la zona tocada a mano antes de las flechas se respeta (sin destino, que sin flecha no existe)");
  igual(enJSON(asistenciaAlGuardar(gol())), [], "un gol sin nada sigue sin nada");
  igual(enJSON(asistenciaAlGuardar({ id: "r", tipo: "gol", equipo: "RIVAL", goleador: "", cuarteto: [] })), [],
        "un gol del rival nunca lleva estos campos");
}

// 6 · El recuento del editor: lo que queda por dibujar
{
  const evs = [
    conFlechaAsistencia(gol({ id: "a" }), FLECHA),
    gol({ id: "b" }),
    gol({ id: "c", zonaAsistencia: "A7" }),               // de antes: zona sin flecha
    gol({ id: "d", accion: "Penalti" }),
    gol({ id: "e", equipo: "RIVAL" }),
    gol({ id: "f", asistente: undefined }),
    { id: "x", tipo: "accion_individual", jugador: "ASISTENTE", accion: "paseGol", flecha: FLECHA },
  ];
  igual(recuentoFlechasAsistencia(evs, "video"), { total: 3, faltan: 2 },
        "en vídeo: 3 asistencias que la llevan y a 2 les falta");
  igual(recuentoFlechasAsistencia(evs, "directo"), { total: 0, faltan: 0 }, "en directo no se pide ninguna");
  igual(recuentoFlechasAsistencia([], "video"), { total: 0, faltan: 0 }, "sin goles, nada");
}

console.log(fallos ? `\n❌ Asistencia: ${fallos} fallo(s)` : "\n✅ Asistencia OK (0 fallos)");
process.exit(fallos ? 1 : 0);
