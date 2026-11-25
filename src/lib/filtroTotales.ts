/**
 * filtroTotales.ts — QUÉ PARTIDOS entran en los Totales de la temporada
 * (petición del entrenador, 25/11/2026).
 *
 * Hasta hoy Totales sumaba todo lo finalizado: amistosos, copa y liga juntos.
 * Ahora se elige por COMPETICIÓN (casillas, con atajos «Todas» y «Solo liga»)
 * y, dentro de eso, partido a partido.
 *
 * La elección se guarda como dos cosas, no como una lista de partidos:
 *   · `compsFuera`: las competiciones desmarcadas.
 *   · `sueltos`: excepciones a mano, partido a partido (id → dentro/fuera).
 * Un partido entra si tiene excepción y es «dentro», o si no la tiene y su
 * competición está marcada. Así un partido NUEVO sigue a su competición: con
 * «Solo liga» puesto, la jornada de mañana entra sola y el amistoso no.
 *
 * Marcar o desmarcar una competición borra las excepciones de sus partidos
 * (se marcan o desmarcan TODOS). «Todas» y «Solo liga» empiezan de cero.
 *
 * El mismo partido en directo y en vídeo sigue contando UNA vez, el de vídeo
 * (lib/duplicadosVideo.ts): esa regla va ANTES que este filtro y aquí no se
 * toca; la versión que no cuenta sale en la lista, pero sin casilla.
 *
 * Sin React ni Dexie: se prueba con node (filtroTotales.test.ts).
 */
import type { Partido } from "./db";

export interface FiltroTotales {
  compsFuera: string[];
  sueltos: Record<string, boolean>;
}

export const FILTRO_TODO: FiltroTotales = { compsFuera: [], sueltos: {} };

/** Código de competición con el que se agrupa ("" = sin competición). */
export function competicionDe(p: Pick<Partido, "config">): string {
  return String(p.config?.competicion ?? "").trim();
}

/** Orden de las casillas: el de siempre en la pantalla de nuevo partido; lo
 *  que no esté ahí (importados, competiciones futuras), detrás y por nombre. */
const ORDEN = ["LIGA", "COPA_REY", "COPA_ESPANA", "SUPERCOPA", "PLAYOFF", "COPA_MUNDO", "COPA_MADRID", "AMISTOSO"];

export interface CompeticionFiltro {
  codigo: string;
  /** Partidos de esa competición que CUENTAN (sin los duplicados de vídeo). */
  n: number;
  /** Cuántos de ellos están dentro ahora mismo. */
  dentro: number;
  estado: "todos" | "algunos" | "ninguno";
}

export function incluido(p: Pick<Partido, "id" | "config">, f: FiltroTotales): boolean {
  const s = f.sueltos[p.id];
  if (s !== undefined) return s;
  return !f.compsFuera.includes(competicionDe(p));
}

export function competiciones(cuentan: Pick<Partido, "id" | "config">[], f: FiltroTotales): CompeticionFiltro[] {
  const por = new Map<string, CompeticionFiltro>();
  for (const p of cuentan) {
    const c = competicionDe(p);
    const e = por.get(c) ?? { codigo: c, n: 0, dentro: 0, estado: "ninguno" as const };
    e.n += 1;
    if (incluido(p, f)) e.dentro += 1;
    por.set(c, e);
  }
  const lista = [...por.values()].map((e) => ({
    ...e, estado: (e.dentro === e.n ? "todos" : e.dentro === 0 ? "ninguno" : "algunos") as CompeticionFiltro["estado"],
  }));
  const pos = (c: string) => { const i = ORDEN.indexOf(c); return i < 0 ? ORDEN.length + (c ? 0 : 1) : i; };
  return lista.sort((a, b) => pos(a.codigo) - pos(b.codigo) || a.codigo.localeCompare(b.codigo));
}

