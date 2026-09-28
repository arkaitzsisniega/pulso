/**
 * Test de las SITUACIONES DE GOL (28/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/situaciones.test.ts
 *
 * Arkaitz pidió una situación nueva —«Pérdida en salida de presión»— y al ir a
 * darla de alta salió el problema de fondo: la lista de acciones de gol estaba
 * escrita a mano en TRES ficheros (el modal del partido, el editor
 * post-partido y el mapa de etiquetas de i18n) y ya no eran la misma. Al editor
 * le faltaban «Incorporación de portero» y «Defensa de incorporación»: al abrir
 * un gol apuntado con una de ellas, el desplegable no la tenía y pintaba OTRA
 * en su sitio. Un nombre equivocado no avisa, parece un dato.
 *
 * Aquí se comprueban las reglas Y —lo que de verdad importa— que los sitios que
 * pintan la lista la pidan al fichero único en vez de escribirla otra vez.
 */
import { readFileSync } from "node:fs";
import {
  ACCIONES_GOL, ACCIONES_GOL_DER, ACCIONES_GOL_IZQ, ALIAS_ACCION_GOL,
  CLAVE_ACCION_GOL, PAREJAS_ESPEJO,
} from "./situaciones.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b),
     `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const leer = (f: string) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

console.log("── Situaciones de gol ──");

// 1 · La lista
{
  igual(ACCIONES_GOL.length, ACCIONES_GOL_IZQ.length + ACCIONES_GOL_DER.length,
        "las dos columnas, una detrás de otra");
  igual(ACCIONES_GOL.length - new Set(ACCIONES_GOL).size, 0,
        "ninguna acción repetida entre las dos columnas");
  ok(ACCIONES_GOL.includes("Pérdida en salida de presión"),
     "«Pérdida en salida de presión» es un botón de gol (28/9/2026)");
  ok(ACCIONES_GOL_IZQ.includes("Pérdida en salida de presión" as never),
     "y va en la columna del juego abierto, no en la de balón parado");
  igual(ACCIONES_GOL_IZQ.indexOf("Pérdida en salida de presión" as never),
        ACCIONES_GOL_IZQ.indexOf("Salida de presión" as never) + 1,
        "pegada a «Salida de presión», que es donde se busca por el nombre");
}

// 2 · Las parejas con espejo: las dos caras se pueden apuntar
{
  igual(PAREJAS_ESPEJO.map(([, encaja]) => encaja),
        ["Incorporación de portero", "Pérdida en salida de presión"],
        "las dos situaciones que se apuntan cuando NOS marcan");
  for (const [marca, encaja] of PAREJAS_ESPEJO) {
    ok(ACCIONES_GOL.includes(marca) && ACCIONES_GOL.includes(encaja),
       `la pareja «${marca}» / «${encaja}» tiene botón por los dos lados`);
  }
}

// 3 · Etiquetas: nada sin traducir en es, en e it
{
  // Las entradas del catálogo, estén en una línea o repartidas en varias
  // (`acc_incorporacion_portero` lo está): por eso no se lee línea a línea.
  const TXT = String.raw`"((?:[^"\\]|\\.)*)"`;
  const ENTRADA = new RegExp(
    String.raw`^\s{2}(\w+):\s*\{\s*es:\s*` + TXT +
    String.raw`,\s*en:\s*` + TXT + String.raw`,\s*it:\s*` + TXT + String.raw`,?\s*\}`,
    "gms");
  const CAT: Record<string, Record<string, string>> = {};
  for (const m of leer("lib/i18n.ts").matchAll(ENTRADA)) {
    CAT[m[1]] = { es: m[2], en: m[3], it: m[4] };
  }
  ok(Object.keys(CAT).length > 300,
     `se lee el catálogo de i18n (${Object.keys(CAT).length} textos)`);
  const sinClave = ACCIONES_GOL.filter((a) => !CLAVE_ACCION_GOL[a]);
  igual(sinClave, [], "todas las acciones tienen clave de etiqueta");
  const sinTexto = ACCIONES_GOL.filter((a) => {
    const e = CAT[CLAVE_ACCION_GOL[a]];
    return !e || !["es", "en", "it"].every((l) => (e[l] ?? "").trim() !== "");
  });
  igual(sinTexto, [], "y las tres traducciones (es, en, it) escritas");
  for (const idioma of ["es", "en", "it"]) {
    const nombres = ACCIONES_GOL.map((a) => CAT[CLAVE_ACCION_GOL[a]][idioma]);
    igual(nombres.length - new Set(nombres).size, 0,
          `${idioma}: no hay dos acciones con el mismo nombre en el botón`);
  }
  const perdida = CAT[CLAVE_ACCION_GOL["Pérdida en salida de presión"]];
  igual([perdida.es, perdida.en, perdida.it],
        ["Pérdida salida presión", "Press-break turnover", "Perdita in uscita"],
        "la nueva, en los tres idiomas");
  igual(ALIAS_ACCION_GOL["10 m"], "10m",
        "«10 m» con espacio sigue valiendo (partidos de antes del 26/9)");
}

// 4 · EL GUARDIÁN — nadie vuelve a escribir la lista a mano
//
// Lo que de verdad protege esto: que el modal del partido, el editor
// post-partido y el catálogo de i18n pidan la lista AQUÍ. Si alguien vuelve a
// escribir sus propias acciones en uno de ellos, se pone rojo.
{
  const CONSUMIDORES = [
    "app/partido/page.tsx",
    "components/EditorEventos.tsx",
    "lib/i18n.ts",
  ];
  for (const f of CONSUMIDORES) {
    const txt = leer(f);
    ok(/from "(@\/lib|\.)\/situaciones"/.test(txt),
       `${f} tira del sitio único`);
    const propia = /const\s+(ACCIONES_GOL\w*|CLAVE_ACCION_GOL)\s*(:[^=]+)?=\s*[[{]/
      .exec(sinComentarios(txt));
    ok(propia === null,
       propia
         ? `${f} vuelve a escribir «${propia[1]}» a mano — si esa copia y la de ` +
           "lib/situaciones.ts se separan, un gol se apunta con el nombre de otro. " +
           "Bórrala e impórtala de @/lib/situaciones."
         : `${f} no tiene su propia copia de la lista`);
  }
  // Y ninguno se queda con acciones sueltas escritas en el JSX.
  const nombres = new Set(ACCIONES_GOL);
  for (const f of ["app/partido/page.tsx", "components/EditorEventos.tsx"]) {
    const sueltas = [...sinComentarios(leer(f)).matchAll(/"([^"]{3,40})"/g)]
      .map((m) => m[1])
      .filter((s) => nombres.has(s));
    igual(sueltas, [],
          `${f} no nombra ninguna acción de gol suelta (van todas por la lista)`);
  }
}

console.log(fallos ? `\n❌ Situaciones: ${fallos} fallo(s)`
                   : "\n✅ Situaciones OK (0 fallos)");
process.exit(fallos ? 1 : 0);
