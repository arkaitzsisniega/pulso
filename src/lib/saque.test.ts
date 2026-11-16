/**
 * Test de la pregunta «¿quién saca?» al iniciar (16/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/saque.test.ts
 *
 * El J8 contra Xota (14/11/2026) se jugó en directo sin que saliera la
 * pregunta: antes de arrancar se corrigió el quinteto con dos cambios a 0:00 y
 * la condición antigua («ningún evento») ya no se cumplía.
 */
import { hayQuePreguntarSaque } from "./saque.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}

const cambio0 = { parte: "1T" as const, segundosPartido: 0 };
const jugado = { parte: "1T" as const, segundosPartido: 46.8 };

ok(hayQuePreguntarSaque("1T", undefined, 0, []), "partido nuevo sin eventos → pregunta");
ok(hayQuePreguntarSaque("1T", undefined, 0, [cambio0, cambio0]),
   "dos cambios a 0:00 antes del saque (J8 Xota) → pregunta");
ok(hayQuePreguntarSaque("1T", undefined, undefined, [cambio0]),
   "segundosParte sin definir cuenta como 0");
ok(!hayQuePreguntarSaque("1T", "INTER", 0, []), "saque ya anotado → no pregunta");
ok(!hayQuePreguntarSaque("1T", "RIVAL", 0, [cambio0]), "saque ya anotado (con cambios) → no pregunta");
ok(!hayQuePreguntarSaque("1T", undefined, 30, [cambio0]), "1ª parte ya corrida → no pregunta");
ok(!hayQuePreguntarSaque("1T", undefined, 0, [cambio0, jugado]),
   "hay eventos con tiempo jugado (partido viejo sin saque) → no pregunta");
ok(!hayQuePreguntarSaque("2T", undefined, 0, []), "2ª parte → no pregunta");
ok(!hayQuePreguntarSaque("1T", undefined, 0, [{ parte: "2T", segundosPartido: 0 }]),
   "evento de otra parte → no pregunta");

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log("\nTodo en verde");
