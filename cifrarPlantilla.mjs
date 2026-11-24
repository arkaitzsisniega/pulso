/**
 * Plantilla CIFRADA en el paquete publicado (25/11/2026, revisión legal del
 * 24/11, RGPD art. 25.2).
 *
 * Hasta ahora la plantilla real (nombres y dorsales) salía del secreto del
 * club (cargarRoster.mjs) y se metía EN CLARO en los ficheros JS de la web
 * publicada: cualquiera que abriese esos ficheros la leía, aunque la app pida
 * contraseña. Ahora el build la mete CIFRADA con una clave que sale de la
 * contraseña del club (la misma con la que se entra al crono):
 *
 *   clave   = PBKDF2-SHA256(contraseña, sal aleatoria de 16 bytes, ITERACIONES)
 *   sobre   = AES-256-GCM(clave, iv aleatorio de 12 bytes, JSON de la plantilla,
 *                         datos asociados "pulso-plantilla-v1:<cliente>")
 *
 * El aparato lo abre con Web Crypto al entrar con la contraseña
 * (src/lib/plantillaCifrada.ts) y se guarda la plantilla ya abierta en su
 * almacenamiento local, para seguir funcionando sin red.
 *
 * La contraseña EN CLARO solo la ve el build. Sale, por este orden:
 *   1. la variable `CRONO_CLAVE_<CLIENTE>` (p. ej. CRONO_CLAVE_INTER);
 *   2. la variable `CRONO_CLAVE` (la pone el workflow desde el secreto del club);
 *   3. el fichero `clave_<cliente>.txt` de la carpeta de secretos
 *      (~/Desktop/Claude/pulso_secretos/ o PULSO_SECRETOS_DIR).
 * Antes de cifrar se comprueba contra el VERIFICADOR del club (abajo): si el
 * secreto tiene una errata, el build se para en vez de publicar un crono en el
 * que nadie podría entrar.
 *
 * El verificador NO es el SHA-256 de siempre: un SHA-256 se prueba a miles de
 * millones de contraseñas por segundo y anularía el cifrado. Es un PBKDF2 con
 * las mismas iteraciones que la clave, así que no es más fácil de atacar que
 * el propio sobre.
 *
 * JavaScript plano (.mjs), como cargarRoster.mjs: lo cargan next.config.ts,
 * los tests (node --experimental-strip-types) y los scripts.
 */
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { carpetaSecretos } from "./cargarRoster.mjs";

/** Versión del formato del sobre. */
export const VERSION_SOBRE = 1;

/** Iteraciones de PBKDF2-SHA256 (lo que recomienda OWASP en 2023+). En un iPad
 *  son unas décimas de segundo, y solo al entrar. */
export const ITERACIONES = 600000;

/** Verificadores de contraseña por club: PBKDF2-SHA256(contraseña,
 *  "pulso-verificador-v1:<cliente>", ITERACIONES, 32 bytes) en hex.
 *  Cambiar la contraseña de un club:
 *    node scripts/clave_club.mjs <cliente>      (la pide sin enseñarla)
 *  → pegar aquí lo que imprime, poner la nueva en su secreto y publicar. */
export const VERIFICADORES = {
  inter: "8809dbb2d320953f8a66fabe66da345f4aa56370724cd381d34492f9506ec2f6",
  filial: "62b78d048e874f8a9958c87339d7f72db61ed16c71935e43899f61118ffb08a2",
  juvenil: "ba0f2f700b92b2fa4042d7b2950721143822322aae80aed716091175e28a341b",
};

const b64 = (buf) => Buffer.from(buf).toString("base64");

/** Datos asociados del AES-GCM: un sobre del filial no se abre en el Inter. */
export function datosAsociados(cliente) {
  return `pulso-plantilla-v1:${cliente}`;
}

export function verificador(clave, cliente) {
  return pbkdf2Sync(clave, `pulso-verificador-v1:${cliente}`, ITERACIONES, 32, "sha256").toString("hex");
}

/** Forma única de la plantilla (mismo orden de campos siempre). */
export function plantillaCanonica(jugadores) {
  return JSON.stringify(jugadores.map(({ dorsal, nombre, posicion, equipo }) => ({ dorsal, nombre, posicion, equipo })));
}

/**
 * Huella de la plantilla: dice al aparato si la plantilla de este build es la
 * MISMA que ya tiene guardada (y entonces no hace falta pedir la contraseña
 * tras actualizar). No depende de la sal ni del iv, que cambian en cada build.
 * PBKDF2 con las mismas iteraciones: comprobar una plantilla adivinada entera
 * cuesta lo mismo que probar una contraseña.
 */
