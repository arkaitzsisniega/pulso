/**
 * Configuración POR CLIENTE del crono (multi-club).
 *
 * El cliente activo se fija en BUILD con la variable `NEXT_PUBLIC_CLIENTE`
 * (por defecto "inter"). El MISMO código sirve a todos los clubes: el del
 * Inter (`NEXT_PUBLIC_CLIENTE=inter`) y la demo comercial CD Pulso
 * (`NEXT_PUBLIC_CLIENTE=pulso`) salen del mismo árbol; solo cambia este
 * interruptor (y `CRONO_BASEPATH` para la ruta en GitHub Pages).
 *
 * Sustituye al antiguo `NEXT_PUBLIC_DEMO=1` (que solo distinguía Inter/demo):
 * ahora cada cliente define su roster, su marca, su idioma y su(s)
 * contraseña(s).
 *
 * ── Añadir un club nuevo ──────────────────────────────────────────────────
 *   1. Generar su contraseña y su hash:  printf %s "SU_PASSWORD" | shasum -a 256
 *   2. Añadir una entrada a CLIENTES con su nombre, roster, idioma y el hash.
 *   3. Su escudo: la imagen en `public/escudos/<id>.png` (PNG con fondo
 *      transparente, ~200 px de alto, que se lea en oscuro y en claro) y la
 *      línea `escudo: "escudos/<id>.png"` en su entrada. Nada más: las
 *      cabeceras, el informe del partido (escudo + `colorPropio.sol` como
 *      color), la ruta de cada build y el modo sin conexión salen solos.
 *   4. Desplegar con NEXT_PUBLIC_CLIENTE=<id> (+ CRONO_BASEPATH propio).
 *
 * Las contraseñas NUNCA se guardan en claro: solo su hash SHA-256 (igual que
 * el AuthGate), y SOLO viaja al bundle la del club que se está construyendo
 * (ver PASS_HASHES más abajo). Una por club por defecto; la lista admite
 * varias por si algún club quiere una por persona del cuerpo técnico.
 */
import { ROSTER_DEMO, type Jugador } from "@/lib/roster";
import { estadoDe, leerGuardada, leerSobre, type EstadoPlantilla, type PlantillaGuardada } from "@/lib/plantillaCifrada";
import type { ParColor } from "@/lib/tema";

export type IdiomaId = "es" | "en" | "it";

export interface ConfigCliente {
  /** id interno (= valor de NEXT_PUBLIC_CLIENTE). */
  id: string;
  /** Nombre corto para marcador y cabeceras (p.ej. "INTER", "PULSO"). */
  nombreCorto: string;
  /** Nombre largo del club (p.ej. "Inter JP Financial", "CD Pulso"). */
  nombreLargo: string;
  /** Marca para los títulos de Home/Login (p.ej. "Inter FS", "CD Pulso"). */
  marcaTitulo: string;
  /** Título de pestaña / PWA (metadata). P.ej. "Inter Crono", "Crono CD Pulso". */
  appTitulo: string;
  /**
   * Idioma fijo del cliente. Si se define, el crono va siempre en ese idioma y
   * NO se muestra el selector. Si es null, se muestra el selector (caso demo).
   */
  idiomaFijo: IdiomaId | null;
  /** true = nombres ficticios (grabar/enseñar); false = roster real. */
  demo: boolean;
  /** true = el informe del partido es el completo, igual que el del club y sin
   *  carga física (`components/InformeCompleto.tsx`). false = el de siempre
   *  (`app/informe/page.tsx`). El Inter y el filial van en false a propósito:
   *  su informe no se toca. */
  informeCompleto: boolean;
  /** true = la primera vez que se abre trae ya un partido de ejemplo guardado
   *  (`lib/partidoEjemplo.ts`). Solo la demo: el Inter y el filial, en false. */
  partidoEjemplo: boolean;
  /** Color de NUESTRO equipo en el aspecto nuevo del crono (marcador, nombre,
   *  dirección de ataque). Uno para el modo Pabellón (oscuro) y otro para el
   *  modo Sol (claro). El del rival sale solo (lib/tema.ts → elegirRival): es
   *  coral, salvo que el del club se le parezca. */
  colorPropio: ParColor;
  /** Aspecto con el que arranca el crono en un aparato que no lo ha elegido:
   *  "nuevo" (rediseño 16/11/2026) o "clasico" (el de siempre). Cada aparato
   *  lo cambia desde la pantalla de inicio y se le queda guardado. */
  aspectoPorDefecto: "nuevo" | "clasico";
  /** Escudo del club en las cabeceras del aspecto NUEVO (arriba a la
   *  izquierda), relativo a `public/`: p. ej. "escudos/inter-verde.png". UNA imagen
   *  para los dos modos (Pabellón y Sol), así que tiene que leerse sobre fondo
   *  oscuro y sobre claro. PNG con transparencia, ~200 px de alto como mucho.
   *  El aspecto clásico no lo usa. El informe del partido SÍ (21/11/2026),
   *  salvo en la demo, que lleva la marca PULSO: ver `lib/marca.ts`. */
  escudo: string;
  /** Opcional: otro escudo SOLO para el informe del partido (papel blanco),
   *  si el de las cabeceras no es el que mejor queda impreso. Sin esta línea,
   *  el informe usa `escudo`. Hoy ningún club la usa: desde el 25/11/2026 el
   *  Inter lleva su escudo oficial VERDE en todas partes, con el interior
   *  relleno de blanco para que se lea también en el modo Pabellón (oscuro). */
  escudoInforme?: string;
  /** Servidor de partidos del club (fase 2, 21/11/2026; lib/servidor.ts):
   *  true = cada partido se sube solo a `URL_SERVIDOR` en cuanto hay red y
   *  sale «Partidos del club» en el inicio. false = el crono de siempre, sin
   *  una sola petición al servidor. Se enciende club a club (demo → juvenil →
   *  filial → Inter, y el Inter con permiso): desde el 25/11/2026, la demo y el
   *  Inter (decisión de Arkaitz); filial y juvenil siguen sin servidor. */
  servidor: boolean;
}

