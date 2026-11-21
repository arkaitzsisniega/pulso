"use client";

/**
 * servidor.ts — El crono y el servidor de partidos del club (fase 2, 21/11/2026).
 *
 * Une la cola (lib/colaSubida.ts, sin React ni Dexie) con lo de verdad: la base
 * local (tabla `subidas`), la llave del aparato (localStorage) y los momentos
 * en que se intenta subir:
 *   · al abrir el crono;
 *   · al volver la red (evento `online`);
 *   · al volver a la app (`visibilitychange`; Safari en iPad no sube con la app
 *     cerrada: no tiene Background Sync);
 *   · cada ~10 s mientras la app está abierta y a la vista.
 *
 * Con `SERVIDOR_ACTIVO` en false (todos los clubes hoy) no hace NADA: ni lee
 * la base, ni pide nada a internet, ni pinta nada.
 */
import { useSyncExternalStore } from "react";
import { db } from "./db";
import { CLIENTE_ID, SERVIDOR_ACTIVO, URL_SERVIDOR, VERSION_CRONO } from "./clientes";
import { ID_PARTIDO_EJEMPLO } from "./partidoEjemplo";
import {
  MotorSubida, iniciarSesion, listarDelClub, bajarPartido, tomarControl,
  type AlmacenCola, type FichaSubida, type SesionServidor, type ResultadoSesion,
  type DuenoPartido,
} from "./colaSubida";

export { SERVIDOR_ACTIVO };
export const INTERVALO_MS = 10_000;

const CLAVE_SESION = `${CLIENTE_ID}_servidor_sesion`;
const CLAVE_APARATO = `${CLIENTE_ID}_servidor_aparato`;

// ── Llave del aparato ─────────────────────────────────────────────────────

function leerSesionGuardada(): SesionServidor | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_SESION) || "null") as SesionServidor | null;
    if (!s || typeof s.token !== "string" || s.url !== URL_SERVIDOR || s.club !== CLIENTE_ID) return null;
    return s;
  } catch { return null; }
}

/** Nombre con el que se dio de alta este aparato la última vez («iPad banquillo»). */
export function nombreAparatoGuardado(): string {
  try { return localStorage.getItem(CLAVE_APARATO) || ""; } catch { return ""; }
}

// ── Estado para pintar (un solo objeto: se cambia entero en cada aviso) ──

export interface EstadoServidor {
  activo: boolean;
  sesion: SesionServidor | null;
  /** El servidor dijo que la llave ya no vale: hay que volver a conectar. */
  caducada: boolean;
  fichas: Record<string, FichaSubida>;
}

let estado: EstadoServidor = { activo: SERVIDOR_ACTIVO, sesion: null, caducada: false, fichas: {} };
let iniciado = false;
const subs = new Set<() => void>();
function publicar(cambios: Partial<EstadoServidor>) {
  estado = { ...estado, ...cambios };
  for (const f of subs) f();
}

const almacen: AlmacenCola = {
  async claves() {
    const out: { id: string; actualizado: number }[] = [];
    await db.partidos.orderBy("actualizado").eachKey((k, cur) => {
      out.push({ id: String(cur.primaryKey), actualizado: Number(k) });
    });
    return out;
  },
  leerPartido: (id) => db.partidos.get(id),
  fichas: () => db.subidas.toArray(),
  guardarFicha: async (f) => { await db.subidas.put(f); },
  borrarFicha: async (id) => { await db.subidas.delete(id); },
};

/** El servidor dice que la llave no vale (anulada, caducada o club con
 *  contraseña nueva): se olvida y se pide volver a conectar. */
