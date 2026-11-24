/**
 * Plantillas PRIVADAS del crono (24/11/2026).
 *
 * Decisión de Arkaitz (23/11): la plantilla real del Inter, del filial y del
 * juvenil NO vive en el código público. Este repositorio solo trae plantillas
 * INVENTADAS de ejemplo (`roster-privado.ejemplo/`); la de verdad se le da al
 * build desde fuera y `next.config.ts` la mete en el paquete de ESE club (y
 * solo de ese club), igual que hasta ahora.
 *
 * De dónde sale, por este orden (gana la primera que exista):
 *   1. La variable `CRONO_ROSTER_JSON_<CLIENTE>` (p. ej. CRONO_ROSTER_JSON_INTER).
 *   2. La variable `CRONO_ROSTER_JSON` — la que pone el workflow de GitHub
 *      Actions desde el secreto del club que está construyendo.
 *   3. El fichero `roster-privado/<cliente>.json` dentro del repo (está en
 *      .gitignore: nunca se sube).
 *   4. El fichero `roster_<cliente>.json` de la carpeta de secretos, por
 *      defecto `~/Desktop/Claude/pulso_secretos/` (o `PULSO_SECRETOS_DIR`).
 *      Es la que sirve a la vez a la carpeta principal y a todas las copias
 *      de trabajo (worktrees), que no comparten los ficheros ignorados.
 *
 * El contenido es siempre el mismo JSON:
 *   { "cliente": "inter", "jugadores": [ { "dorsal": "1", "nombre": "…",
 *     "posicion": "PORTERO" | "CAMPO", "equipo": "PRIMER" | "FILIAL" }, … ] }
 * El campo "cliente" está a propósito: si alguien conecta el secreto del
 * filial al build del Inter, el build se para en vez de publicar un crono del
 * Inter con la plantilla del filial.
 *
 * Sin plantilla, el build del Inter, del filial o del juvenil FALLA con un
 * mensaje claro: jamás se publica un crono de un club con nombres inventados
 * en silencio. La demo (`pulso`) no necesita nada: sus nombres son inventados
 * y viven en `src/lib/roster.ts` (ROSTER_DEMO).
 *
 * Es JavaScript plano (.mjs) para que lo puedan cargar a la vez
 * `next.config.ts`, los tests (`node --experimental-strip-types`) y los
 * scripts, sin compilar nada.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Clientes cuya plantilla es real y por tanto privada. */
export const CLIENTES_PRIVADOS = ["inter", "filial", "juvenil"];

/** El cliente de la demo: nombres inventados, en el código. */
export const CLIENTE_DEMO = "pulso";

/** Carpeta de secretos fuera del repo. */
export function carpetaSecretos(env = process.env) {
  return env.PULSO_SECRETOS_DIR || join(homedir(), "Desktop", "Claude", "pulso_secretos");
}

/**
 * Mismo criterio que `src/lib/clientes.ts` para saber qué plantilla usa un
 * build: "pulso" → la demo; "filial" y "juvenil" → la suya; cualquier otra
 * cosa (incluido nada) → la del Inter.
 */
export function clienteDeLaPlantilla(valor) {
  if (valor === CLIENTE_DEMO) return CLIENTE_DEMO;
  if (valor === "filial" || valor === "juvenil") return valor;
  return "inter";
}

const POSICIONES = new Set(["PORTERO", "CAMPO"]);
const EQUIPOS = new Set(["PRIMER", "FILIAL"]);

/**
 * Comprueba la forma del JSON y devuelve la lista de jugadores, limpia y en el
 * mismo orden. Lanza un Error con un mensaje en castellano si algo no cuadra.
 */
