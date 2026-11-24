/**
 * Plantilla CIFRADA (25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/plantillaCifrada.test.ts
 *
 * Vigila las dos mitades: lo que hace el build (cifrarPlantilla.mjs, con el
 * crypto de Node) y lo que hace el aparato (plantillaCifrada.ts, con Web
 * Crypto). Con la plantilla INVENTADA de la demo: aquí no hay ni un nombre real.
 *
 *   · con la contraseña buena se abre y sale la misma plantilla; con una mala,
 *     con el sobre de otro club o tocado, no;
 *   · la huella no cambia entre builds si la plantilla es la misma (y sí si
 *     cambia): el aparato no pide la contraseña en cada publicación;
 *   · el build se para sin contraseña o con una que no es la del club;
 *   · aparatos que ya estaban dentro con la versión vieja: «falta» → se pide
 *     una vez (o se sigue el partido a medias con su plantilla provisional);
 *   · clientes.ts y AuthGate ya no llevan ningún hash de los clubes cifrados.
 */
import { readFileSync } from "node:fs";
import { cifrarPlantilla, claveParaBuild, huellaPlantilla, verificador, sobreParaBuild, ITERACIONES } from "../../cifrarPlantilla.mjs";
import { ROSTER_DEMO } from "./roster.ts";
import {
  abrirSobre, claveAlmacen, estadoDe, guardarPlantilla, leerGuardada, leerSobre, plantillaDeUnPartido,
  type Sobre,
} from "./plantillaCifrada.ts";
import type { Partido } from "./db.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

const CLAVE = "contraseña-de-prueba";
// Pocas iteraciones en las pruebas de ida y vuelta (rápidas); una con las de
// verdad para comprobar que el aparato respeta las del sobre.
const rapido = (j = ROSTER_DEMO, cliente = "inter", clave = CLAVE) =>
  cifrarPlantilla(j, clave, cliente, { iter: 1000 }) as Sobre;

console.log("── 1 · Ida y vuelta: build (Node) → aparato (Web Crypto) ──");
{
  const s = rapido();
  const abierta = await abrirSobre(s, CLAVE);
  ok(JSON.stringify(abierta) === JSON.stringify(ROSTER_DEMO), "con la contraseña buena sale la misma plantilla, en el mismo orden");
  ok((await abrirSobre(s, "otra")) === null, "con una contraseña mala, null (no lanza)");
  ok((await abrirSobre(s, CLAVE.toUpperCase())) === null, "distingue mayúsculas");
  ok((await abrirSobre({ ...s, cliente: "filial" }, CLAVE)) === null, "un sobre del Inter no se abre como si fuera del filial");
  const tocado = Buffer.from(s.datos, "base64"); tocado[3] ^= 1;
  ok((await abrirSobre({ ...s, datos: tocado.toString("base64") }, CLAVE)) === null, "un sobre manipulado no se abre");
  const lento = cifrarPlantilla(ROSTER_DEMO, CLAVE, "inter") as Sobre;
  ok(lento.iter === ITERACIONES && ITERACIONES >= 200000, `iteraciones de PBKDF2 de verdad: ${ITERACIONES}`);
  ok(JSON.stringify(await abrirSobre(lento, CLAVE)) === JSON.stringify(ROSTER_DEMO), "con las iteraciones de verdad también abre");
  const otra = rapido();
  ok(otra.sal !== s.sal && otra.iv !== s.iv && otra.datos !== s.datos, "sal e iv nuevos en cada build");
  ok(!s.datos.includes("PRIETO") && !Buffer.from(s.datos, "base64").toString("latin1").includes("PRIETO"), "el sobre no lleva los nombres en claro");
  ok(leerSobre(JSON.stringify(s))?.huella === s.huella && leerSobre("") === null && leerSobre("{roto") === null, "leerSobre: bueno, vacío y roto");
}

console.log("── 2 · Huella: misma plantilla → misma huella ──");
{
  const a = rapido(), b = rapido();
  ok(a.huella === b.huella, "dos builds con la misma plantilla: misma huella (no se vuelve a pedir la contraseña)");
  const cambiada = ROSTER_DEMO.map((j, i) => (i === 0 ? { ...j, dorsal: "99" } : j));
  ok(huellaPlantilla(cambiada, "inter") !== a.huella, "si cambia un dorsal, cambia la huella");
  ok(huellaPlantilla(ROSTER_DEMO, "filial") !== a.huella, "la huella es por club");
  ok(rapido(ROSTER_DEMO, "inter", "otra-clave").huella === a.huella, "cambiar la contraseña no cambia la huella (la plantilla sigue valiendo)");
}

console.log("── 3 · El build se para sin contraseña o con una equivocada ──");
{
  const verificadores = { inter: verificador(CLAVE, "inter") };
  const sinSecretos = { PULSO_SECRETOS_DIR: "/nonexistent-pulso" };
  let msg = "";
  try { claveParaBuild("inter", { env: sinSecretos, verificadores }); } catch (e) { msg = (e as Error).message; }
  ok(msg.includes("NO HAY CONTRASEÑA") && msg.includes("CRONO_CLAVE_INTER"), "sin contraseña: para y dice el secreto que falta");
  msg = "";
  try { claveParaBuild("inter", { env: { ...sinSecretos, CRONO_CLAVE: "mala" }, verificadores }); } catch (e) { msg = (e as Error).message; }
  ok(msg.includes("NO es la del club") && !msg.includes("mala"), "contraseña equivocada: para, sin enseñarla");
  ok(claveParaBuild("inter", { env: { ...sinSecretos, CRONO_CLAVE_INTER: CLAVE + "\n" }, verificadores }).clave === CLAVE,
    "la buena pasa (y se le quita el salto de línea final del fichero o secreto)");
  ok(sobreParaBuild({ cliente: "pulso", jugadores: null }) === "", "la demo: sin sobre");
  const fuente = readFileSync(new URL("../../cifrarPlantilla.mjs", import.meta.url), "utf8");
  ok(!/__VERIFICADOR_/.test(fuente), "los tres clubes tienen su verificador puesto");
}

