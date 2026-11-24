/**
 * colaSubida.ts — Subir los partidos al servidor del club (fase 2, 21/11/2026).
 *
 * Cada partido que cambia en el aparato queda PENDIENTE y se sube solo en
 * cuanto hay red, con reintentos y espera creciente. El crono NUNCA espera al
 * servidor: se apunta igual sin red, y la subida va por detrás.
 *
 * Cómo se sabe que un partido ha cambiado: por su `actualizado` (ms del último
 * guardado). Cada ficha de la cola recuerda el `actualizado` que se subió; si
 * el del partido es otro, hay algo nuevo que subir. Así no hace falta enganchar
 * cada `put` de la base, y un partido guardado con la app cerrada a medias se
 * detecta igual en la siguiente pasada.
 *
 * Estados de cada partido (lo que se pinta en el inicio):
 *   · pendiente  — hay cambios sin subir (sin red, o esperando el reintento).
 *   · subiendo   — en camino.
 *   · subido     — el servidor tiene lo último de este aparato.
 *   · error      — el servidor lo rechaza (no es un partido válido, muy grande,
 *                  otra versión más nueva…): no se reintenta hasta que cambie.
 *   · ajeno      — lo apunta OTRO aparato del club (el dueño): aquí solo se
 *                  mira. No se sube hasta «Tomar el control».
 *   · omitido    — no se sube (sin cabecera, el de ejemplo…). No se pinta.
 *
 * Sin React ni Dexie (se prueba con node, con un fetch de mentira):
 *   node --experimental-strip-types src/lib/colaSubida.test.ts
 */
import type { Partido } from "./db";
import { paraExportar } from "./importarPartido";

export type EstadoSubida = "pendiente" | "subiendo" | "subido" | "error" | "ajeno" | "omitido";

export interface DuenoPartido { id: string; nombre: string | null }

/** Una fila de la cola (tabla `subidas` de la base local). */
export interface FichaSubida {
  /** id del partido (el mismo de la tabla `partidos`). */
  id: string;
  estado: EstadoSubida;
  /** `actualizado` del partido que tiene el servidor (lo último subido o bajado). */
  subidoActualizado?: number;
  /** Versión del servidor que corresponde a `subidoActualizado` (para If-Match). */
  version?: number;
  /** Intentos fallidos seguidos (para la espera creciente). */
  intentos: number;
  /** ms a partir del cual se puede volver a intentar. */
  proximoIntento: number;
  /** ms de la última subida buena. */
  subidoEl?: number;
  /** Código corto del último fallo (para el texto: red, grande, no_dueno…). */
  codigo?: string;
  /** Quién manda en el servidor (si se sabe). */
  dueno?: DuenoPartido;
  /** Id de aparato con el que ESTE aparato lo subió (o lo tomó) por última
   *  vez. Si luego se vuelve a conectar, el servidor le da un id nuevo y el
   *  partido seguiría a nombre del viejo: con esto se reconoce y se recupera. */
  subidoPor?: string;
}

/** La llave de este aparato en el servidor del club. */
export interface SesionServidor {
  token: string;
  club: string;
  aparato: { id: string; nombre: string };
  /** Servidor con el que se sacó (si cambia, la llave no vale). */
  url: string;
  /** ms en que se conectó. */
  el: number;
}

/** Ids que el servidor acepta (la misma regla que `validacion.py`). */
export const RE_ID_PARTIDO = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;

/** Espera tras el n-ésimo fallo: 2 s, 4 s, 8 s… hasta 5 min. `azar` (0-1)
 *  añade hasta un 20 % para que dos aparatos no reintenten a la vez. */
export const ESPERA_MIN_MS = 2_000;
export const ESPERA_MAX_MS = 5 * 60_000;
export function esperaReintento(intentos: number, azar = 0): number {
  const base = Math.min(ESPERA_MAX_MS, ESPERA_MIN_MS * 2 ** Math.max(0, intentos - 1));
  return Math.round(base * (1 + 0.2 * Math.min(1, Math.max(0, azar))));
}

/** Entre dos subidas del mismo partido, al menos esto (en directo cambia en
 *  cada acción; con una versión cada 10 s basta y el servidor no se llena). */
export const ENTRE_SUBIDAS_MS = 10_000;
/** Una petición que tarda más que esto se da por perdida (y se reintenta). */
export const TIEMPO_PETICION_MS = 20_000;

