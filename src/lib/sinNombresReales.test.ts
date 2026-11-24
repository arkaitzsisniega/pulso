/**
 * Ningún nombre de la plantilla REAL en el repositorio (24/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/sinNombresReales.test.ts
 *
 * Decisión de Arkaitz (23/11): el repositorio es público y la plantilla real
 * del Inter, del filial y del juvenil se queda fuera; aquí solo van datos
 * inventados. Este test lo vigila de dos maneras:
 *
 *   1. SIEMPRE: `src/lib/roster.ts` no vuelve a tener las plantillas reales
 *      (ROSTER_REAL / ROSTER_FILIAL / ROSTER_JUVENIL / NOMBRES_FILIAL) y
 *      ningún fichero las vuelve a importar.
 *   2. Si encuentra la plantilla privada (en este Mac, en
 *      ~/Desktop/Claude/pulso_secretos; en GitHub Actions, en los secretos):
 *      ningún fichero del repo —los que git sigue y los nuevos sin añadir,
 *      no los ignorados— contiene un nombre suyo (en mayúsculas, como palabra
 *      entera) ni un nombre completo del filial. Los que coinciden con uno
 *      de la demo (que es inventada) no cuentan.
 *
 * Sin la plantilla privada, la parte 2 se OMITE avisando (no puede saber qué
 * nombres buscar sin escribirlos aquí, que es justo lo que no se quiere).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buscarRosterPrivado, carpetaSecretos, CLIENTES_PRIVADOS } from "../../cargarRoster.mjs";
import { ROSTER_DEMO } from "./roster.ts";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const EN_CI = !!process.env.CI; // en Actions el registro es público: no se escriben los nombres

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

const ficheros = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: RAIZ, encoding: "utf8" })
  .split("\0")
  .filter((f) => f && existsSync(join(RAIZ, f)));
const BINARIO = /\.(png|jpe?g|gif|webp|ico|icns|pdf|woff2?|ttf|otf|mp4|mov|zip|gz)$/i;
const textos = ficheros
  .filter((f) => !BINARIO.test(f))
  .map((f) => ({ f, t: readFileSync(join(RAIZ, f), "utf8") }))
  .filter(({ t }) => !t.includes("\0"));

console.log("── 1 · Las plantillas reales no vuelven al código ──");
{
  const roster = readFileSync(join(RAIZ, "src/lib/roster.ts"), "utf8");
  for (const c of ["ROSTER_REAL", "ROSTER_FILIAL", "ROSTER_JUVENIL", "NOMBRES_FILIAL"]) {
    ok(!new RegExp(`export\\s+const\\s+${c}\\b`).test(roster), `roster.ts no define ${c}`);
  }
  const importan = textos.filter(({ f, t }) => f !== "src/lib/sinNombresReales.test.ts" && f.match(/\.(ts|tsx|mjs|js)$/)
    && /import[^;]*\b(ROSTER_REAL|ROSTER_FILIAL|ROSTER_JUVENIL|NOMBRES_FILIAL)\b/.test(t));
  ok(importan.length === 0, `nadie importa una plantilla real del código${importan.length ? ` (${importan.map((x) => x.f).join(", ")})` : ""}`);
  ok(readFileSync(join(RAIZ, ".gitignore"), "utf8").split("\n").includes("/roster-privado/"),
    "la carpeta local roster-privado/ está en .gitignore");
}

console.log("── 2 · Ningún nombre real en ningún fichero ──");
{
  const DEMO = new Set(ROSTER_DEMO.map((j) => j.nombre));
  const nombres = new Set<string>();
  const encontradas: string[] = [];
  for (const c of CLIENTES_PRIVADOS) {
    const r = buscarRosterPrivado(c, { raiz: RAIZ });
    if (!r) continue;
    encontradas.push(c);
    for (const j of r.jugadores) if (!DEMO.has(j.nombre)) nombres.add(j.nombre);
  }
  // Nombres completos del filial (sin uso en la app; solo en el Mac).
  const completos: string[] = [];
  const fCompletos = join(carpetaSecretos(), "nombres_filial.json");
  if (existsSync(fCompletos)) completos.push(...Object.values(JSON.parse(readFileSync(fCompletos, "utf8")) as Record<string, string>));

  if (encontradas.length === 0) {
    console.log("  ⚠️  OMITIDO: no encuentro ninguna plantilla privada (ni secretos ni");
    console.log(`     ${carpetaSecretos()}), así que no sé qué nombres buscar.`);
  } else {
    console.log(`  (plantillas: ${encontradas.join(", ")} — ${nombres.size} nombres; ${completos.length} nombres completos)`);
    const letra = "A-Za-zÀ-ÖØ-öø-ÿ";
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reNombre = (n: string) => new RegExp(`(?<![${letra}])${esc(n)}(?![${letra}])`);
    const reCompleto = (n: string) => new RegExp(`(?<![${letra}])${esc(n)}(?![${letra}])`, "i");
    const buscar = [
      ...[...nombres].map((n) => ({ n, re: reNombre(n) })),
      ...completos.map((n) => ({ n, re: reCompleto(n) })),
    ];
    let hallazgos = 0;
    for (const { f, t } of textos) {
      const lineas = t.split("\n");
      for (const { n, re } of buscar) {
        const i = lineas.findIndex((l) => re.test(l));
        if (i < 0) continue;
        hallazgos += 1;
        ok(false, `${f}:${i + 1} contiene un nombre de la plantilla real${EN_CI ? "" : ` («${n}»)`}`);
      }
    }
    ok(hallazgos === 0, `ningún nombre real en los ${textos.length} ficheros de texto del repo`);
  }
}

if (fallos) {
  console.log(`\n❌ ${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\n✅ Sin plantilla real en el repositorio");
