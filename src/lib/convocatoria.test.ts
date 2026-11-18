/**
 * Aviso de convocatoria distinta de 14 (Arkaitz, 18/11/2026): avisa, NO impide.
 * Ejecutar:  node --experimental-strip-types src/lib/convocatoria.test.ts
 */
import { avisoConvocatoria, CONVOCATORIA_HABITUAL } from "./convocatoria.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
ok(CONVOCATORIA_HABITUAL === 14, "lo habitual son 14");
ok(!avisoConvocatoria(14), "con 14 no avisa");
for (const n of [12, 13, 15, 16]) ok(avisoConvocatoria(n), `con ${n} avisa`);
ok(!avisoConvocatoria(0), "sin nadie convocado todavía no avisa");
if (fallos) { console.log(`\n❌ ${fallos} fallo(s)`); process.exit(1); }
console.log("\n✅ convocatoria: todo bien");