/** ¿Hay algo nuevo que subir de este partido? */
export function hayCambios(actualizado: number, f: FichaSubida | undefined): boolean {
  return !f || f.subidoActualizado !== actualizado;
}

/** Qué hacer con la respuesta del servidor a una subida. */
export type Veredicto =
  | { tipo: "ok"; version: number; dueno?: string }
  | { tipo: "reintentar"; codigo: string }
  | { tipo: "sin_llave" }
  | { tipo: "ajeno"; dueno?: DuenoPartido; version?: number }
  | { tipo: "rechazado"; codigo: string };

/** Lee la respuesta de `PUT /v1/partidos/{id}`. `estado` 0 = no hubo respuesta
 *  (sin red, servidor caído, tiempo agotado, CORS…). */
export function veredicto(estado: number, cuerpo: unknown): Veredicto {
  const c = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as Record<string, unknown>;
  const codigo = typeof c.error === "string" ? c.error : String(estado);
  if (estado === 200 || estado === 201) {
    const v = typeof c.version === "number" ? c.version : NaN;
    if (!Number.isFinite(v)) return { tipo: "reintentar", codigo: "respuesta" };
    return { tipo: "ok", version: v, dueno: typeof c.dueno === "string" ? c.dueno : undefined };
  }
  if (estado === 0) return { tipo: "reintentar", codigo: "red" };
  if (estado === 401) return { tipo: "sin_llave" };
  if (estado === 409 && codigo === "no_dueno") {
    return {
      tipo: "ajeno",
      dueno: typeof c.dueno === "string"
        ? { id: c.dueno, nombre: typeof c.dueno_nombre === "string" ? c.dueno_nombre : null } : undefined,
      version: typeof c.version === "number" ? c.version : undefined,
    };
  }
  // 408 (tiempo), 429 (demasiadas), 5xx (caído o reiniciando): volver a probar.
  if (estado === 408 || estado === 429 || estado >= 500) return { tipo: "reintentar", codigo };
  // 409 «version», 413 grande, 422 no es un partido, 403 otro club, 400…:
  // volver a mandar lo mismo daría lo mismo.
  return { tipo: "rechazado", codigo };
}

// ── Peticiones al servidor ────────────────────────────────────────────────

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Respuesta de una petición: `estado` 0 = no llegó (sin red o tiempo). */
export interface Respuesta { estado: number; cuerpo: unknown; texto: string; etag: string | null }

export async function peticion(
  fetchFn: Fetch, url: string, init: RequestInit = {}, tiempoMs = TIEMPO_PETICION_MS,
): Promise<Respuesta> {
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const reloj = ac ? setTimeout(() => ac.abort(), tiempoMs) : null;
  try {
    const r = await fetchFn(url, { ...init, signal: ac?.signal, cache: "no-store" });
    const texto = r.status === 304 ? "" : await r.text();
    let cuerpo: unknown = null;
    try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = null; }
    return { estado: r.status, cuerpo, texto, etag: r.headers.get("ETag") };
  } catch {
    return { estado: 0, cuerpo: null, texto: "", etag: null };
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

const unir = (base: string, ruta: string) => base.replace(/\/+$/, "") + ruta;
const llave = (s: SesionServidor) => ({ Authorization: `Bearer ${s.token}` });

export type ResultadoSesion =
  | { ok: true; sesion: SesionServidor }
  | { ok: false; codigo: "credenciales" | "demasiados_intentos" | "red" | "otro"; reintentarEn?: number };

/** Conectar el aparato al club: contraseña del club → llave del aparato. */
export async function iniciarSesion(
  fetchFn: Fetch, url: string, club: string, contrasena: string, aparato: string, ahora = Date.now(),
): Promise<ResultadoSesion> {
  const r = await peticion(fetchFn, unir(url, "/v1/sesion"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ club, contrasena, aparato }),
  });
  const c = (r.cuerpo ?? {}) as Record<string, unknown>;
  if (r.estado === 200 && typeof c.token === "string") {
    const ap = (c.aparato ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      sesion: {
        token: c.token, club: typeof c.club === "string" ? c.club : club,
        aparato: { id: String(ap.id ?? ""), nombre: String(ap.nombre ?? aparato) },
        url, el: ahora,
      },
    };
  }
  if (r.estado === 0) return { ok: false, codigo: "red" };
  if (r.estado === 401) return { ok: false, codigo: "credenciales" };
  if (r.estado === 429) {
    return { ok: false, codigo: "demasiados_intentos",
      reintentarEn: typeof c.reintentar_en === "number" ? c.reintentar_en : undefined };
  }
  return { ok: false, codigo: "otro" };
}