/** Dónde vive el servidor de partidos (el mismo para todos los clubes: cada
 *  uno entra con su contraseña y solo ve lo suyo). Para probar en local:
 *  NEXT_PUBLIC_SERVIDOR_URL=http://127.0.0.1:8790 al construir. */
export const URL_SERVIDOR: string =
  (process.env.NEXT_PUBLIC_SERVIDOR_URL || "https://datos.pulso-futsal.com").replace(/\/+$/, "");

// Colores de club para el aspecto nuevo. El verde del Inter lo llevan los tres
// equipos del club; la demo, el azul de PULSO.
const VERDE_INTER: ParColor = { oscuro: "#34d27b", sol: "#0f7a43" };
const AZUL_PULSO: ParColor = { oscuro: "#4ea8ff", sol: "#0b5fd1" };

// Contraseñas. La contraseña en claro NO se escribe aquí, ni siquiera en un
// comentario — este repositorio es público y hasta el 31/8/2026 estaban aquí
// escritas.
//
// Cada club tiene la suya y son distintas a propósito: con la del filial NO se
// entra en el del primer equipo, ni al revés.
//
// · La DEMO (y un club dado de alta con scripts_dev/alta_club.py, con plantilla
//   pública): su SHA-256 aquí. Cambiar una:
//     printf %s "LA NUEVA" | shasum -a 256   → pegar aquí → desplegar.
// · Inter, filial y juvenil (plantilla real, CIFRADA desde el 25/11/2026):
//   NINGÚN hash aquí ni en el paquete. Su contraseña se comprueba abriendo la
//   plantilla cifrada (lib/plantillaCifrada.ts): si abre, es la buena. Un
//   SHA-256 se prueba a miles de millones por segundo y dejaría el cifrado en
//   nada. Cambiar una: ver cifrarPlantilla.mjs (VERIFICADORES) y
//   scripts/clave_club.mjs.
const HASH_PULSO =
  "397e2dbe0f909d0b308b380fd0b8d4848b15ea3720808b623c2e76cc381371e0";

