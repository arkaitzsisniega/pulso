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
 *   3. Desplegar con NEXT_PUBLIC_CLIENTE=<id> (+ CRONO_BASEPATH propio).
 *
 * Las contraseñas NUNCA se guardan en claro: solo su hash SHA-256 (igual que
 * el AuthGate), y SOLO viaja al bundle la del club que se está construyendo
 * (ver PASS_HASHES más abajo). Una por club por defecto; la lista admite
 * varias por si algún club quiere una por persona del cuerpo técnico.
 */
import {
  ROSTER_REAL,
  ROSTER_DEMO,
  ROSTER_FILIAL,
  type Jugador,
} from "@/lib/roster";

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
  /** Roster de jugadores de este cliente. */
  roster: Jugador[];
  /**
   * Idioma fijo del cliente. Si se define, el crono va siempre en ese idioma y
   * NO se muestra el selector. Si es null, se muestra el selector (caso demo).
   */
  idiomaFijo: IdiomaId | null;
  /** true = nombres ficticios (grabar/enseñar); false = roster real. */
  demo: boolean;
}

// SHA-256 de "inter1977" — contraseña histórica del Inter (se mantiene).
const HASH_INTER =
  "2198c9c222da8099db935f222ae09b1b74ffc1d0ccdbfcc830456ab0c07a013d";
// SHA-256 de "pulsodemo2026" — contraseña de la demo comercial CD Pulso.
const HASH_PULSO =
  "e1152d88d11a421c08846c836010ca89d156a9ce9721226ef9784285a5899b32";
// SHA-256 de "filial2026" — contraseña del crono del FILIAL. Distinta a
// propósito: con ella NO se entra en el del primer equipo (ni al revés), que es
// justo lo que pidió Arkaitz. Cambiarla = generar otro hash y volver a
// desplegar (printf %s "NUEVA" | shasum -a 256).
const HASH_FILIAL =
  "a26a6aa1dc925ae5430ff1c96ea2297a01c8554d77ee64c2bcbf002b02bfddc4";

const CLIENTES: Record<string, ConfigCliente> = {
  inter: {
    id: "inter",
    nombreCorto: "INTER",
    nombreLargo: "Inter JP Financial",
    marcaTitulo: "Inter FS",
    appTitulo: "Inter Crono",
    roster: ROSTER_REAL,
    idiomaFijo: "es", // el Inter va siempre en español, sin selector
    demo: false,
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
    roster: ROSTER_FILIAL,
    idiomaFijo: "es",
    demo: false,
  },
  pulso: {
    id: "pulso",
    nombreCorto: "PULSO",
    nombreLargo: "CD Pulso",
    marcaTitulo: "CD Pulso",
    appTitulo: "Crono CD Pulso",
    roster: ROSTER_DEMO,
    idiomaFijo: null, // la demo muestra el selector de idioma (es/en/it)
    demo: true,
  },
};

/**
 * Hashes de contraseña del cliente ACTIVO.
 *
 * Va aparte del registro CLIENTES y con ternarios sobre
 * `process.env.NEXT_PUBLIC_CLIENTE` a propósito: Next sustituye esa variable
 * por un literal en build, el minificador pliega el ternario y los hashes de
 * los OTROS clubes desaparecen del bundle. Metidos dentro de CLIENTES viajaban
 * todos en todos los builds — comprobado el 28/8: el build del filial llevaba
 * dentro el hash del Inter, y "inter1977" se saca de un SHA-256 con un
 * diccionario. Cada club se lleva solo el suyo.
 */
const PASS_HASHES: string[] =
  process.env.NEXT_PUBLIC_CLIENTE === "pulso"
    ? [HASH_PULSO]
    : process.env.NEXT_PUBLIC_CLIENTE === "filial"
      ? [HASH_FILIAL]
      : [HASH_INTER];

const _ID = (process.env.NEXT_PUBLIC_CLIENTE || "inter").toLowerCase();

/** id del cliente activo (fijado en build). */
export const CLIENTE_ID: string = CLIENTES[_ID] ? _ID : "inter";

/** Configuración del cliente activo. Fallback a Inter si el id no existe. */
export const CLIENTE: ConfigCliente = CLIENTES[_ID] ?? CLIENTES.inter;

// Roster activo y derivados (lo que consumen los componentes). Reemplaza a los
// antiguos exports de `roster.ts` (que ahora solo guarda los datos crudos).
export const ROSTER: Jugador[] = CLIENTE.roster;

/** Hashes SHA-256 válidos para el login de ESTE build (ver PASS_HASHES). */
export const PASS_HASHES_CLIENTE: string[] = PASS_HASHES;
export const PORTEROS: Jugador[] = ROSTER.filter((j) => j.posicion === "PORTERO");
export const CAMPO: Jugador[] = ROSTER.filter((j) => j.posicion === "CAMPO");

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

