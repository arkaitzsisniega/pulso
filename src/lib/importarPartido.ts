/**
 * importarPartido.ts — Cargar en este aparato un partido exportado (19/11/2026).
 *
 * El crono ya sabía SACAR un partido («Exportar JSON», en Resumen) pero no
 * sabía METERLO. Caso real: un compañero rehace el partido del 18/11 en modo
 * vídeo desde Safari en su Mac (sin iPad), lo exporta, y Arkaitz lo quiere en
 * el iPad del club. Con «Importar partido» (pantalla de inicio) el fichero
 * entra como un partido más de la lista, con todas sus acciones: Resumen,
 * Totales, el informe y el propio «Exportar JSON» funcionan igual que con uno
 * apuntado en el aparato.
 *
 * El formato es EL MISMO que exporta el crono: el objeto `Partido` tal cual,
 * con una etiqueta `exportacion` (app, formato, club, versión y hora) que se
 * añade desde hoy al exportar. Los ficheros de antes no la llevan y se siguen
 * aceptando: entonces el club se deduce de la plantilla (ver `deducirClub`).
 *
 * Reglas:
 *   · Se valida la ESTRUCTURA entera antes de tocar nada. Un fichero que no es
 *     un partido del crono no importa nada y dice por qué.
 *   · De OTRO club (inter / filial / juvenil / pulso son cronos distintos, con
 *     bases distintas): no se importa. Con etiqueta, se mira la etiqueta; sin
 *     ella, que la mayoría de convocados esté en la plantilla de este crono.
 *   · Un partido A MEDIAS se puede seguir apuntando: el formato guarda el reloj
 *     y los turnos. Si se exportó con el reloj en marcha, entra PARADO en el
 *     segundo en que se exportó (nadie sabe qué pasó después).
 *   · Choque (mismo id que uno guardado): NUNCA se pisa sin preguntar. Lo
 *     decide la pantalla con `aplicarDecision`: reemplazar, guardar los dos
 *     (el importado con id nuevo y marca «importado») o cancelar.
 *
 * Sin dependencias de React ni Dexie (se prueba con node):
 *   node --experimental-strip-types src/lib/importarPartido.test.ts
 */
import type { Partido, ParteId, Evento, TiempoJugador } from "./db";
export type { MarcaImportado } from "./db";

/** Versión del FORMATO del fichero. Subirla solo si un crono viejo ya no
 *  sabría leer lo que exporta uno nuevo. */
export const FORMATO_EXPORTACION = 1;
/** Marca de la app en la etiqueta: distingue el fichero de cualquier JSON. */
export const APP_EXPORTACION = "pulso-crono";
/** Más que esto no es un partido (uno largo de vídeo ronda 1 MB). */
export const TAMANO_MAXIMO = 20 * 1024 * 1024;

export interface EtiquetaExportacion {
  app: string;
  formato: number;
  cliente: string;
  version: string;
  /** ms (Date.now()) del momento de exportar. */
  exportado: number;
}

/** Lo que se escribe en el fichero: el partido tal cual + la etiqueta. */
export function paraExportar(
  partido: Partido,
  ctx: { cliente: string; version: string; ahora?: number },
): Partido & { exportacion: EtiquetaExportacion } {
  return {
    ...partido,
    exportacion: {
      app: APP_EXPORTACION,
      formato: FORMATO_EXPORTACION,
      cliente: ctx.cliente,
      version: ctx.version,
      exportado: ctx.ahora ?? Date.now(),
    },
  };
}

export type CodigoError =
  | "vacio"          // fichero vacío
  | "grande"         // más de TAMANO_MAXIMO
  | "no_json"        // no se puede leer como JSON
  | "es_copia"       // es la copia de seguridad de Totales, no un partido
  | "no_partido"     // JSON, pero no un partido del crono (detalle: qué falla)
  | "version"        // de un crono más nuevo
  | "otro_club"      // la etiqueta dice otro club (detalle: id del club)
  | "otro_roster";   // sin etiqueta y la plantilla no cuadra (n de total)

export type ResultadoValidacion =
  | {
      ok: true;
      /** Listo para guardar (sin la etiqueta, reloj parado, con la marca). */
      partido: Partido;
      /** Cómo se supo el club: por la etiqueta o por la plantilla. */
      club: "etiqueta" | "plantilla";
      /** El partido estaba a medias (se podrá «Continuar»). */
      enCurso: boolean;
      /** Venía con el reloj en marcha y se ha parado al importar. */
      relojParado: boolean;
    }
  | { ok: false; error: CodigoError; detalle?: string; n?: number; total?: number };

const PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
const ESTADOS = ["configurando", "en_curso", "finalizado"];
/** Tipos de evento que sabe dibujar y sumar ESTE crono. Uno que no esté aquí
 *  viene de un crono más nuevo: mejor decirlo que perderlo sin avisar. */