const CLIENTES: Record<string, ConfigCliente> = {
  inter: {
    id: "inter",
    nombreCorto: "INTER",
    nombreLargo: "Inter JP Financial",
    marcaTitulo: "Inter FS",
    appTitulo: "Inter Crono",
    idiomaFijo: "es", // el Inter va siempre en español, sin selector
    demo: false,
    informeCompleto: false,
    partidoEjemplo: false,
    colorPropio: VERDE_INTER,
    aspectoPorDefecto: "clasico",
    escudo: "escudos/inter-verde.png", // el oficial VERDE, el mismo en los tres equipos del club
    servidor: true, // 25/11/2026: decisión de Arkaitz, el Inter sube al servidor (filial y juvenil, NO)
  },
  // Filial (28/8/2026). MISMO código que el Inter, otro build: su roster, su
  // contraseña, su URL (/crono-filial/) y su base local. No comparte NADA con
  // el crono del primer equipo, así que desde aquí no se puede tocar un partido
  // del Inter aunque se abra en el mismo navegador.
  filial: {
    id: "filial",
    nombreCorto: "FILIAL",
    nombreLargo: "Inter JP Financial B",
    marcaTitulo: "Inter FS · Filial",
    appTitulo: "Crono Filial",
    idiomaFijo: "es",
    demo: false,
    informeCompleto: false,
    partidoEjemplo: false,
    colorPropio: VERDE_INTER,
    aspectoPorDefecto: "clasico",
    escudo: "escudos/inter-verde.png", // el oficial VERDE, el mismo en los tres equipos del club
    servidor: false,
  },
  // Juvenil División de Honor (11/11/2026). Igual que el filial: mismo código,
  // otro build, con su plantilla, su contraseña, su URL (/crono-juvenil/) y su
  // base local ("crono_partido_juvenil"). Si comparte iPad con el filial, cada
  // uno ve solo sus partidos.
  juvenil: {
    id: "juvenil",
    nombreCorto: "JUVENIL",
    nombreLargo: "Inter JP Financial Juvenil",
    marcaTitulo: "Inter FS · Juvenil DH",
    appTitulo: "Crono Juvenil",
    idiomaFijo: "es",
    demo: false,
    informeCompleto: false,
    partidoEjemplo: false,
    colorPropio: VERDE_INTER,
    aspectoPorDefecto: "clasico",
    escudo: "escudos/inter-verde.png", // el oficial VERDE, el mismo en los tres equipos del club
    servidor: false,
  },
  pulso: {
    id: "pulso",
    nombreCorto: "PULSO",
    nombreLargo: "CD Pulso",
    marcaTitulo: "CD Pulso",
    appTitulo: "Crono CD Pulso",
    idiomaFijo: null, // la demo muestra el selector de idioma (es/en/it)
    demo: true,
    informeCompleto: true,
    partidoEjemplo: true,
    colorPropio: AZUL_PULSO,
    aspectoPorDefecto: "nuevo",
    escudo: "escudos/pulso.png", // la demo no es un club: lleva el logo de PULSO
    servidor: true, // 25/11/2026: la demo es la primera con servidor
  },
};

/**
 * Roster del cliente ACTIVO.
 *
 * La plantilla REAL (Inter, filial, juvenil) ya no está en el código: el
 * repositorio es público (decisión de Arkaitz, 23/11/2026). Y desde el
 * 25/11/2026 tampoco va EN CLARO en el paquete publicado: `next.config.ts` la
 * mete CIFRADA (SOBRE_PLANTILLA, abajo) y solo la del club que se construye.
 * Para esos clubes ROSTER_ACTIVO empieza vacío y lo rellena la plantilla que el
 * aparato abrió con la contraseña (instalarPlantilla). Sin plantilla o sin
 * contraseña el build ni empieza (lo para next.config.ts).
 *
 * Con ternario sobre `process.env.NEXT_PUBLIC_CLIENTE`, por el mismo motivo que
 * PASS_HASHES (justo debajo): en la demo se pliega y solo queda ROSTER_DEMO; en
 * los otros, ROSTER_DEMO no viaja.
 *
 * (25/9/2026: cuando los rosters iban dentro de CLIENTES, el paquete de la DEMO
 * llevaba la plantilla real entera. No se veía en pantalla, pero cualquiera que
 * abriese los ficheros del sitio la leía.)
 */
const ROSTER_ACTIVO: Jugador[] =
  process.env.NEXT_PUBLIC_CLIENTE === "pulso"
    ? ROSTER_DEMO
    : [];

/**
 * Plantilla CIFRADA de este build (25/11/2026; revisión legal del 24/11).
 *
 * Desde el 25/11 la plantilla real ya NO viaja en claro: `next.config.ts` mete
 * en `process.env.CRONO_ROSTER_CIFRADO` un sobre cifrado con la contraseña del
 * club (cifrarPlantilla.mjs). El aparato lo abre al entrar (AuthGate) y se
 * guarda la plantilla abierta en su localStorage; desde ahí, en cada arranque,
 * se rellena ROSTER aquí mismo, al cargar este módulo y ANTES que ningún otro,
 * así que todo lo que lo usa (con red o sin ella) la encuentra ya puesta. En la
 * demo el sobre va vacío y ROSTER es ROSTER_DEMO, como siempre.
 */
export const SOBRE_PLANTILLA = leerSobre(process.env.CRONO_ROSTER_CIFRADO || "");

/**
 * Hashes de contraseña del cliente ACTIVO.
 *
 * Va aparte del registro CLIENTES y con ternarios sobre
 * `process.env.NEXT_PUBLIC_CLIENTE` a propósito: Next sustituye esa variable
 * por un literal en build, el minificador pliega el ternario y los hashes de
 * los OTROS clubes desaparecen del bundle. Metidos dentro de CLIENTES viajaban
 * todos en todos los builds — comprobado el 28/8: el build del filial llevaba
 * dentro el hash del Inter, y una contraseña corta se saca de un SHA-256 con un
 * diccionario en un rato. Cada club se lleva solo el suyo.
 */
const PASS_HASHES: string[] =
  process.env.NEXT_PUBLIC_CLIENTE === "pulso"
    ? [HASH_PULSO]
    : []; // Inter, filial y juvenil: sin hash, se comprueba abriendo SOBRE_PLANTILLA