/** Quita las excepciones de partidos de esa competición (o de todos). */
function sinSueltosDe(cuentan: Pick<Partido, "id" | "config">[], f: FiltroTotales, comp: string): Record<string, boolean> {
  const ids = new Set(cuentan.filter((p) => competicionDe(p) === comp).map((p) => p.id));
  return Object.fromEntries(Object.entries(f.sueltos).filter(([id]) => !ids.has(id)));
}

/** Casilla de competición: si estaban todos dentro, fuera; si no, todos dentro. */
export function alternarCompeticion(cuentan: Pick<Partido, "id" | "config">[], f: FiltroTotales, comp: string): FiltroTotales {
  const e = competiciones(cuentan, f).find((c) => c.codigo === comp);
  const meter = !e || e.estado !== "todos";
  const fuera = f.compsFuera.filter((c) => c !== comp);
  return { compsFuera: meter ? fuera : [...fuera, comp], sueltos: sinSueltosDe(cuentan, f, comp) };
}

/** Casilla de un partido: le pone la excepción contraria a lo que tiene. Si
 *  con eso coincide con su competición, la excepción sobra y se quita. */
export function alternarPartido(p: Pick<Partido, "id" | "config">, f: FiltroTotales): FiltroTotales {
  const nuevo = !incluido(p, f);
  const sueltos = { ...f.sueltos };
  const porComp = !f.compsFuera.includes(competicionDe(p));
  if (nuevo === porComp) delete sueltos[p.id];
  else sueltos[p.id] = nuevo;
  return { compsFuera: f.compsFuera, sueltos };
}

export function soloCompeticion(cuentan: Pick<Partido, "id" | "config">[], comp: string): FiltroTotales {
  const otras = [...new Set(cuentan.map(competicionDe))].filter((c) => c !== comp);
  return { compsFuera: otras, sueltos: {} };
}

/** ¿Está metido todo lo que hay? (para no poner etiqueta de filtro). */
export function esTodo(cuentan: Pick<Partido, "id" | "config">[], f: FiltroTotales): boolean {
  return cuentan.every((p) => incluido(p, f));
}

/** Lo guardado en el aparato puede venir roto o ser de otra versión. */
export function leerFiltro(texto: string | null | undefined): FiltroTotales {
  try {
    const o = JSON.parse(texto ?? "");
    const compsFuera = Array.isArray(o?.compsFuera) ? o.compsFuera.filter((c: unknown) => typeof c === "string") : [];
    const sueltos: Record<string, boolean> = {};
    if (o?.sueltos && typeof o.sueltos === "object") {
      for (const [k, v] of Object.entries(o.sueltos)) if (typeof v === "boolean") sueltos[k] = v;
    }
    return { compsFuera, sueltos };
  } catch {
    return { ...FILTRO_TODO, sueltos: {} };
  }
}

/** Las excepciones de partidos que ya no están en el aparato, fuera. */
export function limpiarFiltro(cuentan: Pick<Partido, "id">[], f: FiltroTotales): FiltroTotales {
  const ids = new Set(cuentan.map((p) => p.id));
  return { compsFuera: f.compsFuera, sueltos: Object.fromEntries(Object.entries(f.sueltos).filter(([id]) => ids.has(id))) };
}

/**
 * Qué se escribe bajo el título. `nombre` traduce el código (lib/i18n.ts).
 *   · Todo dentro → `null` (no hace falta decir nada).
 *   · Competiciones enteras → «Liga + Copa del Rey».
 *   · Con excepciones a mano → las competiciones con algo dentro y `manual`.
 */
export function describirFiltro(
  cuentan: Pick<Partido, "id" | "config">[], f: FiltroTotales,
): { comps: string[]; manual: boolean; n: number } | null {
  if (esTodo(cuentan, f)) return null;
  const cs = competiciones(cuentan, f);
  return {
    comps: cs.filter((c) => c.dentro > 0).map((c) => c.codigo),
    manual: cs.some((c) => c.estado === "algunos"),
    n: cs.reduce((a, c) => a + c.dentro, 0),
  };
}
