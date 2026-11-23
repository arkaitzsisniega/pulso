/**
 * Test de las PANTALLAS VACÍAS con el aspecto nuevo (23/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/pantallaVacia.test.ts
 *
 * «No hay partido en curso» (directo), «No hay partido para resumir»
 * (resumen), «No hay ningún partido abierto» (los dos informes) y sus
 * «Cargando…» salían con el dibujo antiguo. Aquí se vigila, leyendo el código:
 *   1. Cada una de esas páginas pinta PantallaVacia / PantallaCargando con el
 *      aspecto nuevo, ANTES del dibujo clásico.
 *   2. Todas tienen una salida clara al inicio y otra a empezar partido.
 *   3. Los textos nuevos existen en es / en / it.
 *   4. El CSS existe, respeta el modo Sol y no usa color-mix (iPads viejos).
 */
import { readFileSync } from "node:fs";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  console.log(`  ❌ ${msg}`); fallos++;
}
const leer = (r: string) => readFileSync(new URL(r, import.meta.url), "utf8");

const comp = leer("../components/PantallaVacia.tsx");
ok(/className=\{`pz pz-vac/.test(comp), "la pantalla vive bajo .pz (tema nuevo)");
ok(/data-tema=\{props\.sol \? "sol" : undefined\}/.test(comp) && /useModoSol\(\)/.test(comp), "respeta el modo Sol");
ok(/<BotonSol /.test(comp), "trae el botón del modo Sol");
ok(/SALIDA_INICIO[^=]*= \{ href: "\/"/.test(comp) && /SALIDA_NUEVO[^=]*= \{ href: "\/nuevo"/.test(comp),
  "las dos salidas van al inicio y a partido nuevo");
ok(/<Link href=\{p\.href\}/.test(comp) && /<Link href=\{s\.href\}/.test(comp), "las salidas son enlaces (sin red funcionan)");

const paginas: [string, string, string][] = [
  ["../app/partido/page.tsx", "part_no_en_curso", "vac_part_ayuda"],
  ["../app/resumen/page.tsx", "res_no_partido", "vac_res_ayuda"],
  ["../app/informe/page.tsx", "inf_sin_partido", "vac_inf_ayuda"],
  ["../components/InformeCompleto.tsx", "inf_sin_partido", "vac_inf_ayuda"],
];
for (const [ruta, titulo, ayuda] of paginas) {
  const src = leer(ruta);
  const iVacia = src.indexOf(`titulo="${titulo}"`);
  const iClasico = src.indexOf(`{t("${titulo}")}`) >= 0 ? src.indexOf(`{t("${titulo}")}`) : src.indexOf(`{T("${titulo}")}`);
  ok(iVacia > 0 && src.includes(`ayuda="${ayuda}"`), `${ruta}: PantallaVacia con «${titulo}»`);
  ok(iClasico < 0 || iVacia < iClasico, `${ruta}: la nueva va antes que la clásica`);
  ok(/principal=\{SALIDA_(INICIO|NUEVO)\} secundaria=\{SALIDA_(INICIO|NUEVO)\}/.test(src)
    && src.includes("SALIDA_INICIO") && src.includes("SALIDA_NUEVO"), `${ruta}: salida al inicio y a empezar partido`);
  ok(/<PantallaCargando/.test(src), `${ruta}: «Cargando…» nuevo`);
}
ok(/<PantallaCargando/.test(leer("../components/AuthGate.tsx")), "AuthGate: «Cargando…» nuevo");
// Directo: lo principal es empezar; resumen e informe: volver a elegir partido.
ok(/titulo="part_no_en_curso"[\s\S]{0,120}principal=\{SALIDA_NUEVO\}/.test(leer("../app/partido/page.tsx")),
  "en el directo, lo principal es empezar partido");

const i18n = leer("./i18n.ts");
for (const k of ["vac_empezar", "vac_part_ayuda", "vac_res_ayuda", "vac_inf_ayuda"]) {
  const m = i18n.match(new RegExp(`\\n  ${k}: \\{([^\\n]*)\\},`));
  ok(!!m && /es: "/.test(m[1]) && /en: "/.test(m[1]) && /it: "/.test(m[1]), `texto ${k} en es/en/it`);
}

const css = leer("../app/tema-nuevo.css");
const bloque = css.slice(css.indexOf(".pz-vac {"));
ok(css.includes(".pz-vac {") && css.includes(".pz-vac-btn.lleno"), "CSS de la pantalla vacía");
ok(/\.pz-vac-btn\.lleno \{[^}]*var\(--nos\)/.test(css), "el botón principal va con el color del club");
ok(!/color-mix\(/.test(bloque), "sin color-mix (Safari < 16.2)");
ok(/100vh/.test(bloque) && /100dvh/.test(bloque), "alto con dvh y su red para Safari < 15.4");

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
