/**
 * Test de «sin interruptor» (preparado el 23/11/2026, sale el 15/12/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/sinInterruptor.test.ts
 *
 * Decisión de Arkaitz (19/11/2026): se quita el interruptor Clásico/Nuevo y
 * TODOS los clientes (Inter, filial, juvenil, demo) van con el aspecto nuevo.
 * Aquí se vigila, leyendo el código:
 *   1. useAspecto() es siempre "nuevo" y no lee lo que tuviera guardado el iPad
 *      (un «clásico» guardado pasa solo al nuevo, sin tocar la memoria).
 *   2. Ya no hay forma de cambiarlo: ni setAspecto, ni botones, ni textos.
 *   3. Ningún cliente tiene un aspecto por defecto propio.
 *   4. El modo Sol sigue (es opción del aspecto nuevo).
 *   5. El informe recibe el aspecto de useAspecto (= siempre el nuevo, claro).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
/** Quita los comentarios para no contar lo que solo se menciona en ellos. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const raiz = new URL("../", import.meta.url).pathname;
function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return ficheros(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}
const todo = ficheros(raiz).map((p) => ({ p: p.slice(raiz.length), s: sinComentarios(readFileSync(p, "utf8")) }));

console.log("\n1. Siempre el aspecto nuevo");
const asp = sinComentarios(leer("lib/aspecto.ts"));
ok(/export const ASPECTO_UNICO: Aspecto = "nuevo";/.test(asp), "ASPECTO_UNICO es \"nuevo\"");
ok(/export function useAspecto\(\): Aspecto \{\s*return ASPECTO_UNICO;\s*\}/.test(asp), "useAspecto() devuelve ASPECTO_UNICO, sin más");
ok(!asp.includes("crono_aspecto_"), "ya no se lee la clave crono_aspecto_<club> (un «clásico» guardado se ignora)");
ok(!/removeItem|clear\(\)/.test(asp), "y tampoco se borra nada de la memoria del aparato");

console.log("\n2. Ya no se puede cambiar");
ok(!/setAspecto/.test(asp), "aspecto.ts ya no exporta setAspecto");
const conSet = todo.filter((f) => /setAspecto|onAspecto|data-aspecto|pz_aspecto_/.test(f.s)).map((f) => f.p);
ok(conSet.length === 0, `nadie pinta ni usa el interruptor${conSet.length ? ` (aún en: ${conSet.join(", ")})` : ""}`);
ok(!/pz_aspecto_(titulo|clasico|nuevo|nota)\s*:/.test(leer("lib/i18n.ts")), "los textos del interruptor ya no están en i18n");

console.log("\n3. Los cuatro clientes, iguales");
const cli = sinComentarios(leer("lib/clientes.ts"));
ok(!cli.includes("aspectoPorDefecto"), "ningún cliente tiene aspectoPorDefecto");
for (const id of ["inter", "filial", "juvenil", "pulso"]) {
  ok(new RegExp(`id:\\s*"${id}"`).test(cli), `el cliente ${id} sigue existiendo`);
}

console.log("\n4. El modo Sol sigue");
ok(/export function useModoSol\(\)/.test(asp) && /export function setModoSol\(/.test(asp), "useModoSol y setModoSol siguen");
ok(asp.includes("crono_sol_${CLIENTE.id}"), "con su clave por club");
for (const pag of ["app/page.tsx", "app/nuevo/page.tsx", "app/partido/page.tsx", "app/resumen/page.tsx", "app/totales/page.tsx"]) {
  ok(/setModoSol\(/.test(sinComentarios(leer(pag))), `${pag}: el botón del modo Sol sigue`);
}

console.log("\n5. Las pantallas siguen preguntando a useAspecto (siempre nuevo)");
for (const pag of ["app/page.tsx", "app/nuevo/page.tsx", "app/partido/page.tsx", "app/resumen/page.tsx", "app/totales/page.tsx", "app/informe/page.tsx"]) {
  ok(/useAspecto\(\)/.test(sinComentarios(leer(pag))), `${pag} usa useAspecto()`);
}
const inf = sinComentarios(leer("app/informe/page.tsx"));
ok(/const nuevo = useAspecto\(\) === "nuevo";/.test(inf) && /<InformeCompleto nuevo=\{nuevo\} \/>/.test(inf),
   "el informe (también el completo de la demo) sale con el aspecto nuevo");

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ todo bien");
if (fallos) process.exit(1);
