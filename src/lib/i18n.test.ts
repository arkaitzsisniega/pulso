/**
 * Test del catálogo de textos (rediseño, tanda 5 · 18/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/i18n.test.ts
 *
 * Los TEXTOS del catálogo van sin emojis: el de delante vive en `ico` y el de
 * en medio es un marcador {@nombre} (EMOJI_TEXTO). t() los vuelve a poner, así
 * que el aspecto clásico y el informe salen igual que siempre. Aquí se vigila
 * que nadie vuelva a meter un emoji dentro de un texto y que todo marcador
 * tenga su emoji.
 *
 * i18n.ts no se puede importar desde node (tira del cliente activo), así que
 * el catálogo se lee como texto y se evalúa (es un objeto literal de cadenas).
 */
import { readFileSync } from "node:fs";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

const src = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8");
function literal(nombre: string): string {
  const ini = src.indexOf(`export const ${nombre}`);
  const abre = src.indexOf("{", src.indexOf("=", ini));
  return src.slice(abre, src.indexOf("\n};", abre) + 2);
}
type Entrada = Record<string, string>;
const CATALOGO: Record<string, Entrada> = new Function(`return ${literal("CATALOGO")}`)();
const EMOJI_TEXTO: Record<string, string> = new Function(`return ${literal("EMOJI_TEXTO")}`)();
const EMOJI = /\p{Extended_Pictographic}/u;

console.log("── Catálogo sin emojis en los textos ──");
{
  const claves = Object.keys(CATALOGO);
  ok(claves.length > 1000, `se lee el catálogo (${claves.length} claves)`);
  const conEmoji: string[] = [];
  const icoMal: string[] = [];
  const marcadorSinEmoji: string[] = [];
  for (const [k, e] of Object.entries(CATALOGO)) {
    for (const [l, v] of Object.entries(e)) {
      if (l === "ico") {
        if (!/^(?:\p{Extended_Pictographic}️?)+$/u.test(v)) icoMal.push(k);
        continue;
      }
      if (EMOJI.test(v)) conEmoji.push(`${k}.${l}`);
      for (const m of v.matchAll(/\{@(\w+)\}/g)) if (!EMOJI_TEXTO[m[1]]) marcadorSinEmoji.push(`${k}.${l}: {@${m[1]}}`);
    }
  }
  ok(conEmoji.length === 0, `ningún texto lleva un emoji dentro (${conEmoji.join(", ") || "ninguno"})`);
  ok(icoMal.length === 0, `cada «ico» es solo un emoji (${icoMal.join(", ") || "todos"})`);
  ok(marcadorSinEmoji.length === 0, `todo marcador {@…} tiene su emoji (${marcadorSinEmoji.join(", ") || "todos"})`);
  ok(Object.values(EMOJI_TEXTO).every((v) => EMOJI.test(v)), "EMOJI_TEXTO solo tiene emojis");
}

console.log("── t() devuelve la frase de siempre ──");
{
  // Copia de componer() de i18n.ts: emoji de delante + texto, marcadores fuera.
  const componer = (e: Entrada, tx: string) => {
    const f = tx.replace(/\{@(\w+)\}/g, (m, n: string) => EMOJI_TEXTO[n] ?? m);
    return e.ico ? `${e.ico} ${f}` : f;
  };
  ok(componer(CATALOGO.btn_gol, CATALOGO.btn_gol.es) === "⚽ GOL", "btn_gol sigue saliendo «⚽ GOL»");
  ok(componer(CATALOGO.btn_amarilla, CATALOGO.btn_amarilla.en) === "🟨 YELLOW", "en inglés, «🟨 YELLOW»");
  ok(componer(CATALOGO.mdr_intro, CATALOGO.mdr_intro.es).includes("usa el botón ⚽ GOL."),
     "un emoji en medio de la frase vuelve a su sitio");
  ok(componer(CATALOGO.part_volver_parte_title, CATALOGO.part_volver_parte_title.it).endsWith("(annulla ⏭)"),
     "y en italiano también");
  // La función de verdad hace lo mismo que esta copia.
  ok(/function componer\(entrada: Entrada, texto: string\): string \{/.test(src) &&
     src.includes("return entrada.ico ? `${entrada.ico} ${f}` : f;"),
     "componer() de i18n.ts es la misma regla");
}

console.log("── Estado del partido traducido ──");
{
  for (const e of ["en_curso", "finalizado", "configurando"]) {
    const x = CATALOGO[`estado_${e}`];
    ok(!!x && ["es", "en", "it"].every((l) => (x[l] ?? "").trim() !== "" && x[l] !== e),
       `«${e}» tiene texto en es, en e it`);
  }
  ok(CATALOGO.estado_en_curso.es === "En curso" && CATALOGO.estado_finalizado.es === "Finalizado",
     "en español: «En curso» y «Finalizado»");
  const resumen = readFileSync(new URL("../app/resumen/page.tsx", import.meta.url), "utf8");
  ok(!/:\s*partido\.estado\}/.test(resumen) && (resumen.match(/labelEstadoPartido\(partido\.estado\)/g) ?? []).length >= 2,
     "el resumen ya no enseña el código («en_curso») en ningún cliente");
}

console.log(fallos ? `\n❌ Catálogo: ${fallos} fallo(s)` : "\n✅ Catálogo OK (0 fallos)");
process.exit(fallos ? 1 : 0);
