/**
 * Test de los lanzamientos sin barrera: penalti, 10 m y FSB (26/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/lanzamientos.test.ts
 *
 * Arkaitz pidió el FSB (falta sin barrera) «en el mismo botón que 6 m y 10 m…
 * Lo mismo». Dar de alta un valor nuevo toca muchos sitios, y el que se escapa
 * no da error: da un gol de FSB que desaparece del marcador al editar el
 * partido, o un FSB que el resumen llama «10m». Por eso, además de las reglas,
 * aquí hay un GUARDIÁN que lee el código: todo fichero que trate el 10 m tiene
 * que tratar también el FSB.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Evento } from "./db.ts";
import {
  TIPOS_LANZAMIENTO, esTipoLanzamiento, esLanzamiento, tipoLanzamientoDeAccion,
  esAccionLanzamiento, accionDeLanzamiento,
} from "./lanzamientos.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

const ev = (e: Record<string, unknown>) => ({ id: "x", parte: "1T", segundosParte: 0, segundosPartido: 0,
  timestampReal: 0, marcador: { inter: 0, rival: 0 }, ...e }) as unknown as Evento;

console.log("── Lanzamientos: penalti, 10 m y FSB ──");

// 1 · Qué es un lanzamiento
{
  igual([...TIPOS_LANZAMIENTO], ["penalti", "diezm", "fsb"], "los tres tipos, y el FSB con el nombre que lee el club");
  ok(["penalti", "diezm", "fsb"].every((t) => esTipoLanzamiento(t)), "penalti, 10 m y FSB lo son");
  ok(!["gol", "disparo", "falta", "", undefined, null].some((t) => esTipoLanzamiento(t)),
     "un gol, un disparo o una falta, no");
  ok(esLanzamiento(ev({ tipo: "fsb", equipo: "INTER", tirador: "A", portero: "", resultado: "GOL" })),
     "un evento FSB es un lanzamiento");
  ok(!esLanzamiento(ev({ tipo: "gol", equipo: "INTER", goleador: "A", cuarteto: [] })), "un gol no");
}

// 2 · La acción del gol y su lanzamiento enlazado
{
  igual(["Penalti", "10m", "FSB"].map(tipoLanzamientoDeAccion), ["penalti", "diezm", "fsb"],
        "Penalti → penalti, 10m → diezm, FSB → fsb (lo que crea el store al guardar el gol)");
  igual(["Falta", "Córner", "", undefined, null, "fsb", "10 M"].map(tipoLanzamientoDeAccion),
        [null, null, null, null, null, null, null],
        "una falta con barrera, un córner o nada no son lanzamiento (y la acción va tal cual, sin adivinar)");
  ok(esAccionLanzamiento("FSB") && !esAccionLanzamiento("Falta"), "esAccionLanzamiento dice lo mismo");
  igual(TIPOS_LANZAMIENTO.map(accionDeLanzamiento), ["Penalti", "10m", "FSB"],
        "y a la vuelta, el nombre con que se enseña cada uno");
  ok(TIPOS_LANZAMIENTO.every((t) => tipoLanzamientoDeAccion(accionDeLanzamiento(t)) === t),
     "ida y vuelta: ningún tipo se pierde");
}

// ── Lo que sigue lee el código como texto (db.ts e i18n.ts no se pueden
//    importar desde node: Dexie y el cliente activo) ──
const SRC = fileURLToPath(new URL("..", import.meta.url));
const leer = (rel: string) => readFileSync(join(SRC, rel), "utf8");
function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...fuentes(p));
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) out.push(p);
  }
  return out;
}

// 3 · En db.ts, los eventos con tirador y resultado de lanzamiento son estos tres
{
  const db = leer("lib/db.ts");
  const conTirador = [...db.matchAll(/tipo: "(\w+)"; equipo: "INTER" \| "RIVAL"; tirador: string;/g)].map((m) => m[1]);
  igual(conTirador, [...TIPOS_LANZAMIENTO],
        "los tipos de evento con lanzador de db.ts son los de TIPOS_LANZAMIENTO (uno nuevo, a lanzamientos.ts)");
}

// 4 · GUARDIÁN: quien trata el 10 m trata también el FSB
{
  const ficheros = fuentes(SRC);
  ok(ficheros.length > 20, `se lee el código de la app (${ficheros.length} ficheros)`);
  const sinFsb: string[] = [];
  const sinFsbAccion: string[] = [];
  const parViejo: string[] = [];
  for (const f of ficheros) {
    const txt = readFileSync(f, "utf8");
    const rel = relative(SRC, f);
    if (txt.includes('"diezm"') && !txt.includes('"fsb"')) sinFsb.push(rel);
    if (txt.includes('"10m"') && !txt.includes('"FSB"')) sinFsbAccion.push(rel);
    // La comparación de antes, tipo a tipo: ahora se pregunta a lanzamientos.ts
    // (que es donde vive la lista y la cuenta en su cabecera).
    if (rel !== "lib/lanzamientos.ts"
        && (/===\s*"penalti"\s*\|\|[^\n]*===\s*"diezm"/.test(txt) || /===\s*"10m"/.test(txt))) {
      parViejo.push(rel);
    }
  }
  igual(sinFsb, [], "todo fichero que nombra el evento del 10 m (\"diezm\") nombra también el FSB (\"fsb\")");
  igual(sinFsbAccion, [], "todo fichero que nombra la acción \"10m\" nombra también \"FSB\"");
  igual(parViejo, [], "nadie compara ya `=== \"penalti\" || === \"diezm\"` ni `=== \"10m\"` a mano");
}

// 5 · Los textos, en los tres idiomas
{
  const i18n = leer("lib/i18n.ts");
  const LINEA = /^  (\w+): \{ es: "((?:[^"\\]|\\.)*)", en: "((?:[^"\\]|\\.)*)", it: "((?:[^"\\]|\\.)*)" \},$/gm;
  const CAT: Record<string, Record<string, string>> = {};
  for (const m of i18n.matchAll(LINEA)) CAT[m[1]] = { es: m[2], en: m[3], it: m[4] };
  for (const k of ["acc_fsb", "mp_fsb", "mp_fsb_nota", "ed_t_fsb"]) {
    ok(!!CAT[k] && ["es", "en", "it"].every((l) => CAT[k][l].trim() !== ""), `«${k}» está en es, en e it`);
  }
  ok(/"FSB": "acc_fsb"/.test(i18n), "la acción FSB tiene su etiqueta (labelAccionGol)");
  ok(CAT.btn_pen10m?.es.includes("FSB"), "el botón dice que dentro está el FSB");

  // Cada acción de gol de los dos menús tiene su etiqueta, y el FSB está en los dos.
  const mapa = i18n.slice(i18n.indexOf("const CLAVE_ACCION_GOL"));
  const conEtiqueta = new Set([...mapa.slice(0, mapa.indexOf("};")).matchAll(/"([^"]+)": "acc_/g)].map((m) => m[1]));
  const lista = (txt: string, nombre: string) => {
    const desde = txt.indexOf(`const ${nombre}`);
    const ini = desde < 0 ? -1 : txt.indexOf("= [", desde);
    if (ini < 0) { ok(false, `encuentro la lista ${nombre}`); return []; }
    return [...txt.slice(ini, txt.indexOf("];", ini)).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  const partido = leer("app/partido/page.tsx");
  const editor = leer("components/EditorEventos.tsx");
  const menuGol = [...lista(partido, "ACCIONES_GOL_IZQ"), ...lista(partido, "ACCIONES_GOL_DER")];
  const menuEditor = lista(editor, "ACCIONES_GOL");
  ok(menuGol.includes("FSB") && menuEditor.includes("FSB"), "el FSB está en el modal del gol y en el editor");
  igual(menuGol.filter((a) => !conEtiqueta.has(a)), [], "todas las acciones del modal del gol tienen etiqueta");
  igual(menuEditor.filter((a) => !conEtiqueta.has(a)), [], "y todas las del editor");
  igual(lista(partido, "ACCIONES_GOL_DER").slice(3, 5), ["10m", "FSB"], "en el modal, el FSB va pegado al 10 m");

  // El editor ofrece crear un FSB y tiene nombre para cada tipo que ofrece.
  const tiposEditor = lista(editor, "TIPOS");
  ok(tiposEditor.includes("fsb"), "el editor post-partido deja añadir un FSB");
  igual(tiposEditor.filter((tp) => !CAT[`ed_t_${tp}`]), [], "cada tipo del editor tiene su nombre (ed_t_…)");

  // Y el botón de penalti / 10 m ofrece el FSB con el mismo flujo.
  ok(partido.includes('setTipo("fsb")'), "el modal PEN/10M/FSB tiene el botón del FSB");
}

console.log(fallos ? `\n❌ Lanzamientos: ${fallos} fallo(s)` : "\n✅ Lanzamientos OK (0 fallos)");
process.exit(fallos ? 1 : 0);
