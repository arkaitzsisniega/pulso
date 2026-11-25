/**
 * Test de «vuelve en el X:XX» en la barra de expulsión (25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/vueltaExpulsion.test.ts
 */
import { vueltaExpulsion, SEGUNDOS_EXPULSION } from "./vueltaExpulsion.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const DUR = { "1T": 1200, "2T": 1200, PR1: 300, PR2: 300 };
const SIN_PRORROGA = { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 };

ok(SEGUNDOS_EXPULSION === 120, "una expulsión son 2 minutos");

// El ejemplo del entrenador: expulsan a falta de 7:08 → vuelve en el 5:08.
{
  const v = vueltaExpulsion({ tInicioAbs: 1200 - 428, parteActual: "1T", offsetParteActual: 0, duraciones: DUR });
  ok(!!v && v.parte === "1T" && v.mismaParte && mmss(v.reloj) === "5:08", `a falta de 7:08 → vuelve en el 5:08 (da ${v && mmss(v.reloj)})`);
}
// Con décimas (el reloj real no cae en segundos enteros): se redondea como el marcador.
{
  const v = vueltaExpulsion({ tInicioAbs: 771.4, parteActual: "1T", offsetParteActual: 0, duraciones: DUR });
  // quedaban 428,6 s (el marcador enseñaba 7:09) → vuelve a falta de 308,6 → el marcador enseña 5:09
  ok(!!v && mmss(v.reloj) === "5:09", `con décimas, como el marcador (da ${v && mmss(v.reloj)})`);
}
// En la 2ª parte: el reloj absoluto suma la 1ª.
{
  const v = vueltaExpulsion({ tInicioAbs: 1200 + 600, parteActual: "2T", offsetParteActual: 1200, duraciones: DUR });
  ok(!!v && v.parte === "2T" && mmss(v.reloj) === "8:00", "en la 2ª parte, a falta de 10:00 → 8:00");
}
// Justo a 2:00 del final: vuelve en el 0:00 de la misma parte.
{
  const v = vueltaExpulsion({ tInicioAbs: 1080, parteActual: "1T", offsetParteActual: 0, duraciones: DUR });
  ok(!!v && v.parte === "1T" && v.reloj === 0, "a falta de 2:00 → vuelve en el 0:00");
}
// A falta de 0:30 en la 1ª: le queda 1:30 en la 2ª → vuelve en el 18:30 del 2T.
{
  const v = vueltaExpulsion({ tInicioAbs: 1170, parteActual: "1T", offsetParteActual: 0, duraciones: DUR });
  ok(!!v && v.parte === "2T" && !v.mismaParte && mmss(v.reloj) === "18:30", `pasa de parte → 18:30 del 2T (da ${v && v.parte} ${v && mmss(v.reloj)})`);
}
// Ya en la 2ª parte, la roja fue en la 1ª: sigue diciendo lo mismo.
{
  const v = vueltaExpulsion({ tInicioAbs: 1170, parteActual: "2T", offsetParteActual: 1200, duraciones: DUR });
  ok(!!v && v.parte === "2T" && v.mismaParte && mmss(v.reloj) === "18:30", "ya en la 2ª, el mismo 18:30");
}
// Al final de la 2ª no se sabe si habrá prórroga: no se inventa.
ok(vueltaExpulsion({ tInicioAbs: 1200 + 1170, parteActual: "2T", offsetParteActual: 1200, duraciones: DUR }) === null,
   "pasa del final de la 2ª → no se dice (puede no haber prórroga)");
ok(vueltaExpulsion({ tInicioAbs: 1200 + 1170, parteActual: "2T", offsetParteActual: 1200, duraciones: SIN_PRORROGA }) === null,
   "sin prórroga, igual");
// De la 1ª prórroga a la 2ª sí.
{
  const v = vueltaExpulsion({ tInicioAbs: 2400 + 250, parteActual: "PR1", offsetParteActual: 2400, duraciones: DUR });
  ok(!!v && v.parte === "PR2" && mmss(v.reloj) === "3:50", `PR1 → PR2 (da ${v && v.parte} ${v && mmss(v.reloj)})`);
}
// Y de la 2ª prórroga no.
ok(vueltaExpulsion({ tInicioAbs: 2700 + 250, parteActual: "PR2", offsetParteActual: 2700, duraciones: DUR }) === null,
   "pasa del final de la 2ª prórroga → no se dice");
// Parte sin duración fija: el reloj va hacia arriba.
{
  const v = vueltaExpulsion({ tInicioAbs: 300, parteActual: "1T", offsetParteActual: 0, duraciones: { "1T": 0 } });
  ok(!!v && v.mismaParte && mmss(v.reloj) === "7:00", "reloj hacia arriba: roja en el 5:00 → vuelve en el 7:00");
}
// Datos raros: nada.
ok(vueltaExpulsion({ tInicioAbs: NaN, parteActual: "1T", offsetParteActual: 0, duraciones: DUR }) === null, "sin tiempo → nada");

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ todo bien");
process.exit(fallos ? 1 : 0);