export const TIPOS_EVENTO: ReadonlyArray<Evento["tipo"]> = [
  "gol", "falta", "amarilla", "roja", "tiempo_muerto", "cambio",
  "accion_individual", "incorporacion_rival", "portero_jugador", "disparo",
  "penalti", "diezm", "fsb",
];

const esObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const esNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const esTxt = (v: unknown): v is string => typeof v === "string";

/** Qué falla en la estructura (null = es un partido del crono). Mira lo que
 *  leen Resumen, Totales y el informe; lo opcional de siempre no se exige. */
export function problemaEstructura(p: unknown): string | null {
  if (!esObj(p)) return "no es un objeto";
  if (!esTxt(p.id) || !p.id.trim()) return "id";
  if (!esTxt(p.estado) || !ESTADOS.includes(p.estado)) return "estado";
  if (p.modo !== undefined && p.modo !== "directo" && p.modo !== "video") return "modo";

  const c = p.config;
  if (!esObj(c)) return "config";
  for (const k of ["partido_id", "rival", "fecha"]) if (!esTxt(c[k])) return `config.${k}`;
  if (!Array.isArray(c.convocados) || !c.convocados.every(esTxt)) return "config.convocados";
  if (!esObj(c.pista_inicial)) return "config.pista_inicial";
  if (!esObj(c.duracionParte) || !PARTES.every((x) => esNum((c.duracionParte as Record<string, unknown>)[x])))
    return "config.duracionParte";

  const cr = p.cronometro;
  if (!esObj(cr) || !esTxt(cr.parteActual) || !PARTES.includes(cr.parteActual as ParteId)
      || !esNum(cr.segundosParte) || !(cr.ultimoStart === null || esNum(cr.ultimoStart)))
    return "cronometro";

  if (!Array.isArray(p.enPista) || !p.enPista.every(esTxt)) return "enPista";
  if (!esObj(p.tiempos)) return "tiempos";
  for (const [n, tj] of Object.entries(p.tiempos)) {
    if (!esObj(tj) || !esNum(tj.totalSegundos) || !esObj(tj.porParte)) return `tiempos.${n}`;
  }
  if (!esObj(p.marcador) || !esNum(p.marcador.inter) || !esNum(p.marcador.rival)) return "marcador";
  const st = p.stats;
  if (!esObj(st)) return "stats";
  for (const k of ["faltas", "amarillas", "tiemposMuerto"]) {
    const s = st[k];
    if (!esObj(s) || !PARTES.every((x) => esObj(s[x]))) return `stats.${k}`;
  }
  if (!Array.isArray(p.eventos)) return "eventos";
  for (let i = 0; i < p.eventos.length; i++) {
    const e = p.eventos[i];
    if (!esObj(e) || !esTxt(e.id) || !esTxt(e.tipo) || !esTxt(e.parte)
        || !PARTES.includes(e.parte as ParteId) || !esNum(e.segundosParte))
      return `eventos[${i}]`;
  }
  if (!esObj(p.acciones) || !esObj(p.acciones.porJugador)) return "acciones";
  if (!esObj(p.disparosRival)) return "disparosRival";
  if (p.tanda !== undefined && (!esObj(p.tanda) || !Array.isArray(p.tanda.tiros))) return "tanda";
  return null;
}

/** Sin etiqueta: ¿es de ESTE club? Sí, si la mayoría de los convocados están
 *  en la plantilla de este crono. No se pide el 100 %: entre temporadas o con
 *  una baja, alguno puede ya no estar. Las plantillas del filial y del juvenil
 *  comparten unos pocos chavales, pero ni de lejos la mitad. */
export function deducirClub(convocados: string[], roster: string[]): { suyo: boolean; n: number; total: number } {
  const set = new Set(roster.map((x) => x.trim().toUpperCase()));
  const unicos = [...new Set(convocados.map((x) => x.trim().toUpperCase()))].filter(Boolean);
  const n = unicos.filter((x) => set.has(x)).length;
  const total = unicos.length;
  return { suyo: total > 0 && n * 2 > total, n, total };
}

/** Para el reloj (y los turnos en pista / banquillo) en el instante `ref`:
 *  exactamente lo que haría darle a pausa en ese segundo. */
export function pararReloj(p: Partido, ref: number): { partido: Partido; parado: boolean } {
  const cr = p.cronometro;
  if (cr.ultimoStart == null) {
    // Aun con el reloj parado, un turno con hora de arranque se quedaría
    // contando: se limpia igual.
    const sucio = Object.values(p.tiempos).some((tj) => tj.turnoStart != null || tj.descansoStart != null);
    if (!sucio) return { partido: p, parado: false };
  }
  const parte = cr.parteActual;
  const seg = (desde: number) => Math.max(0, (ref - desde) / 1000);
  const tiempos: Record<string, TiempoJugador> = {};
  for (const [n, tj] of Object.entries(p.tiempos)) {
    let nt = { ...tj };
    if (nt.turnoStart != null) {
      const tramo = seg(nt.turnoStart);
      nt = {
        ...nt,
        segTurnoActual: (nt.segTurnoActual ?? 0) + tramo,
        totalSegundos: nt.totalSegundos + tramo,
        porParte: { ...nt.porParte, [parte]: (nt.porParte[parte] ?? 0) + tramo },
        turnoStart: null,
      };
    }
    if (nt.descansoStart != null) {
      nt = { ...nt, segDescansoActual: (nt.segDescansoActual ?? 0) + seg(nt.descansoStart), descansoStart: null };
    }
    tiempos[n] = nt;
  }
  const cronometro = cr.ultimoStart == null ? cr
    : { ...cr, segundosParte: cr.segundosParte + seg(cr.ultimoStart), ultimoStart: null };
  return { partido: { ...p, cronometro, tiempos }, parado: cr.ultimoStart != null };
}

