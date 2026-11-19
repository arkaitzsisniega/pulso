/**
 * Test del manifest de cada cliente y de los iconos del botón de tiempo (19/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/manifest.test.ts
 *
 * - El filial pedía `manifest-filial.json` y no existía (404 con y sin red).
 *   Cada cliente de clientes.ts debe tener el suyo en public/, con JSON válido,
 *   y el service worker debe guardar el manifest que enlaza cada página.
 * - El botón INICIAR/PAUSAR del aspecto clásico pintaba la flecha dos veces
 *   («▶ ▶ INICIAR»): el icono ya viene en el texto (campo `ico` del catálogo).
 */
import { readFileSync, existsSync } from "node:fs";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const raiz = new URL("../../", import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, raiz), "utf8");

console.log("Un manifest por cliente:");
const clientes = leer("src/lib/clientes.ts");
const ids = [...clientes.matchAll(/^\s{4}id:\s*"([a-z]+)"/gm)].map((m) => m[1]);
ok(ids.length >= 4, `clientes encontrados: ${ids.join(", ")}`);
for (const id of ids) {
  const f = `public/manifest${id === "inter" ? "" : `-${id}`}.json`;
  const existe = existsSync(new URL(f, raiz));
  ok(existe, `${id}: existe ${f}`);
  if (!existe) continue;
  let m: { name?: string; short_name?: string; start_url?: string; icons?: unknown[] } = {};
  try { m = JSON.parse(leer(f)); } catch { /* lo cuenta el ok de abajo */ }
  ok(!!m.name && !!m.short_name && m.start_url === "./" && (m.icons?.length ?? 0) > 0,
     `${id}: JSON válido con nombre, start_url relativa e iconos`);
}

console.log("Sin conexión:");
ok(/\\\/manifest\[\^\/\]\*\\\.json\$/.test(leer("public/sw.js")),
   "el service worker guarda el manifest que enlaza la página");

console.log("Botón de tiempo del aspecto clásico sin icono repetido:");
const partido = leer("src/app/partido/page.tsx");
ok(!/[▶⏸]\s*\{ic\(t\("part_(iniciar|pausar)"\)\)\}/.test(partido),
   "ni ▶ ni ⏸ escritos a mano delante de part_iniciar / part_pausar");
const i18n = leer("src/lib/i18n.ts");
ok(/part_iniciar:\s*\{\s*ico:\s*"▶"/.test(i18n) && /part_pausar:\s*\{\s*ico:\s*"⏸"/.test(i18n),
   "el icono sigue viniendo del catálogo (ico)");

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log("\nTodo bien");
