/**
 * Test del color del rival (rediseño, tanda 1 · 16/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/tema.test.ts
 *
 * El rival va en coral salvo que el color del club se le parezca: entonces
 * pasa solo a otro. Aquí se comprueba con los colores reales de los clubes y
 * con clubes inventados rojos, naranjas y coral.
 */
import { elegirRival, seDistinguen, difTono, deltaE, RIVAL_CANDIDATOS, variablesEquipos, type ParColor } from "./tema.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const CORAL = RIVAL_CANDIDATOS[0];

const VERDE_INTER: ParColor = { oscuro: "#34d27b", sol: "#0f7a43" };
const AZUL_PULSO: ParColor = { oscuro: "#4ea8ff", sol: "#0b5fd1" };

console.log("\nLos clubes de hoy: el rival en coral");
ok(elegirRival(VERDE_INTER) === CORAL, "Inter (verde) → coral");
ok(elegirRival(AZUL_PULSO) === CORAL, "PULSO (azul) → coral");

console.log("\nUn club que se parece al coral: el rival cambia solo");
const parecidos: Array<[string, ParColor]> = [
  ["coral", { oscuro: "#ff6f61", sol: "#c4402f" }],
  ["rojo", { oscuro: "#e63946", sol: "#b3202c" }],
  ["naranja", { oscuro: "#ff8c1a", sol: "#c25e00" }],
  ["salmón", { oscuro: "#ff9b85", sol: "#d2553f" }],
];
for (const [nombre, club] of parecidos) {
  const r = elegirRival(club);
  ok(r !== CORAL, `club ${nombre} → el rival NO es coral (${r.oscuro})`);
  ok(seDistinguen(club.oscuro, r.oscuro) && seDistinguen(club.sol, r.sol),
     `club ${nombre} → el elegido se distingue en los dos modos`);
}

console.log("\nUn club cian: ni coral ni cian a la vez");
const cian: ParColor = { oscuro: "#22d3ee", sol: "#0e7490" };
ok(elegirRival(cian) === CORAL, "club cian → coral (se distinguen)");

console.log("\nLas medidas");
ok(difTono("#ff0000", "#00ffff") > 170, "rojo y cian: tonos opuestos");
ok(difTono("#808080", "#ff7a6b") === 180, "un gris no tiene tono");
ok(deltaE("#ff7a6b", "#ff7a6b") === 0, "un color consigo mismo: ΔE 0");
ok(deltaE("#ff7a6b", "#ff6f61") < 35, "coral y casi-coral: ΔE pequeño");

console.log("\nVariables de inicio y partido nuevo (tanda 3)");
for (const sol of [false, true]) {
  const v = variablesEquipos(VERDE_INTER, sol);
  ok(v["--nos"] === (sol ? VERDE_INTER.sol : VERDE_INTER.oscuro), `--nos es el del club (${sol ? "Sol" : "Pabellón"})`);
  ok(v["--rival"] === (sol ? CORAL.sol : CORAL.oscuro), `--rival es el mismo que en la pantalla del partido (${sol ? "Sol" : "Pabellón"})`);
  ok(seDistinguen(v["--nos"], v["--rival"]), `nuestro color y el del rival se distinguen (${sol ? "Sol" : "Pabellón"})`);
}
const rojo = variablesEquipos({ oscuro: "#e63946", sol: "#b3202c" }, false);
ok(seDistinguen(rojo["--nos"], rojo["--rival"]), "club rojo: el rival de inicio tampoco se le parece");

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ todo bien");
if (fallos) process.exit(1);
