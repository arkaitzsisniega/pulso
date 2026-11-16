/**
 * Test del semáforo de minutos (rediseño, tanda 1 · 16/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/utils.test.ts
 *
 * El aspecto nuevo del crono pinta el semáforo de otra manera (en el número y
 * en una franja), pero el CÁLCULO tiene que ser el de siempre. Aquí se compara,
 * segundo a segundo, lo que da ahora con una copia literal del código que había
 * antes del cambio.
 */
import {
  colorTiempoPista, colorTiempoBanquillo, nivelTiempoPista, nivelTiempoBanquillo,
} from "./utils.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}

// ── Copia LITERAL de la versión anterior (antes del 16/11/2026) ─────────────
function viejoNivel(s: number): number {
  if (s < 60) return 0;
  if (s < 120) return 1;
  if (s < 180) return 2;
  return 3;
}
const VIEJO_COLORES = ["bg-blue-400/40", "bg-green-400/40", "bg-yellow-300/40", "bg-red-400/40"];
function viejoBanquillo(segB: number, segU: number | null | undefined = null): string {
  if (!segU || segU <= 0) return "bg-zinc-700/60";
  const n = viejoNivel(segU) - Math.floor(segB / 60);
  if (n < 0) return "bg-zinc-700/60";
  return VIEJO_COLORES[n];
}
const PISTA_CLASE = ["bg-blue-600", "bg-green-600", "bg-yellow-500", "bg-red-600"];

console.log("\nPista: el nivel nuevo cae en el mismo color que la clase de siempre");
let igualesPista = true;
for (let s = 0; s <= 600; s += 0.5) {
  if (PISTA_CLASE[nivelTiempoPista(s)] !== colorTiempoPista(s)) { igualesPista = false; break; }
}
ok(igualesPista, "0 a 10 min, cada medio segundo");
ok(nivelTiempoPista(59.9) === 0 && nivelTiempoPista(60) === 1, "el corte del minuto 1");
ok(nivelTiempoPista(179.9) === 2 && nivelTiempoPista(180) === 3, "el corte del minuto 3");

console.log("\nBanquillo: mismo color que con el código anterior");
let igualesBanq = true;
let igualesNivel = true;
for (const segU of [null, undefined, 0, -5, 10, 59, 60, 119, 120, 179, 180, 400]) {
  for (let segB = 0; segB <= 400; segB += 1) {
    if (colorTiempoBanquillo(segB, segU) !== viejoBanquillo(segB, segU)) igualesBanq = false;
    const n = nivelTiempoBanquillo(segB, segU);
    const esperado = viejoBanquillo(segB, segU);
    const deNivel = n < 0 ? "bg-zinc-700/60" : VIEJO_COLORES[n];
    if (deNivel !== esperado) igualesNivel = false;
  }
}
ok(igualesBanq, "colorTiempoBanquillo da lo mismo que antes");
ok(igualesNivel, "nivelTiempoBanquillo corresponde al mismo color");
ok(nivelTiempoBanquillo(30, 200) === 3, "sale en rojo y en el primer minuto sigue en rojo");
ok(nivelTiempoBanquillo(65, 200) === 2, "un minuto sentado: baja a amarillo");
ok(nivelTiempoBanquillo(500, 200) === -1, "descansado: gris");
ok(nivelTiempoBanquillo(0, null) === -1, "no ha jugado: gris");

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ todo bien");
if (fallos) process.exit(1);