const _ID = (process.env.NEXT_PUBLIC_CLIENTE || "inter").toLowerCase();

/** id del cliente activo (fijado en build). */
export const CLIENTE_ID: string = CLIENTES[_ID] ? _ID : "inter";

/** Nombre largo de un club por su id (o el id tal cual si no es de aquí).
 *  Para decir de quién es un fichero que no se puede abrir en este crono. */
export function nombreClub(id: string): string {
  return CLIENTES[id]?.nombreLargo ?? id;
}

/** Configuración del cliente activo. Fallback a Inter si el id no existe. */
export const CLIENTE: ConfigCliente = CLIENTES[_ID] ?? CLIENTES.inter;

/** ¿Sube este crono los partidos al servidor? Lo dice `servidor` del club.
 *  NEXT_PUBLIC_SERVIDOR=1 lo enciende en un build de PRUEBA (local) sin tocar
 *  la tabla; el workflow de publicar no la pone nunca. */
export const SERVIDOR_ACTIVO: boolean =
  CLIENTE.servidor || process.env.NEXT_PUBLIC_SERVIDOR === "1";

// Roster activo y derivados (lo que consumen los componentes). Reemplaza a los
// antiguos exports de `roster.ts` (que ahora solo guarda los datos crudos).
// Sale de ROSTER_ACTIVO y NO de CLIENTE.roster: ver el comentario de arriba.
export const ROSTER: Jugador[] = ROSTER_ACTIVO;

/** Hashes SHA-256 válidos para el login de ESTE build (ver PASS_HASHES).
 *  Vacío en los clubes con plantilla cifrada. */
export const PASS_HASHES_CLIENTE: string[] = PASS_HASHES;
export const PORTEROS: Jugador[] = ROSTER.filter((j) => j.posicion === "PORTERO");
export const CAMPO: Jugador[] = ROSTER.filter((j) => j.posicion === "CAMPO");

/**
 * Pone una plantilla en ROSTER / PORTEROS / CAMPO SIN cambiar los arrays (se
 * vacían y se rellenan): los módulos que ya los importaron ven la nueva.
 * Solo tiene sentido en los clubes con plantilla cifrada.
 */
export function instalarPlantilla(jugadores: Jugador[]): void {
  if (!SOBRE_PLANTILLA) return;
  ROSTER.splice(0, ROSTER.length, ...jugadores);
  PORTEROS.splice(0, PORTEROS.length, ...jugadores.filter((j) => j.posicion === "PORTERO"));
  CAMPO.splice(0, CAMPO.length, ...jugadores.filter((j) => j.posicion === "CAMPO"));
}

/** Estado de la plantilla en este aparato (ver lib/plantillaCifrada.ts). */
export function estadoPlantilla(): EstadoPlantilla {
  return estadoDe(SOBRE_PLANTILLA, leerGuardada(CLIENTE_ID));
}

/** La guardada en el aparato (o null). */
export function plantillaGuardada(): PlantillaGuardada | null {
  return SOBRE_PLANTILLA ? leerGuardada(CLIENTE_ID) : null;
}

// Al cargar el módulo (solo en el navegador): la plantilla que ya tenga
// guardada el aparato, para que esté en ROSTER antes de pintar nada.
if (SOBRE_PLANTILLA && typeof window !== "undefined") {
  const g = leerGuardada(CLIENTE_ID);
  if (g) instalarPlantilla(g.jugadores);
}

/**
 * Variante title-case del nombre corto para etiquetas dentro de texto normal
 * (p.ej. "Inter ataca →" del campo, tooltip de gol del resumen). Deriva de
 * nombreCorto: "INTER" → "Inter", "PULSO" → "Pulso". El nombre corto en
 * MAYÚSCULAS (CLIENTE.nombreCorto) se sigue usando en el marcador y en
 * "Stats INTER" (donde el original iba en mayúsculas).
 */
export const NOMBRE_CORTO_TC: string =
  CLIENTE.nombreCorto.charAt(0).toUpperCase() +
  CLIENTE.nombreCorto.slice(1).toLowerCase();

/**
 * Versión desplegada, para poder MIRAR qué build tiene el iPad.
 *
 * El 30/8/2026 Arkaitz echó en falta tres cambios que llevaban desplegados
 * desde el 22: su iPad servía un crono viejo desde la caché y no había forma
 * de saberlo sin ponerse a comparar. Con esto se ve en la pantalla de inicio.
 * La inyecta el workflow al construir (NEXT_PUBLIC_VERSION = SHA del commit);
 * en local queda "dev".
 */
export const VERSION_CRONO: string =
  (process.env.NEXT_PUBLIC_VERSION || "dev").slice(0, 7);