/** Una fila de «Partidos del club». */
export interface PartidoClub {
  id: string;
  fecha: string;
  rival: string;
  partido_id: string;
  modo: string;
  estado: string;
  version: number;
  marcador: { inter: number; rival: number };
  actualizado: number;
  dueno: { id: string; nombre: string | null; soy_yo: boolean };
}

export type Resultado<T> = { ok: true; datos: T } | { ok: false; codigo: string; estado: number };

function fallo<T>(r: Respuesta): Resultado<T> {
  const c = (r.cuerpo ?? {}) as Record<string, unknown>;
  const codigo = r.estado === 0 ? "red" : r.estado === 401 ? "sin_llave"
    : typeof c.error === "string" ? c.error : String(r.estado);
  return { ok: false, codigo, estado: r.estado };
}

export async function listarDelClub(fetchFn: Fetch, s: SesionServidor): Promise<Resultado<PartidoClub[]>> {
  const r = await peticion(fetchFn, unir(s.url, "/v1/partidos"), { headers: llave(s) });
  const c = r.cuerpo as { partidos?: PartidoClub[] } | null;
  if (r.estado === 200 && c && Array.isArray(c.partidos)) return { ok: true, datos: c.partidos };
  return fallo(r);
}

/** La última versión de un partido: el texto tal cual (el JSON exportado). */
export async function bajarPartido(
  fetchFn: Fetch, s: SesionServidor, id: string,
): Promise<Resultado<{ texto: string; version: number }>> {
  const r = await peticion(fetchFn, unir(s.url, `/v1/partidos/${encodeURIComponent(id)}`), { headers: llave(s) });
  if (r.estado === 200 && r.texto) {
    const v = Number((r.etag ?? "").replace(/[^0-9]/g, ""));
    return { ok: true, datos: { texto: r.texto, version: Number.isFinite(v) && v > 0 ? v : 0 } };
  }
  return fallo(r);
}

export async function tomarControl(
  fetchFn: Fetch, s: SesionServidor, id: string,
): Promise<Resultado<{ version: number; dueno: string }>> {
  const r = await peticion(fetchFn, unir(s.url, `/v1/partidos/${encodeURIComponent(id)}/tomar-control`),
    { method: "POST", headers: llave(s) });
  const c = (r.cuerpo ?? {}) as Record<string, unknown>;
  if (r.estado === 200 && typeof c.version === "number") {
    return { ok: true, datos: { version: c.version, dueno: String(c.dueno ?? s.aparato.id) } };
  }
  return fallo(r);
}

// ── Seguir en directo (fase 3, 21/11/2026) ────────────────────────────────

/** Cada cuánto pregunta el que solo mira (5-10 s; con ETag casi siempre es un
 *  304 sin cuerpo). */
export const INTERVALO_SEGUIR_MS = 7_000;

/** Respuesta a «¿hay algo nuevo?» del que mira. */
export type Seguimiento =
  | { tipo: "igual" }
  | { tipo: "nuevo"; texto: string; version: number; etag: string; dueno: string | null; sustituidoPor: string | null }
  | { tipo: "fallo"; codigo: string; estado: number };

/** GET con If-None-Match: 304 = nada nuevo; 200 = la versión nueva entera.
 *  `etag` = el de la última que se tiene aquí ("v<n>"), o null la primera vez. */
export async function seguirPartido(
  fetchFn: Fetch, s: SesionServidor, id: string, etag: string | null,
): Promise<Seguimiento> {
  const cab: Record<string, string> = { ...llave(s) };
  if (etag) cab["If-None-Match"] = etag;
  let dueno: string | null = null, sustituido: string | null = null;
  const envolver: Fetch = async (u, i) => {
    const r = await fetchFn(u, i);
    dueno = r.headers.get("X-Pulso-Dueno");
    sustituido = r.headers.get("X-Pulso-Sustituido-Por");
    return r;
  };
  const r = await peticion(envolver, unir(s.url, `/v1/partidos/${encodeURIComponent(id)}`), { headers: cab });
  if (r.estado === 304) return { tipo: "igual" };
  if (r.estado === 200 && r.texto) {
    const v = Number((r.etag ?? "").replace(/[^0-9]/g, ""));
    return { tipo: "nuevo", texto: r.texto, version: Number.isFinite(v) && v > 0 ? v : 0,
      etag: r.etag ?? "", dueno, sustituidoPor: sustituido };
  }
  const f = fallo<never>(r) as { ok: false; codigo: string; estado: number };
  return { tipo: "fallo", codigo: f.codigo, estado: f.estado };
}

