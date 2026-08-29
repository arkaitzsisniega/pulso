"use client";

/**
 * totales.ts — Suma de TODOS los partidos guardados en este aparato.
 *
 * Por qué existe: el cuerpo técnico del filial no tiene bot ni acceso al panel
 * del club, y su temporada no se puede mezclar con la del primer equipo. Todo
 * lo que necesitan ya está guardado partido a partido en el iPad; esto lo suma.
 *
 * Es una función PURA sobre la lista de partidos: no toca la base ni la red.
 * Así el mismo cálculo vale para la pantalla y para el informe, y se puede
 * comprobar con datos de mentira.
 *
 * Solo cuenta partidos FINALIZADOS: uno a medias falsearía medias y resultados.
 */
import { JUGADOR_EQUIPO, type Partido, type Evento } from "@/lib/db";
import { ROSTER } from "@/lib/clientes";

/** Pseudo-jugadores: acciones del equipo y tarjetas al cuerpo técnico. Nunca
 *  son un convocado real, así que no salen en las tablas por jugador. */
const NO_SON_JUGADORES = new Set([JUGADOR_EQUIPO, "#CT"]);

export interface TotalesEquipo {
  partidos: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  faltas: number;
  amarillas: number;
  rojas: number;
  /** Disparos propios, sumando los de todos los jugadores. */
  disparos: number;
  aPuerta: number;
}

export interface TotalesJugador {
  nombre: string;
  dorsal: string;
  /** Partidos en los que estuvo convocado y partidos en los que llegó a jugar. */
  convocado: number;
  jugados: number;
  segundos: number;
  goles: number;
  asistencias: number;
  aPuerta: number;
  fuera: number;
  palo: number;
  bloqueados: number;
  robos: number;
  cortes: number;
  perdidas: number;
  divididosGanados: number;
  divididosPerdidos: number;
  amarillas: number;
  rojas: number;
  /** Solo porteros. */
  golesEncajados: number;
  paradas: number;
}

export interface Totales {
  equipo: TotalesEquipo;
  jugadores: TotalesJugador[];
  /** Los partidos que se han sumado, del más reciente al más antiguo. */
  partidos: {
    id: string;
    fecha: string;
    rival: string;
    competicion: string;
    local: boolean;
    golesFavor: number;
    golesContra: number;
    resultado: "G" | "E" | "P";
  }[];
}

function vacioJugador(nombre: string, dorsal: string): TotalesJugador {
  return {
    nombre, dorsal, convocado: 0, jugados: 0, segundos: 0, goles: 0,
    asistencias: 0, aPuerta: 0, fuera: 0, palo: 0, bloqueados: 0, robos: 0,
    cortes: 0, perdidas: 0, divididosGanados: 0, divididosPerdidos: 0,
    amarillas: 0, rojas: 0, golesEncajados: 0, paradas: 0,
  };
}

/** Suma los `Record<ParteId, {inter,rival}>` de stats en un solo número nuestro. */
function sumaNuestra(por: Record<string, { inter: number; rival: number }> | undefined): number {
  if (!por) return 0;
  return Object.values(por).reduce((a, p) => a + (p?.inter ?? 0), 0);
}

