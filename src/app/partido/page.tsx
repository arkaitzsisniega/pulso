"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePartido } from "@/lib/store";
import { ROSTER, NOMBRE_CORTO_TC, CLIENTE } from "@/lib/clientes";
import { formatMMSS, colorTiempoPista, colorTiempoBanquillo } from "@/lib/utils";
import { segundosVivos, formatCuentaAtras, msHastaSiguienteCambio } from "@/lib/reloj";
import { Campo } from "@/components/Campo";
import { Porteria } from "@/components/Porteria";
import type { ContadoresJugador, ResultadoDisparo, TandaPenaltis, TiroTanda, Partido, ParteId, ConfigPartido, AccionIndTipo, Evento } from "@/lib/db";
import { direccionAtaque, sacaEn, JUGADOR_EQUIPO } from "@/lib/db";
import { t, useIdioma, labelResultadoDisparo, labelAccionGol } from "@/lib/i18n";

export default function PartidoPage() {
  useIdioma();
  const router = useRouter();
  const {
    partido, cargado,
    segundosTurnoActual, segundosBanquillo, segundosParte,
    segundosPartidoTotal, segundosEnParte,
    segundosRestantesParte, duracionParteActual,
    play, pausa, ajustarReloj, avanzarParte, cambiarJugador, reincorporar,
    registrarEvento, deshacerUltimoEvento, incAccion, registrarAccionIndividual,
    iniciarTanda, apuntarTiroTanda, deshacerUltimoTiroTanda, cerrarTanda,
    setDuracionesParte, finalizarPartido, retrocederParte, setModo,
    setDireccionAtaque, setSaqueInicial } = usePartido();

  // Estado UI
  const [modalCambio, setModalCambio] = useState<{ sale: string } | null>(null);
  const [modalAccionInd, setModalAccionInd] = useState<{ jugador: string } | null>(null);
  const [modalAccionBanquillo, setModalAccionBanquillo] = useState<{ jugador: string } | null>(null);
  const [modalFalta, setModalFalta] = useState(false);
  const [modalGol, setModalGol] = useState(false);
  const [modalAmarilla, setModalAmarilla] = useState(false);
  const [modalRoja, setModalRoja] = useState(false);
  // Confirmaciones encadenadas tras una tarjeta:
  //  · confirmExpulRival: 2ª amarilla de un dorsal rival → ¿juegan con uno menos?
  //    (no trackeamos quién está en pista del rival, así que lo preguntamos).
  //  · confirmFaltaCT: amarilla al cuerpo técnico (cualquier equipo) → ¿suma
  //    falta de equipo? (no toda tarjeta al banquillo conlleva falta).
  const [confirmExpulRival, setConfirmExpulRival] = useState<{ dorsal: string } | null>(null);
  const [confirmFaltaCT, setConfirmFaltaCT] = useState<{ equipo: "INTER" | "RIVAL" } | null>(null);
  const [modalTM, setModalTM] = useState(false);
  const [modalPen, setModalPen] = useState(false);
  const [modalTanda, setModalTanda] = useState(false);
  const [modalTiempos, setModalTiempos] = useState(false);
  const [modalDisparoRival, setModalDisparoRival] = useState(false);
  const [modalIncorporacion, setModalIncorporacion] = useState(false);
  // Al darle a iniciar por primera vez se pregunta quién saca. Con eso, al
  // empezar la 2ª parte el crono ya sabe a quién le toca y lo recuerda
  // (Arkaitz 22/8/2026: antes había que acordarse de memoria).
  const [modalSaque, setModalSaque] = useState(false);
  const [modalCambioParte, setModalCambioParte] = useState(false);
  // Aviso corto tras una acción que se guarda SIN abrir modal (pérdida y
  // recuperación de equipo). Arkaitz: "le doy al botón y, al no pasar nada, no
  // sé si lo he apuntado". Se borra solo.
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarAviso = (texto: string) => {
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    setAviso(texto);
    avisoTimer.current = setTimeout(() => setAviso(null), 1600);
  };
  useEffect(() => () => {
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
  }, []);

  // Jugadores nuestros que tienen al menos una amarilla.
  // OJO: useMemo debe ir ANTES de los early returns (reglas de hooks).
  const jugadoresAmarilla = useMemo(() => {
    const s = new Set<string>();
    for (const ev of partido.eventos) {
      if (ev.tipo === "amarilla" && ev.equipo === "INTER" && (ev as any).jugador
          && (ev as any).jugador !== "#CT") {
        s.add((ev as any).jugador);
      }
    }
    return s;
  }, [partido.eventos]);

  // Jugadores EXPULSADOS de los nuestros (2ª amarilla o roja directa).
  // Estos jugadores se bloquean: no se pueden cambiar, ni tocar para
  // acciones individuales, ni asignarles disparos/goles. Quedan fuera
  // del partido para el resto de tiempo.
  const jugadoresExpulsados = useMemo(() => {
    const cuentaAmarillas: Record<string, number> = {};
    const rojas = new Set<string>();
    for (const ev of partido.eventos) {
      const e = ev as any;
      if (e.tipo === "amarilla" && e.equipo === "INTER" && e.jugador
          && e.jugador !== "#CT") {
        cuentaAmarillas[e.jugador] = (cuentaAmarillas[e.jugador] || 0) + 1;
      }
      if (e.tipo === "roja" && e.equipo === "INTER" && e.jugador) {
        rojas.add(e.jugador);
      }
    }
    const expulsados = new Set<string>();
    for (const [nombre, n] of Object.entries(cuentaAmarillas)) {
      if (n >= 2) expulsados.add(nombre);
    }
    for (const n of rojas) expulsados.add(n);
    return expulsados;
  }, [partido.eventos]);

  // INFERIORIDAD NUMÉRICA — crono regresivo de 2 minutos tras roja de
  // un jugador que estaba en pista. Se cancela si el rival mete gol
  // durante esos 2 minutos (otro jugador puede entrar). En futsal real
  // la regla es: 2 min de juego efectivo o hasta gol del rival.
  //
  // CRONOS DE INFERIORIDAD / SUPERIORIDAD — ahora es un ARRAY (puede haber
  // 1, 2 o más activos simultáneamente si hay varias expulsiones seguidas).
  //
  // Cálculo derivado de los eventos:
  //   1) Buscamos todas las rojas del equipo X ordenadas por tiempo de partido.
  //   2) Buscamos goles del equipo CONTRARIO ordenados por tiempo.
  //   3) Cada gol del contrario cancela la roja MÁS ANTIGUA aún activa
  //      (regla FIFA futsal: cada gol libera al primer expulsado).
  //   4) Las rojas que NO han sido canceladas Y han pasado <120s desde su
  //      tiempo se muestran como cronos activos.
  //   5) Cada crono tiene su propio segRestantes.
  function calcularCronosActivos(
    rojasEquipo: any[],
    golesContrario: any[],
    tActual: number,
  ): Array<{ segRestantes: number; jugador: string; tInicio: number }> {
    if (rojasEquipo.length === 0) return [];
    // Cancelaciones: matchamos cada gol con la roja más antigua aún viva.
    const rojas = rojasEquipo
      .map((r) => ({
        tInicio: r.segundosPartido || 0,
        jugador: r.jugador || "expulsado",
        cancelada: false,
      }))
      .sort((a, b) => a.tInicio - b.tInicio);
    const goles = golesContrario
      .map((g) => g.segundosPartido || 0)
      .sort((a, b) => a - b);
    for (const tGol of goles) {
      // Cada gol cancela la roja más antigua que (a) aún esté viva y
      // (b) cuyo tInicio sea anterior al gol.
      const objetivo = rojas.find((r) => !r.cancelada && r.tInicio < tGol);
      if (objetivo) objetivo.cancelada = true;
    }
    // Devolver los que siguen activos: no cancelados Y <120s desde inicio
    return rojas
      .filter((r) => !r.cancelada && tActual - r.tInicio < 120)
      .map((r) => ({
        segRestantes: Math.max(0, 120 - (tActual - r.tInicio)),
        jugador: r.jugador,
        tInicio: r.tInicio,
      }));
  }

  // Bug fix 20/5/2026: antes el useMemo solo dependía de partido.cronometro,
  // que cambia únicamente en play/pausa/avanzarParte. El forceTick del store
  // (cada TICK_MS) no toca cronometro, así que estos cronos NO avanzaban con
  // el partido en marcha — solo "saltaban" al pausar. Pasamos el valor de
  // segundosPartidoTotal() como dep para que cada tick recalcule.
  // Reloj ABSOLUTO del partido (acumulado entre partes). Necesario para que el
  // restante de 2 min y la cancelación por gol de los cronos de inferioridad/
  // superioridad sean coherentes ENTRE partes: antes se comparaba el tiempo
  // por-parte de una roja con el reloj de otra parte → crono fantasma al
  // empezar la 2ª parte (#bug crono). Aislado aquí; el store NO cambia.
  const _ORDEN_PARTES: ParteId[] = ["1T", "2T", "PR1", "PR2"];
  const _offsetParte = (parte: ParteId): number => {
    const g = partido.cronometro.segundosGuardadosPorParte ?? ({} as Record<ParteId, number>);
    let off = 0;
    for (const pid of _ORDEN_PARTES) { if (pid === parte) break; off += g[pid] ?? 0; }
    return off;
  };
  const _tAbs = (ev: any): number =>
    _offsetParte(ev.parte) + (ev.segundosPartido ?? ev.segundosParte ?? 0);
  const _tActualParaCronos =
    _offsetParte(partido.cronometro.parteActual) + segundosPartidoTotal();
  const cronosInferioridad = useMemo(() => {
    const evs = partido.eventos as any[];
    const rojas = evs.filter((e) => e.tipo === "roja" && e.equipo === "INTER" && e.jugador !== "#CT")
                     .map((e) => ({ ...e, segundosPartido: _tAbs(e) }));
    const goles = evs.filter((e) => e.tipo === "gol" && e.equipo === "RIVAL")
                     .map((e) => ({ ...e, segundosPartido: _tAbs(e) }));
    return calcularCronosActivos(rojas, goles, _tActualParaCronos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido.eventos, _tActualParaCronos]);

  const cronosSuperioridad = useMemo(() => {
    const evs = partido.eventos as any[];
    const rojas = evs.filter((e) => e.tipo === "roja" && e.equipo === "RIVAL" && e.jugador !== "#CT")
                     .map((e) => ({ ...e, segundosPartido: _tAbs(e) }));
    const goles = evs.filter((e) => e.tipo === "gol" && e.equipo === "INTER")
                     .map((e) => ({ ...e, segundosPartido: _tAbs(e) }));
    return calcularCronosActivos(rojas, goles, _tActualParaCronos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido.eventos, _tActualParaCronos]);

  // Avisos de porteros (validaciones tácticas):
  // - 0 porteros en pista: situación normal en fin de partido perdiendo
  //   (portero-jugador). Aviso pequeño, no exagerado.
  // - 2 porteros en pista: nunca debe pasar. Aviso visible para corregir.
  const porterosEnPista = useMemo(() => {
    return partido.enPista.filter((n) => {
      const j = ROSTER.find((r) => r.nombre === n);
      return j?.posicion === "PORTERO";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido.enPista]);

  // OFFLINE: precargar la pantalla de Resumen (y la home) mientras haya conexión,
  // para que el botón "Resumen" funcione también SIN internet (en el pabellón).
  // Antes fallaba con "couldn't load, try again" al navegar a una ruta cuyos
  // recursos aún no estaban en la caché del service worker. Con el prefetch, el
  // SW cachea /resumen en cuanto entras al partido → luego funciona offline.
  useEffect(() => {
    try {
      router.prefetch("/resumen");
      router.prefetch("/");
    } catch { /* prefetch best-effort */ }
  }, [router]);

  // Helper central para EXPULSAR a un jugador INTER: registra evento
  // roja + si el jugador está en pista, lo saca automáticamente
  // dejando un slot vacío (inferioridad numérica). Si está en banquillo,
  // solo registra la roja (queda como expulsado sin más).
  //
  // Usar SIEMPRE desde cualquier sitio que registre una roja INTER (no
  // llamar a registrarEvento directamente) para que el comportamiento
  // sea consistente y se dispare el crono regresivo.
  const expulsarJugadorInter = (jugador: string) => {
    registrarEvento({ tipo: "roja", equipo: "INTER", jugador } as any);
    if (partido.enPista.includes(jugador)) {
      // cambiarJugador con entra="" saca al jugador sin reemplazo →
      // enPista pasa de 5 a 4. Eso dispara el banner de inferioridad.
      cambiarJugador(jugador, "");
    }
  };

  // Helper único para registrar amarilla a un jugador INTER. Si era la
  // 2ª amarilla, dispara automáticamente la EXPULSIÓN (roja + sale
  // de pista si estaba).
  const registrarAmarillaInter = (jugador: string) => {
    registrarEvento({ tipo: "amarilla", equipo: "INTER", jugador } as any);
    const yaTenia = partido.eventos.filter(
      (e: any) => e.tipo === "amarilla" && e.equipo === "INTER" && e.jugador === jugador
    ).length;
    if (yaTenia + 1 >= 2) {
      expulsarJugadorInter(jugador);
    }
  };

  if (!cargado) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">{t("part_cargando")}</div>;
  }
  if (partido.estado !== "en_curso" || !partido.config) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <p className="text-xl">{t("part_no_en_curso")}</p>
        <div className="flex gap-3">
          <button onClick={() => router.push("/")}
            className="px-6 py-3 bg-zinc-800 rounded-xl text-lg">
            {t("inicio")}
          </button>
          <button onClick={() => router.push("/nuevo")}
            className="px-6 py-3 bg-emerald-700 rounded-xl text-lg font-bold">
            {t("part_crear_nuevo")}
          </button>
        </div>
      </div>
    );
  }

  const cfg = partido.config;
  const corriendo = partido.cronometro.ultimoStart != null;
  // Modo de captura (default "directo" para partidos antiguos sin el campo).
  // En directo, los modales de disparo/falta/acción NO piden zona de campo ni
  // de portería (se apunta solo que ocurrió); en vídeo piden todo el detalle.
  const directo = (partido.modo ?? "directo") === "directo";
  const segParte = segundosParte();
  const dur = duracionParteActual();
  const restantes = segundosRestantesParte();
  const acabada = dur > 0 && restantes <= 0;
  const enPista = partido.enPista;
  const banquillo = cfg.convocados.filter((n) => !enPista.includes(n));
  // Listas FILTRADAS sin expulsados: usadas en todos los modales y
  // selectores donde no tiene sentido elegir a un jugador expulsado
  // (cambios, asignación de stats, falta, gol, etc). Las versiones
  // originales `enPista`/`banquillo` se reservan para el render
  // visual donde el expulsado SÍ debe aparecer (con su estética roja).
  const enPistaActivos = enPista.filter((n) => !jugadoresExpulsados.has(n));

  // Orden VISUAL de los 5 en pista: el que MÁS tiempo lleva en pista EN ESTE
  // TURNO (desde que entró, en vivo) va a la IZQUIERDA; el recién entrado, a la
  // derecha. Antes ordenaba por el TOTAL jugado en el partido, con lo que un
  // jugador recién entrado con muchos minutos acumulados se ponía a la
  // izquierda — por eso Arkaitz decía que "seguía sin funcionar" (16/8). Es
  // estable mientras el reloj corre (todos suman a la vez) y solo se reordena
  // al hacer un cambio. Empate → orden de la lista de pista (portero primero
  // al inicio). NO muta partido.enPista (solo afecta al render).
  const enPistaVista = [...enPista]
    .map((n, i) => ({ n, i, seg: segundosTurnoActual(n) }))
    .sort((a, b) => (b.seg - a.seg) || (a.i - b.i))
    .map((x) => x.n);

  // Orden VISUAL del banquillo: el que ha salido del campo MÁS RECIENTEMENTE a
  // la IZQUIERDA … y los que aún NO han jugado, los últimos (en orden de
  // convocatoria). Pedido por Arkaitz (16/8). Se usa también en las listas de
  // "cambio rápido" para que vea el mismo orden en todas partes.
  const _ordenBanquillo = (n: string, i: number): [number, number, number] => {
    const tj = partido.tiempos[n];
    // "Ha jugado" ⇔ ha salido alguna vez de pista (segTurnoUltimo se fija al
    // salir) o acumula tiempo. Los que nunca entraron tienen ultimaSalida =
    // hora de creación del partido, así que hay que separarlos explícitamente.
    const haJugado = !!tj && (tj.segTurnoUltimo != null || (tj.totalSegundos ?? 0) > 0);
    return [haJugado ? 0 : 1, -(tj?.ultimaSalida ?? 0), i];
  };
  const banquilloVista = [...banquillo]
    .map((n, i) => ({ n, k: _ordenBanquillo(n, i) }))
    .sort((a, b) => (a.k[0] - b.k[0]) || (a.k[1] - b.k[1]) || (a.k[2] - b.k[2]))
    .map((x) => x.n);
  const banquilloActivos = banquilloVista.filter((n) => !jugadoresExpulsados.has(n));

  // Huecos en pista cuya sanción YA terminó (pasaron los 2 min o el rival
  // marcó y canceló la roja) → se pueden rellenar metiendo a alguien del
  // banquillo. Plantilla completa = 5. Cada inferioridad AÚN activa justifica
  // un hueco; los que sobran son rellenables.
  const huecosRellenables = Math.max(0, (5 - enPista.length) - cronosInferioridad.length);

  const p = partido.cronometro.parteActual;
  const sFalt = partido.stats.faltas[p];
  // AMARILLAS: se guardan por parte (para el informe), pero se MUESTRAN
  // acumuladas de TODO el partido — una amarilla no caduca al cambiar de
  // parte, prórroga o penaltis (regla del reglamento; pedido Arkaitz 16/8).
  // Antes se mostraba solo la parte actual y en la 2ª parte "aparecían" 0.
  // Las FALTAS sí se reinician por parte (eso está bien).
  const sAma = (["1T", "2T", "PR1", "PR2"] as ParteId[]).reduce(
    (acc, pid) => ({
      inter: acc.inter + (partido.stats.amarillas[pid]?.inter ?? 0),
      rival: acc.rival + (partido.stats.amarillas[pid]?.rival ?? 0),
    }),
    { inter: 0, rival: 0 });
  const sTM = partido.stats.tiemposMuerto[p];

  return (
    // PANTALLA COMPLETA SIN SCROLL (pedido Arkaitz 17/8: en el iPad en horizontal
    // había que bajar para ver faltas/tarjetas). Columna flex de la altura exacta
    // de la ventana (100dvh): "En pista" crece para llenar el hueco y todo lo
    // demás va compacto (modo + ajuste de reloj + faltas/tarjetas en UNA línea,
    // banquillo en una fila, botones más bajos). Si algún día no cabe (muchos
    // banners a la vez), el contenedor sí permite scroll como red de seguridad.
    <div className="h-[100dvh] bg-zinc-950 text-zinc-100 p-2 flex flex-col gap-1.5 overflow-y-auto">
      {/* BOTÓN DE TIEMPO FLOTANTE — SIEMPRE accesible arriba a la derecha, por
          encima de cualquier modal (z-[60] > z-50 de los ModalShell). En futsal
          el reloj se arranca/para sin parar, también mientras metes disparos,
          pérdidas o faltas con un modal abierto. Pedido Arkaitz 10/8/2026. */}
      <div className="fixed top-2 right-2 z-[60]">
        {!corriendo
          ? <button
              onClick={() => {
                // Antes de arrancar el partido, quién saca. Solo la 1ª vez:
                // si ya está anotado, o no es el principio, arranca directo.
                if (!partido.saqueInicial1T && p === "1T"
                    && partido.eventos.length === 0) {
                  setModalSaque(true);
                  return;
                }
                play();
              }}
              aria-label={t("part_iniciar")}
              className="px-5 py-3 bg-green-700 hover:bg-green-600 rounded-xl text-lg font-bold shadow-lg shadow-black/60 border border-green-300/40">▶ {t("part_iniciar")}</button>
          : <button onClick={pausa} aria-label={t("part_pausar")}
              className="px-5 py-3 bg-orange-700 hover:bg-orange-600 rounded-xl text-lg font-bold shadow-lg shadow-black/60 border border-orange-200/40">⏸ {t("part_pausar")}</button>}
      </div>

      {/* HEADER (compacto) */}
      {/* pr-52: el de iniciar/parar es flotante (fixed, arriba a la derecha) y
          con pr-36 los controles de parte le quedaban DEBAJO (Arkaitz 22/8). */}
      <div className="flex items-center justify-between pr-52 flex-none">
        <div className="flex items-center gap-3">
          {/* Reloj grande: componente propio que se repinta JUSTO en cada
              límite de segundo (no cada 250 ms) y cuenta atrás tipo marcador
              (20:00 durante el 1er segundo, 00:00 solo al acabar). Ver
              lib/reloj.ts. Pedido Arkaitz 16/8 ("parece ir más lento"). */}
          <RelojGrande
            segundosParte={partido.cronometro.segundosParte}
            ultimoStart={partido.cronometro.ultimoStart}
            dur={dur}
            acabada={acabada} />
          <div className="text-sm text-zinc-400 leading-tight">
            <div className="font-bold">{p}</div>
            <div className="text-xs">
              {dur > 0
                ? `${formatMMSS(segParte)} / ${formatMMSS(dur)}`
                : `tot ${formatMMSS(segundosPartidoTotal())}`}
            </div>
            {acabada && <div className="text-red-400 text-xs font-bold">{t("part_fin_parte")}</div>}
          </div>
        </div>
        <div className="text-3xl font-bold tabular-nums">
          <span className="text-emerald-400">{CLIENTE.nombreCorto} {partido.marcador.inter}</span>
          <span className="text-zinc-500 mx-2">-</span>
          <span className="text-red-400">{partido.marcador.rival} {cfg.rival}</span>
        </div>
        <div className="flex gap-2">
          {/* El botón Iniciar/Parar ahora es el FLOTANTE de arriba (fixed,
              siempre visible). Aquí quedan solo los controles de parte. */}
          <button
            onClick={() => {
              if (p !== "1T" && confirm(t("part_volver_parte_confirm", { parte: p }))) {
                retrocederParte();
              }
            }}
            disabled={p === "1T"}
            className="px-2 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm"
            title={t("part_volver_parte_title")}>
            ⏮
          </button>
          <button onClick={() => setModalCambioParte(true)}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
            {t("part_parte_btn")}
          </button>
        </div>
      </div>

      {/* BANNERS DE INFERIORIDAD / SUPERIORIDAD NUMÉRICA — pueden estar
          activos VARIOS a la vez (un crono independiente por expulsado,
          regla FIFA futsal). Cada gol del rival cancela el crono de
          inferioridad MÁS ANTIGUO; cada gol nuestro cancela el de
          superioridad más antiguo. */}
      {(cronosInferioridad.length > 0 || cronosSuperioridad.length > 0) && (
        <div className={`grid ${(cronosInferioridad.length + cronosSuperioridad.length) >= 2 ? "grid-cols-2" : "grid-cols-1"} gap-2 flex-none`}>
          {cronosInferioridad.map((c, i) => (
            <div key={`inf-${c.tInicio}-${i}`}
              className="bg-red-700/90 border-2 border-red-400 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🟥</span>
                <div>
                  <div className="text-base font-bold leading-tight">
                    {t("part_inferioridad", { jugador: c.jugador })}
                  </div>
                  <div className="text-xs text-red-100 mt-0.5">
                    {t("part_inferioridad_nota")}
                  </div>
                </div>
              </div>
              <div className="text-4xl font-mono font-bold tabular-nums">
                {formatMMSS(Math.ceil(c.segRestantes))}
              </div>
            </div>
          ))}
          {cronosSuperioridad.map((c, i) => (
            <div key={`sup-${c.tInicio}-${i}`}
              className="bg-emerald-700/90 border-2 border-emerald-400 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🟩</span>
                <div>
                  <div className="text-base font-bold leading-tight">
                    {t("part_superioridad", { jugador: c.jugador })}
                  </div>
                  <div className="text-xs text-emerald-100 mt-0.5">
                    {t("part_superioridad_nota")}
                  </div>
                </div>
              </div>
              <div className="text-4xl font-mono font-bold tabular-nums">
                {formatMMSS(Math.ceil(c.segRestantes))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REINCORPORAR TRAS INFERIORIDAD — cuando una sanción termina (2 min
          cumplidos o gol del rival) queda un hueco en pista. Aquí se ofrece
          meter a un jugador del banquillo de un toque (rápido para el live). */}
      {huecosRellenables > 0 && (
        <div className="bg-emerald-700/90 border-2 border-emerald-400 rounded-lg p-2 flex-none">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">✅</span>
            <div>
              <div className="text-base font-bold leading-tight">
                {t("part_inf_terminada")}
                {huecosRellenables > 1 ? t("part_inf_huecos", { n: huecosRellenables }) : ""}
              </div>
              <div className="text-xs text-emerald-100 mt-0.5">
                {t("part_inf_toca_entra")}
              </div>
            </div>
          </div>
          {banquilloActivos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {banquilloActivos.map((n) => (
                <button key={n} onClick={() => reincorporar(n)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold">
                  ➕ {n}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-emerald-100">
              {t("part_inf_nadie")}
            </div>
          )}
        </div>
      )}

      {/* AVISOS DE PORTEROS — validaciones tácticas.
          - 2 porteros en pista: nunca debe pasar, banner amarillo destacado.
          - 0 porteros en pista: situación normal en fin de partido
            perdiendo (portero-jugador). Línea pequeña discreta. */}
      {porterosEnPista.length >= 2 && (
        <div className="bg-yellow-600/90 border-2 border-yellow-300 rounded-lg p-2 flex-none flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div className="text-sm font-bold leading-tight">
            {t("part_porteros_dos", { n: porterosEnPista.length, lista: porterosEnPista.join(", ") })}
          </div>
        </div>
      )}
      {porterosEnPista.length === 0 && enPista.length > 0 && (
        <div className="text-xs text-zinc-500 flex-none flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>{t("part_sin_portero")}</span>
        </div>
      )}

      {/* LÍNEA DE CONTROL (una sola fila): modo directo/vídeo · ajuste de reloj ·
          faltas / amarillas / TM de la parte · avisos de faltas · tarjetas del
          rival. Antes eran 2 filas arriba + una barra al final de la página que
          obligaba a hacer scroll en el iPad. */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap flex-none text-sm">
        <div className="inline-flex rounded-lg overflow-hidden border border-zinc-700" title={directo ? t("part_modo_directo_nota") : t("part_modo_video_nota")}>
          <button onClick={() => setModo("directo")}
            className={`px-2.5 py-1 text-xs font-bold ${directo ? "bg-red-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
            🔴 {t("part_modo_directo")}
          </button>
          <button onClick={() => setModo("video")}
            className={`px-2.5 py-1 text-xs font-bold ${!directo ? "bg-sky-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
            🎥 {t("part_modo_video")}
          </button>
        </div>
        {/* Dirección de ataque. Se elige al crear el partido, pero hasta el
            saque puede cambiar (sorteo, decisión del árbitro) y antes había
            que rehacer el partido entero. Enseña hacia dónde ataca el Inter EN
            ESTA PARTE (en la 2ª se invierte solo) y al tocarlo lo cambia. */}
        <button
          onClick={() => setDireccionAtaque(cfg.direccionInter1T === "der" ? "izq" : "der")}
          title={t("part_direccion_nota")}
          className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700
                     rounded-lg border border-zinc-700 text-xs font-bold">
          <span className="text-zinc-500 text-[10px] uppercase">{t("part_direccion")}</span>
          <span className="text-emerald-300 text-base leading-none">
            {direccionAtaque(p, "INTER", cfg) === "der" ? "▶" : "◀"}
          </span>
        </button>
        <div className="flex items-center gap-1" title={t("part_ajustar_nota")}>
          <span className="text-zinc-500 text-[10px]">{t("part_ajustar_reloj")}</span>
          {([-60, -10, -1, 1, 10, 60] as const).map((d) => (
            <button key={d} onClick={() => ajustarReloj(d)}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 font-mono text-xs">
              {d < 0 ? "−" : "+"}{formatMMSS(Math.abs(d)).replace(/^0/, "")}
            </button>
          ))}
        </div>
        {/* Faltas / amarillas (todo el partido) / TM */}
        <div className="flex items-center gap-x-3 ml-auto text-sm">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wide">{t("part_stats_parte", { parte: p })}</span>
          <span>
            <span className="text-emerald-400 font-bold">I</span> {t("part_faltas")}{" "}
            <strong className={sFalt.inter >= 5 ? "text-red-400" : ""}>{sFalt.inter}</strong>
            <span className="text-zinc-600 mx-1">/</span>
            <span className="text-red-400 font-bold">R</span> {t("part_faltas")}{" "}
            <strong className={sFalt.rival >= 5 ? "text-red-400" : ""}>{sFalt.rival}</strong>
          </span>
          <span>🟨 <strong>{sAma.inter}</strong><span className="text-zinc-600">/</span><strong>{sAma.rival}</strong></span>
          <span>🛑 TM <strong>{sTM.inter}</strong><span className="text-zinc-600">/</span><strong>{sTM.rival}</strong></span>
        </div>
        {/* Avisos de faltas (solo el más alto que aplique) + tarjetas del rival */}
        {sFalt.inter === 4 && <span className="bg-amber-600 rounded px-2 py-0.5 text-xs font-bold">{t("part_inter_4falta", { equipo: NOMBRE_CORTO_TC })}</span>}
        {sFalt.inter === 5 && <span className="bg-orange-600 rounded px-2 py-0.5 text-xs font-bold">{t("part_inter_5falta", { equipo: NOMBRE_CORTO_TC })}</span>}
        {sFalt.inter >= 6 && <span className="bg-red-700 rounded px-2 py-0.5 text-xs font-bold">{t("part_inter_6falta", { n: sFalt.inter, equipo: NOMBRE_CORTO_TC })}</span>}
        {sFalt.rival === 4 && <span className="bg-amber-600 rounded px-2 py-0.5 text-xs font-bold">{t("part_rival_4falta")}</span>}
        {sFalt.rival === 5 && <span className="bg-orange-600 rounded px-2 py-0.5 text-xs font-bold">{t("part_rival_5falta")}</span>}
        {sFalt.rival >= 6 && <span className="bg-emerald-700 rounded px-2 py-0.5 text-xs font-bold">{t("part_rival_6falta", { n: sFalt.rival, equipo: NOMBRE_CORTO_TC })}</span>}
        {(() => {
          const evs = partido.eventos as any[];
          const amaRival = evs.filter((e) => e.tipo === "amarilla" && e.equipo === "RIVAL" && e.jugador).map((e) => e.jugador as string);
          const rojaRival = evs.filter((e) => e.tipo === "roja" && e.equipo === "RIVAL" && e.jugador).map((e) => e.jugador as string);
          if (!amaRival.length && !rojaRival.length) return null;
          const rojaSet = new Set(rojaRival);
          const amaSinExp = amaRival.filter((d) => !rojaSet.has(d));
          return (
            <span className="text-xs">
              {amaSinExp.length > 0 && <span className="text-yellow-300">{t("part_ama_rival", { rival: cfg.rival })} <strong>{amaSinExp.join(", ")}</strong></span>}
              {amaSinExp.length > 0 && rojaRival.length > 0 && <span className="text-zinc-600 mx-1">·</span>}
              {rojaRival.length > 0 && <span className="text-red-300">{t("part_roja_rival_exp", { rival: cfg.rival })} <strong>{rojaRival.join(", ")}</strong></span>}
            </span>
          );
        })()}
      </div>

      {/* EN PISTA — reparto de altura (Arkaitz 20/8/2026: "el botón del jugador
          se ve demasiado grande"). La pista cede un 40 % de su alto y ese
          espacio va a las dos filas de botones, 20 % a cada una: de ahí el
          6 / 2 / 2 de los `flex-[n]`. Antes la pista se quedaba con TODO el
          sobrante (flex-1) y los botones tenían la altura justa del texto. */}
      <div className="bg-zinc-900 rounded-xl p-2 flex-[42] min-h-[70px] flex flex-col">
        <h2 className="text-zinc-400 text-xs mb-1 flex-none">{t("part_en_pista")}</h2>
        <div className="grid grid-cols-5 gap-2 flex-1 min-h-0">
          {enPistaVista.map((nombre) => {
            const seg = segundosTurnoActual(nombre);
            const totalParte = segundosEnParte(nombre, p);
            const dorsal = ROSTER.find((j) => j.nombre === nombre)?.dorsal || "";
            const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
            const tieneAmarilla = jugadoresAmarilla.has(nombre);
            const estaExpulsado = jugadoresExpulsados.has(nombre);
            return (
              <button key={nombre}
                onClick={() => {
                  if (estaExpulsado) return;  // bloqueado: no se puede tocar
                  setModalAccionInd({ jugador: nombre });
                }}
                disabled={estaExpulsado}
                className={`relative px-2 py-1 h-full min-h-0 rounded-lg text-center flex flex-col justify-center ${
                  estaExpulsado
                    ? "bg-red-900/70 border-2 border-red-500 opacity-80 cursor-not-allowed"
                    : esPortero
                      ? "bg-zinc-800 border-2 border-zinc-600"
                      : colorTiempoPista(seg)
                } ${tieneAmarilla && !estaExpulsado ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-zinc-900" : ""}`}>
                {estaExpulsado && (
                  <span className="absolute top-1 right-1.5 text-lg leading-none" title={t("part_expulsado_title")}>🟥</span>
                )}
                {!estaExpulsado && tieneAmarilla && (
                  <span className="absolute top-1 right-1.5 text-lg leading-none" title={t("part_amarilla_title")}>🟨</span>
                )}
                {esPortero && !estaExpulsado && (
                  <span className="absolute top-1 left-1.5 text-sm">🥅</span>
                )}
                {/* Tamaños en función de la ALTURA disponible (vh) para que
                    quepa sin scroll en cualquier iPad en horizontal. */}
                <div className="text-xs opacity-70 leading-none">{dorsal ? `#${dorsal}` : "—"}</div>
                <div className={`font-bold leading-tight text-[clamp(0.9rem,2.4vh,1.35rem)] ${estaExpulsado ? "line-through" : ""}`}>{nombre}</div>
                {estaExpulsado ? (
                  <div className="text-base font-bold mt-1 text-red-200">{t("part_expulsado")}</div>
                ) : (
                  <>
                    <div className="font-mono tabular-nums leading-none mt-1 text-[clamp(1.4rem,5.5vh,3rem)]">{formatMMSS(seg)}</div>
                    <div className="text-xs opacity-70 mt-1">{t("part_parte_corto", { tiempo: formatMMSS(totalParte) })}</div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* BANQUILLO — una fila hasta 8 jugadores; a partir de 9, dos filas
          (con 10 en una fila los nombres se cortaban en el iPad). */}
      {/* El 30 % que cede la pista viene AQUÍ (Arkaitz 22/8). El banquillo pasa
          de alto fijo a repartirse el espacio; con dos filas, mitad para cada
          una. Proporción final: pista 42 · botones 20+20 · banquillo 18. */}
      <div className="bg-zinc-900 rounded-xl p-2 flex-[18] min-h-[70px] flex flex-col">
        <h2 className="text-zinc-400 text-xs mb-1 flex-none">{t("part_banquillo")}</h2>
        <div className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${banquilloVista.length <= 8 ? Math.max(1, banquilloVista.length) : Math.ceil(banquilloVista.length / 2)}, minmax(0, 1fr))` }}>
          {banquilloVista.map((nombre) => {
            const seg = segundosBanquillo(nombre);
            // segTurnoUltimo = tiempo que jugó en su última rotación antes
            // de salir. Lo necesitamos para colorear el banquillo con el
            // nivel correspondiente a su fatiga residual.
            const segUltimo = partido.tiempos[nombre]?.segTurnoUltimo ?? 0;
            const dorsal = ROSTER.find((j) => j.nombre === nombre)?.dorsal || "";
            const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
            const tieneAmarilla = jugadoresAmarilla.has(nombre);
            const estaExpulsado = jugadoresExpulsados.has(nombre);
            return (
              <button key={nombre}
                onClick={() => {
                  if (estaExpulsado) return;
                  setModalAccionBanquillo({ jugador: nombre });
                }}
                disabled={estaExpulsado}
                className={`relative px-1 py-1.5 min-h-[62px] rounded-lg text-center flex flex-col justify-center ${
                  estaExpulsado
                    ? "bg-red-900/70 border border-red-500 opacity-80 cursor-not-allowed"
                    : esPortero
                      ? "bg-zinc-800 border border-zinc-600"
                      : colorTiempoBanquillo(seg, segUltimo)
                } ${tieneAmarilla && !estaExpulsado ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900" : ""}`}>
                {estaExpulsado && (
                  <span className="absolute top-0.5 right-1 text-sm leading-none">🟥</span>
                )}
                {!estaExpulsado && tieneAmarilla && (
                  <span className="absolute top-0.5 right-1 text-sm leading-none">🟨</span>
                )}
                <div className={`text-sm font-bold leading-tight truncate ${estaExpulsado ? "line-through" : ""}`}>
                  <span className="opacity-60 font-normal text-xs mr-1">{dorsal ? `#${dorsal}` : ""}</span>{nombre}
                </div>
                {estaExpulsado ? (
                  <div className="text-[10px] font-bold text-red-200">{t("part_expulsado")}</div>
                ) : (
                  <div className="text-lg font-mono tabular-nums leading-none mt-1">{formatMMSS(seg)}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTONES ACCIÓN COLECTIVA — RESTAURADO 20/5/2026 noche:
          Arkaitz aclaró que "omitir guardar" no significaba eliminar el
          botón, sino simplificar el flujo del modal. El botón vuelve. */}
      <div className="grid grid-cols-8 gap-1.5 flex-[20] min-h-0">
        <BotonAccion label={t("btn_gol")} color="bg-emerald-700" onClick={() => setModalGol(true)} />
        <BotonAccion label={t("btn_disp_rival")} color="bg-red-700" onClick={() => setModalDisparoRival(true)} />
        <BotonAccion label={t("btn_incorporacion")} color="bg-amber-700"
          onClick={() => setModalIncorporacion(true)} />
        <BotonAccion label={t("btn_falta")} color="bg-orange-600" onClick={() => setModalFalta(true)} />
        <BotonAccion label={t("btn_amarilla")} color="bg-yellow-400 text-zinc-950" onClick={() => setModalAmarilla(true)} />
        <BotonAccion label={t("btn_roja")} color="bg-red-950 border-2 border-red-500" onClick={() => setModalRoja(true)} />
        <BotonAccion label={t("btn_tm")} color="bg-purple-700" onClick={() => setModalTM(true)} />
        <BotonAccion label={t("btn_pen10m")} color="bg-pink-700" onClick={() => setModalPen(true)} />
      </div>
      {/* ACCIONES COLECTIVAS DE EQUIPO (recuperación / pérdida de equipo, se
          guardan como "#EQUIPO") + navegación, TODO en una fila para no
          consumir altura. Pérdida de EQUIPO = SIEMPRE forzada (pf); la no
          forzada siempre es de un jugador (decisión Arkaitz 10/8). */}
      <div className={`grid ${cfg.permiteTanda ? "grid-cols-7" : "grid-cols-6"} gap-1.5 flex-[20] min-h-0`}>
        <button onClick={() => { registrarAccionIndividual(JUGADOR_EQUIPO, "robos");
                                 mostrarAviso(t("aviso_recuperacion_equipo")); }}
          className="h-full min-h-[44px] py-1 px-0.5 bg-green-800 hover:bg-green-700 active:bg-green-500
                     active:scale-95 transition rounded-lg text-base font-bold leading-none leading-tight">
          {t("btn_recuperacion_equipo")}
        </button>
        <button onClick={() => { registrarAccionIndividual(JUGADOR_EQUIPO, "pf");
                                 mostrarAviso(t("aviso_perdida_equipo")); }}
          className="h-full min-h-[44px] py-1 px-0.5 bg-rose-900 hover:bg-rose-800 active:bg-rose-600
                     active:scale-95 transition rounded-lg text-base font-bold leading-none leading-tight">
          {t("btn_perdida_equipo")}
        </button>
        <button onClick={() => {
                  const ultimo = partido.eventos[partido.eventos.length - 1];
                  const desc = describirEvento(ultimo, cfg.rival);
                  deshacerUltimoEvento();
                  mostrarAviso(desc ? t("aviso_deshecho", { que: desc })
                                     : t("aviso_nada_deshacer"));
                }}
          className="h-full min-h-[44px] py-1 px-0.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-base font-bold leading-none">
          {t("btn_deshacer")}
        </button>
        <button onClick={() => setModalTiempos(true)}
          className="h-full min-h-[44px] py-1 px-0.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-base font-bold leading-none">
          {t("btn_tiempos")}
        </button>
        {cfg.permiteTanda && (
          <button onClick={() => { iniciarTanda(); setModalTanda(true); }}
            className={`h-full min-h-[44px] py-1 px-0.5 rounded-lg text-base font-bold leading-none ${
              partido.tanda?.tiros.length
                ? "bg-pink-700 hover:bg-pink-600"
                : "bg-zinc-800 hover:bg-zinc-700"
            }`}>
            {t("btn_tanda")}
            {partido.tanda?.tiros.length ? ` (${partido.tanda.marcador.inter}-${partido.tanda.marcador.rival})` : ""}
          </button>
        )}
        <button onClick={() => router.push("/resumen")}
          className="h-full min-h-[44px] py-1 px-0.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-base font-bold leading-none">
          {t("btn_resumen")}
        </button>
        <button onClick={() => router.push("/")}
          className="h-full min-h-[44px] py-1 px-0.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-base font-bold leading-none">
          {t("inicio")}
        </button>
      </div>

      {modalCambio && (
        <ModalCambio
          enPista={enPistaActivos}
          banquillo={banquilloActivos}
          saleInicial={modalCambio.sale}
          onCerrar={() => setModalCambio(null)}
          onConfirmar={(sale, entra) => {
            cambiarJugador(sale, entra);
            setModalCambio(null);
          }}
        />
      )}

      {modalAccionBanquillo && (
        <ModalAccionBanquillo
          jugador={modalAccionBanquillo.jugador}
          enPista={enPistaActivos}
          onCerrar={() => setModalAccionBanquillo(null)}
          onAmarilla={() => {
            registrarAmarillaInter(modalAccionBanquillo.jugador);
            setModalAccionBanquillo(null);
          }}
          onRoja={() => {
            expulsarJugadorInter(modalAccionBanquillo.jugador);
            setModalAccionBanquillo(null);
          }}
          onFalta={() => {
            registrarEvento({
              tipo: "falta",
              equipo: "INTER",
              jugador: modalAccionBanquillo.jugador,
            } as any);
            setModalAccionBanquillo(null);
          }}
          onCambioPor={(saleDePista) => {
            cambiarJugador(saleDePista, modalAccionBanquillo.jugador);
            setModalAccionBanquillo(null);
          }}
        />
      )}

      {modalAccionInd && (
        <ModalAccionIndividual
          jugador={modalAccionInd.jugador}
          directo={directo}
          enPista={enPistaActivos}
          banquillo={banquilloActivos}
          cfg={cfg}
          parteActual={p}
          onCerrar={() => setModalAccionInd(null)}
          onCambio={(sale, entra) => {
            cambiarJugador(sale, entra);
            setModalAccionInd(null);
          }}
          onAmarilla={() => {
            registrarAmarillaInter(modalAccionInd.jugador);
            setModalAccionInd(null);
          }}
          onRoja={() => {
            expulsarJugadorInter(modalAccionInd.jugador);
            setModalAccionInd(null);
          }}
          onFalta={() => {
            registrarEvento({
              tipo: "falta",
              equipo: "INTER",
              jugador: modalAccionInd.jugador,
            } as any);
            setModalAccionInd(null);
          }}
          onContador={(tipo) => {
            incAccion(modalAccionInd.jugador, tipo, 1);
            setModalAccionInd(null);
          }}
          onAccionConZona={(tipo, zona, receptor) => {
            registrarAccionIndividual(modalAccionInd.jugador, tipo, zona, receptor);
            setModalAccionInd(null);
          }}
          onDisparo={(detalles) => {
            // Registrar como evento "disparo" (no es gol, si fuera gol se usaría GOL).
            registrarEvento({
              tipo: "disparo",
              equipo: "INTER",
              jugador: modalAccionInd.jugador,
              resultado: detalles.resultado,
              zonaCampo: detalles.zonaCampo || undefined,
              zonaPorteria: detalles.zonaPorteria || undefined,
            } as any);
            setModalAccionInd(null);
          }}
        />
      )}

      {modalFalta && (
        <ModalFalta
          directo={directo}
          enPista={enPistaActivos}
          banquillo={banquilloActivos}
          rivalNombre={cfg.rival}
          cfg={cfg}
          parteActual={p}
          onCerrar={() => setModalFalta(false)}
          onConfirmar={(ev) => {
            registrarEvento(ev as any);
            setModalFalta(false);
          }}
        />
      )}

      {modalGol && (
        <ModalGol
          directo={directo}
          enPista={enPistaActivos}
          rivalNombre={cfg.rival}
          cfg={cfg}
          parteActual={p}
          onCerrar={() => setModalGol(false)}
          onConfirmar={(ev, penaltiExtra) => {
            registrarEvento(ev as any, penaltiExtra);
            setModalGol(false);
          }}
        />
      )}

      {modalAmarilla && (
        <ModalAmarilla
          enPista={enPistaActivos}
          banquillo={banquilloActivos}
          rivalNombre={cfg.rival}
          onCerrar={() => setModalAmarilla(false)}
          onConfirmar={(ev) => {
            const evAny = ev as any;
            const esCT = evAny.jugador === "#CT";
            if (evAny.equipo === "INTER" && evAny.jugador && !esCT) {
              // Jugador nuestro: la 2ª amarilla auto-expulsa (sí sabemos quién
              // está en pista de los nuestros).
              registrarAmarillaInter(evAny.jugador);
            } else {
              registrarEvento(evAny);
            }
            setModalAmarilla(false);
            // ── Confirmaciones encadenadas (tras cerrar el modal) ──
            if (esCT) {
              // Amarilla al cuerpo técnico (cualquier equipo): no toda tarjeta
              // al banquillo conlleva falta de equipo → preguntar.
              setConfirmFaltaCT({ equipo: evAny.equipo });
            } else if (evAny.equipo === "RIVAL" && evAny.jugador) {
              // OJO: partido.eventos aún NO incluye la amarilla recién dada
              // (setState es asíncrono), así que `previas` cuenta solo las
              // anteriores. previas>=1 ⇒ esta es la 2ª (o más).
              const evs = partido.eventos as any[];
              const previas = evs.filter(
                (e) => e.tipo === "amarilla" && e.equipo === "RIVAL" && e.jugador === evAny.jugador
              ).length;
              const yaExpulsado = evs.some(
                (e) => e.tipo === "roja" && e.equipo === "RIVAL" && e.jugador === evAny.jugador
              );
              if (previas >= 1 && !yaExpulsado) {
                // 2ª amarilla del rival: como no trackeamos su pista, preguntamos
                // si se queda con uno menos (→ registra roja y dispara el crono).
                setConfirmExpulRival({ dorsal: evAny.jugador });
              }
            }
          }}
        />
      )}

      {modalRoja && (
        <ModalRoja
          enPista={enPistaActivos}
          banquillo={banquilloActivos}
          rivalNombre={cfg.rival}
          onCerrar={() => setModalRoja(false)}
          onConfirmar={(ev) => {
            const evAny = ev as any;
            // Para INTER con jugador → usar helper (registra roja + saca
            // de pista si está). Para RIVAL → solo registrar (no hay
            // "rival en pista" estructural, el crono regresivo se calcula
            // desde los eventos en el useMemo `superioridad`).
            if (evAny.equipo === "INTER" && evAny.jugador) {
              expulsarJugadorInter(evAny.jugador);
            } else {
              registrarEvento(evAny);
            }
            setModalRoja(false);
          }}
        />
      )}

      {/* Confirmación: 2ª amarilla del rival → ¿juegan con uno menos? */}
      {confirmExpulRival && (
        <ModalShell titulo={t("conf_2a_ama_rival_titulo")} onCerrar={() => setConfirmExpulRival(null)} maxW="max-w-md">
          <p className="text-zinc-300 text-base mb-4">
            {t("conf_2a_ama_rival_texto", { dorsal: confirmExpulRival.dorsal, rival: cfg.rival })}
            <span className="block text-zinc-500 text-sm mt-1">
              {t("conf_2a_ama_rival_nota")}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                registrarEvento({ tipo: "roja", equipo: "RIVAL", jugador: confirmExpulRival.dorsal } as any);
                setConfirmExpulRival(null);
              }}
              className="py-5 bg-red-700 hover:bg-red-600 rounded text-lg font-bold">
              {t("conf_si_uno_menos")}
            </button>
            <button
              onClick={() => setConfirmExpulRival(null)}
              className="py-5 bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold">
              {t("conf_no_siguen")}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Confirmación: amarilla al cuerpo técnico → ¿suma falta de equipo? */}
      {confirmFaltaCT && (
        <ModalShell titulo={t("conf_ama_ct_titulo")} onCerrar={() => setConfirmFaltaCT(null)} maxW="max-w-md">
          <p className="text-zinc-300 text-base mb-4">
            {t("conf_ama_ct_texto", { equipo: confirmFaltaCT.equipo === "INTER" ? CLIENTE.nombreCorto : cfg.rival })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                registrarEvento({ tipo: "falta", equipo: confirmFaltaCT.equipo } as any);
                setConfirmFaltaCT(null);
              }}
              className="py-5 bg-orange-700 hover:bg-orange-600 rounded text-lg font-bold">
              {t("conf_si_suma_falta")}
            </button>
            <button
              onClick={() => setConfirmFaltaCT(null)}
              className="py-5 bg-zinc-700 hover:bg-zinc-600 rounded text-lg font-bold">
              {t("conf_no")}
            </button>
          </div>
        </ModalShell>
      )}

      {modalTM && (
        <ModalTM
          rivalNombre={cfg.rival}
          tmInter={sTM.inter}
          tmRival={sTM.rival}
          esProrroga={p === "PR1" || p === "PR2"}
          onCerrar={() => setModalTM(false)}
          onConfirmar={(equipo) => {
            // Defensa en profundidad: 1 TM por equipo y parte, ninguno en
            // prórroga (el modal ya lo bloquea, pero reforzamos aquí).
            const usados = partido.stats.tiemposMuerto[p];
            const esPro = p === "PR1" || p === "PR2";
            const yaGastado = equipo === "INTER" ? usados.inter >= 1 : usados.rival >= 1;
            if (!esPro && !yaGastado) {
              registrarEvento({ tipo: "tiempo_muerto", equipo } as any);
            }
            setModalTM(false);
          }}
        />
      )}

      {modalPen && (
        <ModalPenalti
          directo={directo}
          enPista={enPistaActivos}
          rivalNombre={cfg.rival}
          onCerrar={() => setModalPen(false)}
          onConfirmar={(ev) => { registrarEvento(ev as any); setModalPen(false); }}
        />
      )}

      {/* SAQUE INICIAL. Se pregunta una sola vez, al arrancar el partido, y con
          eso el crono ya sabe a quién le toca sacar en la 2ª parte. */}
      {modalSaque && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-2xl font-bold mb-1">⚽ {t("saque_titulo")}</h3>
            <p className="text-base text-zinc-400 mb-5">{t("saque_sub")}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setSaqueInicial("INTER"); setModalSaque(false); play(); }}
                className="py-8 bg-emerald-700 hover:bg-emerald-600 rounded-xl text-xl font-bold">
                {CLIENTE.nombreCorto}
              </button>
              <button
                onClick={() => { setSaqueInicial("RIVAL"); setModalSaque(false); play(); }}
                className="py-8 bg-red-800 hover:bg-red-700 rounded-xl text-xl font-bold">
                {cfg.rival}
              </button>
            </div>
            <button onClick={() => { setModalSaque(false); play(); }}
              className="mt-5 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
              {t("saque_sin_anotar")}
            </button>
          </div>
        </div>
      )}

      {/* INCORPORACIÓN del portero rival. Dos toques como mucho: si fue con
          disparo, encadena directamente el modal de disparo rival, que es el
          flujo que Arkaitz ya tiene en los dedos. */}
      {modalIncorporacion && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
             onClick={() => setModalIncorporacion(false)}>
          <div className="bg-zinc-900 rounded-2xl p-5 w-full max-w-md"
               onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-1">🧤 {t("inc_titulo")}</h3>
            <p className="text-sm text-zinc-400 mb-4">{t("inc_sub")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  registrarEvento({ tipo: "incorporacion_rival", conDisparo: true } as any);
                  setModalIncorporacion(false);
                  setModalDisparoRival(true);   // encadena el disparo
                }}
                className="py-6 bg-red-700 hover:bg-red-600 rounded-xl text-lg font-bold">
                {t("inc_con_disparo")}
              </button>
              <button
                onClick={() => {
                  registrarEvento({ tipo: "incorporacion_rival", conDisparo: false } as any);
                  setModalIncorporacion(false);
                  mostrarAviso(t("aviso_incorporacion"));
                }}
                className="py-6 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-lg font-bold">
                {t("inc_sin_disparo")}
              </button>
            </div>
            <button onClick={() => setModalIncorporacion(false)}
              className="mt-4 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
              {t("ed_cancelar")}
            </button>
          </div>
        </div>
      )}

      {/* Aviso corto de "apuntado" para las acciones sin modal. */}
      {aviso && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg
                          text-base font-bold">
            ✓ {aviso}
          </div>
        </div>
      )}

      {modalDisparoRival && (
        <ModalDisparoRival
          directo={directo}
          enPista={enPistaActivos}
          rivalNombre={cfg.rival}
          cfg={cfg}
          parteActual={p}
          onCerrar={() => setModalDisparoRival(false)}
          onConfirmar={(ev) => {
            registrarEvento(ev as any);
            setModalDisparoRival(false);
          }}
        />
      )}

      {modalTanda && (
        <ModalTanda
          tanda={partido.tanda}
          enPista={enPistaActivos}
          convocados={cfg.convocados.filter((n) => !jugadoresExpulsados.has(n))}
          rivalNombre={cfg.rival}
          onCerrar={() => { cerrarTanda(); setModalTanda(false); }}
          onApuntar={apuntarTiroTanda}
          onDeshacer={deshacerUltimoTiroTanda}
        />
      )}

      {modalTiempos && (
        <ModalTiempos
          partido={partido}
          enPista={enPista}
          onCerrar={() => setModalTiempos(false)}
          segundosTurnoActual={segundosTurnoActual}
        />
      )}

      {modalCambioParte && (
        <ModalCambioParte
          partido={partido}
          desde={p}
          onCerrar={() => setModalCambioParte(false)}
          onContinuarSiguienteParte={() => {
            const orden: ParteId[] = ["1T", "2T", "PR1", "PR2"];
            const siguiente = orden[orden.indexOf(p) + 1];
            avanzarParte();
            setModalCambioParte(false);
            // Quién saca en la parte que empieza. Es el momento exacto en que
            // hace falta saberlo y en el que nadie se acuerda (Arkaitz 22/8).
            const saca = siguiente
              ? sacaEn(siguiente, partido.saqueInicial1T) : undefined;
            if (saca) {
              mostrarAviso(t("aviso_saca", {
                equipo: saca === "INTER" ? CLIENTE.nombreCorto : cfg.rival,
              }));
            }
          }}
          onConfigurarProrroga={(minutos) => {
            setDuracionesParte({ PR1: minutos, PR2: minutos });
            avanzarParte();
            setModalCambioParte(false);
          }}
          onIrATanda={() => {
            iniciarTanda();
            setModalCambioParte(false);
            setModalTanda(true);
          }}
          onFinalizar={() => {
            finalizarPartido();
            setModalCambioParte(false);
            router.push("/resumen");
          }}
        />
      )}
    </div>
  );
}

// ──────────────── COMPONENTES BÁSICOS ────────────────

/**
 * Reloj grande del partido. Se repinta a sí mismo EXACTAMENTE en cada límite
 * de segundo (setTimeout alineado con lib/reloj.msHastaSiguienteCambio), en
 * vez de depender del tick de 250 ms + render de toda la página, que hacía
 * que el cambio de dígito llegara siempre un poco tarde ("parece ir lento").
 * El valor sigue calculándose contra Date.now() (exacto, sin deriva).
 * Cuenta atrás con semántica de marcador (ceil); transcurrido con floor.
 */
function RelojGrande(props: { segundosParte: number; ultimoStart: number | null; dur: number; acabada: boolean }) {
  const [, repintar] = useState(0);
  const { segundosParte, ultimoStart, dur } = props;
  useEffect(() => {
    if (ultimoStart == null) return;  // pausado: el valor es fijo
    let timer: ReturnType<typeof setTimeout> | null = null;
    let vivo = true;
    const programar = () => {
      if (!vivo) return;
      const ms = msHastaSiguienteCambio({ segundosParte, ultimoStart }, dur);
      timer = setTimeout(() => { repintar((x) => x + 1); programar(); }, ms);
    };
    programar();
    return () => { vivo = false; if (timer) clearTimeout(timer); };
  }, [segundosParte, ultimoStart, dur]);
  const vivos = segundosVivos({ segundosParte, ultimoStart });
  const texto = dur > 0 ? formatCuentaAtras(dur - vivos) : formatMMSS(vivos);
  return (
    <div className={`text-6xl font-mono font-bold tabular-nums ${props.acabada ? "text-red-500 animate-pulse" : ""}`}>
      {texto}
    </div>
  );
}

/** Cómo contarle a Arkaitz QUÉ se acaba de deshacer.
 *
 *  Deshacer era un salto de fe: pulsabas y no sabías si te habías cargado el
 *  gol o la falta de antes. Ahora el aviso lo dice (Arkaitz 22/8/2026).
 */
function describirEvento(ev: Evento | undefined, rival: string): string {
  if (!ev) return "";
  const e: any = ev;
  const quien = (n?: string) => (n ? ` de ${n}` : "");
  switch (e.tipo) {
    case "gol":
      return e.equipo === "INTER"
        ? `gol${quien(e.goleador)}` : `gol de ${rival}`;
    case "falta":
      return `falta${e.equipo === "INTER" ? quien(e.jugador) : ` de ${rival}`}`;
    case "amarilla":  return `amarilla${quien(e.jugador)}`;
    case "roja":      return `roja${quien(e.jugador)}`;
    case "tiempo_muerto":
      return `tiempo muerto${e.equipo === "INTER" ? "" : ` de ${rival}`}`;
    case "cambio":    return `cambio (entró ${e.entra}, salió ${e.sale})`;
    case "disparo":
      return e.equipo === "INTER"
        ? `disparo${quien(e.jugador)}` : `disparo de ${rival}`;
    case "penalti":   return `penalti${quien(e.tirador)}`;
    case "diezm":     return `10 m${quien(e.tirador)}`;
    case "incorporacion_rival":
      return `incorporación del portero de ${rival}`;
    case "accion_individual": {
      const acc: Record<string, string> = {
        pf: "pérdida forzada", pnf: "pérdida no forzada", robos: "robo",
        cortes: "corte", bdg: "balón dividido ganado",
        bdp: "balón dividido perdido",
      };
      const nombre = acc[e.accion] ?? e.accion;
      return e.jugador === JUGADOR_EQUIPO
        ? `${nombre} de equipo` : `${nombre}${quien(e.jugador)}`;
    }
    default: return String(e.tipo).replace(/_/g, " ");
  }
}


function BotonAccion(props: { label: string; color: string; onClick: () => void }) {
  // Altura contenida (antes py-9/text-2xl: ~100 px que obligaban a hacer scroll
  // en el iPad). Sigue siendo un botón grande para el dedo (~56 px).
  return (
    <button onClick={props.onClick}
      className={`${props.color} hover:opacity-90 h-full min-h-[44px] py-2 rounded-xl
                  text-lg font-bold leading-tight`}>
      {props.label}
    </button>
  );
}

function ModalShell(props: { titulo: string; onCerrar: () => void; children: React.ReactNode; maxW?: string; tituloClass?: string; clase?: string }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      onClick={props.onCerrar}>
      <div className={`bg-zinc-900 rounded-xl p-5 w-full ${props.maxW || "max-w-4xl"} max-h-[95vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`${props.tituloClass || "text-2xl"} font-bold`}>{props.titulo}</h2>
          <button onClick={props.onCerrar} className="text-zinc-400 text-3xl leading-none px-2">×</button>
        </div>
        {/* `clase` escala el contenido entero de golpe: con text-[1.2em] todo
            lo de dentro crece un 20 % sin tocar cada botón por separado. */}
        <div className={props.clase}>{props.children}</div>
      </div>
    </div>
  );
}

// Portería como OVERLAY (aparece POR ENCIMA del campo, sin scroll). Pedido
// Arkaitz 10/8: al pinchar la zona de campo, la portería sale encima como si
// pasaras de una pantalla a otra (en vez de bajar haciendo scroll). z-[70] va
// por encima del ModalShell (z-50).
function PorteriaOverlay(props: {
  titulo: string;
  onSelect: (z: string) => void;
  onSaltar: () => void;
  onAtras: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
      onClick={props.onAtras}>
      <div className="bg-zinc-900 rounded-xl p-5 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={props.onAtras} className="text-zinc-400 text-2xl leading-none px-2">←</button>
          <h2 className="text-xl font-bold text-center flex-1">{props.titulo}</h2>
          <span className="w-8" />
        </div>
        <Porteria onSelect={props.onSelect} />
        {props.extra}
        <div className="mt-3 text-right">
          <button onClick={props.onSaltar}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">
            {t("saltar_zona_porteria_guardar")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChipsJugador(props: {
  opciones: string[];
  seleccionado: string;
  onSelect: (n: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.opciones.map((n) => (
        <button key={n} onClick={() => props.onSelect(n)}
          className={`px-3 py-2 rounded text-base ${
            props.seleccionado === n ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-200"
          }`}>{n}</button>
      ))}
    </div>
  );
}

function Paso(props: { n: number; titulo: string; activo: boolean; children: React.ReactNode }) {
  return (
    <div className={`mb-3 ${props.activo ? "" : "opacity-50"}`}>
      <h3 className="text-sm text-zinc-400 mb-2">
        <span className="bg-zinc-800 px-2 py-0.5 rounded-full text-xs mr-2">{props.n}</span>
        {props.titulo}
      </h3>
      {props.children}
    </div>
  );
}

// ──────────────── MODAL ACCIÓN BANQUILLO ────────────────
// Toque en jugador del banquillo: amarilla, falta o cambio rápido por uno en pista.

function ModalAccionBanquillo(props: {
  jugador: string;
  enPista: string[];
  onCerrar: () => void;
  onAmarilla: () => void;
  onRoja: () => void;
  onFalta: () => void;
  onCambioPor: (saleDePista: string) => void;
}) {
  return (
    <ModalShell titulo={t("mab_titulo", { jugador: props.jugador })} onCerrar={props.onCerrar} maxW="max-w-2xl">
      {/* Mismo orden y colores que en el menú de pista: FALTA · AMARILLA · ROJA */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={props.onFalta}
          className="py-4 bg-orange-600 hover:bg-orange-500 rounded-lg text-lg font-bold">
          {t("mab_falta")}
        </button>
        <button onClick={props.onAmarilla}
          className="py-4 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 rounded-lg text-lg font-bold">
          {t("mab_amarilla")}
        </button>
        <button onClick={props.onRoja}
          className="py-4 bg-red-950 border-2 border-red-500 hover:bg-red-900 rounded-lg text-lg font-bold">
          {t("mab_roja")}
        </button>
      </div>
      <h3 className="text-sm text-zinc-400 mb-2">{t("mab_entra_por")}</h3>
      <div className="grid grid-cols-5 gap-2">
        {props.enPista.map((n) => (
          <button key={n}
            onClick={() => props.onCambioPor(n)}
            className="py-4 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-base font-bold">
            {n}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

// ──────────────── MODAL CAMBIO (auto-confirm al seleccionar entra) ────────────────

function ModalCambio(props: {
  enPista: string[]; banquillo: string[]; saleInicial: string;
  onCerrar: () => void;
  onConfirmar: (sale: string, entra: string) => void;
}) {
  const [sale, setSale] = useState(props.saleInicial);
  return (
    <ModalShell titulo={t("mc_titulo")} onCerrar={props.onCerrar} maxW="max-w-2xl">
      <Paso n={1} titulo={t("mc_sale")} activo={!sale}>
        <ChipsJugador opciones={props.enPista} seleccionado={sale} onSelect={setSale} />
      </Paso>
      {sale && (
        <Paso n={2} titulo={t("mc_entra", { sale })} activo={true}>
          <div className="flex flex-wrap gap-2">
            {props.banquillo.map((n) => (
              <button key={n}
                onClick={() => props.onConfirmar(sale, n)}
                className="px-4 py-3 bg-emerald-700 hover:bg-emerald-600 rounded text-base font-bold">
                {n}
              </button>
            ))}
            {/* Slot vacío: deja un hueco en pista (inferioridad numérica
                tras expulsión, p.ej.). B7 (20/5/2026): solo el cuadrado,
                sin texto "Nadie" — el usuario reconoce el hueco por el
                borde discontinuo y el espacio en blanco. */}
            <button
              onClick={() => props.onConfirmar(sale, "")}
              className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded text-base font-bold border-2 border-dashed border-zinc-500 min-w-[80px]"
              title={t("mc_slot_vacio_title")}>
              {/* slot vacío sin texto */}
            </button>
          </div>
        </Paso>
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL FALTA ────────────────
// Flujo: equipo → jugador (o SIN ASIGNAR / RIVAL-MANO) → zona campo → cierra.

function ModalFalta(props: {
  directo: boolean;
  enPista: string[];
  banquillo: string[];     // se admiten también jugadores del banquillo
  rivalNombre: string;
  cfg: ConfigPartido; parteActual: ParteId;
  onCerrar: () => void;
  onConfirmar: (ev: any) => void;
}) {
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);
  const [jugador, setJugador] = useState<string>("");
  const [sinAsignar, setSinAsignar] = useState(false);
  const [rivalMano, setRivalMano] = useState(false);
  // Lista de candidatos: primero los que están en pista, después los del
  // banquillo (puede haber falta a un jugador del banquillo si protesta
  // o si entra a discusión por ejemplo).
  const candidatos = [...props.enPista, ...props.banquillo];

  const aplicar = (zonaCampo?: string) => {
    const ev: any = { tipo: "falta", equipo };
    if (jugador) ev.jugador = jugador;
    if (sinAsignar) ev.sinAsignar = true;
    if (rivalMano) ev.rivalMano = true;
    if (zonaCampo) ev.zonaCampo = zonaCampo;
    props.onConfirmar(ev);
  };

  // Selección de jugador / sin-asignar / rival-mano. En DIRECTO se guarda ya
  // (sin pedir la zona del campo); en VÍDEO solo fija la selección y aparece
  // el paso de zona. Usa los valores de `sel` directamente para no depender
  // del setState asíncrono.
  const seleccionar = (sel: { jugador?: string; sinAsignar?: boolean; rivalMano?: boolean }) => {
    setJugador(sel.jugador ?? "");
    setSinAsignar(!!sel.sinAsignar);
    setRivalMano(!!sel.rivalMano);
    if (props.directo) {
      const ev: any = { tipo: "falta", equipo };
      if (sel.jugador) ev.jugador = sel.jugador;
      if (sel.sinAsignar) ev.sinAsignar = true;
      if (sel.rivalMano) ev.rivalMano = true;
      props.onConfirmar(ev);
    }
  };

  return (
    <ModalShell titulo={t("mf_titulo")} onCerrar={props.onCerrar}>
      <Paso n={1} titulo={t("mf_que_equipo")} activo={!equipo}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setEquipo("INTER"); }}
            className={`px-6 py-4 rounded text-lg font-bold ${
              equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"
            }`}>{t("mf_la_cometemos")}</button>
          <button onClick={() => { setEquipo("RIVAL"); }}
            className={`px-6 py-4 rounded text-lg font-bold ${
              equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"
            }`}>{t("mf_la_comete_rival", { rival: props.rivalNombre })}</button>
        </div>
      </Paso>

      {equipo && (
        <Paso n={2}
          titulo={
            equipo === "INTER"
              ? t("mf_jugador_comete")
              : t("mf_quien_recibe")
          }
          activo={!jugador && !sinAsignar && !rivalMano}>
          <div className="flex flex-wrap gap-2">
            {candidatos.map((n) => {
              const enBanquillo = props.banquillo.includes(n);
              return (
                <button key={n}
                  onClick={() => seleccionar({ jugador: n })}
                  className={`px-3 py-2 rounded text-base ${
                    jugador === n ? "bg-emerald-700"
                                  : enBanquillo ? "bg-zinc-700 opacity-70" : "bg-zinc-800"
                  }`}
                  title={enBanquillo ? t("mf_jugador_banquillo_title") : undefined}>
                  {n}{enBanquillo ? " 🪑" : ""}
                </button>
              );
            })}
            <button onClick={() => seleccionar({ sinAsignar: true })}
              className={`px-3 py-2 rounded text-base ${
                sinAsignar ? "bg-zinc-500" : "bg-zinc-800"
              }`}>{t("sin_asignar")}</button>
            {equipo === "INTER" && (
              <button onClick={() => seleccionar({ rivalMano: true })}
                className={`px-3 py-2 rounded text-base ${
                  rivalMano ? "bg-purple-700" : "bg-zinc-800"
                }`}>{t("mf_rival_mano")}</button>
            )}
          </div>
        </Paso>
      )}

      {!props.directo && equipo && (jugador || sinAsignar || rivalMano) && (
        <Paso n={3} titulo={t("mf_zona_produce")} activo>
          {/* La falta importa por su cercanía a portería: cuando la cometemos
              NOSOTROS, el tiro libre lo lanza el rival hacia NUESTRA portería,
              así que orientamos el mapa como el ataque del rival (su mapa); y
              al revés cuando la comete el rival. Por eso usamos el equipo
              CONTRARIO al que comete la falta. #bug faltas mapa al revés */}
          <Campo onSelect={(z) => aplicar(z)}
            direccion={direccionAtaque(props.parteActual,
              equipo === "INTER" ? "RIVAL" : "INTER", props.cfg)}
            nombreAtacante={equipo === "INTER" ? props.rivalNombre : NOMBRE_CORTO_TC} />
          <div className="mt-2 flex justify-end">
            <button onClick={() => aplicar(undefined)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">
              {t("saltar_zona_guardar")}
            </button>
          </div>
        </Paso>
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL AMARILLA ────────────────

function ModalAmarilla(props: {
  enPista: string[];
  banquillo: string[];
  rivalNombre: string;
  onCerrar: () => void;
  onConfirmar: (ev: any) => void;
}) {
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);

  const candidatos = [...props.enPista, ...props.banquillo];

  return (
    <ModalShell titulo={t("mam_titulo")} onCerrar={props.onCerrar} maxW="max-w-2xl">
      <Paso n={1} titulo={t("mam_equipo")} activo={!equipo}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEquipo("INTER")}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"
            }`}>{CLIENTE.nombreCorto}</button>
          <button onClick={() => { setEquipo("RIVAL"); }}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"
            }`}>{props.rivalNombre}</button>
        </div>
      </Paso>
      {equipo === "INTER" && (
        <Paso n={2} titulo={t("mam_jugador_saltar")} activo>
          <div className="flex flex-wrap gap-2">
            {candidatos.map((n) => {
              const enBanquillo = props.banquillo.includes(n);
              return (
                <button key={n} onClick={() => props.onConfirmar({ tipo: "amarilla", equipo: "INTER", jugador: n })}
                  className={`px-3 py-2 rounded ${
                    enBanquillo ? "bg-zinc-700 hover:bg-zinc-600 opacity-80"
                                : "bg-emerald-700 hover:bg-emerald-600"
                  }`}
                  title={enBanquillo ? t("mf_jugador_banquillo_title") : undefined}>
                  {n}{enBanquillo ? " 🪑" : ""}
                </button>
              );
            })}
            <button onClick={() => props.onConfirmar({ tipo: "amarilla", equipo: "INTER", jugador: "#CT" })}
              className="px-3 py-2 rounded bg-purple-700 hover:bg-purple-600 font-bold">{t("cuerpo_tecnico")}</button>
            <button onClick={() => props.onConfirmar({ tipo: "amarilla", equipo: "INTER" })}
              className="px-3 py-2 rounded bg-zinc-700">{t("sin_asignar")}</button>
          </div>
        </Paso>
      )}
      {equipo === "RIVAL" && (
        <TecladoDorsalRival
          titulo={t("mam_dorsal_rival")}
          onConfirmar={(dorsalOCT) => props.onConfirmar({
            tipo: "amarilla", equipo: "RIVAL", jugador: dorsalOCT,
          })}
          onSinAsignar={() => props.onConfirmar({ tipo: "amarilla", equipo: "RIVAL" })}
        />
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL ROJA ────────────────
// Igual que amarilla pero registra evento roja directamente. Para
// expulsiones por roja directa o por 2ª amarilla manual.

function ModalRoja(props: {
  enPista: string[];
  banquillo: string[];
  rivalNombre: string;
  onCerrar: () => void;
  onConfirmar: (ev: any) => void;
}) {
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);
  const candidatos = [...props.enPista, ...props.banquillo];

  return (
    <ModalShell titulo={t("mroja_titulo")} onCerrar={props.onCerrar} maxW="max-w-2xl">
      <Paso n={1} titulo={t("mam_equipo")} activo={!equipo}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEquipo("INTER")}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"
            }`}>{CLIENTE.nombreCorto}</button>
          <button onClick={() => setEquipo("RIVAL")}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"
            }`}>{props.rivalNombre}</button>
        </div>
      </Paso>
      {equipo === "INTER" && (
        <Paso n={2} titulo={t("mroja_jugador_expulsado")} activo>
          <div className="flex flex-wrap gap-2">
            {candidatos.map((n) => {
              const enBanquillo = props.banquillo.includes(n);
              return (
                <button key={n} onClick={() => props.onConfirmar({ tipo: "roja", equipo: "INTER", jugador: n })}
                  className={`px-3 py-2 rounded ${
                    enBanquillo ? "bg-zinc-700 hover:bg-zinc-600 opacity-80"
                                : "bg-red-700 hover:bg-red-600"
                  }`}>
                  {n}{enBanquillo ? " 🪑" : ""}
                </button>
              );
            })}
          </div>
        </Paso>
      )}
      {equipo === "RIVAL" && (
        <TecladoDorsalRival
          titulo={t("mroja_dorsal_rival")}
          onConfirmar={(dorsalOCT) => props.onConfirmar({
            tipo: "roja", equipo: "RIVAL", jugador: dorsalOCT,
          })}
          onSinAsignar={() => props.onConfirmar({ tipo: "roja", equipo: "RIVAL" })}
        />
      )}
    </ModalShell>
  );
}

// ──────────────── TECLADO NUMÉRICO RIVAL ────────────────
// Permite teclear el dorsal del jugador rival que recibe la tarjeta.
// Tecla extra "CT" = cuerpo técnico recibe la amonestación.
// El dorsal se devuelve como string con prefijo "#": "#17", "#CT".

function TecladoDorsalRival(props: {
  titulo: string;
  onConfirmar: (dorsalOCT: string) => void;
  onSinAsignar: () => void;
}) {
  const [dorsal, setDorsal] = useState("");
  const teclas = ["1","2","3","4","5","6","7","8","9","0"];

  const pulsa = (t: string) => {
    if (dorsal.length < 3) setDorsal(dorsal + t);
  };
  const borrar = () => setDorsal(dorsal.slice(0, -1));
  const confirmar = () => {
    if (!dorsal) return;
    props.onConfirmar(`#${dorsal}`);
  };

  return (
    <Paso n={2} titulo={props.titulo} activo>
      <div className="bg-zinc-950 rounded-lg p-4 mb-3 text-center">
        <div className="text-zinc-500 text-sm mb-1">{t("tdr_dorsal_sel")}</div>
        <div className="text-5xl font-bold font-mono tabular-nums min-h-[60px]">
          {dorsal ? `#${dorsal}` : <span className="text-zinc-700">—</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {teclas.slice(0, 9).map((t) => (
          <button key={t} onClick={() => pulsa(t)}
            className="py-5 bg-zinc-700 hover:bg-zinc-600 rounded text-2xl font-bold">
            {t}
          </button>
        ))}
        <button onClick={borrar}
          className="py-5 bg-zinc-800 hover:bg-zinc-700 rounded text-xl">
          ⌫
        </button>
        <button onClick={() => pulsa("0")}
          className="py-5 bg-zinc-700 hover:bg-zinc-600 rounded text-2xl font-bold">
          0
        </button>
        <button onClick={confirmar} disabled={!dorsal}
          className={`py-5 rounded text-xl font-bold ${
            dorsal ? "bg-emerald-700 hover:bg-emerald-600" : "bg-zinc-800 opacity-50"
          }`}>
          ✓
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => props.onConfirmar("#CT")}
          className="py-4 bg-purple-700 hover:bg-purple-600 rounded text-base font-bold">
          {t("cuerpo_tecnico")}
        </button>
        <button onClick={props.onSinAsignar}
          className="py-4 bg-zinc-700 hover:bg-zinc-600 rounded text-base font-bold">
          {t("sin_asignar_min")}
        </button>
      </div>
    </Paso>
  );
}

// ──────────────── MODAL TM ────────────────

function ModalTM(props: {
  rivalNombre: string;
  tmInter: number;
  tmRival: number;
  esProrroga: boolean;
  onCerrar: () => void;
  onConfirmar: (equipo: "INTER" | "RIVAL") => void;
}) {
  // En la prórroga no hay tiempos muertos (regla futsal).
  if (props.esProrroga) {
    return (
      <ModalShell titulo={t("mtm_titulo")} onCerrar={props.onCerrar} maxW="max-w-md">
        <p className="text-center text-zinc-300 py-6 text-lg">
          {t("mtm_prorroga")}
        </p>
      </ModalShell>
    );
  }
  // 1 tiempo muerto por equipo y parte: deshabilitar el que ya lo gastó.
  const interUsado = props.tmInter >= 1;
  const rivalUsado = props.tmRival >= 1;
  return (
    <ModalShell titulo={t("mtm_titulo")} onCerrar={props.onCerrar} maxW="max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <button disabled={interUsado}
          onClick={() => { if (!interUsado) props.onConfirmar("INTER"); }}
          className={`py-6 rounded text-xl font-bold ${
            interUsado ? "bg-zinc-800 opacity-40 cursor-not-allowed"
                       : "bg-emerald-700 hover:bg-emerald-600"}`}>
          INTER{interUsado ? t("mtm_usado") : ""}
        </button>
        <button disabled={rivalUsado}
          onClick={() => { if (!rivalUsado) props.onConfirmar("RIVAL"); }}
          className={`py-6 rounded text-xl font-bold ${
            rivalUsado ? "bg-zinc-800 opacity-40 cursor-not-allowed"
                       : "bg-red-700 hover:bg-red-600"}`}>
          {props.rivalNombre}{rivalUsado ? t("mtm_usado") : ""}
        </button>
      </div>
      {(interUsado || rivalUsado) && (
        <p className="text-xs text-zinc-400 mt-3 text-center">
          {t("mtm_nota")}
        </p>
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL GOL ────────────────

// Acciones de gol: el VALOR almacenado en el evento es SIEMPRE el español
// canónico (no se traduce, para no romper datos ni las comparaciones
// accion === "Penalti" / "10m"). Solo se traduce la ETIQUETA mostrada en el
// botón, vía labelAccionGol().
// Acciones de gol: el VALOR almacenado en el evento es SIEMPRE el español
// canónico (no se traduce, para no romper datos ni las comparaciones
// accion === "Penalti" / "10m"). Solo se traduce la ETIQUETA mostrada en el
// botón, vía labelAccionGol() (importado de @/lib/i18n).
// Dos columnas, en el orden que pidió Arkaitz (22/8/2026): a la izquierda el
// juego abierto (lo que más se marca), a la derecha el balón parado y las
// superioridades. El VALOR sigue siendo el español canónico; solo la etiqueta
// se traduce, vía labelAccionGol().
const ACCIONES_GOL_IZQ = [
  "Robo zona alta", "Ataque posicional", "1x1 banda", "Contraataque",
  "2ª jugada", "Salida de presión",
];
const ACCIONES_GOL_DER = [
  "Córner", "Banda", "Falta", "10m", "Penalti",
  "5x4", "4x5", "4x3", "3x4", "Otra",
];
const ACCIONES_GOL = [...ACCIONES_GOL_IZQ, ...ACCIONES_GOL_DER];

function ModalGol(props: {
  directo: boolean;
  enPista: string[]; rivalNombre: string;
  cfg: ConfigPartido; parteActual: ParteId;
  onCerrar: () => void;
  /** penaltiExtra: extras a pasar al store cuando acción=Penalti/10m. */
  onConfirmar: (ev: any, penaltiExtra?: { penaltiTipo?: "penalti" | "diezm"; penaltiPorteroRival?: string }) => void;
}) {
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);
  const [goleador, setGoleador] = useState("");
  const [asistente, setAsistente] = useState<string | "OMIT" | "">("");
  const [accion, setAccion] = useState("");
  const [zonaCampo, setZonaCampo] = useState("");
  const [zonaPorteria, setZonaPorteria] = useState("");
  const [zonaAsistencia, setZonaAsistencia] = useState("");
  const [porteroRival, setPorteroRival] = useState("");

  const esPenaltiOAccion = accion === "Penalti" || accion === "10m";

  const aplicar = (zp: string) => {
    const ev: any = { tipo: "gol", equipo };
    if (equipo === "INTER") {
      ev.goleador = goleador;
      if (asistente && asistente !== "OMIT") ev.asistente = asistente;
      ev.cuarteto = props.enPista.filter((n) => n !== goleador);
    } else {
      // Gol del RIVAL: guardar también quién estaba en pista (los 5). Antes
      // solo se guardaba en los goles del Inter y el informe no podía marcar
      // a nadie "en pista" en los goles en contra (visto por Arkaitz 16/8).
      ev.cuarteto = [...props.enPista];
    }
    if (accion) ev.accion = accion;
    if (zonaAsistencia) ev.zonaAsistencia = zonaAsistencia;
    if (zonaCampo) ev.zonaCampo = zonaCampo;
    if (zp) ev.zonaPorteria = zp;
    if (porteroRival && equipo === "INTER") ev.portero = porteroRival;
    const extra = esPenaltiOAccion
      ? {
          penaltiTipo: (accion === "10m" ? "diezm" : "penalti") as "penalti" | "diezm",
          penaltiPorteroRival: porteroRival || undefined,
        }
      : undefined;
    props.onConfirmar(ev, extra);
  };

  // DIRECTO: al elegir la acción, guardar el gol YA, sin pedir zona de campo ni
  // de portería (regla: en directo, cero zonas en nada). Usa `acc` directamente
  // para no depender del setState asíncrono. Goleador/asistente ya están fijados.
  const aplicarDirecto = (acc: string) => {
    const ev: any = { tipo: "gol", equipo };
    if (equipo === "INTER") {
      ev.goleador = goleador;
      if (asistente && asistente !== "OMIT") ev.asistente = asistente;
      ev.cuarteto = props.enPista.filter((n) => n !== goleador);
    } else {
      ev.cuarteto = [...props.enPista];  // quinteto en pista en el gol rival
    }
    ev.accion = acc;
    const esPenOAcc = acc === "Penalti" || acc === "10m";
    const extra = esPenOAcc
      ? { penaltiTipo: (acc === "10m" ? "diezm" : "penalti") as "penalti" | "diezm", penaltiPorteroRival: undefined }
      : undefined;
    props.onConfirmar(ev, extra);
  };

  return (
    <ModalShell titulo={t("mg_titulo")} onCerrar={props.onCerrar}
      maxW="max-w-6xl" tituloClass="text-3xl" clase="text-[1.2em]">
      <Paso n={1} titulo={t("mam_equipo")} activo={!equipo}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEquipo("INTER")}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"
            }`}>{CLIENTE.nombreCorto}</button>
          <button onClick={() => setEquipo("RIVAL")}
            className={`py-4 rounded text-lg font-bold ${
              equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"
            }`}>{props.rivalNombre}</button>
        </div>
      </Paso>

      {equipo === "INTER" && (
        <>
          <Paso n={2} titulo={t("mg_goleador")} activo={!goleador}>
            <ChipsJugador opciones={props.enPista} seleccionado={goleador} onSelect={setGoleador} />
          </Paso>

          {goleador && (
            <Paso n={3} titulo={t("mg_asistente")} activo={!asistente}>
              <div className="flex flex-wrap gap-2">
                {props.enPista.filter((n) => n !== goleador).map((n) => (
                  <button key={n} onClick={() => setAsistente(n)}
                    className={`px-3 py-2 rounded ${
                      asistente === n ? "bg-emerald-700" : "bg-zinc-800"
                    }`}>{n}</button>
                ))}
                <button onClick={() => setAsistente("OMIT")}
                  className={`px-3 py-2 rounded ${
                    asistente === "OMIT" ? "bg-zinc-500" : "bg-zinc-800"
                  }`}>{t("mg_sin_asistente")}</button>
              </div>
            </Paso>
          )}
        </>
      )}

      {(equipo === "RIVAL" || (goleador && asistente)) && (
        <Paso n={equipo === "RIVAL" ? 2 : 4} titulo={t("mg_accion_gol")} activo={!accion}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {[ACCIONES_GOL_IZQ, ACCIONES_GOL_DER].map((columna, i) => (
              <div key={i} className="flex flex-col gap-2">
                {columna.map((a) => (
                  <button key={a} onClick={() => {
                      if (props.directo) { aplicarDirecto(a); return; }
                      setAccion(a);
                    }}
                    className={`px-3 py-2.5 rounded text-base font-semibold ${
                      accion === a ? "bg-emerald-700" : "bg-zinc-800 hover:bg-zinc-700"
                    }`}>{labelAccionGol(a)}</button>
                ))}
              </div>
            ))}
          </div>
        </Paso>
      )}

      {/* Zona de la ASISTENCIA (desde dónde el pase de gol) — solo gol INTER con
          asistente, antes del remate. NUNCA en directo (cero zonas). */}
      {!props.directo && accion && !esPenaltiOAccion && equipo === "INTER" && asistente && asistente !== "OMIT" && !zonaAsistencia && (
        <Paso n={5} titulo={t("mg_zona_asistencia")} activo>
          <Campo seleccionada={zonaAsistencia} onSelect={setZonaAsistencia}
            direccion={direccionAtaque(props.parteActual, "INTER", props.cfg)}
            nombreAtacante={NOMBRE_CORTO_TC} />
          <div className="mt-1 text-right">
            <button onClick={() => setZonaAsistencia("__skip__")}
              className="px-3 py-1 bg-zinc-700 rounded text-xs">{t("saltar_zona_campo_corto")}</button>
          </div>
        </Paso>
      )}
      {/* Zona del REMATE (desde dónde se remató). Tras la asistencia, o directo
          si no hay asistente / es gol del rival. */}
      {!props.directo && accion && !esPenaltiOAccion
        && (!(equipo === "INTER" && asistente && asistente !== "OMIT") || zonaAsistencia) && (
        <Paso n={6} titulo={t("mg_zona_tira")} activo={!zonaCampo}>
          <Campo seleccionada={zonaCampo} onSelect={setZonaCampo}
            direccion={equipo ? direccionAtaque(props.parteActual, equipo, props.cfg) : "der"}
            nombreAtacante={equipo === "INTER" ? NOMBRE_CORTO_TC : props.rivalNombre} />
          <div className="mt-1 text-right">
            <button onClick={() => setZonaCampo("__skip__")}
              className="px-3 py-1 bg-zinc-700 rounded text-xs">{t("saltar_zona_campo_corto")}</button>
          </div>
        </Paso>
      )}

      {!props.directo && accion && (zonaCampo || esPenaltiOAccion) && (
        <PorteriaOverlay
          titulo={esPenaltiOAccion
            ? t("mg_porteria_entra_accion", { accion: labelAccionGol(accion).toLowerCase() })
            : t("mg_porteria_entra")}
          onSelect={(z) => aplicar(z)}
          onSaltar={() => aplicar("")}
          onAtras={() => { if (!esPenaltiOAccion) setZonaCampo(""); else setAccion(""); }}
          extra={equipo === "INTER" && esPenaltiOAccion ? (
            <input className="w-full mt-2 bg-zinc-800 rounded px-3 py-2 text-sm"
              placeholder={t("mg_portero_rival_ph")}
              value={porteroRival}
              onChange={(e) => setPorteroRival(e.target.value.toUpperCase())} />
          ) : undefined}
        />
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL DISPARO DEL RIVAL ────────────────
// Flujo: resultado (PUERTA/PALO/FUERA/BLOQUEADO) → zona del campo (desde
// donde tiró, perspectiva del rival que ataca al revés que Inter) →
// si fue a puerta, zona de portería + portero nuestro que recibió.
// Si fue gol, mejor usar el botón GOL (no este modal). Aquí solo
// disparos que NO son gol.

function ModalDisparoRival(props: {
  directo: boolean;
  enPista: string[];
  rivalNombre: string;
  cfg: ConfigPartido; parteActual: ParteId;
  onCerrar: () => void;
  onConfirmar: (ev: any) => void;
}) {
  const [resultado, setResultado] = useState<ResultadoDisparo | null>(null);
  const [zonaCampo, setZonaCampo] = useState("");
  const [zonaPorteria, setZonaPorteria] = useState("");
  const [porteroNuestro, setPorteroNuestro] = useState("");
  // Flag para que el auto-confirmar solo dispare UNA vez (evita doble-close
  // si el useEffect se ejecuta de más).
  const yaConfirmado = useRef(false);

  const aplicar = () => {
    if (yaConfirmado.current) return;
    yaConfirmado.current = true;
    const ev: any = {
      tipo: "disparo",
      equipo: "RIVAL",
      resultado,
    };
    if (porteroNuestro) ev.portero = porteroNuestro;
    if (zonaCampo) ev.zonaCampo = zonaCampo;
    if (zonaPorteria) ev.zonaPorteria = zonaPorteria;
    props.onConfirmar(ev);
  };

  // Portero nuestro EN PISTA por defecto.
  const porterosPista = props.enPista.filter((n) =>
    ROSTER.find((j) => j.nombre === n)?.posicion === "PORTERO"
  );
  // Si solo hay 1 portero en pista, lo pre-seleccionamos (una sola vez al abrir).
  useEffect(() => {
    if (porterosPista[0] && !porteroNuestro) {
      setPorteroNuestro(porterosPista[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DIRECTO: guardar en el MISMO toque del resultado, sin zonas y sin esperas.
  // Antes se hacía con un setTimeout(150ms) y, mientras tanto, el render
  // pintaba el paso del CAMPO → "aparece el campo medio segundo y se quita"
  // (bug visto por Arkaitz 16/8). Ahora ni se espera ni se renderiza el campo.
  const confirmarDirecto = (r: ResultadoDisparo) => {
    if (yaConfirmado.current) return;
    yaConfirmado.current = true;
    const ev: any = { tipo: "disparo", equipo: "RIVAL", resultado: r };
    const portero = porteroNuestro || porterosPista[0];
    if (portero) ev.portero = portero;
    props.onConfirmar(ev);
  };

  // ⚡ Auto-confirmar cuando se completen los pasos requeridos. Ahorra el
  // click final de "Guardar" que pedía Arkaitz.
  // - PUERTA: requiere zonaCampo + zonaPorteria + portero (este pre-seleccionado).
  // - PALO/FUERA/BLOQUEADO: solo zonaCampo (no hay portería que marcar).
  useEffect(() => {
    if (!resultado || yaConfirmado.current) return;
    if (props.directo) return;  // en directo ya se guardó en el toque
    if (resultado === "PUERTA") {
      if (zonaCampo && zonaPorteria && porteroNuestro) {
        // Pequeño delay para que el usuario VEA su última selección antes
        // de que el modal se cierre (sensación de "fluido" en vez de
        // "brusco").
        const t = setTimeout(aplicar, 200);
        return () => clearTimeout(t);
      }
    } else {
      // PALO / FUERA / BLOQUEADO — basta con tener resultado + zonaCampo
      if (zonaCampo) {
        const t = setTimeout(aplicar, 200);
        return () => clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, zonaCampo, zonaPorteria, porteroNuestro]);

  return (
    <ModalShell titulo={t("mdr_titulo", { rival: props.rivalNombre })} onCerrar={props.onCerrar}>
      <p className="text-xs text-zinc-500 mb-2">
        {t("mdr_intro")}
      </p>

      <Paso n={1} titulo={t("mdr_como_acabo")} activo={!resultado}>
        <div className="grid grid-cols-4 gap-2">
          {(["PUERTA", "PALO", "FUERA", "BLOQUEADO"] as ResultadoDisparo[]).map((r) => (
            <button key={r}
              onClick={() => { if (props.directo) confirmarDirecto(r); else setResultado(r); }}
              className={`py-4 rounded font-bold text-lg ${
                resultado === r ? "bg-red-700" : "bg-zinc-800"
              }`}>{labelResultadoDisparo(r)}</button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          {t("mdr_puerta_nota")}
        </p>
      </Paso>

      {/* Paso "Tirador rival" eliminado 20/5/2026 noche: Arkaitz no
          quiere apuntar quién es el tirador del rival, le da igual.
          El flujo simplificado: resultado → zona campo → zona portería.
          En DIRECTO no hay pasos 2/3: ni campo ni portería, nunca. */}

      {!props.directo && resultado && (
        <Paso n={2} titulo={t("mdr_zona_campo")} activo={!zonaCampo}>
          <Campo
            seleccionada={zonaCampo}
            onSelect={setZonaCampo}
            direccion={direccionAtaque(props.parteActual, "RIVAL", props.cfg)}
            nombreAtacante={props.rivalNombre} />
          <div className="mt-2 flex justify-end">
            <button onClick={() => setZonaCampo("__skip__")}
              className="px-3 py-1 bg-zinc-700 rounded text-xs">
              {t("saltar_zona_campo")}
            </button>
          </div>
        </Paso>
      )}

      {!props.directo && resultado === "PUERTA" && zonaCampo && (
        <PorteriaOverlay
          titulo={t("mdr_zona_porteria_portero")}
          onSelect={(z) => setZonaPorteria(z)}
          onSaltar={() => aplicar()}
          onAtras={() => setZonaCampo("")}
          extra={
            <div className="mt-3">
              <h4 className="text-xs text-zinc-400 mb-1">{t("mdr_portero_paro")}</h4>
              <ChipsJugador
                opciones={porterosPista}
                seleccionado={porteroNuestro}
                onSelect={setPorteroNuestro} />
              <p className="text-xs text-zinc-500 mt-2 italic">{t("mdr_guarda_auto_porteria")}</p>
            </div>
          }
        />
      )}

      {!props.directo && resultado && resultado !== "PUERTA" && !zonaCampo && (
        <p className="text-xs text-zinc-500 mt-2 italic">
          {t("mdr_guarda_auto_campo")}
        </p>
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL PENALTI / 10M ────────────────

function ModalPenalti(props: {
  directo: boolean;
  enPista: string[]; rivalNombre: string;
  onCerrar: () => void;
  onConfirmar: (ev: any) => void;
}) {
  const [tipo, setTipo] = useState<"penalti" | "diezm" | null>(null);
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);
  const [tirador, setTirador] = useState("");
  const [porteroNuestro, setPorteroNuestro] = useState("");
  const [porteroRival, setPorteroRival] = useState("");
  const [resultado, setResultado] = useState<"GOL" | "PARADA" | "POSTE" | "FUERA" | null>(null);

  const aplicar = (zonaPorteria?: string, res?: "GOL" | "PARADA" | "POSTE" | "FUERA") => {
    const ev: any = {
      tipo,
      equipo,
      tirador: equipo === "INTER" ? tirador : "",
      portero: equipo === "INTER" ? porteroRival : porteroNuestro,
      resultado: res ?? resultado,
    };
    if (zonaPorteria) ev.zonaPorteria = zonaPorteria;
    props.onConfirmar(ev);
  };

  const RESULTADOS: ("GOL" | "PARADA" | "POSTE" | "FUERA")[] = ["GOL", "PARADA", "POSTE", "FUERA"];
  const porterosPista = props.enPista.filter((n) =>
    ROSTER.find((j) => j.nombre === n)?.posicion === "PORTERO"
  );

  return (
    <ModalShell titulo={t("mp_titulo")} onCerrar={props.onCerrar}>
      <Paso n={1} titulo={t("mp_tipo")} activo={!tipo}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTipo("penalti")}
            className={`py-3 rounded font-bold ${tipo === "penalti" ? "bg-pink-700" : "bg-zinc-800"}`}>
            {t("mp_penalti_6m")}</button>
          <button onClick={() => setTipo("diezm")}
            className={`py-3 rounded font-bold ${tipo === "diezm" ? "bg-pink-700" : "bg-zinc-800"}`}>
            {t("mp_10m")}</button>
        </div>
      </Paso>

      {tipo && (
        <Paso n={2} titulo={t("mp_favor_contra")} activo={!equipo}>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEquipo("INTER")}
              className={`py-3 rounded font-bold ${equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"}`}>
              {t("mp_a_favor", { equipo: NOMBRE_CORTO_TC })}</button>
            <button onClick={() => setEquipo("RIVAL")}
              className={`py-3 rounded font-bold ${equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"}`}>
              {t("mp_en_contra", { rival: props.rivalNombre })}</button>
          </div>
        </Paso>
      )}

      {equipo === "INTER" && (
        <Paso n={3} titulo={t("mp_tirador_nuestro")} activo={!tirador}>
          <ChipsJugador opciones={props.enPista} seleccionado={tirador} onSelect={setTirador} />
          <input className="w-full bg-zinc-800 rounded px-3 py-2 mt-2 text-sm"
            placeholder={t("mp_portero_rival_ph")}
            value={porteroRival} onChange={(e) => setPorteroRival(e.target.value.toUpperCase())} />
        </Paso>
      )}

      {equipo === "RIVAL" && (
        <Paso n={3} titulo={t("mp_portero_nuestro")} activo={!porteroNuestro}>
          <ChipsJugador opciones={porterosPista} seleccionado={porteroNuestro} onSelect={setPorteroNuestro} />
          <input className="w-full bg-zinc-800 rounded px-3 py-2 mt-2 text-sm"
            placeholder={t("mp_tirador_rival_ph")}
            value={tirador} onChange={(e) => setTirador(e.target.value.toUpperCase())} />
        </Paso>
      )}

      {equipo && ((equipo === "INTER" && tirador) || (equipo === "RIVAL" && porteroNuestro)) && (
        <Paso n={4} titulo={t("mp_resultado")} activo={!resultado}>
          <div className="grid grid-cols-4 gap-2">
            {RESULTADOS.map((r) => (
              <button key={r}
                onClick={() => {
                  // DIRECTO: guardar en el toque (sin zona de portería) — en
                  // directo cero zonas en nada. En VÍDEO se pasa al paso 5.
                  if (props.directo) { aplicar(undefined, r); return; }
                  setResultado(r);
                }}
                className={`py-3 rounded font-bold ${
                  resultado === r
                    ? (r === "GOL" ? "bg-green-700" : "bg-yellow-700")
                    : "bg-zinc-800"
                }`}>{labelResultadoDisparo(r)}</button>
            ))}
          </div>
        </Paso>
      )}

      {!props.directo && resultado && (
        <Paso n={5}
          titulo={resultado === "FUERA" ? t("mp_zona_no_aplica") : t("mp_zona_guardar")}
          activo>
          {resultado !== "FUERA" ? (
            <Porteria onSelect={(z) => aplicar(z)} />
          ) : null}
          <div className="mt-2 flex justify-end">
            <button onClick={() => aplicar(undefined)}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded font-bold">
              {resultado === "FUERA" ? t("guardar") : t("saltar_zona_guardar")}
            </button>
          </div>
        </Paso>
      )}
    </ModalShell>
  );
}

// ──────────────── MODAL ACCIÓN INDIVIDUAL (tap en jugador) ────────────────

// Tipos de accion que requieren zona del campo
type AccionConZonaTipo = "pf" | "pnf" | "robos" | "cortes" | "bdg" | "bdp";

function ModalAccionIndividual(props: {
  jugador: string;
  directo: boolean;
  enPista: string[];
  banquillo: string[];
  cfg: ConfigPartido; parteActual: ParteId;
  onCerrar: () => void;
  onCambio: (sale: string, entra: string) => void;
  onAmarilla: () => void;
  onRoja: () => void;
  onFalta: () => void;
  /** Acciones individuales con zona (básicas + stats de vídeo). `receptor` solo
   *  para conexPivot (el pívot que recibe). */
  onAccionConZona: (tipo: AccionIndTipo, zonaCampo?: string, receptor?: string) => void;
  onContador: (tipo: keyof ContadoresJugador) => void;
  onDisparo: (detalles: { resultado: ResultadoDisparo; zonaCampo: string; zonaPorteria: string }) => void;
}) {
  const [paso, setPaso] = useState<"menu" | "accionZona" | "disparoTipo" | "disparoCampo" | "disparoPorteria" | "videoMenu" | "videoResultado" | "videoConexion">("menu");
  const [disparoRes, setDisparoRes] = useState<ResultadoDisparo>("PUERTA");
  const [zonaCampo, setZonaCampo] = useState("");
  const [accionPendiente, setAccionPendiente] = useState<AccionIndTipo | null>(null);
  const [receptorPendiente, setReceptorPendiente] = useState<string>("");
  const [videoGrupo, setVideoGrupo] = useState<string>("");

  const esPortero = ROSTER.find((j) => j.nombre === props.jugador)?.posicion === "PORTERO";

  // Etiqueta de cada subtipo (título del paso de zona).
  const LBL_ACCION: Record<string, string> = {
    pf: t("lblacc_pf"), pnf: t("lblacc_pnf"), robos: t("lblacc_robos"),
    cortes: t("lblacc_cortes"), bdg: t("lblacc_bdg"), bdp: t("lblacc_bdp"),
    duelC_g: `${t("vid_duelC")} ✅`, duelC_p: `${t("vid_duelC")} ❌`,
    duelP_g: `${t("vid_duelP")} ✅`, duelP_p: `${t("vid_duelP")} ❌`,
    unoAtq_g: `${t("vid_unoAtq")} ✅`, unoAtq_p: `${t("vid_unoAtq")} ❌`,
    unoDef_g: `${t("vid_unoDef")} ✅`, unoDef_p: `${t("vid_unoDef")} ❌`,
    ultCob: t("vid_ultCob"), corteConex: t("vid_corteConex"), conexPivot: t("vid_conexPivot"),
    saqueB: `${t("vid_saque")} ✅`, saqueM: `${t("vid_saque")} ❌`, achique: t("vid_achique"),
    cobBR: `${t("vid_cob")} B+R`, cobBN: `${t("vid_cob")} B`, cobMR: `${t("vid_cob")} M+R`, cobMN: `${t("vid_cob")} M`,
    paseB: `${t("vid_pase")} ✅`, paseM: `${t("vid_pase")} ❌`,
  };

  // Grupos de stat de vídeo con "resultado" (2 o 4 opciones) → subtipo final.
  const GRUPOS: Record<string, { label: string; ops: [AccionIndTipo, string][] }> = {
    duelC: { label: t("vid_duelC"), ops: [["duelC_g", t("vid_ganado")], ["duelC_p", t("vid_perdido")]] },
    duelP: { label: t("vid_duelP"), ops: [["duelP_g", t("vid_ganado")], ["duelP_p", t("vid_perdido")]] },
    unoAtq: { label: t("vid_unoAtq"), ops: [["unoAtq_g", t("vid_ganado")], ["unoAtq_p", t("vid_perdido")]] },
    unoDef: { label: t("vid_unoDef"), ops: [["unoDef_g", t("vid_ganado")], ["unoDef_p", t("vid_perdido")]] },
    saque: { label: t("vid_saque"), ops: [["saqueB", t("vid_bueno")], ["saqueM", t("vid_malo")]] },
    pase: { label: t("vid_pase"), ops: [["paseB", t("vid_bueno")], ["paseM", t("vid_malo")]] },
    cob: { label: t("vid_cob"), ops: [["cobBR", t("vid_cob_br")], ["cobBN", t("vid_cob_bn")], ["cobMR", t("vid_cob_mr")], ["cobMN", t("vid_cob_mn")]] },
  };

  // Ir a elegir la zona con un subtipo ya decidido (+ receptor opcional).
  const irAZona = (a: AccionIndTipo, receptor?: string) => {
    setAccionPendiente(a);
    setReceptorPendiente(receptor || "");
    setPaso("accionZona");
  };

  const irAAccionZona = (a: AccionIndTipo) => {
    if (props.directo) { props.onAccionConZona(a, undefined); return; }
    irAZona(a);
  };

  if (paso === "menu") {
    // LAYOUT por filas (pedido Arkaitz 16/8), con COLORES por familia para que
    // en pista se lea de un vistazo:
    //   fila 1 → ROBO · CORTE           (verdes distintos = recuperar)
    //   fila 2 → PÉRDIDA F · PÉRDIDA NF (rojos distintos = perder)
    //   fila 2b→ BDG · BDP              (solo VÍDEO; en directo NO existen)
    //   fila 3 → DISPARO                (azul, ancho completo)
    //   fila 3b→ STATS DE VÍDEO         (solo VÍDEO)
    //   fila 4 → FALTA · AMARILLA · ROJA (naranja · amarillo · rojo oscuro)
    //   debajo → BANQUILLO grande con el DORSAL (cambio en un toque)
    return (
      <ModalShell titulo={t("mai_titulo", { jugador: props.jugador })} onCerrar={props.onCerrar}>
        <p className="text-sm text-zinc-400 mb-3">
          {props.directo ? t("mai_intro_directo") : t("mai_intro")}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <BotonGrande label={t("mai_btn_robo")}  color="bg-green-600" onClick={() => irAAccionZona("robos")} />
          <BotonGrande label={t("mai_btn_corte")} color="bg-emerald-800" onClick={() => irAAccionZona("cortes")} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <BotonGrande label={t("mai_btn_pf")}  subtitle={t("mai_btn_pf_sub")}  color="bg-red-600"  onClick={() => irAAccionZona("pf")} />
          <BotonGrande label={t("mai_btn_pnf")} subtitle={t("mai_btn_pnf_sub")} color="bg-rose-800" onClick={() => irAAccionZona("pnf")} />
        </div>
        {/* Balón dividido: solo en VÍDEO (Arkaitz lo quitó del directo, 16/8). */}
        {!props.directo && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <BotonGrande label={t("mai_btn_bdg")} subtitle={t("mai_btn_bdg_sub")} color="bg-purple-700" onClick={() => irAAccionZona("bdg")} />
            <BotonGrande label={t("mai_btn_bdp")} subtitle={t("mai_btn_bdp_sub")} color="bg-purple-950" onClick={() => irAAccionZona("bdp")} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 mb-2">
          <BotonGrande label={t("mai_disparo")} color="bg-blue-600" onClick={() => setPaso("disparoTipo")} />
        </div>

        {/* Stats de VÍDEO — solo en modo vídeo (duelos, 1x1, coberturas...). */}
        {!props.directo && (
          <div className="grid grid-cols-1 gap-2 mb-2">
            <BotonGrande label={t("vid_menu_btn")} color="bg-sky-900" onClick={() => setPaso("videoMenu")} />
          </div>
        )}

        {/* Disciplina: FALTA (izq) · AMARILLA (centro) · ROJA (der). */}
        <div className="grid grid-cols-3 gap-2">
          <BotonGrande label={t("mab_falta")} color="bg-orange-600" onClick={props.onFalta} />
          <BotonGrande label={t("mab_amarilla")} color="bg-yellow-400 text-zinc-950" onClick={props.onAmarilla} />
          <BotonGrande label={t("mab_roja")} color="bg-red-950 border-2 border-red-500" onClick={props.onRoja} />
        </div>

        {/* CAMBIO DIRECTO: tap en un jugador del banquillo y se hace el cambio
            inmediatamente. Botones GRANDES con el DORSAL bien visible (en vez
            de la flecha), en el mismo orden que el banquillo de la pantalla
            (último en salir a la izquierda; sin jugar, al final). */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            {t("mai_cambio_rapido")}
          </h3>
          {props.banquillo.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("mai_no_banquillo")}</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {props.banquillo.map((n) => {
                const dorsal = ROSTER.find((j) => j.nombre === n)?.dorsal || "";
                const esPor = ROSTER.find((j) => j.nombre === n)?.posicion === "PORTERO";
                return (
                  <button key={n}
                    onClick={() => props.onCambio(props.jugador, n)}
                    className={`min-h-[76px] px-2 py-2 rounded-xl flex items-center justify-center gap-3 font-bold border-2 ${
                      esPor ? "bg-zinc-800 border-zinc-500" : "bg-zinc-700 border-zinc-500 hover:bg-zinc-600"
                    }`}>
                    <span className="text-3xl font-mono tabular-nums leading-none">{dorsal || "·"}</span>
                    <span className="text-lg leading-tight text-left">{n}{esPor ? " 🥅" : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-zinc-500 mt-2">
            {t("mai_sale_pre")}<strong>{props.jugador}</strong>{t("mai_sale_post")}
          </p>
        </div>
      </ModalShell>
    );
  }

  if (paso === "accionZona" && accionPendiente) {
    return (
      <ModalShell titulo={`${LBL_ACCION[accionPendiente]} · ${props.jugador}`}
        onCerrar={props.onCerrar}>
        <Paso n={1} titulo={t("mai_en_que_zona")} activo>
          <Campo
            onSelect={(z) => props.onAccionConZona(accionPendiente, z, receptorPendiente || undefined)}
            direccion={direccionAtaque(props.parteActual, "INTER", props.cfg)}
            nombreAtacante={NOMBRE_CORTO_TC} />
          <div className="mt-2 flex justify-between">
            <button onClick={() => { setAccionPendiente(null); setReceptorPendiente(""); setPaso("menu"); }}
              className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
            <button onClick={() => props.onAccionConZona(accionPendiente, undefined, receptorPendiente || undefined)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">
              {t("saltar_zona_guardar")}
            </button>
          </div>
        </Paso>
      </ModalShell>
    );
  }

  if (paso === "disparoTipo") {
    return (
      <ModalShell titulo={t("mai_disparo_de", { jugador: props.jugador })} onCerrar={props.onCerrar}>
        <Paso n={1} titulo={t("mai_resultado_disparo")} activo>
          <div className="grid grid-cols-4 gap-2">
            {(["PUERTA", "PALO", "FUERA", "BLOQUEADO"] as ResultadoDisparo[]).map((r) => (
              <button key={r}
                onClick={() => {
                  if (props.directo) {
                    // DIRECTO: guardar el disparo sin zona de campo ni portería.
                    props.onDisparo({ resultado: r, zonaCampo: "", zonaPorteria: "" });
                    return;
                  }
                  setDisparoRes(r); setPaso("disparoCampo");
                }}
                className="py-4 rounded font-bold bg-pink-700 hover:bg-pink-600">{labelResultadoDisparo(r)}</button>
            ))}
          </div>
        </Paso>
        <button onClick={() => setPaso("menu")} className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
      </ModalShell>
    );
  }

  if (paso === "disparoCampo") {
    return (
      <ModalShell titulo={t("mai_disparo_flecha", { jugador: props.jugador, res: labelResultadoDisparo(disparoRes) })} onCerrar={props.onCerrar}>
        <Paso n={2} titulo={t("mai_zona_dispara")} activo>
          <Campo onSelect={(z) => {
            setZonaCampo(z);
            if (disparoRes === "PUERTA") setPaso("disparoPorteria");
            else props.onDisparo({ resultado: disparoRes, zonaCampo: z, zonaPorteria: "" });
          }}
          direccion={direccionAtaque(props.parteActual, "INTER", props.cfg)}
          nombreAtacante={NOMBRE_CORTO_TC} />
          <div className="mt-2 flex justify-between">
            <button onClick={() => setPaso("disparoTipo")} className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
            <button onClick={() => {
              if (disparoRes === "PUERTA") setPaso("disparoPorteria");
              else props.onDisparo({ resultado: disparoRes, zonaCampo: "", zonaPorteria: "" });
            }} className="px-4 py-2 bg-zinc-700 rounded text-xs">{t("saltar_zona_campo_corto")}</button>
          </div>
        </Paso>
      </ModalShell>
    );
  }

  if (paso === "disparoPorteria") {
    return (
      <ModalShell titulo={t("mai_disparo_puerta_desde", { jugador: props.jugador, zona: zonaCampo || "?" })} onCerrar={props.onCerrar}>
        <Paso n={3} titulo={t("mai_zona_porteria_tap")} activo>
          <Porteria onSelect={(z) =>
            props.onDisparo({ resultado: "PUERTA", zonaCampo, zonaPorteria: z })
          } />
          <div className="mt-2 flex justify-between">
            <button onClick={() => setPaso("disparoCampo")} className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
            <button onClick={() =>
              props.onDisparo({ resultado: "PUERTA", zonaCampo, zonaPorteria: "" })
            } className="px-4 py-2 bg-zinc-700 rounded text-xs">{t("saltar_zona_porteria")}</button>
          </div>
        </Paso>
      </ModalShell>
    );
  }

  // ── STATS DE VÍDEO (solo modo vídeo) ──
  if (paso === "videoMenu") {
    return (
      <ModalShell titulo={`📹 ${props.jugador}`} onCerrar={props.onCerrar}>
        <p className="text-sm text-zinc-400 mb-3">{t("vid_menu_intro")}</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <BotonGrande label={GRUPOS.duelC.label} onClick={() => { setVideoGrupo("duelC"); setPaso("videoResultado"); }} />
          <BotonGrande label={GRUPOS.duelP.label} onClick={() => { setVideoGrupo("duelP"); setPaso("videoResultado"); }} />
          <BotonGrande label={GRUPOS.unoAtq.label} onClick={() => { setVideoGrupo("unoAtq"); setPaso("videoResultado"); }} />
          <BotonGrande label={GRUPOS.unoDef.label} onClick={() => { setVideoGrupo("unoDef"); setPaso("videoResultado"); }} />
          <BotonGrande label={t("vid_conexPivot")} color="bg-emerald-800" onClick={() => setPaso("videoConexion")} />
          <BotonGrande label={t("vid_corteConex")} onClick={() => irAZona("corteConex")} />
          <BotonGrande label={t("vid_ultCob")} onClick={() => irAZona("ultCob")} />
          <BotonGrande label={t("mai_btn_bdg")} subtitle={t("mai_btn_bdg_sub")} onClick={() => irAZona("bdg")} />
          <BotonGrande label={t("mai_btn_bdp")} subtitle={t("mai_btn_bdp_sub")} onClick={() => irAZona("bdp")} />
        </div>
        {esPortero && (
          <>
            <h3 className="text-sm font-semibold text-sky-300 mb-2">{t("vid_portero")}</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <BotonGrande label={GRUPOS.saque.label} color="bg-sky-900" onClick={() => { setVideoGrupo("saque"); setPaso("videoResultado"); }} />
              <BotonGrande label={GRUPOS.pase.label} color="bg-sky-900" onClick={() => { setVideoGrupo("pase"); setPaso("videoResultado"); }} />
              <BotonGrande label={GRUPOS.cob.label} color="bg-sky-900" onClick={() => { setVideoGrupo("cob"); setPaso("videoResultado"); }} />
              <BotonGrande label={t("vid_achique")} color="bg-sky-900" onClick={() => irAZona("achique")} />
            </div>
          </>
        )}
        <button onClick={() => setPaso("menu")} className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
      </ModalShell>
    );
  }

  if (paso === "videoResultado" && GRUPOS[videoGrupo]) {
    const g = GRUPOS[videoGrupo];
    return (
      <ModalShell titulo={`${g.label} · ${props.jugador}`} onCerrar={props.onCerrar}>
        <Paso n={1} titulo={t("vid_elige_resultado")} activo>
          <div className="grid grid-cols-2 gap-2">
            {g.ops.map(([sub, lbl]) => (
              <button key={sub} onClick={() => irAZona(sub)}
                className="py-4 rounded-lg font-bold bg-zinc-700 hover:bg-zinc-600">{lbl}</button>
            ))}
          </div>
        </Paso>
        <button onClick={() => setPaso("videoMenu")} className="px-4 py-2 bg-zinc-700 rounded">{t("atras")}</button>
      </ModalShell>
    );
  }

  if (paso === "videoConexion") {
    return (
      <ModalShell titulo={`${t("vid_conexPivot")} · ${props.jugador}`} onCerrar={props.onCerrar}>
        <Paso n={1} titulo={t("vid_conex_receptor")} activo>
          <ChipsJugador
            opciones={props.enPista.filter((n) => n !== props.jugador)}
            seleccionado={receptorPendiente}
            onSelect={(n) => irAZona("conexPivot", n)} />
        </Paso>
        <button onClick={() => setPaso("videoMenu")} className="px-4 py-2 bg-zinc-700 rounded mt-3">{t("atras")}</button>
      </ModalShell>
    );
  }

  return null;
}

function BotonGrande(props: { label: string; subtitle?: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={props.onClick}
      className={`${props.color || "bg-zinc-700"} hover:opacity-90 py-6 rounded-xl font-bold flex flex-col items-center`}>
      <span className="text-lg">{props.label}</span>
      {props.subtitle && <span className="text-sm opacity-70">{props.subtitle}</span>}
    </button>
  );
}

// ──────────────── MODAL TIEMPOS (resumen por jugador) ────────────────

function ModalTiempos(props: {
  partido: Partido;
  enPista: string[];
  segundosTurnoActual: (n: string) => number;
  onCerrar: () => void;
}) {
  const { partido, enPista } = props;
  if (!partido.config) return null;
  const partes: ParteId[] = ["1T", "2T", "PR1", "PR2"];
  // Filtramos solo las partes que se juegan (duración > 0)
  const partesActivas = partes.filter((p) => (partido.config!.duracionParte[p] ?? 0) > 0);

  // Para cada jugador: total (incluye live), por parte (incluye live de la parte actual).
  const filas = partido.config.convocados.map((nombre) => {
    const t = partido.tiempos[nombre];
    if (!t) return { nombre, total: 0, porParte: {} as Record<ParteId, number>, esPortero: false, enPista: false };
    const parteActual = partido.cronometro.parteActual;
    const enPistaAhora = enPista.includes(nombre);
    // Live: si está en pista con turnoStart, suma desde turnoStart.
    const liveExtra = (enPistaAhora && t.turnoStart != null && partido.cronometro.ultimoStart != null)
      ? (Date.now() - t.turnoStart) / 1000
      : 0;
    const porParte: Record<ParteId, number> = { ...t.porParte };
    if (liveExtra > 0) porParte[parteActual] = (porParte[parteActual] ?? 0) + liveExtra;
    const total = t.totalSegundos + liveExtra;
    const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
    return { nombre, total, porParte, esPortero, enPista: enPistaAhora };
  });
  // Orden: en pista primero, después por total descendente
  filas.sort((a, b) => {
    if (a.enPista !== b.enPista) return a.enPista ? -1 : 1;
    return b.total - a.total;
  });

  return (
    <ModalShell titulo={t("mt_titulo")} onCerrar={props.onCerrar}>
      <div className="overflow-x-auto">
        {/* Anchos fijos: nombre estrecho, tiempos grandes y pegados (16/8). */}
        <table className="w-full table-fixed text-xl">
          {/* Tiempos de ancho fijo pegados al nombre; hueco sobrante al final. */}
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: `${Math.min(15, Math.floor(62 / (1 + partesActivas.length)))}%` }} />
            {partesActivas.map((p) => <col key={p} style={{ width: `${Math.min(15, Math.floor(62 / (1 + partesActivas.length)))}%` }} />)}
            <col />
          </colgroup>
          <thead className="text-sm text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 px-2">{t("mt_jugador")}</th>
              <th className="text-right px-2">{t("mt_total")}</th>
              {partesActivas.map((p) => (
                <th key={p} className="text-right px-2">{p}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre} className="border-b border-zinc-900">
                <td className="py-1.5 px-2 truncate">
                  <span className={`${f.esPortero ? "text-yellow-400" : ""} font-bold`}>
                    {f.nombre}
                  </span>
                  {f.enPista && <span className="ml-2 text-[10px] bg-green-700 px-1.5 py-0.5 rounded align-middle">{t("mt_en_pista")}</span>}
                </td>
                <td className="text-right font-mono tabular-nums px-2 font-bold text-2xl">
                  {formatMMSS(f.total)}
                </td>
                {partesActivas.map((p) => (
                  <td key={p} className="text-right font-mono tabular-nums px-2 text-zinc-300 text-2xl">
                    {formatMMSS(f.porParte[p] ?? 0)}
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot className="text-xs text-zinc-500 border-t border-zinc-800">
            <tr>
              <td className="pt-2 px-2 italic truncate">{t("mt_total_minutos")}</td>
              <td className="text-right font-mono tabular-nums px-2 font-bold pt-2 text-base">
                {formatMMSS(filas.reduce((s, f) => s + f.total, 0))}
              </td>
              {partesActivas.map((p) => (
                <td key={p} className="text-right font-mono tabular-nums px-2 pt-2 text-base">
                  {formatMMSS(filas.reduce((s, f) => s + (f.porParte[p] ?? 0), 0))}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-zinc-500 mt-3">
        {t("mt_nota")}
      </p>
    </ModalShell>
  );
}

// ──────────────── MODAL TANDA DE PENALTIS ────────────────
// Flujo simple: lista de tiros + form para añadir el siguiente.
// Cada tiro: equipo → tirador (chips de convocados / texto rival) → portero
// → resultado → (si gol o parada/poste) zona portería = guardar.
// Marcador de la tanda se actualiza solo.

function ModalTanda(props: {
  tanda: TandaPenaltis;
  enPista: string[];
  convocados: string[];
  rivalNombre: string;
  onCerrar: () => void;
  onApuntar: (tiro: Omit<TiroTanda, "id" | "orden" | "timestampReal">) => void;
  onDeshacer: () => void;
}) {
  // Estado del formulario para el siguiente tiro
  const [equipo, setEquipo] = useState<"INTER" | "RIVAL" | null>(null);
  const [tirador, setTirador] = useState("");
  const [portero, setPortero] = useState("");
  const [resultado, setResultado] = useState<"GOL" | "PARADA" | "POSTE" | "FUERA" | null>(null);

  const reset = () => { setEquipo(null); setTirador(""); setPortero(""); setResultado(null); };

  const aplicar = (zonaPorteria?: string) => {
    if (!equipo || !resultado) return;
    props.onApuntar({
      equipo,
      tirador: tirador || undefined,
      portero: portero || undefined,
      resultado,
      zonaPorteria: zonaPorteria,
    });
    reset();
  };

  const porterosNuestros = props.convocados.filter((n) =>
    ROSTER.find((j) => j.nombre === n)?.posicion === "PORTERO"
  );

  return (
    <ModalShell titulo={t("mta_titulo", { inter: props.tanda.marcador.inter, rival: props.tanda.marcador.rival })}
      onCerrar={props.onCerrar}>

      {/* Historial de tiros */}
      <div className="mb-4 bg-zinc-950 rounded p-3 max-h-48 overflow-y-auto">
        <h3 className="text-sm text-zinc-400 mb-2">{t("mta_tiros_realizados", { n: props.tanda.tiros.length })}</h3>
        {props.tanda.tiros.length === 0 && <p className="text-xs text-zinc-600">{t("mta_ninguno")}</p>}
        <ol className="text-sm space-y-1">
          {props.tanda.tiros.map((ti) => (
            <li key={ti.id} className="flex justify-between items-center">
              <span>
                <span className="text-zinc-500 text-xs">#{ti.orden}</span>{" "}
                <span className={ti.equipo === "INTER" ? "text-emerald-400" : "text-red-400"}>
                  {ti.equipo === "INTER" ? "INTER" : props.rivalNombre}
                </span>
                {" · "}
                <span className="font-bold">{ti.tirador || "—"}</span>
                {" → "}
                <span className={ti.resultado === "GOL" ? "text-green-400 font-bold" : "text-yellow-400"}>{labelResultadoDisparo(ti.resultado)}</span>
                {ti.zonaPorteria && <span className="text-zinc-500 text-xs"> ({ti.zonaPorteria})</span>}
              </span>
            </li>
          ))}
        </ol>
        {props.tanda.tiros.length > 0 && (
          <button onClick={props.onDeshacer}
            className="mt-2 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded">
            {t("mta_deshacer")}
          </button>
        )}
      </div>

      {/* Form: siguiente tiro */}
      <div className="border-t border-zinc-800 pt-3">
        <h3 className="text-sm font-bold text-zinc-300 mb-2">{t("mta_apuntar_tiro", { n: props.tanda.tiros.length + 1 })}</h3>

        <Paso n={1} titulo={t("mta_quien_lanza")} activo={!equipo}>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEquipo("INTER")}
              className={`py-3 rounded font-bold ${equipo === "INTER" ? "bg-emerald-700" : "bg-zinc-800"}`}>
              INTER</button>
            <button onClick={() => setEquipo("RIVAL")}
              className={`py-3 rounded font-bold ${equipo === "RIVAL" ? "bg-red-700" : "bg-zinc-800"}`}>
              {props.rivalNombre}</button>
          </div>
        </Paso>

        {equipo === "INTER" && (
          <Paso n={2} titulo={t("mta_tirador")} activo={!tirador}>
            <ChipsJugador opciones={props.convocados} seleccionado={tirador} onSelect={setTirador} />
          </Paso>
        )}
        {equipo === "RIVAL" && (
          <Paso n={2} titulo={t("mta_portero_nuestro")} activo={!portero}>
            <ChipsJugador opciones={porterosNuestros} seleccionado={portero} onSelect={setPortero} />
            <input className="w-full bg-zinc-800 rounded px-3 py-2 mt-2 text-sm"
              placeholder={t("mta_tirador_rival_ph")}
              value={tirador} onChange={(e) => setTirador(e.target.value.toUpperCase())} />
          </Paso>
        )}

        {equipo && ((equipo === "INTER" && tirador) || (equipo === "RIVAL" && portero)) && (
          <Paso n={3} titulo={t("mta_resultado")} activo={!resultado}>
            <div className="grid grid-cols-4 gap-2">
              {(["GOL", "PARADA", "POSTE", "FUERA"] as const).map((r) => (
                <button key={r} onClick={() => setResultado(r)}
                  className={`py-3 rounded font-bold ${
                    resultado === r
                      ? (r === "GOL" ? "bg-green-700" : "bg-yellow-700")
                      : "bg-zinc-800"
                  }`}>{labelResultadoDisparo(r)}</button>
              ))}
            </div>
          </Paso>
        )}

        {resultado && (
          <Paso n={4} titulo={resultado === "FUERA" ? t("mta_zona_fuera") : t("mta_zona_porteria")} activo>
            {resultado !== "FUERA" ? (
              <Porteria onSelect={(z) => aplicar(z)} />
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={reset}
                className="px-3 py-1 bg-zinc-700 rounded text-xs">{t("reiniciar")}</button>
              <button onClick={() => aplicar(undefined)}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded font-bold">
                {resultado === "FUERA" ? t("guardar") : t("saltar_zona_guardar")}
              </button>
            </div>
          </Paso>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-zinc-800 pt-3">
        <button onClick={props.onCerrar}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded">{t("mta_cerrar")}</button>
      </div>
    </ModalShell>
  );
}

// ──────────────── MODAL CAMBIO DE PARTE / DESCANSO / FIN ────────────────
//
// Lógica según la parte de la que veníamos:
//   - 1T → modal "Descanso de 1ª parte" con resumen + botón "Empezar 2ª".
//   - 2T → modal "Final de 2ª parte" con 3 opciones:
//          - Hay prórroga (config minutos) → setDuracionesParte + avanzar a PR1.
//          - Tanda de penaltis directos → abrir tanda.
//          - Finalizar partido → ir a /resumen.
//   - PR1 → "Descanso de prórroga" con resumen + botón "Empezar PR2".
//   - PR2 → "Final de prórroga" con 2 opciones (tanda / finalizar).

function ModalCambioParte(props: {
  partido: Partido;
  desde: ParteId;
  onCerrar: () => void;
  onContinuarSiguienteParte: () => void;
  onConfigurarProrroga: (minutos: number) => void;
  onIrATanda: () => void;
  onFinalizar: () => void;
}) {
  const { partido, desde } = props;
  const cfg = partido.config!;
  const [minProrroga, setMinProrroga] = useState(5);

  const TITULOS: Record<ParteId, string> = {
    "1T": t("mcp_titulo_1t"),
    "2T": t("mcp_titulo_2t"),
    PR1: t("mcp_titulo_pr1"),
    PR2: t("mcp_titulo_pr2"),
  };

  // Empate? Útil para 2T y PR2.
  const empate = partido.marcador.inter === partido.marcador.rival;

  // Resumen rápido por jugador (tiempo en la parte que acaba)
  const filasTiempos = cfg.convocados
    .map((nombre) => {
      const t = partido.tiempos[nombre];
      if (!t) return null;
      const totalParte = (t.porParte?.[desde] ?? 0);
      const total = t.totalSegundos ?? 0;
      const esPortero = ROSTER.find((j) => j.nombre === nombre)?.posicion === "PORTERO";
      const c = partido.acciones.porJugador[nombre];
      return { nombre, totalParte, total, esPortero, c };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && (x.totalParte > 0 || x.total > 0))
    .sort((a, b) => b.totalParte - a.totalParte);

  // Totales por JUGADOR (acumulados a TODO el partido). Las acciones colectivas
  // de equipo (#EQUIPO) van aparte, más abajo (recEquipo / perdEquipo).
  const tot = cfg.convocados.reduce((acc, n) => {
    const c = partido.acciones.porJugador[n];
    if (!c) return acc;
    return {
      dpp: acc.dpp + (c.dpp || 0),
      dpa: acc.dpa + (c.dpa || 0),
      dpf: acc.dpf + (c.dpf || 0),
      dpb: acc.dpb + (c.dpb || 0),
      pf: acc.pf + (c.pf || 0),
      pnf: acc.pnf + (c.pnf || 0),
      robos: acc.robos + (c.robos || 0),
      cortes: acc.cortes + (c.cortes || 0),
      bdg: acc.bdg + (c.bdg || 0),
      bdp: acc.bdp + (c.bdp || 0),
    };
  }, { dpp:0,dpa:0,dpf:0,dpb:0,pf:0,pnf:0,robos:0,cortes:0,bdg:0,bdp:0 });
  // Acciones colectivas de equipo (aparte de los jugadores): recuperación de
  // equipo = robos; pérdida de equipo = pf (forzada).
  const _cEq = partido.acciones.porJugador[JUGADOR_EQUIPO];
  const recEquipo = _cEq?.robos ?? 0;
  const perdEquipo = _cEq?.pf ?? 0;

  const totalDispINTER = tot.dpp + tot.dpa + tot.dpf + tot.dpb;
  const r = partido.disparosRival;
  const totalDispRIVAL = r.puerta + r.palo + r.fuera + r.bloqueado;

  // ¿Mostramos opciones de final (2T o PR2)?
  const esFinal2T = desde === "2T";
  const esFinalPR2 = desde === "PR2";
  const esFinalParte = esFinal2T || esFinalPR2;

  return (
    <ModalShell titulo={TITULOS[desde]} onCerrar={props.onCerrar} tituloClass="text-lg text-zinc-300">

      {/* Marcador actual + estado (compacto: el protagonista de esta pantalla
          son los TIEMPOS por jugador — pedido Arkaitz 16/8) */}
      <div className="text-center bg-zinc-950 rounded-lg px-3 py-2 mb-3">
        <div className="text-2xl font-bold tabular-nums">
          <span className="text-emerald-400">{CLIENTE.nombreCorto} {partido.marcador.inter}</span>
          <span className="text-zinc-500 mx-2">-</span>
          <span className="text-red-400">{partido.marcador.rival} {cfg.rival}</span>
        </div>
        {esFinalParte && empate && (
          <div className="text-yellow-400 text-sm mt-1">
            {t("mcp_empate")}
          </div>
        )}
      </div>

      {/* ATAJO arriba — botón principal de avance bien visible.
          Para 1T = empezar 2T, PR1 = empezar PR2. En 2T y PR2 no hay
          un único atajo (hay 3 opciones), así que solo aparece para
          1T/PR1. Las opciones de 2T/PR2 siguen abajo. */}
      {(desde === "1T" || desde === "PR1") && (
        <button onClick={props.onContinuarSiguienteParte}
          className="w-full py-4 mb-3 bg-green-700 hover:bg-green-600 rounded-xl text-2xl font-bold">
          ▶ {desde === "1T" ? t("mcp_empezar_2a") : t("mcp_empezar_pr2")}
        </button>
      )}

      {/* TIEMPOS POR JUGADOR — PRIMERO, grandes y TODOS visibles (sin scroll
          interno: antes un max-h cortaba la lista y no se veían todos). Columna
          de nombre estrecha para que los tiempos queden pegados y grandes. */}
      <div className="bg-zinc-900 rounded-lg p-3 mb-3">
        <h3 className="text-sm font-bold text-zinc-400 mb-2 uppercase tracking-wide">
          {t("mcp_tiempos_jugador", { parte: desde })}
        </h3>
        <table className="w-full table-fixed text-2xl">
          <colgroup>
            <col style={{ width: "34%" }} /><col style={{ width: "20%" }} /><col style={{ width: "22%" }} /><col />
          </colgroup>
          <thead className="text-sm text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="text-left py-1 px-2">{t("mt_jugador")}</th>
              <th className="text-right px-2">{desde}</th>
              <th className="text-right px-2">{t("mcp_total_partido")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filasTiempos.map((f) => (
              <tr key={f.nombre} className="border-b border-zinc-900">
                <td className={`py-1 px-2 truncate ${f.esPortero ? "text-yellow-400" : ""} font-bold`}>
                  {f.nombre}{f.esPortero ? " 🥅" : ""}
                </td>
                <td className="text-right font-mono tabular-nums px-2 font-bold text-3xl">{formatMMSS(f.totalParte)}</td>
                <td className="text-right font-mono tabular-nums px-2 text-zinc-400">{formatMMSS(f.total)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DISPAROS — compacto (una línea por equipo) */}
      <div className="bg-zinc-900 rounded-lg p-3 mb-3">
        <h3 className="text-sm font-bold text-zinc-400 mb-2 uppercase tracking-wide">{t("mcp_disparos")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {/* INTER */}
          <div className="bg-emerald-900/40 rounded-lg px-3 py-2 border border-emerald-700/40">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-emerald-300 font-bold uppercase tracking-wide">{CLIENTE.nombreCorto}</span>
              <span><span className="text-2xl font-bold text-white tabular-nums">{totalDispINTER}</span>
                <span className="text-xs text-emerald-300 ml-1">{t("mcp_total")}</span></span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-emerald-800/40 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{tot.dpp}</div>
                <div className="text-[10px] text-emerald-200 uppercase">{t("mcp_puerta")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{tot.dpa}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_palo")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{tot.dpf}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_fuera")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{tot.dpb}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_bloq")}</div>
              </div>
            </div>
          </div>
          {/* RIVAL */}
          <div className="bg-red-900/40 rounded-lg px-3 py-2 border border-red-700/40">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-red-300 font-bold uppercase tracking-wide truncate">{cfg.rival}</span>
              <span><span className="text-2xl font-bold text-white tabular-nums">{totalDispRIVAL}</span>
                <span className="text-xs text-red-300 ml-1">{t("mcp_total")}</span></span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-red-800/40 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{r.puerta}</div>
                <div className="text-[10px] text-red-200 uppercase">{t("mcp_puerta")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{r.palo}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_palo")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{r.fuera}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_fuera")}</div>
              </div>
              <div className="bg-zinc-800/60 rounded py-0.5">
                <div className="text-base font-bold tabular-nums">{r.bloqueado}</div>
                <div className="text-[10px] text-zinc-400 uppercase">{t("mcp_bloq")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTROS STATS DEL EQUIPO — Pérdidas / Recuperaciones / Balones divididos (compacto) */}
      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div className="bg-red-900/20 rounded-lg p-2 border border-red-700/20">
          <div className="text-red-300 font-bold mb-1">{t("mcp_perdidas")}</div>
          <div className="flex justify-between"><span>{t("mcp_forzada")}</span><strong>{tot.pf}</strong></div>
          <div className="flex justify-between"><span>{t("mcp_no_forzada")}</span><strong>{tot.pnf}</strong></div>
          <div className="flex justify-between text-red-300/80"><span>{t("res_de_equipo")}</span><strong>{perdEquipo}</strong></div>
          <div className="border-t border-red-700/40 mt-1 pt-1 flex justify-between text-red-200">
            <span>{t("mcp_total_lbl")}</span><strong>{tot.pf + tot.pnf + perdEquipo}</strong>
          </div>
        </div>
        <div className="bg-green-900/20 rounded-lg p-2 border border-green-700/20">
          <div className="text-green-300 font-bold mb-1">{t("mcp_recuperaciones")}</div>
          <div className="flex justify-between"><span>{t("mcp_robos")}</span><strong>{tot.robos}</strong></div>
          <div className="flex justify-between"><span>{t("mcp_cortes")}</span><strong>{tot.cortes}</strong></div>
          <div className="flex justify-between text-green-300/80"><span>{t("res_de_equipo")}</span><strong>{recEquipo}</strong></div>
          <div className="border-t border-green-700/40 mt-1 pt-1 flex justify-between text-green-200">
            <span>{t("mcp_total_lbl")}</span><strong>{tot.robos + tot.cortes + recEquipo}</strong>
          </div>
        </div>
        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-700/20">
          <div className="text-purple-300 font-bold mb-1">{t("mcp_divididos")}</div>
          <div className="flex justify-between"><span>{t("mcp_ganados")}</span><strong>{tot.bdg}</strong></div>
          <div className="flex justify-between"><span>{t("mcp_no_ganados")}</span><strong>{tot.bdp}</strong></div>
          <div className="border-t border-purple-700/40 mt-1 pt-1 flex justify-between text-purple-200">
            <span>{t("mcp_ratio")}</span>
            <strong>{(tot.bdg + tot.bdp) > 0
              ? `${Math.round(tot.bdg / (tot.bdg + tot.bdp) * 100)}%`
              : "—"}</strong>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL — solo top scorers de cada categoría para no saturar */}
      <div className="bg-zinc-900 rounded-lg p-4 mb-4">
        <h3 className="text-base font-bold text-zinc-300 mb-3">{t("mcp_acciones_indiv")}</h3>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-2">{t("mt_jugador")}</th>
                <th className="text-right px-2 text-emerald-300">{t("mcp_disp")}</th>
                <th className="text-right px-2 text-red-300">{t("mcp_perd")}</th>
                <th className="text-right px-2 text-green-300">{t("mcp_recup")}</th>
                <th className="text-right px-2 text-purple-300">{t("mcp_divid")}</th>
              </tr>
            </thead>
            <tbody>
              {filasTiempos
                .filter((f) => f.c && (
                  (f.c.dpp || 0) + (f.c.dpa || 0) + (f.c.dpf || 0) + (f.c.dpb || 0) +
                  (f.c.pf || 0) + (f.c.pnf || 0) + (f.c.robos || 0) + (f.c.cortes || 0) +
                  (f.c.bdg || 0) + (f.c.bdp || 0) > 0
                ))
                .map((f) => {
                  const c = f.c!;
                  const disp = (c.dpp||0)+(c.dpa||0)+(c.dpf||0)+(c.dpb||0);
                  const perd = (c.pf||0)+(c.pnf||0);
                  const rec = (c.robos||0)+(c.cortes||0);
                  const div = (c.bdg||0)+(c.bdp||0);
                  return (
                    <tr key={f.nombre} className="border-b border-zinc-900">
                      <td className={`py-1.5 px-2 ${f.esPortero ? "text-yellow-400" : ""} font-bold`}>{f.nombre}</td>
                      <td className="text-right font-mono px-2">{disp}</td>
                      <td className="text-right font-mono px-2">{perd}</td>
                      <td className="text-right font-mono px-2">{rec}</td>
                      <td className="text-right font-mono px-2">{div}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCIONES SEGÚN PARTE */}
      <div className="border-t border-zinc-800 pt-4">

        {/* 1T y PR1 ya tienen el botón principal arriba (atajo visible).
            No lo duplicamos aquí abajo. */}

        {/* 2T → tres opciones (prórroga / penaltis / finalizar) */}
        {esFinal2T && (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-zinc-300">{t("mcp_como_seguimos")}</h3>

            {/* Prórroga */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <label className="text-base font-semibold">{t("mcp_hay_prorroga")}</label>
                <input type="number" min={1} max={20} value={minProrroga}
                  onChange={(e) => setMinProrroga(Number(e.target.value) || 5)}
                  className="w-16 bg-zinc-950 rounded px-2 py-1 text-center text-base" />
                <span className="text-base">{t("mcp_min_cada_parte")}</span>
              </div>
              <button onClick={() => props.onConfigurarProrroga(minProrroga)}
                className="w-full py-4 bg-purple-700 hover:bg-purple-600 rounded-lg text-lg font-bold">
                {t("mcp_empezar_prorroga", { a: minProrroga, b: minProrroga })}
              </button>
            </div>

            {/* Tanda directa (sin prórroga) — solo si la competición la permite */}
            {cfg.permiteTanda && (
              <button onClick={props.onIrATanda}
                className="w-full py-4 bg-pink-700 hover:bg-pink-600 rounded-lg text-lg font-bold">
                {t("mcp_directo_tanda")}
              </button>
            )}

            {/* Finalizar */}
            <button onClick={props.onFinalizar}
              className="w-full py-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-lg font-bold">
              {t("mcp_finalizar_resumen")}
            </button>
          </div>
        )}

        {/* PR2 → tanda o finalizar */}
        {esFinalPR2 && (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-zinc-300">{t("mcp_como_seguimos")}</h3>
            {cfg.permiteTanda && (
              <button onClick={props.onIrATanda}
                className="w-full py-4 bg-pink-700 hover:bg-pink-600 rounded-lg text-lg font-bold">
                {t("mcp_tanda")}
              </button>
            )}
            <button onClick={props.onFinalizar}
              className="w-full py-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-lg font-bold">
              {t("mcp_finalizar_resumen")}
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