/** ¿Este aparato tiene que SOLO MIRAR este partido? Cuando el servidor dice
 *  que lo apunta otro aparato del club (ficha «ajeno»). Sin ficha (servidor
 *  apagado, aparato sin conectar, partido que nunca se subió) se apunta como
 *  siempre: el crono no depende del servidor. */
export function soloMirar(f: FichaSubida | undefined): boolean {
  return !!f && f.estado === "ajeno";
}

/** ¿Hay que seguirlo en directo (preguntar cada pocos segundos)? Solo mientras
 *  se mira, está en curso y la pestaña se ve. */
export function hayQueSeguir(f: FichaSubida | undefined, estadoPartido: string | undefined, visible: boolean): boolean {
  return soloMirar(f) && estadoPartido === "en_curso" && visible;
}

// ── El motor de la cola ───────────────────────────────────────────────────

/** Lo que el motor necesita de la base local (Dexie en el crono, un Map en
 *  los tests). */
export interface AlmacenCola {
  /** id + `actualizado` de TODOS los partidos guardados (barato: por índice). */
  claves(): Promise<{ id: string; actualizado: number }[]>;
  leerPartido(id: string): Promise<Partido | undefined>;
  fichas(): Promise<FichaSubida[]>;
  guardarFicha(f: FichaSubida): Promise<void>;
  borrarFicha(id: string): Promise<void>;
}

export interface DependenciasMotor {
  almacen: AlmacenCola;
  fetch: Fetch;
  /** La sesión de ahora (null = aparato sin conectar: no se sube nada). */
  sesion(): SesionServidor | null;
  /** El servidor dice que la llave ya no vale (anulada o caducada). */
  alPerderSesion(): void;
  /** Id del crono (inter, filial, juvenil, pulso): va en la etiqueta. */
  cliente: string;
  /** Versión del crono (va en la etiqueta). */
  version: string;
  /** Ids que no se suben nunca (el partido de ejemplo de la demo). */
  excluir?: ReadonlySet<string>;
  ahora?: () => number;
  azar?: () => number;
  /** Se llama cada vez que cambia alguna ficha (para repintar el inicio). */
  alCambiar?: (fichas: ReadonlyMap<string, FichaSubida>) => void;
}

export interface ResumenPasada {
  sinSesion?: boolean;
  subidos: string[];
  fallidos: string[];
  pendientes: number;
}

export class MotorSubida {
  private d: DependenciasMotor;
  private corriendo: Promise<ResumenPasada> | null = null;
  private otraVez = false;
  private cargada = false;
  /** Copia en memoria de la cola (lo que pinta la pantalla). */
  readonly fichas = new Map<string, FichaSubida>();

  constructor(d: DependenciasMotor) { this.d = d; }

  private ahora() { return (this.d.ahora ?? Date.now)(); }

  /** Carga la cola guardada (para pintar los estados antes de la 1.ª pasada). */
  async cargar(): Promise<void> {
    this.cargada = true;
    for (const f of await this.d.almacen.fichas()) {
      // Una subida cortada a medias (se cerró la app): vuelve a la cola.
      this.fichas.set(f.id, f.estado === "subiendo" ? { ...f, estado: "pendiente", proximoIntento: 0 } : f);
    }
    this.avisar();
  }

  private avisar() { this.d.alCambiar?.(this.fichas); }

  private async guardar(f: FichaSubida) {
    this.fichas.set(f.id, f);
    await this.d.almacen.guardarFicha(f);
    this.avisar();
  }

  /** «Ya»: lo que esperaba un reintento se puede probar ahora (al volver la
   *  red o al volver a la app). No borra la cuenta de fallos. */
  despertar(): void {
    for (const f of this.fichas.values()) {
      if (f.estado === "pendiente" && f.proximoIntento > this.ahora()) f.proximoIntento = 0;
    }
  }

