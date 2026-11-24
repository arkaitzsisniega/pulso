/**
 * Limpia de la rama `gh-pages` los ficheros VIEJOS que aún llevan la plantilla
 * real en claro (25/11/2026).
 *
 * Por qué: el workflow publica con `keep_files: true`, así que cada despliegue
 * AÑADE sus ficheros (`_next/static/chunks/<hash>.js`…) y no borra los de
 * antes. Los paquetes anteriores al 25/11 llevaban la plantilla en claro y
 * siguen ahí, descargables, aunque ninguna página los use ya. El 24/11 se hizo
 * a mano en `crono-demo/` (22 ficheros); esto lo hace en `crono/`,
 * `crono-filial/` y `crono-juvenil/`.
 *
 * CUÁNDO: DESPUÉS de que el workflow haya publicado los cuatro cronos con la
 * plantilla cifrada (pestaña Actions en verde). Antes no: borraría ficheros que
 * el build vigente todavía usa, o competiría con el push del robot.
 *
 *   node --experimental-strip-types scripts/limpiar_gh_pages.mjs               # solo MIRA (por defecto)
 *   node --experimental-strip-types scripts/limpiar_gh_pages.mjs --aplicar     # + commit en una copia aparte
 *   node --experimental-strip-types scripts/limpiar_gh_pages.mjs --aplicar --subir
 *   …  --huerfana   con --subir: deja gh-pages en UN solo commit sin historia
 *                   (como el 24/11), para que los ficheros borrados no sigan en
 *                   la historia de la rama. Empuja con --force-with-lease.
 *   …  --carpetas crono,crono-filial   (por defecto las tres)
 *   …  --todos-los-viejos   borra también los no usados SIN nombres (por defecto,
 *                           solo los que llevan nombres reales)
 *
 * Qué es «lo que usa el build vigente»: se parte de las páginas (.html, .txt)
 * y del sw.js que tocó el ÚLTIMO commit «deploy <carpeta>: …» del robot, y se
 * siguen todas las referencias `static/…` de fichero en fichero. Lo que queda
 * fuera de esa red y está en `_next/` es viejo.
 *
 * Seguridad: nunca escribe un nombre (ni en pantalla ni en el commit); si un
 * fichero QUE SÍ USA el build vigente lleva un nombre, se para sin tocar nada
 * (sería que la plantilla cifrada no se publicó). Trabaja en una copia aparte
 * (git worktree temporal) y no toca la carpeta del repo.
 *
 * Necesita la plantilla privada (cargarRoster.mjs: ~/Desktop/Claude/pulso_secretos/).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buscarRosterPrivado, carpetaSecretos, CLIENTES_PRIVADOS } from "../cargarRoster.mjs";
import { ROSTER_DEMO } from "../src/lib/roster.ts";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const APLICAR = tiene("--aplicar");
const SUBIR = tiene("--subir");
const HUERFANA = tiene("--huerfana");
const TODOS = tiene("--todos-los-viejos");
const CARPETAS = (opcion("--carpetas") || "crono,crono-filial,crono-juvenil").split(",").map((s) => s.trim()).filter(Boolean);
if (SUBIR && !APLICAR) { console.error("--subir necesita --aplicar"); process.exit(2); }
if (HUERFANA && !SUBIR) { console.error("--huerfana necesita --subir"); process.exit(2); }

const git = (a, cwd = RAIZ) => execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });

// ── Qué buscar (los mismos criterios que sinNombresReales.test.ts) ──
const DEMO = new Set(ROSTER_DEMO.map((j) => j.nombre));
const nombres = new Set();
for (const c of CLIENTES_PRIVADOS) {
  const r = buscarRosterPrivado(c, { raiz: RAIZ });
  if (!r) { console.error(`⛔ Falta la plantilla privada de «${c}»: sin ella no sé qué buscar.`); process.exit(1); }
  for (const j of r.jugadores) if (!DEMO.has(j.nombre)) nombres.add(j.nombre);
}
const completos = [];
const fc = join(carpetaSecretos(), "nombres_filial.json");
if (existsSync(fc)) completos.push(...Object.values(JSON.parse(readFileSync(fc, "utf8"))));
const letra = "A-Za-zÀ-ÖØ-öø-ÿ";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const res = [
  ...[...nombres].map((n) => new RegExp(`(?<![${letra}])${esc(n)}(?![${letra}])`)),
  ...completos.map((n) => new RegExp(`(?<![${letra}])${esc(n)}(?![${letra}])`, "i")),
];
const BINARIO = /\.(png|jpe?g|gif|webp|ico|icns|pdf|woff2?|ttf|otf|mp4|mov|zip|gz)$/i;
const llevaNombres = (f) => {
  if (BINARIO.test(f)) return false;
  const t = readFileSync(f, "utf8");
  return res.some((re) => re.test(t)) || /\{\\?"dorsal\\?":\\?"\d/.test(t);
};

// ── Copia aparte de gh-pages ──
console.log("Bajando origin/gh-pages…");
git(["fetch", "origin", "gh-pages"]);
const base = git(["rev-parse", "origin/gh-pages"]).trim();
const copia = mkdtempSync(join(tmpdir(), "pulso-gh-pages-"));
git(["worktree", "add", "--detach", copia, base]);
const limpiarCopia = () => { try { git(["worktree", "remove", "--force", copia]); } catch { /* nada */ } };

