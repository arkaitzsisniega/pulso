/**
 * Test del guardado con espera (bug del 20/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/guardadoDiferido.test.ts
 *
 * «Finalizar partido y ver resumen» no finalizaba: el «finalizado» se quedaba
 * en un guardado pendiente de 300 ms y, al saltar a /resumen, la pantalla del
 * partido se desmontaba y el guardado se CANCELABA. En el inicio y al recargar
 * el partido seguía «en curso». Aquí se reproduce el recorrido entero con una
 * base de mentira: finalizar → salir de la pantalla → volver al inicio →
 * recargar → sigue finalizado.
 */
import { readFileSync } from "node:fs";
import { GuardadoDiferido, type Temporizador } from "./guardadoDiferido.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

/** Temporizador manual: el tiempo solo pasa cuando se llama a avanzar(). */
function relojFalso() {
  let ahora = 0;
  let sig = 1;
  const tareas = new Map<number, { cuando: number; fn: () => void }>();
  const tempo: Temporizador = {
    poner: (fn, ms) => { const id = sig++; tareas.set(id, { cuando: ahora + ms, fn }); return id; },
    quitar: (h) => { tareas.delete(h as number); },
  };
  const avanzar = (ms: number) => {
    ahora += ms;
    for (const [id, t] of [...tareas]) if (t.cuando <= ahora) { tareas.delete(id); t.fn(); }
  };
  return { tempo, avanzar };
}

type P = { id: string; estado: string; goles: number };

console.log("── Guardado con espera: nunca se tira lo pendiente ──");

// 1 · El recorrido del bug: finalizar y salir en el mismo toque.
{
  const base = new Map<string, P>();
  base.set("p1", { id: "p1", estado: "en_curso", goles: 3 });
  const { tempo, avanzar } = relojFalso();
  const pantallaPartido = new GuardadoDiferido<P>((p) => base.set(p.id, p), 300, tempo);

  pantallaPartido.programar({ id: "p1", estado: "finalizado", goles: 3 }); // «Finalizar…»
  ok(base.get("p1")!.estado === "en_curso", "antes de salir todavía no está escrito (espera de 300 ms)");
  pantallaPartido.vaciar();                       // se desmonta: salto a /resumen
  ok(base.get("p1")!.estado === "finalizado", "al salir de la pantalla se escribe YA el «finalizado»");
  avanzar(1000);                                  // pasa el tiempo: no reescribe nada viejo
  // Inicio y recarga: lo que haya en la base es lo que se ve.
  const recargado = base.get("p1")!;
  ok(recargado.estado === "finalizado", "volver al inicio y recargar: sigue FINALIZADO");
}

// 2 · Sin salir: a los 300 ms se escribe solo, una vez, con lo ÚLTIMO.
{
  const escritos: P[] = [];
  const { tempo, avanzar } = relojFalso();
  const g = new GuardadoDiferido<P>((p) => escritos.push(p), 300, tempo);
  g.programar({ id: "p1", estado: "en_curso", goles: 1 });
  avanzar(100);
  g.programar({ id: "p1", estado: "en_curso", goles: 2 });
  avanzar(299);
  ok(escritos.length === 0, "cada cambio reinicia la espera");
  avanzar(1);
  ok(escritos.length === 1 && escritos[0].goles === 2, "se escribe una vez, con el último cambio");
  g.vaciar();
  ok(escritos.length === 1, "vaciar sin nada pendiente no escribe otra vez");
  ok(!g.pendienteDeEscribir, "no queda nada pendiente");
}

// 3 · Un gol y «Inicio» en menos de 300 ms: el gol no se pierde.
{
  const escritos: P[] = [];
  const { tempo } = relojFalso();
  const g = new GuardadoDiferido<P>((p) => escritos.push(p), 300, tempo);
  g.programar({ id: "p1", estado: "en_curso", goles: 4 });
  g.vaciar();
  ok(escritos.at(-1)?.goles === 4, "lo apuntado justo antes de cambiar de pantalla se guarda");
}

// 4 · descartar: solo para cuando otro partido entero ya se ha escrito.
{
  const escritos: P[] = [];
  const { tempo, avanzar } = relojFalso();
  const g = new GuardadoDiferido<P>((p) => escritos.push(p), 300, tempo);
  g.programar({ id: "vacio", estado: "configurando", goles: 0 });
  g.descartar();
  avanzar(1000); g.vaciar();
  ok(escritos.length === 0, "descartar no escribe nada, ni después");
}

// 5 · El store lo usa así: al desmontarse VACÍA, no cancela.
{
  const src = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  ok(src.includes("new GuardadoDiferido<Partido>"), "store.ts guarda con GuardadoDiferido");
  ok(/return \(\) => \{[\s\S]{0,400}g\.vaciar\(\);\s+\/\/ ← salir de la pantalla/.test(src),
     "al desmontarse la pantalla se vacía lo pendiente");
  ok(!/clearTimeout\(saveTimer/.test(src), "ya no queda el clearTimeout que tiraba el guardado");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
