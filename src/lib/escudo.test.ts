/**
 * Test del escudo del club en el aspecto nuevo (18/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/escudo.test.ts
 *
 * Que cada cliente tenga su escudo, que la imagen exista en public/ y sea
 * pequeña, que la ruta lleve la carpeta de cada build y que el modo sin
 * conexión lo guarde (precarga en el layout + service worker).
 */
import { readFileSync, existsSync } from "node:fs";
import { rutaEscudo } from "./escudo.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const raiz = new URL("../../", import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, raiz), "utf8");

console.log("Ruta con la carpeta de cada build:");
ok(rutaEscudo("/pulso/crono", "escudos/inter.png") === "/pulso/crono/escudos/inter.png", "Inter en /pulso/crono");
ok(rutaEscudo("/pulso/crono-filial/", "/escudos/inter.png") === "/pulso/crono-filial/escudos/inter.png", "sin barras dobles");
ok(rutaEscudo("", "escudos/pulso.png") === "/escudos/pulso.png", "en local, desde la raíz");

console.log("Cada cliente con su escudo:");
const clientes = leer("src/lib/clientes.ts");
const bloque = clientes.slice(clientes.indexOf("const CLIENTES"), clientes.indexOf("const ROSTER_ACTIVO"));
const ids = [...bloque.matchAll(/^  (\w+): \{$/gm)].map((m) => m[1]);
ok(ids.length >= 4, `clientes encontrados: ${ids.join(", ")}`);
const esperado: Record<string, string> = {
  inter: "escudos/inter-verde.png", filial: "escudos/inter-verde.png",
  juvenil: "escudos/inter-verde.png", pulso: "escudos/pulso.png",
};
for (const id of ids) {
  const ent = bloque.slice(bloque.indexOf(`  ${id}: {`));
  const m = ent.match(/escudo: "([^"]+)"/);
  ok(!!m, `${id}: tiene escudo`);
  if (!m) continue;
  if (esperado[id]) ok(m[1] === esperado[id], `${id}: ${m[1]}`);
  const f = new URL(`public/${m[1]}`, raiz);
  ok(existsSync(f), `${id}: public/${m[1]} existe`);
  if (!existsSync(f)) continue;
  const png = readFileSync(f);
  const esPng = png.subarray(1, 4).toString() === "PNG";
  ok(esPng, `${id}: es PNG`);
  const an = png.readUInt32BE(16), al = png.readUInt32BE(20);
  ok(an <= 512 && al <= 512, `${id}: tamaño web (${an}×${al})`);
  ok(png.length < 60_000, `${id}: pesa poco (${Math.round(png.length / 1024)} KB)`);
}

console.log("Sin conexión:");
ok(/rel="preload" as="image" href=\{rutaEscudo\(/.test(leer("src/app/layout.tsx")), "el layout precarga el escudo");
ok(leer("public/sw.js").includes('a.includes("/escudos/")'), "el service worker guarda lo de /escudos/");

console.log("El informe lleva la marca del club (21/11/2026):");
ok(/MARCA_INFORME: MarcaInforme = construirMarcaInforme\(CLIENTE, BASE\)/.test(leer("src/lib/marca.ts")),
  "el informe sale de la entrada del club en clientes.ts");
ok(/ficheroEscudoInforme\(CLIENTE\)/.test(leer("src/app/layout.tsx")),
  "el layout precarga también el escudo del informe (sin conexión)");
ok(leer("public/sw.js").includes("${BASE}/marca.png"), "la demo sigue con marca.png guardada al instalar");
for (const id of ids) {
  const ent = bloque.slice(bloque.indexOf(`  ${id}: {`));
  const m = ent.slice(0, ent.indexOf("\n  },")).match(/escudoInforme: "([^"]+)"/);
  if (!m) continue;
  ok(m[1].startsWith("escudos/"), `${id}: escudo del informe en public/escudos/ (lo guarda el service worker)`);
  const f = new URL(`public/${m[1]}`, raiz);
  ok(existsSync(f), `${id}: public/${m[1]} existe`);
  if (existsSync(f)) {
    const png = readFileSync(f);
    ok(png.subarray(1, 4).toString() === "PNG" && png.length < 60_000, `${id}: PNG que pesa poco (${Math.round(png.length / 1024)} KB)`);
  }
}

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log("\nTodo bien.");