export function huellaPlantilla(jugadores, cliente) {
  return pbkdf2Sync(plantillaCanonica(jugadores), `pulso-huella-v1:${cliente}`, ITERACIONES, 16, "sha256").toString("hex");
}

/**
 * Cifra la plantilla. Devuelve el sobre (objeto JSON) que viaja en el paquete:
 * { v, cliente, iter, sal, iv, datos, huella } — sal, iv y datos en base64;
 * `datos` = texto cifrado seguido de la etiqueta GCM de 16 bytes (el formato
 * que espera Web Crypto).
 */
export function cifrarPlantilla(jugadores, clave, cliente, { sal = randomBytes(16), iv = randomBytes(12), iter = ITERACIONES } = {}) {
  const k = pbkdf2Sync(clave, sal, iter, 32, "sha256");
  const c = createCipheriv("aes-256-gcm", k, iv);
  c.setAAD(Buffer.from(datosAsociados(cliente), "utf8"));
  const cuerpo = Buffer.concat([c.update(plantillaCanonica(jugadores), "utf8"), c.final()]);
  const datos = Buffer.concat([cuerpo, c.getAuthTag()]);
  return {
    v: VERSION_SOBRE,
    cliente,
    iter,
    sal: b64(sal),
    iv: b64(iv),
    datos: b64(datos),
    huella: huellaPlantilla(jugadores, cliente),
  };
}

/** Busca la contraseña en claro de un club. { clave, origen } o null. */
export function buscarClave(cliente, { env = process.env } = {}) {
  const propia = `CRONO_CLAVE_${cliente.toUpperCase()}`;
  const limpia = (s) => s.replace(/\r?\n$/, "");
  if (env[propia]) return { clave: limpia(env[propia]), origen: `variable ${propia}` };
  if (env.CRONO_CLAVE) return { clave: limpia(env.CRONO_CLAVE), origen: "variable CRONO_CLAVE" };
  const f = join(carpetaSecretos(env), `clave_${cliente}.txt`);
  if (existsSync(f)) return { clave: limpia(readFileSync(f, "utf8")), origen: f };
  return null;
}

/** La contraseña del club que se construye, comprobada. Lanza si falta o no
 *  coincide con su verificador. */
export function claveParaBuild(cliente, { env = process.env, verificadores = VERIFICADORES } = {}) {
  const r = buscarClave(cliente, { env });
  if (!r || !r.clave) {
    throw new Error(
      [
        "",
        `⛔ NO HAY CONTRASEÑA para cifrar la plantilla del crono «${cliente}».`,
        "   La plantilla real ya no se publica en claro: va cifrada con la contraseña del",
        "   club, y sin ella no se construye. Se le da al build por UNA de estas vías:",
        `     · en GitHub Actions: el secreto CRONO_CLAVE_${cliente.toUpperCase()};`,
        `     · en este ordenador: ${join(carpetaSecretos(env), `clave_${cliente}.txt`)} (una línea).`,
        "",
      ].join("\n"),
    );
  }
  const esperado = verificadores[cliente];
  if (!esperado || esperado.startsWith("__")) {
    throw new Error(`⛔ El club «${cliente}» no tiene verificador de contraseña en cifrarPlantilla.mjs (node scripts/clave_club.mjs ${cliente}).`);
  }
  if (verificador(r.clave, cliente) !== esperado) {
    throw new Error(
      `⛔ La contraseña de «${cliente}» (${r.origen}) NO es la del club: no coincide con su verificador.\n` +
        "   ¿Errata en el secreto? Si la habéis cambiado a propósito, actualiza VERIFICADORES en\n" +
        `   cifrarPlantilla.mjs con: node scripts/clave_club.mjs ${cliente}`,
    );
  }
  return r;
}

/**
 * Lo que usa next.config.ts: el sobre en texto, o "" para la demo. Lo deja en
 * `process.env.__CRONO_SOBRE_<CLIENTE>` para que, si Next vuelve a cargar la
 * configuración en otro proceso del mismo build, todos usen el MISMO sobre
 * (si no, cada uno sortearía su sal y su iv).
 */
export function sobreParaBuild(plantilla, { env = process.env } = {}) {
  if (!plantilla.jugadores) return "";
  const cache = `__CRONO_SOBRE_${plantilla.cliente.toUpperCase()}`;
  if (env[cache]) return env[cache];
  const { clave } = claveParaBuild(plantilla.cliente, { env });
  const sobre = JSON.stringify(cifrarPlantilla(plantilla.jugadores, clave, plantilla.cliente));
  env[cache] = sobre;
  return sobre;
}
