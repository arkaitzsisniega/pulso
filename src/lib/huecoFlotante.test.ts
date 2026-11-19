/**
 * Test del hueco para el flotante iniciar/pausar (19/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/huecoFlotante.test.ts
 */
import { readFileSync } from "node:fs";
import { huecoFlotante, AIRE_FLOTANTE } from "./huecoFlotante.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}

// iPad 11″ horizontal (1180 px): botón de 164 px a 16 px del borde.
const boton = { left: 1000, right: 1164, top: 17, bottom: 73 };
const alta = { left: 142, right: 1038, top: 21, bottom: 800 };   // la del jugador

console.log("iPad apaisado, ventana alta y ancha: se aparta a la izquierda");
const h = huecoFlotante(alta, boton, 1180);
ok(h.lado === "derecha", "por la derecha (no pierde alto)");
ok(h.lado === "derecha" && h.px === 1180 - 1000 + AIRE_FLOTANTE, "hueco = desde el botón al borde + aire");

console.log("iPad de 10,2″ (1024 px): también a la izquierda");
const b1024 = { left: 844, right: 1008, top: 17, bottom: 73 };
ok(huecoFlotante({ left: 64, right: 960, top: 19, bottom: 749 }, b1024, 1024).lado === "derecha", "queda ancho de sobra");

console.log("Pantalla estrecha (iPad en vertical): por debajo del botón");
const b820 = { left: 614, right: 800, top: 15, bottom: 75 };
const hv = huecoFlotante({ left: 16, right: 804, top: 20, bottom: 1160 }, b820, 820);
ok(hv.lado === "arriba" && hv.px === 75 + AIRE_FLOTANTE, "baja hasta debajo del botón");

console.log("Ventana centrada más abajo: no cambia");
ok(huecoFlotante({ ...alta, top: 213, bottom: 607 }, boton, 1180).lado === "ninguno", "no toca el botón en alto");

console.log("Ventana estrecha (max-w-md): no cambia");
ok(huecoFlotante({ left: 366, right: 814, top: 20, bottom: 700 }, boton, 1180).lado === "ninguno", "no toca el botón en ancho");

console.log("Sin botón en pantalla: no cambia");
ok(huecoFlotante(alta, null, 1180).lado === "ninguno", "null → ninguno");

console.log("La ventana lo usa, el botón sigue por encima y el clásico no se toca");
const pagina = readFileSync(new URL("../app/partido/page.tsx", import.meta.url), "utf8");
const shell = pagina.slice(pagina.indexOf("function ModalShell("), pagina.indexOf("function PorteriaOverlay("));
ok(/huecoFlotante\(/.test(shell), "ModalShell calcula el hueco");
ok(/if \(!nuevo\) return;/.test(shell), "solo en el aspecto nuevo");
const clasico = shell.slice(shell.lastIndexOf("  return ("));
ok(!/ref=\{/.test(clasico), "la ventana del clásico sigue sin medir nada");
const css = readFileSync(new URL("../app/tema-nuevo.css", import.meta.url), "utf8");
const play = css.match(/^\.pz-play \{[^}]*\}/m)?.[0] ?? "";
ok(/z-index:\s*60/.test(play), "el flotante sigue en z-index 60 (encima de las ventanas, z-50)");
const saca = css.match(/^\.pz-saca \{[^}]*\}/m)?.[0] ?? "";
ok(/z-index:\s*4\d\b/.test(saca), "«saca» queda debajo de las ventanas (z-index < 50)");

if (fallos) { console.log(`\n❌ ${fallos} fallo(s)`); process.exit(1); }
console.log("\n✅ todo bien");