  /** Una vuelta: detecta cambios y sube lo que toque. Si ya hay una en marcha,
   *  no se pisan: se apunta otra para justo después. */
  pasada(): Promise<ResumenPasada> {
    if (this.corriendo) { this.otraVez = true; return this.corriendo; }
    this.corriendo = (async () => {
      let r: ResumenPasada;
      try {
        do {
          this.otraVez = false;
          r = await this.unaPasada();
        } while (this.otraVez && !r.sinSesion);
      } finally {
        this.corriendo = null;
      }
      return r;
    })();
    return this.corriendo;
  }

  /** Apunta en la cola lo que ha cambiado (y olvida los partidos borrados). */
  async repasar(): Promise<void> {
    if (!this.cargada) await this.cargar();
    const claves = await this.d.almacen.claves();
    const vivos = new Set(claves.map((c) => c.id));
    for (const id of [...this.fichas.keys()]) {
      if (!vivos.has(id)) { this.fichas.delete(id); await this.d.almacen.borrarFicha(id); }
    }
    let cambio = false;
    for (const { id, actualizado } of claves) {
      const f = this.fichas.get(id);
      if (!hayCambios(actualizado, f)) continue;
      if (f && f.estado === "pendiente") continue;      // ya estaba en la cola
      if (f && f.estado === "subiendo") continue;
      // Un partido de otro aparato no se sube aunque se toque aquí.
      if (f && f.estado === "ajeno") continue;
      // Rechazado por el servidor por versión: hasta que se resuelva a mano.
      if (f && f.estado === "error" && f.codigo === "version") continue;
      const nueva: FichaSubida = {
        ...(f ?? { id, intentos: 0 }),
        id, estado: "pendiente", intentos: 0, proximoIntento: 0, codigo: undefined,
      };
      this.fichas.set(id, nueva);
      await this.d.almacen.guardarFicha(nueva);
      cambio = true;
    }
    if (cambio) this.avisar();
  }

  private async unaPasada(): Promise<ResumenPasada> {
    const resumen: ResumenPasada = { subidos: [], fallidos: [], pendientes: 0 };
    if (!this.d.sesion()) { resumen.sinSesion = true; return resumen; }
    await this.repasar();
    for (const f of [...this.fichas.values()]) {
      if (f.estado !== "pendiente") continue;
      const ahora = this.ahora();
      if (f.proximoIntento > ahora) continue;
      if (f.subidoEl && ahora - f.subidoEl < ENTRE_SUBIDAS_MS) continue;
      const ses = this.d.sesion();
      if (!ses) { resumen.sinSesion = true; break; }
      const ok = await this.subir(f, ses);
      if (ok === "sin_llave") { resumen.sinSesion = true; break; }
      if (ok) resumen.subidos.push(f.id); else if (ok === false) resumen.fallidos.push(f.id);
    }
    resumen.pendientes = [...this.fichas.values()].filter((f) => f.estado === "pendiente").length;
    return resumen;
  }