export function calcularTotales(todos: Partido[]): Totales {
  const finalizados = todos.filter((p) => p.estado === "finalizado" && p.config);
  // Del más reciente al más antiguo: es el orden en que se mira una temporada.
  finalizados.sort((a, b) =>
    String(b.config?.fecha ?? "").localeCompare(String(a.config?.fecha ?? "")));

  const dorsalDe = new Map(ROSTER.map((j) => [j.nombre, j.dorsal]));
  const porJugador = new Map<string, TotalesJugador>();
  const dame = (nombre: string) => {
    if (!porJugador.has(nombre)) {
      porJugador.set(nombre, vacioJugador(nombre, dorsalDe.get(nombre) ?? ""));
    }
    return porJugador.get(nombre)!;
  };

  const equipo: TotalesEquipo = {
    partidos: 0, ganados: 0, empatados: 0, perdidos: 0, golesFavor: 0,
    golesContra: 0, faltas: 0, amarillas: 0, rojas: 0, disparos: 0, aPuerta: 0,
  };
  const partidos: Totales["partidos"] = [];

  for (const p of finalizados) {
    const gf = p.marcador?.inter ?? 0;
    const gc = p.marcador?.rival ?? 0;
    const resultado: "G" | "E" | "P" = gf > gc ? "G" : gf === gc ? "E" : "P";

    equipo.partidos += 1;
    equipo.golesFavor += gf;
    equipo.golesContra += gc;
    if (resultado === "G") equipo.ganados += 1;
    else if (resultado === "E") equipo.empatados += 1;
    else equipo.perdidos += 1;
    equipo.faltas += sumaNuestra(p.stats?.faltas as never);
    equipo.amarillas += sumaNuestra(p.stats?.amarillas as never);

    partidos.push({
      id: p.id,
      fecha: String(p.config?.fecha ?? ""),
      rival: String(p.config?.rival ?? ""),
      competicion: String(p.config?.competicion ?? ""),
      local: Boolean(p.config?.local),
      golesFavor: gf, golesContra: gc, resultado,
    });

    // ── Convocados y minutos ──
    for (const nombre of p.config?.convocados ?? []) {
      if (NO_SON_JUGADORES.has(nombre)) continue;
      const j = dame(nombre);
      j.convocado += 1;
      const seg = p.tiempos?.[nombre]?.totalSegundos ?? 0;
      j.segundos += seg;
      if (seg > 0) j.jugados += 1;
    }

    // ── Acciones individuales ──
    for (const [nombre, c] of Object.entries(p.acciones?.porJugador ?? {})) {
      if (NO_SON_JUGADORES.has(nombre)) continue;
      const j = dame(nombre);
      j.aPuerta += c?.dpp ?? 0;
      j.fuera += c?.dpf ?? 0;
      j.palo += c?.dpa ?? 0;
      j.bloqueados += c?.dpb ?? 0;
      j.robos += c?.robos ?? 0;
      j.cortes += c?.cortes ?? 0;
      j.perdidas += (c?.pf ?? 0) + (c?.pnf ?? 0);
      j.divididosGanados += c?.bdg ?? 0;
      j.divididosPerdidos += c?.bdp ?? 0;
      j.golesEncajados += c?.golesEncajados ?? 0;
      j.paradas += c?.paradas ?? 0;
    }

    // ── Goles, asistencias y tarjetas, del registro de eventos ──
    for (const ev of (p.eventos ?? []) as Evento[]) {
      const e = ev as never as Record<string, unknown>;
      const tipo = String(e.tipo ?? "");
      const equipoEv = String(e.equipo ?? "");
      if (tipo === "gol" && equipoEv === "INTER") {
        // Un gol en propia del rival no lo marca nadie nuestro: suma al
        // marcador (ya contado arriba) pero NO a ningún goleador.
        const goleador = String(e.goleador ?? "").trim();
        if (goleador && !NO_SON_JUGADORES.has(goleador)) dame(goleador).goles += 1;
        const asistente = String(e.asistente ?? "").trim();
        if (asistente && !NO_SON_JUGADORES.has(asistente)) dame(asistente).asistencias += 1;
      }
      if ((tipo === "amarilla" || tipo === "roja") && equipoEv === "INTER") {
        const quien = String(e.jugador ?? "").trim();
        if (tipo === "roja") equipo.rojas += 1;
        if (!quien || NO_SON_JUGADORES.has(quien)) continue;
        if (tipo === "amarilla") dame(quien).amarillas += 1;
        else dame(quien).rojas += 1;
      }
    }
  }

  const jugadores = [...porJugador.values()];
  for (const j of jugadores) {
    equipo.disparos += j.aPuerta + j.fuera + j.palo + j.bloqueados;
    equipo.aPuerta += j.aPuerta;
  }
  // Orden: los que más han jugado primero — es como se mira una plantilla.
  jugadores.sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre));

  return { equipo, jugadores, partidos };
}

/** "1h 23'" para totales largos; "23'" cuando no llega a la hora. */
export function formatMinutos(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min}'`;
  return `${Math.floor(min / 60)}h ${min % 60}'`;
}
