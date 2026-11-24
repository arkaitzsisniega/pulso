/**
 * Saca las plantillas REALES del antiguo `src/lib/roster.ts` a ficheros
 * LOCALES fuera del repo, en el formato que espera `cargarRoster.mjs`
 * (24/11/2026). Se usa una vez, al pasar a plantillas privadas: lo que sale es
 * exactamente lo que hay que pegar en los secretos de GitHub.
 *
 *   node scripts/exportar_roster_privado.mjs                 # desde origin/main
 *   node scripts/exportar_roster_privado.mjs --ref <commit>  # desde otro commit
 *   node scripts/exportar_roster_privado.mjs --desde <ruta a un roster.ts viejo>
 *   …  --salida <carpeta>   (por defecto ~/Desktop/Claude/pulso_secretos)
 *
 * Escribe, con permisos solo para el usuario (carpeta 700, ficheros 600):
 *   roster_inter.json · roster_filial.json · roster_juvenil.json
 *   nombres_filial.json   (nombres completos del filial; NO va a ningún
 *                          secreto, solo para la guía en papel)
 *
 * No sobrescribe nada: si un fichero ya existe y es distinto, se para. Para
 * rehacerlo, se borra el fichero a mano. No imprime ningún nombre.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { carpetaSecretos, validarRoster } from "../cargarRoster.mjs";

const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const desde = opcion("--desde");
const ref = opcion("--ref") ?? "origin/main";
const salida = opcion("--salida") ?? carpetaSecretos();

const fuente = desde
  ? readFileSync(desde, "utf8")
  : execFileSync("git", ["show", `${ref}:src/lib/roster.ts`], { encoding: "utf8" });

/** El bloque `export const NOMBRE … = [ … ];` (o `{ … };`) del fichero. */
function bloque(nombre, cierre) {
  const ini = fuente.indexOf(`export const ${nombre}`);
  if (ini < 0) throw new Error(`No encuentro ${nombre} en el roster de origen (¿ya está limpio ese commit?)`);
  const fin = fuente.indexOf(cierre, ini);
  return fuente.slice(ini, fin);
}

function jugadores(nombre) {
  const re = /\{\s*dorsal:\s*"([^"]+)",\s*nombre:\s*"([^"]+)",\s*posicion:\s*"([^"]+)",\s*equipo:\s*"([^"]+)"\s*\}/g;
  return [...bloque(nombre, "];").matchAll(re)].map(([, dorsal, n, posicion, equipo]) => ({
    dorsal, nombre: n, posicion, equipo,
  }));
}

const PLANTILLAS = { inter: "ROSTER_REAL", filial: "ROSTER_FILIAL", juvenil: "ROSTER_JUVENIL" };

mkdirSync(salida, { recursive: true, mode: 0o700 });
chmodSync(salida, 0o700);

function guardar(fichero, datos) {
  const ruta = join(salida, fichero);
  const texto = JSON.stringify(datos, null, 2) + "\n";
  if (existsSync(ruta)) {
    if (readFileSync(ruta, "utf8") === texto) {
      console.log(`  = ${ruta} (ya estaba igual)`);
      return;
    }
    throw new Error(`${ruta} ya existe y es DISTINTO. No lo piso: bórralo a mano si quieres rehacerlo.`);
  }
  writeFileSync(ruta, texto, { mode: 0o600 });
  chmodSync(ruta, 0o600);
  console.log(`  + ${ruta}`);
}

console.log(`Plantillas desde ${desde ?? `${ref}:src/lib/roster.ts`} → ${salida}`);
for (const [cliente, constante] of Object.entries(PLANTILLAS)) {
  const datos = { cliente, jugadores: jugadores(constante) };
  validarRoster(datos, cliente, constante); // lanza si algo no cuadra
  guardar(`roster_${cliente}.json`, datos);
  console.log(`    ${datos.jugadores.length} jugadores`);
}

// Nombres completos del filial (antes NOMBRES_FILIAL; la app no los usa).
if (fuente.includes("export const NOMBRES_FILIAL")) {
  const re = /(?:"([^"]+)"|([A-Z]+)):\s*"([^"]+)"/g;
  const nombres = {};
  for (const [, conComillas, sinComillas, completo] of bloque("NOMBRES_FILIAL", "};").matchAll(re)) {
    nombres[conComillas ?? sinComillas] = completo;
  }
  guardar("nombres_filial.json", nombres);
}
console.log("Listo. Nada de esto va al repo: son los contenidos de los secretos.");