function perderSesion() {
  try { localStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
  publicar({ sesion: null, caducada: true });
}

let motor: MotorSubida | null = null;
function elMotor(): MotorSubida {
  if (!motor) {
    motor = new MotorSubida({
      almacen,
      fetch: (u, i) => fetch(u, i),
      sesion: () => estado.sesion,
      alPerderSesion: perderSesion,
      cliente: CLIENTE_ID,
      version: VERSION_CRONO,
      excluir: new Set([ID_PARTIDO_EJEMPLO]),
      alCambiar: (m) => publicar({ fichas: Object.fromEntries(m) }),
    });
  }
  return motor;
}

/** Una vuelta de la cola, sin que un fallo llegue nunca a la pantalla. */
export async function subirAhora(): Promise<void> {
  if (!SERVIDOR_ACTIVO || !estado.sesion) return;
  try { await elMotor().pasada(); } catch (e) { console.warn("[servidor] pasada", e); }
}

/** Arranca la subida automática (una vez por pestaña). Devuelve cómo pararla. */
export function arrancarSincronizacion(): () => void {
  if (!SERVIDOR_ACTIVO || typeof window === "undefined" || iniciado) return () => {};
  iniciado = true;
  publicar({ sesion: leerSesionGuardada() });
  const m = elMotor();
  void m.cargar().then(subirAhora).catch(() => {});
  const despierta = () => { m.despertar(); void subirAhora(); };
  const alVer = () => { if (document.visibilityState === "visible") despierta(); };
  window.addEventListener("online", despierta);
  document.addEventListener("visibilitychange", alVer);
  const reloj = window.setInterval(() => {
    if (document.visibilityState === "visible") void subirAhora();
  }, INTERVALO_MS);
  return () => {
    iniciado = false;
    window.removeEventListener("online", despierta);
    document.removeEventListener("visibilitychange", alVer);
    window.clearInterval(reloj);
  };
}

export function useServidor(): EstadoServidor {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => estado,
    () => estado,
  );
}

// ── Acciones de la pantalla ───────────────────────────────────────────────

export async function conectar(contrasena: string, nombreAparato: string): Promise<ResultadoSesion> {
  const nombre = nombreAparato.trim().slice(0, 60) || "iPad";
  const r = await iniciarSesion(fetch, URL_SERVIDOR, CLIENTE_ID, contrasena, nombre);
  if (r.ok) {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(r.sesion));
      localStorage.setItem(CLAVE_APARATO, nombre);
    } catch { /* sin almacenamiento: vale para esta sesión */ }
    publicar({ sesion: r.sesion, caducada: false });
    elMotor().despertar();
    void subirAhora();
  }
  return r;
}

/** Desconectar ESTE aparato: se olvida la llave. Los partidos se quedan aquí y
 *  en el servidor; lo pendiente se sube al volver a conectar. */
export function desconectar(): void {
  try { localStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
  publicar({ sesion: null, caducada: false });
}

export function partidosDelClub() {
  const s = estado.sesion;
  if (!s) return Promise.resolve({ ok: false as const, codigo: "sin_llave", estado: 401 });
  return listarDelClub(fetch, s).then((r) => { if (!r.ok && r.codigo === "sin_llave") perderSesion(); return r; });
}

export function bajarDelClub(id: string) {
  const s = estado.sesion;
  if (!s) return Promise.resolve({ ok: false as const, codigo: "sin_llave", estado: 401 });
  return bajarPartido(fetch, s, id);
}

export async function tomarControlDe(id: string) {
  const s = estado.sesion;
  if (!s) return { ok: false as const, codigo: "sin_llave", estado: 401 };
  const r = await tomarControl(fetch, s, id);
  if (r.ok) await elMotor().marcarDueno(id, r.datos.version, { id: s.aparato.id, nombre: s.aparato.nombre });
  return r;
}

/** Lo que se acaba de abrir desde el servidor ya está al día aquí. */
export async function marcarAbierto(id: string, actualizado: number, version: number, dueno: DuenoPartido, soyYo: boolean) {
  await elMotor().marcarBajado(id, actualizado, version, dueno, soyYo);
}

export async function reintentarSubida(id: string) {
  await elMotor().reintentar(id);
  void subirAhora();
}