  /** true = subido · false = falló · null = no tocaba · "sin_llave". */
  private async subir(f: FichaSubida, ses: SesionServidor): Promise<boolean | null | "sin_llave"> {
    const p = await this.d.almacen.leerPartido(f.id);
    if (!p) { this.fichas.delete(f.id); await this.d.almacen.borrarFicha(f.id); return null; }
    const omitir = (codigo: string) =>
      this.guardar({ ...f, estado: "omitido", codigo, subidoActualizado: p.actualizado, intentos: 0 }).then(() => null);
    if (!p.config) return omitir("sin_config");
    if (this.d.excluir?.has(p.id)) return omitir("excluido");
    if (!RE_ID_PARTIDO.test(p.id)) {
      await this.guardar({ ...f, estado: "error", codigo: "id", subidoActualizado: p.actualizado });
      return false;
    }

    const enviado = p.actualizado;
    const cuerpo = JSON.stringify(paraExportar(p, { cliente: this.d.cliente, version: this.d.version, ahora: this.ahora() }));
    await this.guardar({ ...f, estado: "subiendo" });
    const cab: Record<string, string> = { ...llave(ses), "Content-Type": "application/json" };
    if (f.version) cab["If-Match"] = `"v${f.version}"`;
    const r = await peticion(this.d.fetch, unir(ses.url, `/v1/partidos/${encodeURIComponent(p.id)}`),
      { method: "PUT", headers: cab, body: cuerpo });
    const v = veredicto(r.estado, r.cuerpo);
    const ahora = this.ahora();
    switch (v.tipo) {
      case "ok":
        await this.guardar({
          ...f, estado: "subido", subidoActualizado: enviado, version: v.version, intentos: 0,
          proximoIntento: 0, subidoEl: ahora, codigo: undefined,
          dueno: { id: v.dueno ?? ses.aparato.id, nombre: ses.aparato.nombre }, subidoPor: ses.aparato.id,
        });
        return true;
      case "reintentar": {
        const intentos = f.intentos + 1;
        await this.guardar({
          ...f, estado: "pendiente", intentos, codigo: v.codigo,
          proximoIntento: ahora + esperaReintento(intentos, (this.d.azar ?? Math.random)()),
        });
        return false;
      }
      case "sin_llave":
        await this.guardar({ ...f, estado: "pendiente", codigo: "sin_llave", proximoIntento: 0 });
        this.d.alPerderSesion();
        return "sin_llave";
      case "ajeno":
        // ¿El «otro» aparato es este mismo con su llave de antes (se
        // desconectó y volvió a entrar)? Entonces es suyo: se recupera el
        // control y se vuelve a subir. Solo si lo subió ESTE aparato.
        if (v.dueno && f.subidoPor && v.dueno.id === f.subidoPor && f.subidoPor !== ses.aparato.id
            && !f.codigo?.startsWith("recuperado")) {
          const tc = await tomarControl(this.d.fetch, ses, p.id);
          if (tc.ok) {
            await this.guardar({ ...f, estado: "pendiente", version: tc.datos.version, subidoPor: ses.aparato.id,
              codigo: "recuperado", proximoIntento: 0, subidoEl: undefined });
            return this.subir(this.fichas.get(f.id)!, ses);
          }
        }
        await this.guardar({
          ...f, estado: "ajeno", codigo: "no_dueno", intentos: 0, dueno: v.dueno,
          // Lo de aquí se queda sin subir (el servidor lo guarda aparte).
        });
        return false;
      case "rechazado":
        await this.guardar({ ...f, estado: "error", codigo: v.codigo, intentos: 0, subidoActualizado: v.codigo === "version" ? f.subidoActualizado : enviado });
        return false;
    }
  }

  /** El partido se acaba de abrir desde el servidor (o de tomar el control):
   *  lo que hay aquí ES esa versión, no hay nada que subir. */
  async marcarBajado(id: string, actualizado: number, version: number, dueno: DuenoPartido, soyYo: boolean): Promise<void> {
    await this.guardar({
      id, estado: soyYo ? "subido" : "ajeno", subidoActualizado: actualizado, version,
      intentos: 0, proximoIntento: 0, dueno, codigo: soyYo ? undefined : "no_dueno",
      subidoEl: soyYo ? this.ahora() : undefined, subidoPor: soyYo ? dueno.id : undefined,
    });
  }

  /** «Tomar el control» hecho: este aparato manda.
   *  · `subirLoDeAqui` true (aquí ya estaba la versión del servidor): lo que
   *    haya cambiado aquí desde entonces se sube en la próxima pasada.
   *  · false (no se pudo traer la última): lo de aquí NO se sube por encima;
   *    lo que se apunte desde ahora, sí (con If-Match de la del servidor).
   *  Ojo: si se va a traer la última versión, NO se llama a esto antes de
   *  guardarla (marcarBajado): una pasada en medio subiría lo viejo de aquí
   *  encima (visto en la prueba con dos aparatos del 21/11). */
  async marcarDueno(id: string, version: number, dueno: DuenoPartido, subirLoDeAqui = true): Promise<void> {
    const f = this.fichas.get(id);
    const p = await this.d.almacen.leerPartido(id);
    const base: FichaSubida = f ?? { id, estado: "subido", intentos: 0, proximoIntento: 0 };
    const cambiado = subirLoDeAqui && p ? hayCambios(p.actualizado, f) : false;
    await this.guardar({
      ...base, id, version, dueno, subidoPor: dueno.id, codigo: undefined, intentos: 0, proximoIntento: 0,
      estado: cambiado ? "pendiente" : "subido",
      subidoActualizado: subirLoDeAqui ? (f?.subidoActualizado ?? p?.actualizado) : p?.actualizado,
    });
  }

  /** Volver a intentar un partido con error (botón «Reintentar»). */
  async reintentar(id: string): Promise<void> {
    const f = this.fichas.get(id);
    if (!f) return;
    await this.guardar({ ...f, estado: "pendiente", intentos: 0, proximoIntento: 0, codigo: undefined,
      version: f.codigo === "version" ? undefined : f.version });
  }
}