console.log("── 4 · El aparato: guardado y aparatos que ya estaban dentro ──");
{
  const mem = new Map<string, string>();
  const almacen = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const s = rapido();
  ok(estadoDe(null, null) === "abierta", "build sin sobre (demo): «abierta», nada que pedir");
  // Aparato del Inter que ya había entrado con la versión vieja: solo tiene esto.
  mem.set("inter_crono_auth", "1");
  ok(estadoDe(s, leerGuardada("inter", almacen)) === "falta", "ya entró con la versión vieja → «falta»: se pide la contraseña una vez");
  ok(claveAlmacen("inter") === "inter_crono_plantilla" && claveAlmacen("juvenil") === "juvenil_crono_plantilla", "una clave de almacenamiento por club");
  ok(guardarPlantilla("inter", { v: 1, huella: s.huella, jugadores: ROSTER_DEMO, el: 1 }, almacen), "se guarda");
  ok(estadoDe(s, leerGuardada("inter", almacen)) === "lista", "misma huella → «lista» (sin red, sin contraseña)");
  ok(leerGuardada("filial", almacen) === null, "lo del Inter no lo ve el filial");
  const otroBuild = rapido(ROSTER_DEMO.slice(1));
  ok(estadoDe(otroBuild, leerGuardada("inter", almacen)) === "vieja", "build con otra plantilla → «vieja»: se sigue usando la guardada y se avisa");
  mem.set("inter_crono_plantilla", "{basura");
  ok(leerGuardada("inter", almacen) === null, "si lo guardado está roto, como si no hubiera");
  ok(guardarPlantilla("inter", { v: 1, huella: "", jugadores: ROSTER_DEMO, el: 1 }, {
    getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); },
  }) === false, "si el navegador no deja guardar, devuelve false sin lanzar");
}

console.log("── 5 · Partido a medias: plantilla provisional ──");
{
  const p = {
    config: {
      convocados: ["PRIETO", "IBAÑEZ", "SOTO", "LARA"],
      pista_inicial: { portero: "PRIETO", pista1: "IBAÑEZ", pista2: "SOTO", pista3: "LARA", pista4: "" },
    },
    acciones: { porJugador: { LARA: { paradas: 2, golesEncajados: 0 }, SOTO: { paradas: 0, golesEncajados: 0 } } },
  } as unknown as Partido;
  const prov = plantillaDeUnPartido(p);
  ok(prov.map((j) => j.nombre).join() === "PRIETO,IBAÑEZ,SOTO,LARA", "los convocados del partido, con sus nombres canónicos");
  ok(prov.filter((j) => j.posicion === "PORTERO").map((j) => j.nombre).join() === "PRIETO,LARA", "porteros: el de inicio y el que tiene paradas");
  ok(prov.every((j) => j.dorsal === ""), "sin dorsales (el partido no los guarda)");
  const g = { v: 1 as const, huella: "", jugadores: prov, provisional: true, el: 1 };
  ok(estadoDe(rapido(), g) === "provisional", "guardada como provisional → «provisional» (aviso para poner la contraseña)");
  ok(plantillaDeUnPartido({ config: null } as unknown as Partido).length === 0, "partido sin configurar: vacía, no lanza");
}

console.log("── 6 · Ningún hash de los clubes cifrados en el código ──");
{
  const cl = leer("./clientes.ts");
  ok(!/HASH_(INTER|FILIAL|JUVENIL)\b/.test(cl), "clientes.ts ya no tiene HASH_INTER / HASH_FILIAL / HASH_JUVENIL");
  ok(/const PASS_HASHES: string\[\] =\n/.test(cl) && cl.includes('? [HASH_PULSO]'), "la demo sigue con su SHA-256 (y el ancla de alta_club.py intacta)");
  ok(/const ROSTER_ACTIVO: Jugador\[\] =\n/.test(cl), "el ancla de la plantilla para alta_club.py sigue");
  ok(!cl.includes("CRONO_ROSTER_PRIVADO"), "clientes.ts no lee la plantilla en claro");
  ok(cl.includes("process.env.CRONO_ROSTER_CIFRADO"), "clientes.ts lee el sobre");
  const nc = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  ok(!nc.includes("CRONO_ROSTER_PRIVADO") && nc.includes("CRONO_ROSTER_CIFRADO: sobre"), "next.config.ts mete el sobre, no la plantilla");
  const gate = readFileSync(new URL("../components/AuthGate.tsx", import.meta.url), "utf8");
  ok(gate.includes("abrirSobre") && gate.includes("PASS_HASHES_CLIENTE"), "AuthGate: abre el sobre (clubes) o compara el hash (demo)");
  ok(gate.includes('"desbloquear"') && gate.includes("seguirSinContrasena"), "AuthGate: pantalla de una vez + seguir el partido a medias");
  const editor = readFileSync(new URL("../components/EditorEventos.tsx", import.meta.url), "utf8");
  ok(!/^const NOMBRES\b/m.test(editor), "EditorEventos no congela la plantilla al cargar el módulo");
}

if (fallos) {
  console.log(`\n❌ ${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\n✅ Plantilla cifrada OK");
