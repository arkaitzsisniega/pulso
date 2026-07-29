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
 * el AuthGate). Una por club por defecto, pero `passHashes` es una lista por
 * si algún club quiere varias (una por persona del cuerpo técnico).
 */
import { ROSTER_REAL, ROSTER_DEMO, type Jugador } from "@/lib/roster";

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
  /** Hashes SHA-256 de las contraseñas válidas (1+ por club). */
  passHashes: string[];
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

const CLIENTES: Record<string, ConfigCliente> = {
  inter: {
    id: "inter",
    nombreCorto: "INTER",
    nombreLargo: "Inter JP Financial",
    marcaTitulo: "Inter FS",
    appTitulo: "Inter Crono",
    roster: ROSTER_REAL,
    passHashes: [HASH_INTER],
    idiomaFijo: "es", // el Inter va siempre en español, sin selector
    demo: false,
  },
  pulso: {
    id: "pulso",
    nombreCorto: "PULSO",
    nombreLargo: "CD Pulso",
    marcaTitulo: "CD Pulso",
    appTitulo: "Crono CD Pulso",
    roster: ROSTER_DEMO,
    passHashes: [HASH_PULSO],
    idiomaFijo: null, // la demo muestra el selector de idioma (es/en/it)
    demo: true,
  },
};

const _ID = (process.env.NEXT_PUBLIC_CLIENTE || "inter").toLowerCase();

/** id del cliente activo (fijado en build). */
export const CLIENTE_ID: string = CLIENTES[_ID] ? _ID : "inter";

/** Configuración del cliente activo. Fallback a Inter si el id no existe. */
export const CLIENTE: ConfigCliente = CLIENTES[_ID] ?? CLIENTES.inter;

// Roster activo y derivados (lo que consumen los componentes). Reemplaza a los
// antiguos exports de `roster.ts` (que ahora solo guarda los datos crudos).
export const ROSTER: Jugador[] = CLIENTE.roster;
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
