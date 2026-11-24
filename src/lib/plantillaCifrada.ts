/**
 * Plantilla CIFRADA: la parte del aparato (25/11/2026).
 *
 * El build mete la plantilla real del club cifrada (ver `cifrarPlantilla.mjs`
 * en la raíz: PBKDF2-SHA256 + AES-256-GCM). Aquí se abre con Web Crypto al
 * entrar con la contraseña y se guarda YA ABIERTA en el almacenamiento local
 * del aparato (localStorage, igual que el «ya entré» del login), para que
 * después funcione sin red y sin volver a pedir la contraseña.
 *
 * Sin React, sin Dexie y sin importar nada de la app (solo tipos): lo prueba
 * `plantillaCifrada.test.ts` con node.
 */
import type { Jugador } from "./roster";
import type { Partido } from "./db";

/** El sobre que viaja en el paquete (lo escribe cifrarPlantilla.mjs). */
export interface Sobre {
  v: number;
  cliente: string;
  iter: number;
  sal: string;   // base64
  iv: string;    // base64
  datos: string; // base64: cifrado + etiqueta GCM
  huella: string;
}

/** Lo que se guarda en el aparato. */
export interface PlantillaGuardada {
  v: 1;
  /** Huella del build del que salió (o "" si es provisional). */
  huella: string;
  jugadores: Jugador[];
  /** true = sacada del partido en curso, sin contraseña (ver
   *  `plantillaDeUnPartido`): sirve para acabar ESE partido. */
  provisional?: boolean;
  /** ms en que se guardó. */
  el: number;
}

/** Estado de la plantilla en este aparato. */
export type EstadoPlantilla =
  | "abierta"     // build sin cifrar (la demo): no hay nada que hacer
  | "lista"       // guardada y es la de este build
  | "vieja"       // guardada, pero el build trae otra (alta/baja): se sigue usando y se avisa
  | "provisional" // la del partido en curso, sin contraseña
  | "falta";      // no hay ninguna: hay que escribir la contraseña

export function leerSobre(texto: string): Sobre | null {
  if (!texto) return null;
  try {
    const s = JSON.parse(texto) as Sobre;
    if (s && s.v === 1 && s.sal && s.iv && s.datos && s.huella && s.cliente) return s;
  } catch { /* nada */ }
  return null;
}

const deB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

function esJugador(j: unknown): j is Jugador {
  if (!j || typeof j !== "object") return false;
  const x = j as Record<string, unknown>;
  return typeof x.nombre === "string" && typeof x.dorsal === "string"
    && (x.posicion === "PORTERO" || x.posicion === "CAMPO")
    && (x.equipo === "PRIMER" || x.equipo === "FILIAL");
}

/**
 * Abre el sobre con la contraseña. Devuelve la plantilla, o null si la
 * contraseña no es la buena (AES-GCM no descifra: la etiqueta no cuadra).
 * Esto ES la comprobación de la contraseña en los clubes con plantilla
 * cifrada: en el paquete ya no viaja ningún hash que se pueda atacar rápido.
 */
export async function abrirSobre(sobre: Sobre, contrasena: string): Promise<Jugador[] | null> {
  const sutil = globalThis.crypto?.subtle;
  if (!sutil) throw new Error("este navegador no tiene Web Crypto (¿página sin https?)");
  const base = await sutil.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveKey"]);
  const clave = await sutil.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: deB64(sobre.sal), iterations: sobre.iter },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let claro: ArrayBuffer;
  try {
    claro = await sutil.decrypt(
      { name: "AES-GCM", iv: deB64(sobre.iv), additionalData: new TextEncoder().encode(`pulso-plantilla-v1:${sobre.cliente}`) },
      clave,
      deB64(sobre.datos),
    );
  } catch {
    return null; // contraseña equivocada (o sobre manipulado)
  }
  const lista = JSON.parse(new TextDecoder().decode(claro));
  if (!Array.isArray(lista) || !lista.every(esJugador)) return null;
  return lista as Jugador[];
}

/** Clave del almacenamiento local, por club (como `<club>_crono_auth`). */
export function claveAlmacen(cliente: string): string {
  return `${cliente}_crono_plantilla`;
}

type Almacen = Pick<Storage, "getItem" | "setItem">;

function almacenPorDefecto(): Almacen | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function leerGuardada(cliente: string, almacen: Almacen | null = almacenPorDefecto()): PlantillaGuardada | null {
  if (!almacen) return null;
  try {
    const g = JSON.parse(almacen.getItem(claveAlmacen(cliente)) || "null") as PlantillaGuardada | null;
    if (g && g.v === 1 && Array.isArray(g.jugadores) && g.jugadores.length > 0 && g.jugadores.every(esJugador)) return g;
  } catch { /* nada */ }
  return null;
}

/** Guarda la plantilla abierta. Devuelve false si el almacenamiento no deja
 *  (modo privado…): entonces vale para esta sesión y se pedirá otra vez. */
export function guardarPlantilla(cliente: string, g: PlantillaGuardada, almacen: Almacen | null = almacenPorDefecto()): boolean {
  if (!almacen) return false;
  try {
    almacen.setItem(claveAlmacen(cliente), JSON.stringify(g));
    return true;
  } catch {
    return false;
  }
}

export function estadoDe(sobre: Sobre | null, g: PlantillaGuardada | null): EstadoPlantilla {
  if (!sobre) return "abierta";
  if (!g) return "falta";
  if (g.provisional) return "provisional";
  return g.huella === sobre.huella ? "lista" : "vieja";
}

/**
 * Plantilla de EMERGENCIA sacada de un partido guardado (el que estaba a
 * medias cuando el aparato se actualizó): sus convocados, con los nombres
 * canónicos que ya lleva el partido. No hay dorsales (el partido no los
 * guarda); es portero el que salió de portero o tiene paradas o goles
 * encajados. Basta para acabar ese partido sin contraseña y sin red.
 */
export function plantillaDeUnPartido(p: Partido): Jugador[] {
  const convocados = p.config?.convocados ?? [];
  const porteros = new Set<string>();
  if (p.config?.pista_inicial?.portero) porteros.add(p.config.pista_inicial.portero);
  for (const [n, c] of Object.entries(p.acciones?.porJugador ?? {})) {
    if ((c?.paradas ?? 0) > 0 || (c?.golesEncajados ?? 0) > 0) porteros.add(n);
  }
  return convocados.map((nombre) => ({
    dorsal: "",
    nombre,
    posicion: porteros.has(nombre) ? "PORTERO" : "CAMPO",
    equipo: "PRIMER",
  }));
}