export function validarRoster(datos, cliente, origen = "la plantilla") {
  const mal = (m) => new Error(`Plantilla privada de «${cliente}» (${origen}): ${m}`);
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    throw mal('tiene que ser un objeto { "cliente": …, "jugadores": [ … ] }');
  }
  if (datos.cliente !== cliente) {
    throw mal(`dice que es del cliente «${datos.cliente}», no de «${cliente}». ¿Secreto equivocado?`);
  }
  if (!Array.isArray(datos.jugadores) || datos.jugadores.length === 0) {
    throw mal("no trae jugadores");
  }
  const vistos = new Set();
  const jugadores = datos.jugadores.map((j, i) => {
    const donde = `jugador nº ${i + 1}`;
    if (!j || typeof j !== "object") throw mal(`${donde}: no es un objeto`);
    const { dorsal, nombre, posicion, equipo } = j;
    if (typeof dorsal !== "string" || !/^\d{1,3}$/.test(dorsal)) {
      throw mal(`${donde}: el dorsal tiene que ser un texto con el número ("7", "01")`);
    }
    if (typeof nombre !== "string" || !nombre.trim() || nombre !== nombre.trim()) {
      throw mal(`${donde}: falta el nombre o lleva espacios a los lados`);
    }
    if (!POSICIONES.has(posicion)) throw mal(`${donde}: la posición es PORTERO o CAMPO`);
    if (!EQUIPOS.has(equipo)) throw mal(`${donde}: el equipo es PRIMER o FILIAL`);
    if (vistos.has(nombre)) throw mal(`${donde}: el nombre está repetido`);
    vistos.add(nombre);
    return { dorsal, nombre, posicion, equipo };
  });
  if (!jugadores.some((j) => j.posicion === "PORTERO")) throw mal("no hay ningún portero");
  return jugadores;
}

function leerJSON(texto, cliente, origen) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    throw new Error(`Plantilla privada de «${cliente}» (${origen}): no es un JSON válido (${e.message})`);
  }
  return validarRoster(datos, cliente, origen);
}

/**
 * Busca la plantilla privada de un cliente. Devuelve { jugadores, origen } o
 * null si no la encuentra en ningún sitio. Si la encuentra pero está mal,
 * lanza (una plantilla rota no se arregla sola usando otra).
 */
export function buscarRosterPrivado(cliente, { env = process.env, raiz = process.cwd() } = {}) {
  const propia = `CRONO_ROSTER_JSON_${cliente.toUpperCase()}`;
  if (env[propia]) return { jugadores: leerJSON(env[propia], cliente, `variable ${propia}`), origen: `variable ${propia}` };
  if (env.CRONO_ROSTER_JSON) {
    return { jugadores: leerJSON(env.CRONO_ROSTER_JSON, cliente, "variable CRONO_ROSTER_JSON"), origen: "variable CRONO_ROSTER_JSON" };
  }
  const ficheros = [
    join(raiz, "roster-privado", `${cliente}.json`),
    join(carpetaSecretos(env), `roster_${cliente}.json`),
  ];
  for (const f of ficheros) {
    if (existsSync(f)) return { jugadores: leerJSON(readFileSync(f, "utf8"), cliente, f), origen: f };
  }
  return null;
}

/**
 * Lo que necesita `next.config.ts`: la plantilla del cliente que se está
 * construyendo, o null para la demo. Sin plantilla privada, lanza.
 */
export function rosterParaBuild({ env = process.env, raiz = process.cwd() } = {}) {
  const cliente = clienteDeLaPlantilla(env.NEXT_PUBLIC_CLIENTE);
  if (cliente === CLIENTE_DEMO) return { cliente, jugadores: null, origen: "demo (inventada, en el código)" };
  const r = buscarRosterPrivado(cliente, { env, raiz });
  if (!r) {
    throw new Error(
      [
        "",
        `⛔ NO HAY PLANTILLA para el crono «${cliente}» y no se construye sin ella.`,
        "   La plantilla real no está en el código (es público). Se le da al build por",
        "   UNA de estas vías:",
        `     · en GitHub Actions: el secreto ROSTER_${cliente.toUpperCase()} (ver README, «Plantillas privadas»);`,
        `     · en este ordenador: ${join(carpetaSecretos(env), `roster_${cliente}.json`)}`,
        `       o ${join(raiz, "roster-privado", `${cliente}.json`)} (ignorado por git).`,
        "   El formato está en roster-privado.ejemplo/. Para la demo: NEXT_PUBLIC_CLIENTE=pulso.",
        "",
      ].join("\n"),
    );
  }
  return { cliente, ...r };
}