try {
  const aBorrar = [];
  for (const carpeta of CARPETAS) {
    const dir = join(copia, carpeta);
    if (!existsSync(dir)) { console.log(`· ${carpeta}/: no existe en gh-pages, nada que hacer`); continue; }
    // Último despliegue del robot para esta carpeta.
    const ultimo = git(["log", "-1", "--format=%H", `--grep=^deploy ${carpeta}:`, base], copia).trim();
    if (!ultimo) throw new Error(`no encuentro ningún commit «deploy ${carpeta}: …» en gh-pages`);
    const tocados = git(["show", "--name-only", "--format=", ultimo], copia).split("\n").filter(Boolean);
    const raices = tocados
      .filter((f) => f.startsWith(`${carpeta}/`) && !f.includes("/_next/") && /\.(html|txt)$|\/sw\.js$/.test(f))
      .map((f) => join(copia, f))
      .filter((f) => existsSync(f));
    if (!raices.some((f) => f.endsWith("index.html"))) throw new Error(`${carpeta}: el último despliegue (${ultimo.slice(0, 7)}) no trae index.html`);

    // Red de referencias static/… desde las raíces.
    const usados = new Set();
    const pendientes = [...raices];
    const reRef = /static\/[A-Za-z0-9_\-.~@+]+(?:\/[A-Za-z0-9_\-.~@+]+)+/g;
    while (pendientes.length) {
      const f = pendientes.pop();
      if (usados.has(f)) continue;
      usados.add(f);
      if (BINARIO.test(f)) continue;
      for (const m of readFileSync(f, "utf8").matchAll(reRef)) {
        const r = join(dir, "_next", m[0]);
        if (!usados.has(r) && existsSync(r) && statSync(r).isFile()) pendientes.push(r);
      }
    }

    const enNext = [];
    const recorrer = (d) => {
      for (const e of readdirSync(d)) {
        const r = join(d, e);
        if (statSync(r).isDirectory()) recorrer(r); else enNext.push(r);
      }
    };
    if (existsSync(join(dir, "_next"))) recorrer(join(dir, "_next"));

    const usadosConNombres = [...usados].filter(llevaNombres);
    if (usadosConNombres.length) {
      throw new Error(`${carpeta}: ${usadosConNombres.length} fichero(s) que SÍ usa el build vigente llevan nombres en claro `
        + `(${usadosConNombres.map((f) => relative(copia, f)).join(", ")}). ¿Se publicó sin la plantilla cifrada? No toco nada.`);
    }
    const viejos = enNext.filter((f) => !usados.has(f));
    const conNombres = viejos.filter(llevaNombres);
    const estos = TODOS ? viejos : conNombres;
    console.log(`· ${carpeta}/ (último despliegue ${ultimo.slice(0, 7)}): ${usados.size} ficheros en uso, `
      + `${viejos.length} viejos sin usar, ${conNombres.length} de ellos con nombres reales → se borran ${estos.length}`);
    for (const f of estos) console.log(`    - ${relative(copia, f)}${conNombres.includes(f) ? "  (nombres)" : ""}`);
    aBorrar.push(...estos.map((f) => relative(copia, f)));
  }

  if (aBorrar.length === 0) { console.log("\nNada que borrar."); }
  else if (!APLICAR) { console.log(`\nSOLO MIRANDO: ${aBorrar.length} fichero(s). Para borrarlos: --aplicar (y --subir).`); }
  else {
    for (let i = 0; i < aBorrar.length; i += 200) git(["rm", "-q", "--", ...aBorrar.slice(i, i + 200)], copia);
    git(["-c", "user.name=github-actions[bot]", "-c", "user.email=github-actions[bot]@users.noreply.github.com",
      "commit", "-q", "-m", `Quitar ${aBorrar.length} ficheros viejos con la plantilla en claro (${CARPETAS.join(", ")})`], copia);
    console.log(`\nCommit hecho en la copia aparte (${copia}).`);
    if (SUBIR) {
      let sha = git(["rev-parse", "HEAD"], copia).trim();
      if (HUERFANA) {
        sha = git(["-c", "user.name=github-actions[bot]", "-c", "user.email=github-actions[bot]@users.noreply.github.com",
          "commit-tree", "HEAD^{tree}", "-m", "gh-pages: contenido vigente, sin historia (ficheros viejos con datos fuera)"], copia).trim();
      }
      // --force-with-lease: si el robot ha publicado mientras tanto, se para.
      git(["push", `--force-with-lease=gh-pages:${base}`, "origin", `${sha}:refs/heads/gh-pages`], copia);
      console.log(`Subido a gh-pages (${sha.slice(0, 7)}${HUERFANA ? ", huérfana" : ""}). GitHub Pages tarda 1-2 min.`);
      console.log("Comprueba después que los cuatro cronos cargan (200) y que el del Inter abre con la contraseña.");
    } else {
      console.log("No se ha subido nada (falta --subir).");
    }
  }
} catch (e) {
  console.error(`\n⛔ ${e.message}`);
  process.exitCode = 1;
} finally {
  if (!(APLICAR && !SUBIR)) limpiarCopia();
}
