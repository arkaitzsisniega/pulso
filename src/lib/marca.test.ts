/**
 * Test de la marca del informe del partido (21/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/marca.test.ts
 *
 * Cada club lleva en el informe su escudo, su nombre y su color; la demo, la
 * marca PULSO de siempre. Y el rival nunca del mismo color que el club.
 */
// marca.ts importa sin extensión y con el alias "@/lib/…", como el resto de la
// app. Node no sabe de ninguno de los dos: aquí se le enseña.
import { registerHooks } from "node:module";
registerHooks({
  resolve(esp, ctx, sig) {
    if (esp.startsWith("@/lib/")) esp = new URL(`./${esp.slice(6)}`, import.meta.url).href;
    if ((esp.startsWith(".") || esp.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(esp)) {
      try { return sig(`${esp}.ts`, ctx); } catch { /* tal cual */ }
    }
    return sig(esp, ctx);
  },
});
const { construirMarcaInforme, marcaPulso, ROJO_RIVAL } = await import("./marca.ts");
const { seDistinguen } = await import("./tema.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}

const INTER = {
  demo: false, nombreLargo: "Inter JP Financial",
  escudo: "escudos/inter.png", escudoInforme: "escudos/inter-informe.png",
  colorPropio: { oscuro: "#34d27b", sol: "#0f7a43" },
};
const DEMO = {
  demo: true, nombreLargo: "CD Pulso", escudo: "escudos/pulso.png",
  colorPropio: { oscuro: "#4ea8ff", sol: "#0b5fd1" },
};

console.log("Inter:");
const mi = construirMarcaInforme(INTER, "/pulso/crono");
ok(mi.nombre === "Inter JP Financial", `nombre: ${mi.nombre}`);
ok(mi.escudo === "/pulso/crono/escudos/inter-informe.png", `escudo del papel: ${mi.escudo}`);
ok(mi.color === "#0f7a43", `color del club en claro: ${mi.color}`);
ok(mi.colorRival === ROJO_RIVAL, "rival en el rojo de siempre");
ok(mi.pie === marcaPulso("").pie && mi.origen === marcaPulso("").origen, "pie y autoría de PULSO, iguales");

console.log("Club sin escudo aparte para el informe (su png + una línea):");
const azul = construirMarcaInforme({ ...DEMO, demo: false, nombreLargo: "CD Azul", escudo: "escudos/azul.png" }, "");
ok(azul.escudo === "/escudos/azul.png", `usa el de las cabeceras: ${azul.escudo}`);
ok(azul.color === "#0b5fd1", "su color");

console.log("Club rojo:");
const rojo = construirMarcaInforme({ ...INTER, escudoInforme: undefined, nombreLargo: "CD Rojo",
  colorPropio: { oscuro: "#ff5a4f", sol: "#c62828" } }, "");
ok(rojo.colorRival !== ROJO_RIVAL, `el rival deja el rojo: ${rojo.colorRival}`);
ok(seDistinguen(rojo.color, rojo.colorRival), "y se distingue del club");

console.log("Demo:");
const md = construirMarcaInforme(DEMO, "/pulso/crono-demo");
ok(JSON.stringify(md) === JSON.stringify(marcaPulso("/pulso/crono-demo")), "marca PULSO, idéntica a la de antes");
ok(md.nombre === "PULSO" && md.escudo === "/pulso/crono-demo/marca.png" && md.color === "#0d7a4f",
  "PULSO · marca.png · verde de siempre");

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log("\nTodo bien.");