/** Lee el texto del fichero y lo deja listo para guardar, o dice por qué no.
 *  `cliente` = id de ESTE crono; `roster` = nombres de su plantilla. */
export function validarArchivo(
  texto: string,
  ctx: { cliente: string; roster: string[]; ahora?: number },
): ResultadoValidacion {
  if (!texto || !texto.trim()) return { ok: false, error: "vacio" };
  if (texto.length > TAMANO_MAXIMO) return { ok: false, error: "grande" };
  let datos: unknown;
  try { datos = JSON.parse(texto.replace(/^﻿/, "")); }
  catch { return { ok: false, error: "no_json" }; }

  if (esObj(datos) && (datos.formato === "crono-copia-v1" || Array.isArray(datos.partidos)))
    return { ok: false, error: "es_copia" };
  if (Array.isArray(datos)) return { ok: false, error: "es_copia" };

  // La etiqueta primero: si viene de un crono más nuevo, la estructura puede
  // no cuadrar con la de aquí y el mensaje bueno es «actualiza».
  const et = esObj(datos) ? datos.exportacion : undefined;
  if (et !== undefined) {
    if (!esObj(et) || et.app !== APP_EXPORTACION || !esNum(et.formato))
      return { ok: false, error: "no_partido", detalle: "exportacion" };
    if (et.formato > FORMATO_EXPORTACION) return { ok: false, error: "version" };
  }

  const problema = problemaEstructura(datos);
  if (problema) return { ok: false, error: "no_partido", detalle: problema };
  const crudo = datos as unknown as Partido & { exportacion?: EtiquetaExportacion };

  const desconocido = crudo.eventos.find((e) => !TIPOS_EVENTO.includes(e.tipo));
  if (desconocido) return { ok: false, error: "version", detalle: String(desconocido.tipo) };

  // ¿De este club?
  let club: "etiqueta" | "plantilla";
  if (esObj(et) && esTxt(et.cliente) && et.cliente) {
    if (et.cliente.toLowerCase() !== ctx.cliente.toLowerCase())
      return { ok: false, error: "otro_club", detalle: et.cliente.toLowerCase() };
    club = "etiqueta";
  } else {
    const d = deducirClub(crudo.config!.convocados, ctx.roster);
    if (!d.suyo) return { ok: false, error: "otro_roster", n: d.n, total: d.total };
    club = "plantilla";
  }

  // Listo para guardar: sin la etiqueta, con lo opcional rellenado como lo
  // dejaría un partido nuevo, y con el reloj parado.
  const { exportacion, ...resto } = crudo;
  const ahora = ctx.ahora ?? Date.now();
  let partido: Partido = {
    ...resto,
    modo: resto.modo ?? "directo",
    incorporacionesRival: resto.incorporacionesRival ?? { total: 0, conDisparo: 0, sinDisparo: 0 },
    tanda: resto.tanda ?? { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
    actualizado: esNum(resto.actualizado) ? resto.actualizado : ahora,
  };
  const ref = exportacion && esNum(exportacion.exportado) ? exportacion.exportado : partido.actualizado;
  const parada = pararReloj(partido, ref);
  partido = parada.partido;
  // Un `importado` que viniera de una importación anterior se sustituye.
  partido = { ...partido, importado: { el: ahora, idOriginal: partido.id } };

  return {
    ok: true, partido, club,
    enCurso: partido.estado !== "finalizado",
    relojParado: parada.parado,
  };
}

/** Qué se hace cuando ya hay un partido con ese id. */
export type DecisionChoque = "reemplazar" | "ambos";

/** El partido que se guarda según la decisión. `reemplazar` = mismo id (pisa
 *  el que había, porque lo ha elegido él); `ambos` = id nuevo y marca de copia.
 *  Cancelar no llega aquí: no se guarda nada. */
export function aplicarDecision(p: Partido, decision: DecisionChoque, idNuevo: string): Partido {
  if (decision === "reemplazar") return p;
  return {
    ...p,
    id: idNuevo,
    importado: { el: p.importado?.el ?? Date.now(), idOriginal: p.importado?.idOriginal ?? p.id, copia: true },
  };
}

/** Nº de acciones apuntadas (para enseñar en la ventana). */
export function contarAcciones(p: Partido): number {
  return p.eventos.length + (p.tanda?.tiros.length ?? 0);
}
