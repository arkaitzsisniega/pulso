/**
 * Test de los nombres de las acciones individuales (15/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/acciones.test.ts
 *
 * El editor post-partido enseñaba «PF» al abrir un saque o una anticipación:
 * su desplegable no las conocía y pintaba la primera opción. Un nombre
 * equivocado no avisa, parece un dato.
 */
import { readFileSync } from "node:fs";
import { etiquetaAccionInd, gruposAccionInd } from "./acciones.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

// Los tipos, de db.ts, y los textos, de i18n.ts. Se leen como texto porque
// ninguno de los dos se puede importar desde node (Dexie, cliente activo).
const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const db = leer("./db.ts");
const union = db.slice(db.indexOf("export type AccionIndTipo ="));
const TIPOS = [...union.slice(0, union.indexOf(";")).matchAll(/"(\w+)"/g)].map((m) => m[1]);

const CATALOGO: Record<string, Record<string, string>> = {};
const LINEA = /^  (\w+): \{ es: "((?:[^"\\]|\\.)*)", en: "((?:[^"\\]|\\.)*)", it: "((?:[^"\\]|\\.)*)" \},$/gm;
for (const m of leer("./i18n.ts").matchAll(LINEA)) CATALOGO[m[1]] = { es: m[2], en: m[3], it: m[4] };
const traductor = (idioma: string) => (clave: string) => CATALOGO[clave]?.[idioma] ?? clave;
const es = traductor("es");

console.log("── Acciones individuales ──");

// 1 · En el desplegable del editor están todas, una vez cada una
{
  ok(TIPOS.length >= 28, `se leen los tipos de AccionIndTipo (${TIPOS.length})`);
  const grupos = gruposAccionInd(es);
  const salen: string[] = grupos.flatMap((g) => g.opciones.map((o) => o.v));
  igual([...salen].sort(), [...TIPOS].sort(), "salen todas las de AccionIndTipo, ni una más");
  igual(salen.length - new Set(salen).size, 0, "y ninguna repetida");
  igual(grupos.map((g) => g.titulo),
        ["Acciones básicas", "Estadísticas de vídeo", "Estadísticas de vídeo · 🥅 Portero"],
        "en los bloques del modal: básicas, vídeo y portero");
  igual(grupos[0].opciones.map((o) => o.v), ["robos", "cortes", "pf", "pnf", "bdg", "bdp"],
        "las básicas, en el orden de sus botones");
  ok(grupos[1].opciones.some((o) => o.v === "antB") && !grupos[2].opciones.some((o) => o.v === "antB"),
     "la anticipación va con las de campo: también la tienen los porteros, pero no es solo suya");
}

// 2 · Los nombres son los del modal y dicen cómo acabó
{
  igual(etiquetaAccionInd("pf", es), "❌ Pérdida forzada", "una básica, con su nombre de siempre");
  igual(etiquetaAccionInd("saqueB", es), "Saque · ✅ Bueno", "un saque dice si fue bueno");
  igual(etiquetaAccionInd("antM", es), "Anticipación · ❌ Mala", "la anticipación, en femenino");
  igual(etiquetaAccionInd("cobMR", es), "Cobertura · Mala + recupera", "la cobertura, con las dos cosas");
  igual(etiquetaAccionInd("conexPivot", es), "🎯 Conexión con pívot", "la que no tiene resultado, solo el nombre");
  igual(etiquetaAccionInd("inventada", es), "inventada",
        "un código que no se conoce sale tal cual, nunca con el nombre de otra acción");
}

// 3 · En los tres idiomas: nada sin traducir y ningún nombre repetido
for (const idioma of ["es", "en", "it"]) {
  const grupos = gruposAccionInd(traductor(idioma));
  const nombres = grupos.flatMap((g) => g.opciones.map((o) => o.lbl));
  const crudos = [...grupos.map((g) => g.titulo), ...nombres].filter((s) => /\b(?:lblacc|vid|res|ed)_\w/.test(s));
  igual(crudos, [], `${idioma}: ningún texto sale como clave sin traducir`);
  igual(nombres.length - new Set(nombres).size, 0, `${idioma}: no hay dos acciones con el mismo nombre`);
}

console.log(fallos ? `\n❌ Acciones: ${fallos} fallo(s)` : "\n✅ Acciones OK (0 fallos)");
process.exit(fallos ? 1 : 0);
