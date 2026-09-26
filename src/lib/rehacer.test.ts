/**
 * Test de «🎥 Rehacer con vídeo»: casa o fuera (26/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/rehacer.test.ts
 *
 * El compañero que registra los partidos se lo dijo a Arkaitz: al rehacer un
 * partido con vídeo no se podía poner que jugamos de VISITANTE. La cabecera se
 * copiaba tal cual del partido del directo y casa/fuera solo se elige al crear
 * un partido nuevo. Si el original salió mal, el rehecho heredaba el fallo, y
 * de ahí salen el marcador del informe, Totales y el LOCAL/VISITANTE del club.
 */
import { readFileSync } from "node:fs";
import type { ConfigPartido } from "./db.ts";
import { configParaRehacer, jugabamosEnCasa } from "./rehacer.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const original = (): ConfigPartido => ({
  rival: "JAEN", fecha: "2026-09-26", hora: "12:00", lugar: "Jaén",
  competicion: "LIGA", local: true, partido_id: "J3.JAEN",
  convocados: ["HERRERO", "RAYA", "PIRATA", "CECILIO", "PANI"],
  pista_inicial: { portero: "HERRERO", pista1: "RAYA", pista2: "PIRATA", pista3: "CECILIO", pista4: "PANI" },
  duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
  permiteTanda: false, direccionInter1T: "der",
});

console.log("── Rehacer con vídeo: casa o fuera ──");

// 1 · Lo que sale marcado al abrir la ventana
{
  ok(jugabamosEnCasa({ local: true }), "si el original dice en casa, sale EN CASA");
  ok(!jugabamosEnCasa({ local: false }), "si dice fuera, sale FUERA");
  ok(!jugabamosEnCasa({} as never) && !jugabamosEnCasa(null), "sin el dato, FUERA (como la casilla de Nuevo partido)");
}

// 2 · La cabecera del partido rehecho
{
  const orig = original();
  const copia = JSON.stringify(orig);
  const fuera = configParaRehacer(orig, { local: false });
  ok(fuera.local === false, "el original decía EN CASA y se rehace FUERA: el nuevo va fuera");
  ok(configParaRehacer({ ...orig, local: false }, { local: true }).local === true, "y al revés");
  ok(configParaRehacer(orig).local === true && configParaRehacer(orig, {}).local === true,
     "sin tocar nada, se queda lo del original");
  igual({ ...fuera, local: true }, orig, "lo demás de la cabecera, idéntico (rival, fecha, alineación, duraciones…)");
  igual(JSON.stringify(orig), copia, "el partido original NO se toca");
  fuera.convocados.push("OTRO");
  fuera.pista_inicial.pista1 = "OTRO";
  fuera.duracionParte["1T"] = 1;
  igual(JSON.stringify(orig), copia, "ni aunque luego se cambie la alineación del nuevo");
}

// 3 · Lo usan de verdad el store y la pantalla de inicio (se lee el código:
//     store.ts y page.tsx no se pueden importar desde node).
{
  const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const store = leer("./store.ts");
  ok(/rehacerPartido\(id: string, cambios: CambiosRehacer/.test(store)
     && store.includes("configParaRehacer(orig.config, cambios)"),
     "rehacerPartido construye el nuevo con configParaRehacer y los cambios");
  const inicio = leer("../app/page.tsx");
  ok(/rehacerPartido\([^)]*\{ local: enCasa \}\)/.test(inicio), "la pantalla de inicio le pasa lo elegido (casa/fuera)");
  ok(!inicio.includes("home_rehacer_confirm") && !/\bconfirm\(t\(/.test(inicio.slice(0, inicio.indexOf("const borrar"))),
     "y ya no es un confirm() de Aceptar/Cancelar");
  ok(inicio.includes('data-rehacer-local={casa ? "casa" : "fuera"}'), "con los dos botones, EN CASA y FUERA");
  ok(inicio.includes("setEnCasa(jugabamosEnCasa(p.config))"), "con lo del original ya marcado");
}

console.log(fallos ? `\n❌ Rehacer: ${fallos} fallo(s)` : "\n✅ Rehacer OK (0 fallos)");
process.exit(fallos ? 1 : 0);
