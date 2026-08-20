"use client";

/**
 * i18n.ts — Motor de catálogos multi-idioma para el CRONO de PULSO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ ES
 * ═══════════════════════════════════════════════════════════════════════════
 * El texto que ve el cuerpo técnico (botones, modales, avisos, tablas) deja de
 * estar "pegado" al código JSX y pasa a vivir en un CATÁLOGO: un diccionario de
 * frases por idioma. El código referencia CLAVES estables (p.ej. "btn_gol"), no
 * la frase literal. Añadir un idioma nuevo = añadir su sub-diccionario; CERO
 * tocar la lógica de los componentes.
 *
 *   • Idioma por defecto = **español** ("es"). Si NEXT_PUBLIC_IDIOMA no está
 *     definido o vale "es", el comportamiento es EXACTAMENTE el de antes
 *     (mismas frases ES, palabra por palabra). El crono del Inter NO cambia.
 *   • El nombre del equipo NO se traduce: es el NOMBRE PROPIO del club y viene
 *     de la config por cliente (CLIENTE.marcaTitulo / nombreLargo / nombreCorto),
 *     inyectado como parámetro {marca}/{club}/{corto} en las claves de título.
 *     Para el Inter da "Inter FS" / "Inter JP Financial" / "INTER" (texto idéntico
 *     al de antes); la demo da "CD Pulso" / "PULSO". El rival viene de cfg.rival.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CÓMO SE USA
 * ═══════════════════════════════════════════════════════════════════════════
 *     import { t, useIdioma } from "@/lib/i18n";
 *
 *     // En el cuerpo de un COMPONENTE de página (una vez, arriba del todo)
 *     // para que el selector de la demo re-renderice al cambiar idioma:
 *     useIdioma();
 *
 *     // frase fija:
 *     <button>{t("btn_iniciar")}</button>
 *
 *     // frase con variables (placeholders {var} en el catálogo):
 *     <p>{t("aviso_porteros_dos", { n: 2, lista: "DIDAC, PACO" })}</p>
 *
 * Reglas de t():
 *   - Devuelve la frase del idioma activo.
 *   - FALLBACK en cascada: idioma activo → "es" → la propia clave (nunca peta).
 *   - Si se pasan params, sustituye {var} por su valor (string/number).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SELECTOR DE IDIOMA (según el cliente)
 * ═══════════════════════════════════════════════════════════════════════════
 *   - Idioma INICIAL = CLIENTE.idiomaFijo si está definido; si no, la env
 *     NEXT_PUBLIC_IDIOMA (default "es"). Ver idiomaInicial().
 *   - Si CLIENTE.idiomaFijo === null (demo) se renderiza <SelectorIdioma/> y el
 *     usuario cambia a EN/IT en caliente; setIdioma() avisa a los componentes
 *     suscritos vía useIdioma() y re-renderizan con el nuevo texto.
 *   - Si CLIENTE.idiomaFijo tiene valor (el Inter = "es") el selector NO aparece
 *     y el idioma queda fijo. Comportamiento idéntico al de antes de i18n.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CÓMO AÑADIR UN IDIOMA NUEVO  (lo hace Claude solo)
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. En cada entrada del CATALOGO de abajo, añade la clave bajo el nuevo código
 *    de idioma. Ejemplo para italiano ("it"):
 *        btn_gol: { es: "⚽ GOL", en: "⚽ GOAL", it: "⚽ GOL" },
 *    (No hace falta traducir TODAS de golpe: lo que falte cae a "es".)
 * 2. Añade el código a IDIOMAS_DISPONIBLES para que salga en el selector demo.
 * 3. Activa por defecto poniendo NEXT_PUBLIC_IDIOMA=<código> en el entorno.
 *
 * Los placeholders {var} deben quedar EXACTAMENTE igual en todas las
 * traducciones de una misma clave.
 */
import { useSyncExternalStore } from "react";
import { CLIENTE } from "@/lib/clientes";

export type Idioma = "es" | "en" | "it";

// Idioma base / clave. Todo recae aquí si falta una traducción.
export const IDIOMA_BASE: Idioma = "es";

// Idiomas que ofrece el selector de la demo. El español siempre primero.
export const IDIOMAS_DISPONIBLES: { codigo: Idioma; etiqueta: string; bandera: string }[] = [
  { codigo: "es", etiqueta: "Español", bandera: "🇪🇸" },
  { codigo: "en", etiqueta: "English", bandera: "🇬🇧" },
  { codigo: "it", etiqueta: "Italiano", bandera: "🇮🇹" },
];

function normaliza(val: string | undefined | null): Idioma {
  const v = (val || "").trim().toLowerCase();
  if (!v) return IDIOMA_BASE;
  if (v === "español" || v === "espanol" || v === "castellano" || v.startsWith("es")) return "es";
  if (v === "inglés" || v === "ingles" || v === "english" || v.startsWith("en")) return "en";
  if (v === "italiano" || v === "italian" || v.startsWith("it")) return "it";
  return IDIOMA_BASE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado del idioma activo + suscripción (para que el selector demo re-renderice
// los componentes en caliente). En el Inter (sin selector) nunca cambia.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Idioma con el que arranca la app. Si el cliente tiene idioma fijo
 * (CLIENTE.idiomaFijo; p.ej. el Inter en "es"), arranca en ese y sin selector.
 * Si es null (demo), cae al de la env NEXT_PUBLIC_IDIOMA (default "es") y el
 * usuario puede cambiarlo en caliente con <SelectorIdioma/>.
 */
function idiomaInicial(): Idioma {
  return CLIENTE.idiomaFijo ?? normaliza(process.env.NEXT_PUBLIC_IDIOMA);
}

let _idioma: Idioma = idiomaInicial();
const _subs = new Set<() => void>();

export function idiomaActivo(): Idioma {
  return _idioma;
}

export function setIdioma(idioma: Idioma): void {
  if (idioma === _idioma) return;
  _idioma = idioma;
  for (const fn of _subs) fn();
}

/**
 * Hook React: suscribe el componente a los cambios de idioma y devuelve el
 * idioma activo. Llámalo UNA vez en el cuerpo de cada componente de página;
 * así, cuando el selector de la demo cambie el idioma, el árbol re-renderiza
 * y todas las llamadas a t() devuelven el texto nuevo.
 *
 * Usa useSyncExternalStore con getServerSnapshot = idioma de la env para que
 * SSR y primer render cliente coincidan (sin mismatch de hidratación).
 */
export function useIdioma(): Idioma {
  return useSyncExternalStore(
    (cb) => {
      _subs.add(cb);
      return () => {
        _subs.delete(cb);
      };
    },
    () => _idioma,
    () => idiomaInicial(),
  );
}

/**
 * t(clave, params?) — traduce una clave del catálogo al idioma activo.
 * Cascada: idioma activo → IDIOMA_BASE (es) → la propia clave.
 * params sustituye {var} por su valor.
 */
export function t(clave: string, params?: Record<string, string | number>): string {
  const entrada = CATALOGO[clave];
  let frase: string;
  if (!entrada) {
    // Clave no catalogada: devolvemos la clave (visible en QA, nunca rompe).
    frase = clave;
  } else {
    frase = entrada[_idioma] ?? entrada[IDIOMA_BASE] ?? clave;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      frase = frase.split(`{${k}}`).join(String(v));
    }
  }
  return frase;
}

type Entrada = Partial<Record<Idioma, string>> & { es: string };

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE FRASES
// Estructura:  clave -> { es: "...", en: "...", [otros idiomas] }
// Los {placeholders} se rellenan con los params de t().
//
// Terminología futsal (EN): match, goal, foul, yellow/red card, sending-off,
// bench, line-up, penalty shootout, timer, period, shot, save, opponent.
// "rival" → "opponent". "parte" → "period/half". "tanda" → "shootout".
// ─────────────────────────────────────────────────────────────────────────────
export const CATALOGO: Record<string, Entrada> = {
  // ══════════════════ GENÉRICOS / COMUNES ══════════════════
  cargando: { es: "Cargando…", en: "Loading…", it: "Caricamento…" },
  inicio: { es: "🏠 Inicio", en: "🏠 Home", it: "🏠 Home" },
  atras: { es: "← Atrás", en: "← Back", it: "← Indietro" },
  guardar: { es: "GUARDAR", en: "SAVE", it: "SALVA" },
  reiniciar: { es: "Reiniciar", en: "Reset", it: "Reimposta" },
  sin_asignar: { es: "SIN ASIGNAR", en: "UNASSIGNED", it: "NON ASSEGNATO" },
  sin_asignar_min: { es: "Sin asignar", en: "Unassigned", it: "Non assegnato" },
  saltar_zona_guardar: { es: "Saltar zona y guardar", en: "Skip zone and save", it: "Salta zona e salva" },
  saltar_zona_campo: { es: "Saltar zona del campo", en: "Skip pitch zone", it: "Salta zona del campo" },
  saltar_zona_campo_corto: { es: "Saltar zona campo", en: "Skip pitch zone", it: "Salta zona campo" },
  saltar_zona_porteria: { es: "Saltar zona portería", en: "Skip goal zone", it: "Salta zona porta" },
  saltar_zona_porteria_guardar: { es: "Saltar zona portería y guardar", en: "Skip goal zone and save", it: "Salta zona porta e salva" },
  cuerpo_tecnico: { es: "🧠 Cuerpo técnico (CT)", en: "🧠 Coaching staff (CS)", it: "🧠 Staff tecnico (ST)" },

  // ══════════════════ HOME (page.tsx) ══════════════════
  home_titulo: { es: "⚽ Crono {marca}", en: "⚽ {marca} Timer", it: "⚽ Cronometro {marca}" },
  home_subtitulo: {
    es: "Cronómetro y registro en directo para el banquillo del {club}.",
    en: "Live match timer and event tracker for the {club} bench.",
    it: "Cronometro e registro in diretta per la panchina del {club}.",
  },
  home_partido_en_curso: { es: "⏳ Hay un partido en curso", en: "⏳ A match is in progress", it: "⏳ C'è una partita in corso" },
  home_continuar: { es: "⏯ Continuar", en: "⏯ Resume", it: "⏯ Riprendi" },
  home_nuevo: { es: "🏁 Nuevo partido", en: "🏁 New match", it: "🏁 Nuova partita" },
  home_guardados: { es: "📋 Partidos guardados", en: "📋 Saved matches", it: "📋 Partite salvate" },
  home_sin_partidos: { es: "Aún no hay partidos guardados. Crea uno con «Nuevo partido».", en: "No saved matches yet. Create one with “New match”.", it: "Ancora nessuna partita salvata. Creane una con «Nuova partita»." },
  home_ver_stats: { es: "📊 Estadísticas", en: "📊 Stats", it: "📊 Statistiche" },
  home_rehacer: { es: "🎥 Rehacer con vídeo", en: "🎥 Redo with video", it: "🎥 Rifai col video" },
  home_rehacer_confirm: { es: "Se creará un partido NUEVO desde cero, en modo vídeo, con la misma alineación y datos del encuentro, para rehacerlo viendo el vídeo. El del directo se conserva. ¿Continuar?", en: "A brand-new match will be created from scratch, in video mode, with the same lineup and match info, to redo it while watching the video. The live one is kept. Continue?", it: "Verrà creata una partita NUOVA da zero, in modalità video, con la stessa formazione e dati, per rifarla guardando il video. Quella in diretta si conserva. Continuare?" },
  home_borrar: { es: "Borrar partido", en: "Delete match", it: "Elimina partita" },
  home_borrar_confirm: { es: "¿Borrar este partido? No se puede deshacer.", en: "Delete this match? This can't be undone.", it: "Eliminare questa partita? Non è reversibile." },
  home_modo_directo: { es: "🔴 Directo", en: "🔴 Live", it: "🔴 Diretta" },
  home_modo_video: { es: "🎥 Vídeo", en: "🎥 Video", it: "🎥 Video" },
  home_estado_curso: { es: "En curso", en: "In progress", it: "In corso" },
  home_estado_fin: { es: "Finalizado", en: "Finished", it: "Finita" },
  home_offline: {
    es: "Funciona offline. Instala en el iPad como app: Compartir → Añadir a pantalla inicio.",
    en: "Works offline. Install on the iPad as an app: Share → Add to Home Screen.",
    it: "Funziona offline. Installa sull'iPad come app: Condividi → Aggiungi a Home.",
  },

  // ══════════════════ LOGIN (AuthGate.tsx) ══════════════════
  login_titulo: { es: "Crono {marca}", en: "{marca} Timer", it: "Cronometro {marca}" },
  login_subtitulo: {
    es: "Acceso restringido al cuerpo técnico. Introduce la contraseña.",
    en: "Restricted access for the coaching staff. Enter the password.",
    it: "Accesso riservato allo staff tecnico. Inserisci la password.",
  },
  login_placeholder: { es: "Contraseña", en: "Password", it: "Password" },
  login_incorrecta: { es: "Contraseña incorrecta.", en: "Incorrect password.", it: "Password errata." },
  login_error_validar: { es: "Error al validar: {detalle}", en: "Validation error: {detalle}", it: "Errore di convalida: {detalle}" },
  login_comprobando: { es: "Comprobando…", en: "Checking…", it: "Verifica in corso…" },
  login_entrar: { es: "Entrar", en: "Enter", it: "Entra" },
  login_olvidada: {
    es: "Si la has olvidado, pregunta a Arkaitz.",
    en: "If you forgot it, ask Arkaitz.",
    it: "Se l'hai dimenticata, chiedi ad Arkaitz.",
  },

  // ══════════════════ NUEVO PARTIDO (nuevo/page.tsx) ══════════════════
  nuevo_titulo: { es: "⚽ Nuevo partido", en: "⚽ New match", it: "⚽ Nuova partita" },
  nuevo_modo: { es: "¿Cómo vas a cronometrar este partido?", en: "How will you track this match?", it: "Come cronometrerai questa partita?" },
  nuevo_modo_directo: { es: "DIRECTO", en: "LIVE", it: "DIRETTA" },
  nuevo_modo_directo_sub: { es: "En el banquillo · rápido, sin zonas", en: "On the bench · fast, no zones", it: "In panchina · veloce, senza zone" },
  nuevo_modo_video: { es: "VÍDEO", en: "VIDEO", it: "VIDEO" },
  nuevo_modo_video_sub: { es: "Revisión con grabación · todo el detalle", en: "Reviewing footage · full detail", it: "Revisione col video · tutto il dettaglio" },
  nuevo_rival: { es: "Rival", en: "Opponent", it: "Avversario" },
  nuevo_rival_ph: { es: "Ej: VALDEPEÑAS", en: "e.g. VALDEPEÑAS", it: "Es: VALDEPEÑAS" },
  nuevo_id_partido: { es: "ID partido", en: "Match ID", it: "ID partita" },
  nuevo_fecha: { es: "Fecha", en: "Date", it: "Data" },
  nuevo_hora: { es: "Hora", en: "Time", it: "Ora" },
  nuevo_lugar: { es: "Lugar", en: "Venue", it: "Luogo" },
  nuevo_lugar_ph: { es: "Pabellón...", en: "Arena...", it: "Palazzetto..." },
  nuevo_competicion: { es: "Competición", en: "Competition", it: "Competizione" },
  nuevo_inter_local: { es: "{equipo} juega como LOCAL", en: "{equipo} plays at HOME", it: "{equipo} gioca in CASA" },
  nuevo_duracion_titulo: { es: "Duración por parte (min) — preset:", en: "Period length (min) — preset:", it: "Durata per tempo (min) — preset:" },
  nuevo_1a_parte: { es: "1ª parte", en: "1st period", it: "1º tempo" },
  nuevo_2a_parte: { es: "2ª parte", en: "2nd period", it: "2º tempo" },
  nuevo_prorroga1_no: { es: "Prórroga 1 (0 = no)", en: "Extra time 1 (0 = none)", it: "Supplementare 1 (0 = no)" },
  nuevo_prorroga2_no: { es: "Prórroga 2 (0 = no)", en: "Extra time 2 (0 = none)", it: "Supplementare 2 (0 = no)" },
  nuevo_permite_tanda: {
    es: "Permite tanda de penaltis si hay empate (eliminatoria)",
    en: "Allow penalty shootout if drawn (knockout)",
    it: "Consenti serie di rigori in caso di pareggio (eliminazione diretta)",
  },
  nuevo_direccion_pregunta: {
    es: "¿Hacia dónde ataca INTER en la 1ª parte? (vista del banquillo)",
    en: "Which way does INTER attack in the 1st period? (bench view)",
    it: "Verso dove attacca l'INTER nel 1º tempo? (vista dalla panchina)",
  },
  nuevo_izquierda: { es: "← Izquierda", en: "← Left", it: "← Sinistra" },
  nuevo_derecha: { es: "Derecha →", en: "Right →", it: "Destra →" },
  nuevo_direccion_nota: {
    es: "En 2ª parte cambian de campo automáticamente. El rival siempre ataca en sentido contrario a {equipo}.",
    en: "In the 2nd period they switch ends automatically. The opponent always attacks the opposite way to {equipo}.",
    it: "Nel 2º tempo cambiano campo automaticamente. L'avversario attacca sempre nel senso opposto a {equipo}.",
  },
  nuevo_convocados: { es: "Convocados (toca para conmutar)", en: "Squad (tap to toggle)", it: "Convocati (tocca per cambiare)" },
  nuevo_convocados_count: { es: "{n} convocados", en: "{n} called up", it: "{n} convocati" },
  nuevo_pista_inicial: { es: "Pista inicial", en: "Starting line-up", it: "Formazione iniziale" },
  nuevo_portero: { es: "🥅 Portero", en: "🥅 Goalkeeper", it: "🥅 Portiere" },
  nuevo_pista_n: { es: "⚽ Pista {n}", en: "⚽ Court {n}", it: "⚽ Campo {n}" },
  nuevo_elige: { es: "— elige —", en: "— choose —", it: "— scegli —" },
  nuevo_empezar: { es: "🏁 EMPEZAR PARTIDO", en: "🏁 START MATCH", it: "🏁 INIZIA PARTITA" },
  nuevo_iniciando: { es: "⏳ Iniciando…", en: "⏳ Starting…", it: "⏳ Avvio…" },
  // alerts de validación
  nuevo_alert_rival: { es: "Pon el nombre del rival", en: "Enter the opponent's name", it: "Inserisci il nome dell'avversario" },
  nuevo_alert_id: {
    es: "Pon el ID del partido (ej: J29.VALDEPEÑAS)",
    en: "Enter the match ID (e.g. J29.VALDEPEÑAS)",
    it: "Inserisci l'ID della partita (es: J29.VALDEPEÑAS)",
  },
  nuevo_alert_cinco: {
    es: "Selecciona los 5 jugadores en pista (portero + 4 campo)",
    en: "Select the 5 players on court (goalkeeper + 4 outfield)",
    it: "Seleziona i 5 giocatori in campo (portiere + 4 di movimento)",
  },
  nuevo_alert_distintos: {
    es: "Los 5 jugadores deben ser distintos",
    en: "The 5 players must be different",
    it: "I 5 giocatori devono essere diversi",
  },
  nuevo_alert_no_convocados: {
    es: "Estos jugadores en pista NO están convocados:\n  · {lista}\n\nMárcalos como convocados arriba o cambia el select por uno que sí esté.",
    en: "These players on court are NOT in the squad:\n  · {lista}\n\nAdd them to the squad above or pick one that is.",
    it: "Questi giocatori in campo NON sono convocati:\n  · {lista}\n\nSegnali come convocati sopra o cambia la selezione con uno che lo sia.",
  },
  nuevo_alert_no_inicio: {
    es: "No pude iniciar el partido. Mira la consola.",
    en: "Couldn't start the match. Check the console.",
    it: "Non sono riuscito ad avviare la partita. Controlla la console.",
  },

  // ══════════════════ PARTIDO — HEADER / CONTROLES ══════════════════
  part_cargando: { es: "Cargando…", en: "Loading…", it: "Caricamento…" },
  part_no_en_curso: { es: "No hay partido en curso.", en: "No match in progress.", it: "Nessuna partita in corso." },
  part_crear_nuevo: { es: "🏁 Crear partido nuevo", en: "🏁 Create new match", it: "🏁 Crea nuova partita" },
  part_fin_parte: { es: "⏱️ Fin de parte", en: "⏱️ End of period", it: "⏱️ Fine tempo" },
  part_iniciar: { es: "▶ INICIAR", en: "▶ START", it: "▶ AVVIA" },
  part_pausar: { es: "⏸ PAUSAR", en: "⏸ PAUSE", it: "⏸ PAUSA" },
  part_volver_parte_confirm: {
    es: "¿Volver a la parte anterior? (estás en {parte})",
    en: "Go back to the previous period? (you're in {parte})",
    it: "Tornare al tempo precedente? (sei nel {parte})",
  },
  part_volver_parte_title: {
    es: "Volver a la parte anterior (deshacer ⏭)",
    en: "Go back to the previous period (undo ⏭)",
    it: "Torna al tempo precedente (annulla ⏭)",
  },
  part_parte_btn: { es: "⏭ parte", en: "⏭ period", it: "⏭ tempo" },

  // ══════════════════ PARTIDO — BANNERS INFERIORIDAD / SUPERIORIDAD ══════════════════
  part_inferioridad: { es: "INFERIORIDAD · expulsado {jugador}", en: "DOWN A PLAYER · sent off {jugador}", it: "INFERIORITÀ NUMERICA · espulso {jugador}" },
  part_inferioridad_nota: {
    es: "Acaba a los 2 min o si el rival mete gol.",
    en: "Ends after 2 min or if the opponent scores.",
    it: "Termina dopo 2 min o se l'avversario segna.",
  },
  part_superioridad: { es: "SUPERIORIDAD · rival {jugador} fuera", en: "UP A PLAYER · opponent {jugador} off", it: "SUPERIORITÀ NUMERICA · avversario {jugador} fuori" },
  part_superioridad_nota: {
    es: "Acaba a los 2 min o si nosotros metemos gol.",
    en: "Ends after 2 min or if we score.",
    it: "Termina dopo 2 min o se segniamo noi.",
  },
  part_inf_terminada: {
    es: "Inferioridad terminada — mete a un jugador",
    en: "Back to even — put a player on",
    it: "Inferiorità terminata — inserisci un giocatore",
  },
  part_inf_huecos: { es: " ({n} huecos)", en: " ({n} slots)", it: " ({n} posti)" },
  part_inf_toca_entra: {
    es: "Toca a quien entra. Vuelves a 5 en pista.",
    en: "Tap who comes on. Back to 5 on court.",
    it: "Tocca chi entra. Torni a 5 in campo.",
  },
  part_inf_nadie: {
    es: "No queda nadie disponible en el banquillo.",
    en: "No one left available on the bench.",
    it: "Non resta nessuno disponibile in panchina.",
  },

  // ══════════════════ PARTIDO — AVISOS PORTEROS ══════════════════
  part_porteros_dos: {
    es: "Hay {n} porteros en pista ({lista}). Revísalo: solo uno puede estar.",
    en: "There are {n} goalkeepers on court ({lista}). Check it: only one is allowed.",
    it: "Ci sono {n} portieri in campo ({lista}). Controlla: solo uno è consentito.",
  },
  part_sin_portero: { es: "Sin portero en pista (portero-jugador).", en: "No goalkeeper on court (flying goalkeeper).", it: "Nessun portiere in campo (portiere di movimento)." },

  // ══════════════════ PARTIDO — AJUSTE RELOJ ══════════════════
  part_ajustar_reloj: { es: "Ajustar reloj:", en: "Adjust clock:", it: "Regola cronometro:" },
  part_modo: { es: "Modo:", en: "Mode:", it: "Modalità:" },
  part_modo_directo: { es: "DIRECTO", en: "LIVE", it: "DIRETTA" },
  part_modo_video: { es: "VÍDEO", en: "VIDEO", it: "VIDEO" },
  part_modo_directo_nota: { es: "rápido · sin zonas", en: "fast · no zones", it: "veloce · senza zone" },
  part_modo_video_nota: { es: "detalle completo · con zonas", en: "full detail · with zones", it: "dettaglio completo · con zone" },
  part_ajustar_nota: {
    es: "(ajusta también tiempo de jugadores en pista)",
    en: "(also adjusts on-court players' time)",
    it: "(regola anche il tempo dei giocatori in campo)",
  },

  // ══════════════════ PARTIDO — PISTA / BANQUILLO ══════════════════
  part_en_pista: { es: "EN PISTA (toca un jugador para apuntar acciones)", en: "ON COURT (tap a player to log actions)", it: "IN CAMPO (tocca un giocatore per registrare azioni)" },
  part_banquillo: {
    es: "BANQUILLO (toca un jugador para amarilla / falta / cambiar)",
    en: "BENCH (tap a player for yellow / foul / sub)",
    it: "PANCHINA (tocca un giocatore per giallo / fallo / cambio)",
  },
  part_expulsado: { es: "EXPULSADO", en: "SENT OFF", it: "ESPULSO" },
  part_expulsado_title: { es: "Expulsado", en: "Sent off", it: "Espulso" },
  part_amarilla_title: { es: "Amarilla", en: "Yellow card", it: "Giallo" },
  part_sin_dorsal: { es: "—", en: "—", it: "—" },
  part_parte_corto: { es: "parte {tiempo}", en: "period {tiempo}", it: "tempo {tiempo}" },

  // ══════════════════ PARTIDO — BOTONES ACCIÓN COLECTIVA ══════════════════
  btn_gol: { es: "⚽ GOL", en: "⚽ GOAL", it: "⚽ GOL" },
  btn_disp_rival: { es: "🎯 DISP. RIVAL", en: "🎯 OPP. SHOT", it: "🎯 TIRO AVV." },
  btn_incorporacion: { es: "🧤 INCORP.", en: "🧤 KEEPER UP", it: "🧤 PORT. ALTO" },
  res_incorporaciones: { es: "Incorporaciones del portero", en: "Keeper-up plays",
                          it: "Incorporazioni del portiere" },
  res_inc_con_disparo: { es: "· con disparo", en: "· with shot", it: "· con tiro" },
  res_inc_sin_disparo: { es: "· sin disparo", en: "· without shot", it: "· senza tiro" },
  inc_titulo: { es: "Incorporación del portero rival",
                en: "Opponent keeper joins the attack",
                it: "Incorporazione del portiere avversario" },
  inc_sub: { es: "¿Esa incorporación acabó en disparo?",
             en: "Did it end in a shot?",
             it: "È finita con un tiro?" },
  inc_con_disparo: { es: "🎯 Con disparo", en: "🎯 With shot", it: "🎯 Con tiro" },
  inc_sin_disparo: { es: "Sin disparo", en: "No shot", it: "Senza tiro" },
  aviso_incorporacion: { es: "Incorporación apuntada",
                          en: "Keeper-up recorded",
                          it: "Incorporazione registrata" },
  aviso_perdida_equipo: { es: "Pérdida de equipo apuntada",
                           en: "Team turnover recorded",
                           it: "Palla persa di squadra registrata" },
  aviso_recuperacion_equipo: { es: "Recuperación de equipo apuntada",
                                en: "Team recovery recorded",
                                it: "Recupero di squadra registrato" },
  btn_falta: { es: "⚠️ FALTA", en: "⚠️ FOUL", it: "⚠️ FALLO" },
  btn_amarilla: { es: "🟨 AMARILLA", en: "🟨 YELLOW", it: "🟨 GIALLO" },
  btn_roja: { es: "🟥 ROJA", en: "🟥 RED", it: "🟥 ROSSO" },
  btn_cambio: { es: "🔄 CAMBIO", en: "🔄 SUB", it: "🔄 CAMBIO" },
  btn_tm: { es: "🛑 T.M.", en: "🛑 T.O.", it: "🛑 T.O." },
  btn_pen10m: { es: "🎯 PEN/10M", en: "🎯 PEN/10M", it: "🎯 PEN/10M" },
  btn_recuperacion_equipo: { es: "🟢 REC. EQUIPO", en: "🟢 TEAM STEAL", it: "🟢 REC. SQUADRA" },
  btn_perdida_equipo: { es: "🔴 PÉRD. EQUIPO", en: "🔴 TEAM LOSS", it: "🔴 PERD. SQUADRA" },
  btn_deshacer: { es: "↶ Deshacer", en: "↶ Undo", it: "↶ Annulla" },
  btn_tiempos: { es: "📊 TIEMPOS", en: "📊 TIMES", it: "📊 TEMPI" },
  btn_tanda: { es: "🥇 TANDA", en: "🥇 SHOOTOUT", it: "🥇 RIGORI" },
  btn_resumen: { es: "🏁 RESUMEN", en: "🏁 SUMMARY", it: "🏁 RIEPILOGO" },

  // ══════════════════ PARTIDO — STATS COMPACTAS ══════════════════
  part_stats_parte: { es: "Stats {parte}", en: "Stats {parte}", it: "Stat {parte}" },
  part_faltas: { es: "Faltas", en: "Fouls", it: "Falli" },
  part_ama_rival: { es: "🟨 {rival}:", en: "🟨 {rival}:", it: "🟨 {rival}:" },
  part_roja_rival_exp: { es: "🟥 {rival} expulsado:", en: "🟥 {rival} sent off:", it: "🟥 {rival} espulso:" },
  part_inter_4falta: { es: "⚠️ {equipo}: 4ª falta. Ojo.", en: "⚠️ {equipo}: 4th foul. Careful.", it: "⚠️ {equipo}: 4º fallo. Attenzione." },
  part_inter_5falta: {
    es: "⚠️ {equipo}: 5ª falta. La siguiente es 10 m.",
    en: "⚠️ {equipo}: 5th foul. The next one is a 10 m.",
    it: "⚠️ {equipo}: 5º fallo. Il prossimo è un tiro libero dai 10 m.",
  },
  part_inter_6falta: {
    es: "⚠️ {equipo} {n}ª falta → 10 m a favor del rival",
    en: "⚠️ {equipo} {n}th foul → 10 m for the opponent",
    it: "⚠️ {equipo} {n}º fallo → 10 m a favore dell'avversario",
  },
  part_rival_4falta: { es: "⚠️ Rival: 4ª falta. Ojo.", en: "⚠️ Opponent: 4th foul. Careful.", it: "⚠️ Avversario: 4º fallo. Attenzione." },
  part_rival_5falta: {
    es: "⚠️ Rival: 5ª falta. La siguiente es 10 m.",
    en: "⚠️ Opponent: 5th foul. The next one is a 10 m.",
    it: "⚠️ Avversario: 5º fallo. Il prossimo è un tiro libero dai 10 m.",
  },
  part_rival_6falta: {
    es: "⚠️ Rival {n}ª falta → 10 m a favor del {equipo}",
    en: "⚠️ Opponent {n}th foul → 10 m for {equipo}",
    it: "⚠️ Avversario {n}º fallo → 10 m a favore di {equipo}",
  },

  // ══════════════════ MODAL CONFIRMACIONES (expulsión rival / falta CT) ══════════════════
  conf_2a_ama_rival_titulo: { es: "🟥 2ª amarilla del rival", en: "🟥 Opponent's 2nd yellow", it: "🟥 2º giallo dell'avversario" },
  conf_2a_ama_rival_texto: {
    es: "El dorsal {dorsal} del {rival} ya tenía una amarilla. ¿Se queda el rival con uno menos?",
    en: "Opponent number {dorsal} ({rival}) already had a yellow. Do they go down a player?",
    it: "Il numero {dorsal} del {rival} aveva già un giallo. L'avversario resta in inferiorità?",
  },
  conf_2a_ama_rival_nota: {
    es: "(Sí = expulsión + crono de 2 min de superioridad para nosotros.)",
    en: "(Yes = sending-off + 2-min power-play timer for us.)",
    it: "(Sì = espulsione + cronometro di 2 min di superiorità per noi.)",
  },
  conf_si_uno_menos: { es: "Sí, uno menos", en: "Yes, down a player", it: "Sì, uno in meno" },
  conf_no_siguen: { es: "No, siguen igual", en: "No, unchanged", it: "No, restano uguali" },
  conf_ama_ct_titulo: { es: "🟨 Amarilla al cuerpo técnico", en: "🟨 Yellow to the coaching staff", it: "🟨 Giallo allo staff tecnico" },
  conf_ama_ct_texto: {
    es: "Tarjeta al banquillo de {equipo}. ¿Conlleva falta de equipo (suma a las acumuladas de la parte)?",
    en: "Card to the {equipo} bench. Does it count as a team foul (adds to the period's accumulated fouls)?",
    it: "Cartellino alla panchina del {equipo}. Conta come fallo di squadra (si somma a quelli accumulati nel tempo)?",
  },
  conf_si_suma_falta: { es: "Sí, suma falta", en: "Yes, count foul", it: "Sì, conta come fallo" },
  conf_no: { es: "No", en: "No", it: "No" },

  // ══════════════════ MODAL ACCIÓN BANQUILLO ══════════════════
  mab_titulo: { es: "🪑 {jugador} (banquillo)", en: "🪑 {jugador} (bench)", it: "🪑 {jugador} (panchina)" },
  mab_amarilla: { es: "🟨 Amarilla", en: "🟨 Yellow", it: "🟨 Giallo" },
  mab_roja: { es: "🟥 Roja", en: "🟥 Red", it: "🟥 Rosso" },
  mab_falta: { es: "⚠️ Falta", en: "⚠️ Foul", it: "⚠️ Fallo" },
  mab_entra_por: { es: "🔄 …o entra por (sale de pista):", en: "🔄 …or comes on for (leaves court):", it: "🔄 …oppure entra al posto di (esce dal campo):" },

  // ══════════════════ MODAL CAMBIO ══════════════════
  mc_titulo: { es: "🔄 Cambio", en: "🔄 Substitution", it: "🔄 Cambio" },
  mc_sale: { es: "SALE de pista", en: "OFF the court", it: "ESCE dal campo" },
  mc_entra: { es: "ENTRA por {sale} (tap = aplicar)", en: "ON for {sale} (tap = apply)", it: "ENTRA al posto di {sale} (tocca = applica)" },
  mc_slot_vacio_title: {
    es: "Dejar slot vacío en pista (inferioridad numérica)",
    en: "Leave an empty slot on court (playing short)",
    it: "Lascia un posto vuoto in campo (inferiorità numerica)",
  },

  // ══════════════════ MODAL FALTA ══════════════════
  mf_titulo: { es: "⚠️ Falta", en: "⚠️ Foul", it: "⚠️ Fallo" },
  mf_que_equipo: { es: "¿Qué equipo la comete?", en: "Which team commits it?", it: "Quale squadra lo commette?" },
  mf_la_cometemos: { es: "La COMETEMOS nosotros", en: "WE commit it", it: "Lo commettiamo NOI" },
  mf_la_comete_rival: { es: "La COMETE {rival}", en: "{rival} commits it", it: "Lo commette il {rival}" },
  mf_jugador_comete: {
    es: "¿Qué jugador la comete? (o sin asignar / RIVAL-MANO)",
    en: "Which player commits it? (or unassigned / OPP-HANDBALL)",
    it: "Quale giocatore lo commette? (o non assegnato / AVV-MANO)",
  },
  mf_quien_recibe: { es: "¿Quién la recibe? (o sin asignar)", en: "Who is fouled? (or unassigned)", it: "Chi lo subisce? (o non assegnato)" },
  mf_rival_mano: { es: "RIVAL / MANO", en: "OPP / HANDBALL", it: "AVV / MANO" },
  mf_jugador_banquillo_title: { es: "Jugador en banquillo", en: "Player on bench", it: "Giocatore in panchina" },
  mf_zona_produce: {
    es: "Zona del campo donde se produce (tap = aplicar)",
    en: "Pitch zone where it happens (tap = apply)",
    it: "Zona del campo dove avviene (tocca = applica)",
  },

  // ══════════════════ MODAL AMARILLA ══════════════════
  mam_titulo: { es: "🟨 Tarjeta amarilla", en: "🟨 Yellow card", it: "🟨 Cartellino giallo" },
  mam_equipo: { es: "Equipo", en: "Team", it: "Squadra" },
  mam_jugador_saltar: { es: "Jugador (tap = aplicar) o saltar", en: "Player (tap = apply) or skip", it: "Giocatore (tocca = applica) o salta" },
  mam_dorsal_rival: { es: "Dorsal del rival que recibe la amarilla", en: "Opponent number who gets the yellow", it: "Numero dell'avversario che riceve il giallo" },

  // ══════════════════ MODAL ROJA ══════════════════
  mroja_titulo: { es: "🟥 Tarjeta roja (expulsión)", en: "🟥 Red card (sending-off)", it: "🟥 Cartellino rosso (espulsione)" },
  mroja_jugador_expulsado: { es: "Jugador expulsado (tap = aplicar)", en: "Player sent off (tap = apply)", it: "Giocatore espulso (tocca = applica)" },
  mroja_dorsal_rival: { es: "Dorsal del rival expulsado", en: "Opponent number sent off", it: "Numero dell'avversario espulso" },

  // ══════════════════ TECLADO DORSAL RIVAL ══════════════════
  tdr_dorsal_sel: { es: "Dorsal seleccionado:", en: "Selected number:", it: "Numero selezionato:" },

  // ══════════════════ MODAL TM (tiempo muerto) ══════════════════
  mtm_titulo: { es: "🛑 Tiempo muerto", en: "🛑 Time-out", it: "🛑 Time-out" },
  mtm_prorroga: { es: "En la prórroga no hay tiempos muertos.", en: "There are no time-outs in extra time.", it: "Nei supplementari non ci sono time-out." },
  mtm_usado: { es: " ✓ usado", en: " ✓ used", it: " ✓ usato" },
  mtm_nota: {
    es: "Cada equipo tiene 1 tiempo muerto por parte. El que ya lo gastó queda deshabilitado.",
    en: "Each team has 1 time-out per period. Whoever used it is disabled.",
    it: "Ogni squadra ha 1 time-out per tempo. Quella che l'ha già usato resta disabilitata.",
  },

  // ══════════════════ MODAL GOL ══════════════════
  mg_titulo: { es: "⚽ GOL", en: "⚽ GOAL", it: "⚽ GOL" },
  mg_goleador: { es: "Goleador (tap)", en: "Scorer (tap)", it: "Marcatore (tocca)" },
  mg_asistente: { es: "Asistente (tap o saltar)", en: "Assist (tap or skip)", it: "Assist (tocca o salta)" },
  mg_sin_asistente: { es: "sin asistente", en: "no assist", it: "senza assist" },
  mg_accion_gol: { es: "Acción del gol", en: "Goal action", it: "Azione del gol" },
  mg_zona_tira: { es: "Zona desde donde se REMATÓ", en: "Zone the goal was SHOT from", it: "Zona da cui si è TIRATO" },
  mg_zona_asistencia: { es: "Zona desde donde se dio la ASISTENCIA (el pase)", en: "Zone the ASSIST (pass) was given from", it: "Zona da cui è stato dato l'ASSIST (il passaggio)" },
  mg_porteria_entra_accion: {
    es: "Portería: ¿dónde entra el {accion}? (tap = guardar)",
    en: "Goal: where does the {accion} go in? (tap = save)",
    it: "Porta: dove entra il {accion}? (tocca = salva)",
  },
  mg_porteria_entra: { es: "Portería: ¿dónde entra? (tap = guardar)", en: "Goal: where does it go in? (tap = save)", it: "Porta: dove entra? (tocca = salva)" },
  mg_portero_rival_ph: {
    es: "Portero rival (opcional, p.ej. 'DIDAC')",
    en: "Opponent goalkeeper (optional, e.g. 'DIDAC')",
    it: "Portiere avversario (facoltativo, es. 'DIDAC')",
  },
  // Acciones de gol (ACCIONES_GOL). Identificadores cortos de jugada.
  acc_corner: { es: "Córner", en: "Corner", it: "Calcio d'angolo" },
  acc_banda: { es: "Banda", en: "Throw-in", it: "Rimessa laterale" },
  acc_falta: { es: "Falta", en: "Free kick", it: "Punizione" },
  acc_5x4: { es: "5x4", en: "5x4", it: "5x4" },
  acc_4x5: { es: "4x5", en: "4x5", it: "4x5" },
  acc_4x3: { es: "4x3", en: "4x3", it: "4x3" },
  acc_3x4: { es: "3x4", en: "3x4", it: "3x4" },
  acc_contraataque: { es: "Contraataque", en: "Counterattack", it: "Contropiede" },
  acc_robo_zona_alta: { es: "Robo zona alta", en: "High-press steal", it: "Recupero zona alta" },
  acc_2a_jugada: { es: "Segunda jugada", en: "Second phase", it: "Seconda giocata" },
  acc_salida_presion: { es: "Salida de presión", en: "Press break", it: "Uscita dalla pressione" },
  acc_1x1_banda: { es: "1x1 banda", en: "1v1 wing", it: "1v1 sulla fascia" },
  acc_ataque_posicional: { es: "Ataque posicional", en: "Positional attack", it: "Attacco posizionale" },
  acc_10m: { es: "10m", en: "10m", it: "10m" },
  acc_penalti: { es: "Penalti", en: "Penalty", it: "Rigore" },
  acc_otra: { es: "Otra", en: "Other", it: "Altro" },

  // ══════════════════ MODAL DISPARO RIVAL ══════════════════
  mdr_titulo: { es: "🎯 Disparo del {rival}", en: "🎯 {rival} shot", it: "🎯 Tiro del {rival}" },
  mdr_intro: {
    es: "Para apuntar un disparo del rival que NO fue gol. Si fue gol del rival, usa el botón ⚽ GOL.",
    en: "To log an opponent shot that was NOT a goal. If it was an opponent goal, use the ⚽ GOAL button.",
    it: "Per registrare un tiro dell'avversario che NON è stato gol. Se è stato gol dell'avversario, usa il pulsante ⚽ GOL.",
  },
  mdr_como_acabo: { es: "¿Cómo acabó el disparo?", en: "How did the shot end?", it: "Come è finito il tiro?" },
  mdr_puerta_nota: {
    es: "PUERTA = a puerta pero parado por nuestro portero.",
    en: "ON TARGET = on goal but saved by our goalkeeper.",
    it: "IN PORTA = verso la porta ma parato dal nostro portiere.",
  },
  mdr_zona_campo: { es: "Zona del campo (desde donde tira el rival)", en: "Pitch zone (where the opponent shoots from)", it: "Zona del campo (da cui tira l'avversario)" },
  mdr_zona_porteria_portero: { es: "Zona de portería (a dónde tiró) + portero nuestro", en: "Goal zone (where it went) + our goalkeeper", it: "Zona di porta (dove ha tirato) + nostro portiere" },
  mdr_portero_paro: { es: "Portero nuestro (el que paró)", en: "Our goalkeeper (the one who saved)", it: "Nostro portiere (quello che ha parato)" },
  mdr_guarda_auto_porteria: {
    es: "Se guardará automáticamente al marcar la zona de portería.",
    en: "It saves automatically once you mark the goal zone.",
    it: "Verrà salvato automaticamente quando segni la zona di porta.",
  },
  mdr_guarda_auto_campo: {
    es: "Se guardará automáticamente al marcar la zona del campo.",
    en: "It saves automatically once you mark the pitch zone.",
    it: "Verrà salvato automaticamente quando segni la zona del campo.",
  },

  // ══════════════════ MODAL PENALTI / 10M ══════════════════
  mp_titulo: { es: "🎯 Penalti / 10 metros", en: "🎯 Penalty / 10 metres", it: "🎯 Rigore / 10 metri" },
  mp_tipo: { es: "Tipo", en: "Type", it: "Tipo" },
  mp_penalti_6m: { es: "Penalti (6m)", en: "Penalty (6m)", it: "Rigore (6m)" },
  mp_10m: { es: "10 metros", en: "10 metres", it: "10 metri" },
  mp_favor_contra: { es: "¿A favor o en contra?", en: "For or against?", it: "A favore o contro?" },
  mp_a_favor: { es: "A FAVOR (lo tira {equipo})", en: "FOR ({equipo} takes it)", it: "A FAVORE (lo tira {equipo})" },
  mp_en_contra: { es: "EN CONTRA (lo tira {rival})", en: "AGAINST ({rival} takes it)", it: "CONTRO (lo tira il {rival})" },
  mp_tirador_nuestro: { es: "Tirador nuestro (tap)", en: "Our taker (tap)", it: "Nostro tiratore (tocca)" },
  mp_portero_rival_ph: { es: "Portero rival (opcional)", en: "Opponent goalkeeper (optional)", it: "Portiere avversario (facoltativo)" },
  mp_portero_nuestro: { es: "Portero nuestro (tap)", en: "Our goalkeeper (tap)", it: "Nostro portiere (tocca)" },
  mp_tirador_rival_ph: { es: "Tirador rival (texto, opcional)", en: "Opponent taker (text, optional)", it: "Tiratore avversario (testo, facoltativo)" },
  mp_resultado: { es: "Resultado", en: "Outcome", it: "Esito" },
  mp_zona_no_aplica: {
    es: "Zona portería (no aplica) — pulsa GUARDAR",
    en: "Goal zone (n/a) — tap SAVE",
    it: "Zona di porta (non applicabile) — premi SALVA",
  },
  mp_zona_guardar: { es: "Zona de portería (tap = guardar)", en: "Goal zone (tap = save)", it: "Zona di porta (tocca = salva)" },

  // ══════════════════ MODAL ACCIÓN INDIVIDUAL ══════════════════
  mai_titulo: { es: "📊 {jugador}", en: "📊 {jugador}", it: "📊 {jugador}" },
  mai_intro: {
    es: "Todas las acciones abren el mapa para situar la zona del campo.",
    en: "Every action opens the map to place the pitch zone.",
    it: "Tutte le azioni aprono la mappa per individuare la zona del campo.",
  },
  mai_intro_directo: {
    es: "Toca la acción y se guarda al momento (en directo no hay zonas).",
    en: "Tap the action and it is saved instantly (no zones in live mode).",
    it: "Tocca l'azione e si salva subito (in diretta niente zone).",
  },
  mai_disparo: { es: "🎯 DISPARO", en: "🎯 SHOT", it: "🎯 TIRO" },
  mai_cambio_rapido: {
    es: "🔄 Cambio rápido — toca al jugador de banquillo que entra:",
    en: "🔄 Quick sub — tap the bench player coming on:",
    it: "🔄 Cambio rapido — tocca il giocatore in panchina che entra:",
  },
  mai_no_banquillo: { es: "No hay jugadores en banquillo.", en: "No players on the bench.", it: "Nessun giocatore in panchina." },
  // Partido en dos trozos para conservar el <strong> alrededor del nombre.
  mai_sale_pre: { es: "Sale ", en: "", it: "Esce " },
  mai_sale_post: { es: ", entra el que pulses.", en: " goes off, whoever you tap comes on.", it: ", entra quello che tocchi." },
  mai_en_que_zona: { es: "¿En qué zona del campo? (tap = guardar)", en: "Which pitch zone? (tap = save)", it: "In quale zona del campo? (tocca = salva)" },
  mai_disparo_de: { es: "🎯 Disparo de {jugador}", en: "🎯 {jugador} shot", it: "🎯 Tiro di {jugador}" },
  mai_resultado_disparo: { es: "Resultado del disparo (tap)", en: "Shot outcome (tap)", it: "Esito del tiro (tocca)" },
  mai_zona_dispara: { es: "Zona del campo desde donde se dispara (tap)", en: "Pitch zone the shot is taken from (tap)", it: "Zona del campo da cui si tira (tocca)" },
  mai_zona_porteria_tap: { es: "Zona de portería (tap = guardar)", en: "Goal zone (tap = save)", it: "Zona di porta (tocca = salva)" },
  mai_disparo_flecha: { es: "🎯 {jugador} → {res}", en: "🎯 {jugador} → {res}", it: "🎯 {jugador} → {res}" },
  mai_disparo_puerta_desde: { es: "🎯 {jugador} → PUERTA desde {zona}", en: "🎯 {jugador} → ON TARGET from {zona}", it: "🎯 {jugador} → IN PORTA da {zona}" },
  // Etiquetas de acción individual (LBL_ACCION en partido)
  lblacc_pf: { es: "❌ Pérdida forzada", en: "❌ Forced turnover", it: "❌ Palla persa forzata" },
  lblacc_pnf: { es: "❌ Pérdida NO forzada", en: "❌ Unforced turnover", it: "❌ Palla persa NON forzata" },
  lblacc_robos: { es: "🔁 Robo", en: "🔁 Steal", it: "🔁 Recupero palla" },
  lblacc_cortes: { es: "✂️ Corte", en: "✂️ Interception", it: "✂️ Intercetto" },
  lblacc_bdg: { es: "🥇 Bal. dividido ganado", en: "🥇 Loose ball won", it: "🥇 Contrasto vinto" },
  lblacc_bdp: { es: "🥈 Bal. dividido perdido", en: "🥈 Loose ball lost", it: "🥈 Contrasto perso" },
  // ── Estadísticas de VÍDEO ──
  vid_menu_btn: { es: "📹 STATS DE VÍDEO", en: "📹 VIDEO STATS", it: "📹 STATISTICHE VIDEO" },
  vid_menu_intro: { es: "Estadísticas del análisis de vídeo. Se sitúan en el campo.", en: "Video-analysis stats. Placed on the pitch.", it: "Statistiche dell'analisi video. Si posizionano nel campo." },
  vid_duelC: { es: "Duelo cierre-pívot", en: "Last man vs pivot", it: "Duello ultimo-pivot" },
  vid_duelP: { es: "Duelo pívot-cierre", en: "Pivot vs last man", it: "Duello pivot-ultimo" },
  vid_unoAtq: { es: "1x1 ataque", en: "1v1 attack", it: "1v1 attacco" },
  vid_unoDef: { es: "1x1 defensa", en: "1v1 defense", it: "1v1 difesa" },
  vid_conexPivot: { es: "🎯 Conexión con pívot", en: "🎯 Pass to pivot", it: "🎯 Connessione col pivot" },
  vid_corteConex: { es: "✂️ Corte tras conexión", en: "✂️ Cut after pivot pass", it: "✂️ Taglio dopo connessione" },
  vid_ultCob: { es: "🛡️ Última cobertura", en: "🛡️ Last cover", it: "🛡️ Ultima copertura" },
  vid_portero: { es: "🥅 Portero", en: "🥅 Goalkeeper", it: "🥅 Portiere" },
  vid_saque: { es: "Saque", en: "Goal throw", it: "Rimessa" },
  vid_pase: { es: "Pase con el pie", en: "Pass with foot", it: "Passaggio col piede" },
  vid_cob: { es: "Cobertura", en: "Cover", it: "Copertura" },
  vid_achique: { es: "Achique", en: "Closing down", it: "Uscita" },
  vid_ganado: { es: "✅ Ganado", en: "✅ Won", it: "✅ Vinto" },
  vid_perdido: { es: "❌ Perdido", en: "❌ Lost", it: "❌ Perso" },
  vid_bueno: { es: "✅ Bueno", en: "✅ Good", it: "✅ Buono" },
  vid_malo: { es: "❌ Malo", en: "❌ Bad", it: "❌ Cattivo" },
  vid_cob_br: { es: "Buena + recupera", en: "Good + recover", it: "Buona + recupero" },
  vid_cob_bn: { es: "Buena, no recupera", en: "Good, no recover", it: "Buona, no recupero" },
  vid_cob_mr: { es: "Mala + recupera", en: "Bad + recover", it: "Cattiva + recupero" },
  vid_cob_mn: { es: "Mala, no recupera", en: "Bad, no recover", it: "Cattiva, no recupero" },
  vid_elige_resultado: { es: "¿Cómo acabó?", en: "How did it end?", it: "Com'è finita?" },
  vid_conex_receptor: { es: "¿Quién recibe (el pívot)?", en: "Who receives (the pivot)?", it: "Chi riceve (il pivot)?" },
  // Botones grandes del menú de acción individual
  mai_btn_robo: { es: "🔁 Robo", en: "🔁 Steal", it: "🔁 Recupero" },
  mai_btn_corte: { es: "✂️ Corte", en: "✂️ Interception", it: "✂️ Intercetto" },
  mai_btn_pf: { es: "❌ PF", en: "❌ FT", it: "❌ PF" },
  mai_btn_pf_sub: { es: "forzada", en: "forced", it: "forzata" },
  mai_btn_pnf: { es: "❌ PNF", en: "❌ UT", it: "❌ PNF" },
  mai_btn_pnf_sub: { es: "no forzada", en: "unforced", it: "non forzata" },
  mai_btn_bdg: { es: "🥇 BDG", en: "🥇 LBW", it: "🥇 CV" },
  mai_btn_bdg_sub: { es: "dividido ganado", en: "loose ball won", it: "contrasto vinto" },
  mai_btn_bdp: { es: "🥈 BDP", en: "🥈 LBL", it: "🥈 CP" },
  mai_btn_bdp_sub: { es: "dividido perdido", en: "loose ball lost", it: "contrasto perso" },

  // ══════════════════ MODAL TIEMPOS (en partido) ══════════════════
  mt_titulo: { es: "📊 Tiempo jugado por jugador", en: "📊 Minutes played per player", it: "📊 Minuti giocati per giocatore" },
  mt_jugador: { es: "Jugador", en: "Player", it: "Giocatore" },
  mt_total: { es: "Total", en: "Total", it: "Totale" },
  mt_en_pista: { es: "EN PISTA", en: "ON COURT", it: "IN CAMPO" },
  mt_total_minutos: { es: "Total minutos jugados", en: "Total minutes played", it: "Totale minuti giocati" },
  mt_nota: {
    es: "El valor de la parte actual incluye los segundos en vivo (se actualiza con el reloj). Los porteros marcados en amarillo.",
    en: "The current period's value includes live seconds (updates with the clock). Goalkeepers shown in yellow.",
    it: "Il valore del tempo attuale include i secondi in diretta (si aggiorna con il cronometro). I portieri sono evidenziati in giallo.",
  },

  // ══════════════════ MODAL TANDA ══════════════════
  mta_titulo: { es: "🥇 Tanda de penaltis · {inter} - {rival}", en: "🥇 Penalty shootout · {inter} - {rival}", it: "🥇 Serie di rigori · {inter} - {rival}" },
  mta_tiros_realizados: { es: "Tiros realizados ({n})", en: "Shots taken ({n})", it: "Tiri effettuati ({n})" },
  mta_ninguno: { es: "— ninguno aún —", en: "— none yet —", it: "— nessuno ancora —" },
  mta_deshacer: { es: "↶ Deshacer último tiro", en: "↶ Undo last shot", it: "↶ Annulla ultimo tiro" },
  mta_apuntar_tiro: { es: "Apuntar tiro #{n}", en: "Log shot #{n}", it: "Registra tiro #{n}" },
  mta_quien_lanza: { es: "¿Quién lanza?", en: "Who takes it?", it: "Chi tira?" },
  mta_tirador: { es: "Tirador (tap)", en: "Taker (tap)", it: "Tiratore (tocca)" },
  mta_portero_nuestro: { es: "Portero nuestro (tap)", en: "Our goalkeeper (tap)", it: "Nostro portiere (tocca)" },
  mta_tirador_rival_ph: { es: "Tirador rival (texto, opcional)", en: "Opponent taker (text, optional)", it: "Tiratore avversario (testo, facoltativo)" },
  mta_resultado: { es: "Resultado", en: "Outcome", it: "Esito" },
  mta_zona_fuera: { es: "Guardar (FUERA)", en: "Save (WIDE)", it: "Salva (FUORI)" },
  mta_zona_porteria: { es: "Zona portería (tap = guardar)", en: "Goal zone (tap = save)", it: "Zona di porta (tocca = salva)" },
  mta_cerrar: { es: "Cerrar tanda", en: "Close shootout", it: "Chiudi serie di rigori" },

  // ══════════════════ MODAL CAMBIO DE PARTE ══════════════════
  mcp_titulo_1t: { es: "🔵 Final de 1ª parte", en: "🔵 End of 1st period", it: "🔵 Fine del 1º tempo" },
  mcp_titulo_2t: { es: "🏁 Final del partido (2ª parte)", en: "🏁 End of match (2nd period)", it: "🏁 Fine della partita (2º tempo)" },
  mcp_titulo_pr1: { es: "🟣 Final de prórroga 1", en: "🟣 End of extra time 1", it: "🟣 Fine del supplementare 1" },
  mcp_titulo_pr2: { es: "🏁 Final de prórroga 2", en: "🏁 End of extra time 2", it: "🏁 Fine del supplementare 2" },
  mcp_empate: { es: "⚠️ Empate · hay que decidir cómo seguir", en: "⚠️ Draw · decide how to continue", it: "⚠️ Pareggio · bisogna decidere come proseguire" },
  mcp_empezar_2a: { es: "Empezar 2ª parte", en: "Start 2nd period", it: "Inizia 2º tempo" },
  mcp_empezar_pr2: { es: "Empezar prórroga 2", en: "Start extra time 2", it: "Inizia supplementare 2" },
  mcp_disparos: { es: "🎯 Disparos", en: "🎯 Shots", it: "🎯 Tiri" },
  mcp_total: { es: "total", en: "total", it: "totale" },
  mcp_puerta: { es: "Puerta", en: "On target", it: "In porta" },
  mcp_palo: { es: "Palo", en: "Post", it: "Palo" },
  mcp_fuera: { es: "Fuera", en: "Wide", it: "Fuori" },
  mcp_bloq: { es: "Bloq.", en: "Block.", it: "Murati" },
  mcp_perdidas: { es: "❌ Pérdidas", en: "❌ Turnovers", it: "❌ Palle perse" },
  mcp_forzada: { es: "Forzada", en: "Forced", it: "Forzata" },
  mcp_no_forzada: { es: "No forzada", en: "Unforced", it: "Non forzata" },
  mcp_total_lbl: { es: "Total", en: "Total", it: "Totale" },
  mcp_recuperaciones: { es: "✅ Recuperaciones", en: "✅ Recoveries", it: "✅ Recuperi" },
  mcp_robos: { es: "Robos", en: "Steals", it: "Recuperi palla" },
  mcp_cortes: { es: "Cortes", en: "Interceptions", it: "Intercetti" },
  mcp_divididos: { es: "⚖️ Balones divididos", en: "⚖️ Loose balls", it: "⚖️ Contrasti" },
  mcp_ganados: { es: "Ganados", en: "Won", it: "Vinti" },
  mcp_no_ganados: { es: "No ganados", en: "Lost", it: "Persi" },
  mcp_ratio: { es: "Ratio", en: "Ratio", it: "Rapporto" },
  mcp_tiempos_jugador: { es: "⏱ Tiempos por jugador ({parte})", en: "⏱ Times per player ({parte})", it: "⏱ Tempi per giocatore ({parte})" },
  mcp_total_partido: { es: "Total partido", en: "Match total", it: "Totale partita" },
  mcp_acciones_indiv: { es: "👤 Acciones individuales (jugadores con stats)", en: "👤 Individual actions (players with stats)", it: "👤 Azioni individuali (giocatori con statistiche)" },
  mcp_disp: { es: "Disp", en: "Shots", it: "Tiri" },
  mcp_perd: { es: "Pérd", en: "TO", it: "PP" },
  mcp_recup: { es: "Recup", en: "Rec", it: "Rec" },
  mcp_divid: { es: "Divid", en: "Loose", it: "Contr" },
  mcp_como_seguimos: { es: "¿Cómo seguimos?", en: "How do we continue?", it: "Come proseguiamo?" },
  mcp_hay_prorroga: { es: "🟣 Hay prórroga de", en: "🟣 Extra time of", it: "🟣 C'è un supplementare di" },
  mcp_min_cada_parte: { es: "min cada parte", en: "min each period", it: "min per tempo" },
  mcp_empezar_prorroga: { es: "▶ Empezar prórroga ({a}+{b} min)", en: "▶ Start extra time ({a}+{b} min)", it: "▶ Inizia supplementare ({a}+{b} min)" },
  mcp_directo_tanda: { es: "🥇 Pasar directo a tanda de penaltis", en: "🥇 Go straight to penalty shootout", it: "🥇 Vai direttamente alla serie di rigori" },
  mcp_finalizar_resumen: { es: "🏁 Finalizar partido y ver resumen", en: "🏁 Finish match and view summary", it: "🏁 Termina partita e vedi riepilogo" },
  mcp_tanda: { es: "🥇 Tanda de penaltis", en: "🥇 Penalty shootout", it: "🥇 Serie di rigori" },

  // ══════════════════ RESUMEN — CABECERA / TABS ══════════════════
  res_no_partido: { es: "No hay partido para resumir.", en: "No match to summarise.", it: "Nessuna partita da riepilogare." },
  res_volver_partido: { es: "← Volver al partido", en: "← Back to match", it: "← Torna alla partita" },
  res_titulo: { es: "🏁 Resumen del partido", en: "🏁 Match summary", it: "🏁 Riepilogo della partita" },
  res_inicio_flecha: { es: "Inicio →", en: "Home →", it: "Home →" },
  res_tanda_penaltis: { es: "🥇 Tanda penaltis:", en: "🥇 Penalty shootout:", it: "🥇 Serie di rigori:" },
  res_tiros: { es: "({n} tiros)", en: "({n} shots)", it: "({n} tiri)" },
  res_estado: { es: "Estado:", en: "Status:", it: "Stato:" },
  res_partes_jugadas: { es: "Partes jugadas:", en: "Periods played:", it: "Tempi giocati:" },
  res_tab_general: { es: "📊 General", en: "📊 Overview", it: "📊 Generale" },
  res_tab_tiempos: { es: "⏱ Tiempos", en: "⏱ Times", it: "⏱ Tempi" },
  res_tab_individual: { es: "👤 Individual", en: "👤 Individual", it: "👤 Individuale" },
  res_tab_cronograma: { es: "📅 Cronograma", en: "📅 Timeline", it: "📅 Cronologia" },
  res_tab_disparos: { es: "🎯 Disparos", en: "🎯 Shots", it: "🎯 Tiri" },
  res_tab_analisis: { es: "🧠 Análisis", en: "🧠 Analysis", it: "🧠 Analisi" },
  res_tab_editar: { es: "✏️ Editar", en: "✏️ Edit", it: "✏️ Modifica" },

  // ══════════════════ EDICIÓN POST-PARTIDO (EditorEventos.tsx) ══════════════════
  ed_titulo: { es: "✏️ Editar acciones", en: "✏️ Edit events", it: "✏️ Modifica azioni" },
  ed_nota: { es: "Al editar, el marcador y las estadísticas se recalculan solos.", en: "Editing recalculates the score and stats automatically.", it: "Le modifiche ricalcolano punteggio e statistiche." },
  ed_nota_min_cambio: { es: "⚠️ Editar sustituciones aún no recalcula los minutos por jugador (en camino).", en: "⚠️ Editing substitutions doesn't recompute player minutes yet (coming).", it: "⚠️ Modificare le sostituzioni non ricalcola ancora i minuti (in arrivo)." },
  ed_anadir: { es: "➕ Añadir acción", en: "➕ Add event", it: "➕ Aggiungi azione" },
  ed_sin_acciones: { es: "No hay acciones registradas.", en: "No events recorded.", it: "Nessuna azione registrata." },
  ed_editar_accion: { es: "Editar acción", en: "Edit event", it: "Modifica azione" },
  ed_nueva_accion: { es: "Nueva acción", en: "New event", it: "Nuova azione" },
  ed_tipo: { es: "Tipo de acción", en: "Event type", it: "Tipo di azione" },
  ed_minuto: { es: "Minuto (mm:ss)", en: "Minute (mm:ss)", it: "Minuto (mm:ss)" },
  ed_parte: { es: "Parte", en: "Period", it: "Tempo" },
  ed_equipo: { es: "Equipo", en: "Team", it: "Squadra" },
  ed_goleador: { es: "Goleador", en: "Scorer", it: "Marcatore" },
  ed_asistente: { es: "Asistente", en: "Assist", it: "Assist" },
  ed_tipo_gol: { es: "Tipo de gol", en: "Goal type", it: "Tipo di gol" },
  ed_jugador: { es: "Jugador", en: "Player", it: "Giocatore" },
  ed_resultado: { es: "Resultado", en: "Result", it: "Risultato" },
  ed_tirador: { es: "Tirador", en: "Taker", it: "Tiratore" },
  ed_portero: { es: "Portero", en: "Goalkeeper", it: "Portiere" },
  ed_sale: { es: "Sale", en: "Out", it: "Esce" },
  ed_entra: { es: "Entra", en: "In", it: "Entra" },
  ed_accion_tipo: { es: "Acción", en: "Action", it: "Azione" },
  ed_zona_campo: { es: "Zona del campo", en: "Pitch zone", it: "Zona del campo" },
  ed_zona_porteria: { es: "Zona portería", en: "Goal zone", it: "Zona porta" },
  ed_cambiar: { es: "Cambiar", en: "Change", it: "Cambia" },
  ed_borrar: { es: "🗑 Borrar", en: "🗑 Delete", it: "🗑 Elimina" },
  ed_borrar_confirm: { es: "¿Borrar esta acción? Se recalcula todo.", en: "Delete this event? Everything recalculates.", it: "Eliminare questa azione? Si ricalcola tutto." },
  ed_guardar: { es: "Guardar", en: "Save", it: "Salva" },
  ed_cancelar: { es: "Cancelar", en: "Cancel", it: "Annulla" },
  ed_confirmar_borrar: { es: "Sí, borrar", en: "Yes, delete", it: "Sì, elimina" },
  ed_sin_zona: { es: "(sin zona)", en: "(no zone)", it: "(senza zona)" },
  ed_t_gol: { es: "Gol", en: "Goal", it: "Gol" },
  ed_t_falta: { es: "Falta", en: "Foul", it: "Fallo" },
  ed_t_amarilla: { es: "Amarilla", en: "Yellow card", it: "Gialla" },
  ed_t_roja: { es: "Roja", en: "Red card", it: "Rossa" },
  ed_t_tiempo_muerto: { es: "Tiempo muerto", en: "Timeout", it: "Timeout" },
  ed_t_disparo: { es: "Disparo", en: "Shot", it: "Tiro" },
  ed_t_cambio: { es: "Cambio", en: "Substitution", it: "Sostituzione" },
  ed_t_accion_individual: { es: "Acción individual", en: "Individual action", it: "Azione individuale" },
  ed_t_penalti: { es: "Penalti", en: "Penalty", it: "Rigore" },
  ed_t_diezm: { es: "10 metros", en: "10 metres", it: "10 metri" },
  ed_min_titulo: { es: "⏱ Minutos por jugador", en: "⏱ Minutes per player", it: "⏱ Minuti per giocatore" },
  ed_min_recalcular: { es: "🔄 Recalcular (aprox.)", en: "🔄 Recompute (approx.)", it: "🔄 Ricalcola (appross.)" },
  ed_min_nota: { es: "Recálculo aproximado (ignora pausas). Ajusta a mano lo que haga falta.", en: "Approximate recompute (ignores pauses). Adjust by hand as needed.", it: "Ricalcolo approssimato (ignora le pause). Regola a mano se serve." },
  ed_min_total: { es: "Total", en: "Total", it: "Totale" },

  // ══════════════════ RESUMEN — GENERAL ══════════════════
  res_disparos: { es: "🎯 Disparos", en: "🎯 Shots", it: "🎯 Tiri" },
  res_puerta: { es: "Puerta", en: "On target", it: "In porta" },
  res_palo: { es: "Palo", en: "Post", it: "Palo" },
  res_fuera: { es: "Fuera", en: "Wide", it: "Fuori" },
  res_bloqueados: { es: "Bloqueados", en: "Blocked", it: "Murati" },
  res_total: { es: "Total", en: "Total", it: "Totale" },
  res_stats_inter: { es: "📊 Stats {corto}", en: "📊 {corto} stats", it: "📊 Statistiche {corto}" },
  res_perdidas: { es: "❌ Pérdidas", en: "❌ Turnovers", it: "❌ Palle perse" },
  res_forzada: { es: "Forzada", en: "Forced", it: "Forzata" },
  res_no_forzada: { es: "No forzada", en: "Unforced", it: "Non forzata" },
  res_recuperaciones: { es: "✅ Recuperaciones", en: "✅ Recoveries", it: "✅ Recuperi" },
  res_robos: { es: "Robos", en: "Steals", it: "Recuperi palla" },
  res_de_equipo: { es: "De equipo", en: "Team", it: "Di squadra" },
  res_cortes: { es: "Cortes", en: "Interceptions", it: "Intercetti" },
  res_divididos: { es: "⚖️ Balones divididos", en: "⚖️ Loose balls", it: "⚖️ Contrasti" },
  res_ganados: { es: "Ganados", en: "Won", it: "Vinti" },
  res_no_ganados: { es: "No ganados", en: "Lost", it: "Persi" },
  res_ratio: { es: "Ratio", en: "Ratio", it: "Rapporto" },
  res_goles_partido: { es: "⚽ Goles del partido", en: "⚽ Match goals", it: "⚽ Gol della partita" },
  res_sin_goles: { es: "Aún no hay goles registrados.", en: "No goals logged yet.", it: "Ancora nessun gol registrato." },
  res_orden_faltas: { es: "⚠️ Orden de faltas (quién comete cada una)", en: "⚠️ Foul order (who commits each)", it: "⚠️ Ordine dei falli (chi commette ciascuno)" },
  res_sin_faltas: { es: "Aún no hay faltas del equipo registradas.", en: "No team fouls logged yet.", it: "Ancora nessun fallo di squadra registrato." },
  res_stats_video: { es: "Estadísticas de vídeo", en: "Video stats", it: "Statistiche video" },
  res_video_leyenda: { es: "Duelos y 1x1 = ganados-perdidos · Conexión con pívot = dadas/recibidas · Saque y pase = buenos-malos", en: "Duels & 1v1 = won-lost · Pivot connection = given/received · Throw & pass = good-bad", it: "Duelli e 1v1 = vinti-persi · Connessione col pivot = dati/ricevuti · Rimessa e passaggio = buoni-cattivi" },
  res_video_conex: { es: "Conex. (da/rec)", en: "Conn. (giv/rec)", it: "Conn. (dati/ric)" },
  res_gol_rival: { es: "⚽ Gol del rival", en: "⚽ Opponent goal", it: "⚽ Gol dell'avversario" },
  res_asist: { es: "asist.", en: "assist", it: "assist" },
  res_desde: { es: "desde {zona}", en: "from {zona}", it: "da {zona}" },
  res_a_zona: { es: "a {zona}", en: "to {zona}", it: "a {zona}" },
  res_en_pista: { es: "En pista:", en: "On court:", it: "In campo:" },
  res_tanda_titulo: { es: "🥇 Tanda de penaltis", en: "🥇 Penalty shootout", it: "🥇 Serie di rigori" },

  // ══════════════════ RESUMEN — TIEMPOS ══════════════════
  res_tiempo_jugado: { es: "⏱ Tiempo jugado por jugador", en: "⏱ Minutes played per player", it: "⏱ Minuti giocati per giocatore" },
  res_tiempo_nota: {
    es: "Color de fila según minutos jugados (rojo = más, verde = menos). Porteros sin código de color.",
    en: "Row colour by minutes played (red = more, green = less). Goalkeepers have no colour code.",
    it: "Colore della riga in base ai minuti giocati (rosso = di più, verde = di meno). I portieri non hanno codice colore.",
  },
  res_jugador: { es: "Jugador", en: "Player", it: "Giocatore" },
  res_tiempos_total: { es: "Total", en: "Total", it: "Totale" },
  res_en_pista_badge: { es: "EN PISTA", en: "ON COURT", it: "IN CAMPO" },
  res_total_acumulado: { es: "Total acumulado", en: "Cumulative total", it: "Totale accumulato" },

  // ══════════════════ RESUMEN — INDIVIDUAL ══════════════════
  res_stats_indiv: { es: "👤 Stats individuales por jugador", en: "👤 Individual stats per player", it: "👤 Statistiche individuali per giocatore" },
  res_indiv_nota: {
    es: "Disparos (azul) · Pérdidas (rojo) · Recuperaciones (verde) · Balones divididos (morado) · Presencia en goles (dorado). Desliza horizontalmente si no entra todo en la pantalla.",
    en: "Shots (blue) · Turnovers (red) · Recoveries (green) · Loose balls (purple) · Goal presence (gold). Scroll horizontally if it doesn't all fit.",
    it: "Tiri (blu) · Palle perse (rosso) · Recuperi (verde) · Contrasti (viola) · Presenza nei gol (oro). Scorri orizzontalmente se non entra tutto nello schermo.",
  },
  res_col_jug: { es: "Jug.", en: "Plr.", it: "Gioc." },
  res_col_disparos: { es: "🎯 DISPAROS", en: "🎯 SHOTS", it: "🎯 TIRI" },
  res_col_perd: { es: "❌ PÉRD.", en: "❌ TURN.", it: "❌ P.P." },
  res_col_recup: { es: "✅ RECUP.", en: "✅ REC.", it: "✅ REC." },
  res_col_div: { es: "⚖️ DIV.", en: "⚖️ LOOSE", it: "⚖️ CONTR." },
  res_col_goles: { es: "⚽ GOLES", en: "⚽ GOALS", it: "⚽ GOL" },
  res_th_puer: { es: "Puer.", en: "Tgt.", it: "Porta" },
  res_th_palo: { es: "Palo", en: "Post", it: "Palo" },
  res_th_fuera: { es: "Fuera", en: "Wide", it: "Fuori" },
  res_th_bloq: { es: "Bloq.", en: "Blk.", it: "Mur." },
  res_th_robos: { es: "Robos", en: "Steals", it: "Recuperi" },
  res_th_cortes: { es: "Cortes", en: "Int.", it: "Interc." },
  res_title_puerta: { es: "Puerta", en: "On target", it: "In porta" },
  res_title_palo: { es: "Palo", en: "Post", it: "Palo" },
  res_title_fuera: { es: "Fuera", en: "Wide", it: "Fuori" },
  res_title_bloqueado: { es: "Bloqueado", en: "Blocked", it: "Murato" },
  res_title_total_disp: { es: "Total disparos", en: "Total shots", it: "Totale tiri" },
  res_title_forzada: { es: "Forzada", en: "Forced", it: "Forzata" },
  res_title_no_forzada: { es: "No forzada", en: "Unforced", it: "Non forzata" },
  res_title_ganados: { es: "Ganados", en: "Won", it: "Vinti" },
  res_title_perdidos: { es: "Perdidos", en: "Lost", it: "Persi" },
  res_title_goles_marcados: { es: "Goles marcados", en: "Goals scored", it: "Gol segnati" },
  res_title_asistencias: { es: "Asistencias", en: "Assists", it: "Assist" },
  res_title_gf: { es: "Goles a favor con él en pista", en: "Goals for while on court", it: "Gol fatti con lui in campo" },
  res_title_gc: { es: "Goles en contra con él en pista", en: "Goals against while on court", it: "Gol subiti con lui in campo" },
  res_indiv_leyenda: {
    es: "+GF / −GC: goles a favor y en contra mientras el jugador estaba EN PISTA (cuenta presencia en cada gol, no solo participación directa). Para porteros, GC = goles encajados estando él bajo palos.",
    en: "+GF / −GA: goals for and against while the player was ON COURT (counts presence at each goal, not just direct involvement). For goalkeepers, GA = goals conceded while in goal.",
    it: "+GF / −GS: gol fatti e subiti mentre il giocatore era IN CAMPO (conta la presenza a ogni gol, non solo il coinvolgimento diretto). Per i portieri, GS = gol subiti mentre era tra i pali.",
  },
  // abreviaturas de gol (cabecera tabla individual)
  res_abbr_g: { es: "G", en: "G", it: "G" },
  res_abbr_a: { es: "A", en: "A", it: "A" },
  res_abbr_gf: { es: "+GF", en: "+GF", it: "+GF" },
  res_abbr_gc: { es: "-GC", en: "-GA", it: "-GS" },

  // ══════════════════ RESUMEN — CRONOGRAMA ══════════════════
  res_crono_titulo: { es: "📅 Cronograma del partido", en: "📅 Match timeline", it: "📅 Cronologia della partita" },
  res_crono_sin_partes: { es: "Aún no hay partes jugadas para mostrar.", en: "No periods played to show yet.", it: "Ancora nessun tempo giocato da mostrare." },
  res_crono_todo: { es: "Todo", en: "All", it: "Tutto" },
  res_crono_eventos: { es: "EVENTOS", en: "EVENTS", it: "EVENTI" },
  res_crono_tramo_pista: { es: "Tramo EN PISTA", en: "ON COURT spell", it: "Periodo IN CAMPO" },
  res_crono_leyenda_iconos: {
    es: "· ⚽ goles · 🟨 tarjetas · F faltas · • disparos",
    en: "· ⚽ goals · 🟨 cards · F fouls · • shots",
    it: "· ⚽ gol · 🟨 cartellini · F falli · • tiri",
  },
  res_crono_nota: {
    es: "Pasa el dedo / cursor por encima de cada marca o tramo para ver el detalle. Los tramos verdes son minutos EN PISTA del jugador (amarillo si es portero).",
    en: "Hover your finger / cursor over each marker or spell for details. Green spells are the player's ON COURT minutes (yellow if goalkeeper).",
    it: "Passa il dito / cursore su ogni marca o periodo per vedere il dettaglio. I tratti verdi sono i minuti IN CAMPO del giocatore (gialli se portiere).",
  },
  // tooltips del cronograma (descripciones cortas)
  res_crono_tt_gol: { es: "GOL", en: "GOAL", it: "GOL" },
  res_crono_tt_falta: { es: "Falta", en: "Foul", it: "Fallo" },
  res_crono_tt_disparo: { es: "Disparo", en: "Shot", it: "Tiro" },

  // ══════════════════ RESUMEN — DISPAROS (pestaña) ══════════════════
  resd_disparos_lbl: { es: "disparos", en: "shots", it: "tiri" },
  resd_resumen_parte: { es: "📊 Resumen por parte y resultado", en: "📊 Summary by period and outcome", it: "📊 Riepilogo per tempo ed esito" },
  resd_parte: { es: "Parte", en: "Period", it: "Tempo" },
  resd_total: { es: "Total", en: "Total", it: "Totale" },
  resd_leyenda: {
    es: "Gol = a puerta y entró. Parada = a puerta pero la atajó el portero. Palo = al poste o travesaño. Bloqueado = lo cortó un defensor antes del marco. Fuera = ni a puerta ni bloqueado.",
    en: "Goal = on target and in. Save = on target but stopped by the goalkeeper. Post = hit the post or crossbar. Blocked = cut off by a defender before the goal. Wide = neither on target nor blocked.",
    it: "Gol = in porta ed è entrato. Parata = in porta ma parato dal portiere. Palo = sul palo o sulla traversa. Murato = bloccato da un difensore prima della porta. Fuori = né in porta né murato.",
  },
  resd_mapa_campo: { es: "📍 Mapa del campo — desde dónde tira", en: "📍 Pitch map — where shots are taken from", it: "📍 Mappa del campo — da dove si tira" },
  resd_mapa_campo_nota: {
    es: "Intensidad del verde = nº de disparos en esa zona. Cada zona muestra el total y desglose: Goles · Paradas · Palo · Bloqueados · Fuera. La dirección de ataque coincide con la configurada para la 1ª parte.",
    en: "Green intensity = number of shots in that zone. Each zone shows the total and breakdown: Goals · Saves · Post · Blocked · Wide. The attack direction matches the one set for the 1st period.",
    it: "Intensità del verde = nº di tiri in quella zona. Ogni zona mostra il totale e il dettaglio: Gol · Parate · Palo · Murati · Fuori. La direzione d'attacco coincide con quella impostata per il 1º tempo.",
  },
  resd_sin_zona_campo: {
    es: "{n} disparos sin zona del campo apuntada (no se eligió zona al registrarlos).",
    en: "{n} shots with no pitch zone logged (no zone was chosen when recording them).",
    it: "{n} tiri senza zona del campo registrata (non è stata scelta la zona al momento della registrazione).",
  },
  resd_mapa_porteria: { es: "🥅 Zona de portería a la que tira", en: "🥅 Goal zone shots are aimed at", it: "🥅 Zona di porta verso cui si tira" },
  resd_mapa_porteria_nota: {
    es: "P1–P3 arriba (escuadras y centro alto), P4–P6 media, P7–P9 ras de suelo. Color = nº de disparos dirigidos ahí.",
    en: "P1–P3 top (top corners and high centre), P4–P6 mid, P7–P9 along the ground. Colour = number of shots aimed there.",
    it: "P1–P3 in alto (incroci e centro alto), P4–P6 a mezza altezza, P7–P9 a terra. Colore = nº di tiri indirizzati lì.",
  },
  resd_sin_disparos_zona: { es: "Sin disparos a esta zona", en: "No shots to this zone", it: "Nessun tiro verso questa zona" },
  resd_sin_zona_porteria: {
    es: "{n} disparos sin zona de portería apuntada{extra}.",
    en: "{n} shots with no goal zone logged{extra}.",
    it: "{n} tiri senza zona di porta registrata{extra}.",
  },
  resd_sin_zona_porteria_rival: {
    es: " (normal en disparos del rival si no se registró el destino)",
    en: " (normal for opponent shots if the destination wasn't recorded)",
    it: " (normale nei tiri dell'avversario se non è stata registrata la destinazione)",
  },
  // Etiquetas de resultado de disparo (LABEL_RES)
  resd_res_gol: { es: "Gol", en: "Goal", it: "Gol" },
  resd_res_parada: { es: "Parada", en: "Save", it: "Parata" },
  resd_res_palo: { es: "Palo", en: "Post", it: "Palo" },
  resd_res_bloqueado: { es: "Bloqueado", en: "Blocked", it: "Murato" },
  resd_res_fuera: { es: "Fuera", en: "Wide", it: "Fuori" },

  // ══════════════════ RESUMEN — ANÁLISIS ══════════════════
  resa_quintetos: { es: "🟢 Quintetos iniciales", en: "🟢 Starting fives", it: "🟢 Quintetti iniziali" },
  resa_quintetos_nota: {
    es: "Con qué 5 jugadores empezamos cada parte (incluido el portero).",
    en: "Which 5 players we started each period with (goalkeeper included).",
    it: "Con quali 5 giocatori abbiamo iniziato ogni tempo (portiere incluso).",
  },
  resa_sin_datos: { es: "Sin datos", en: "No data", it: "Nessun dato" },
  resa_asistencias: { es: "🎯 Asistencias", en: "🎯 Assists", it: "🎯 Assist" },
  resa_sin_asistencias: { es: "Sin asistencias registradas todavía.", en: "No assists logged yet.", it: "Ancora nessun assist registrato." },
  resa_parejas: { es: "Parejas asistente → goleador", en: "Assist → scorer pairs", it: "Coppie assist → marcatore" },
  resa_eficiencia: { es: "🎯 Eficiencia ofensiva", en: "🎯 Attacking efficiency", it: "🎯 Efficienza offensiva" },
  resa_sin_disparos: { es: "Sin disparos registrados todavía.", en: "No shots logged yet.", it: "Ancora nessun tiro registrato." },
  resa_disparos: { es: "Disparos", en: "Shots", it: "Tiri" },
  resa_a_puerta: { es: "A puerta", en: "On target", it: "In porta" },
  resa_goles: { es: "Goles", en: "Goals", it: "Gol" },
  resa_pct_gol: { es: "% gol", en: "% goal", it: "% gol" },
  resa_pct_puerta: { es: "% puerta", en: "% on target", it: "% in porta" },
  resa_title_pct_gol: { es: "% goles / disparos", en: "% goals / shots", it: "% gol / tiri" },
  resa_title_pct_puerta: { es: "% disparos a puerta / total", en: "% on-target shots / total", it: "% tiri in porta / totale" },
  resa_cuartetos: { es: "⚔️ Cuartetos por +/-", en: "⚔️ Outfield fours by +/-", it: "⚔️ Quartetti per +/-" },
  resa_sin_cuartetos: {
    es: "Sin goles asociados a cuartetos todavía. Se calculan a partir del cuarteto en pista cuando cae cada gol.",
    en: "No goals tied to outfield fours yet. They're computed from the four on court when each goal is scored.",
    it: "Ancora nessun gol associato ai quartetti. Si calcolano dal quartetto in campo nel momento di ogni gol.",
  },
  resa_transiciones: { es: "⚡ Transiciones (ventana 20s)", en: "⚡ Transitions (20s window)", it: "⚡ Transizioni (finestra 20s)" },
  resa_transiciones_nota: {
    es: "% recuperaciones que acaban en gol nuestro (transición ofensiva efectiva) · % pérdidas que acaban en gol del rival (vulnerabilidad post-pérdida). Ambas miradas dentro de los siguientes 20 segundos.",
    en: "% of recoveries that end in a goal for us (effective attacking transition) · % of turnovers that end in an opponent goal (post-turnover vulnerability). Both measured within the next 20 seconds.",
    it: "% recuperi che finiscono in un nostro gol (transizione offensiva efficace) · % palle perse che finiscono in un gol dell'avversario (vulnerabilità dopo la perdita). Entrambe misurate nei 20 secondi successivi.",
  },
  resa_recup_gol: { es: "↗️ Recuperación → Gol", en: "↗️ Recovery → Goal", it: "↗️ Recupero → Gol" },
  resa_recup_de: { es: "{a} / {b} recuperaciones", en: "{a} / {b} recoveries", it: "{a} / {b} recuperi" },
  resa_perdida_gol: { es: "↘️ Pérdida → Gol rival", en: "↘️ Turnover → Opponent goal", it: "↘️ Palla persa → Gol avversario" },
  resa_perdidas_de: { es: "{a} / {b} pérdidas", en: "{a} / {b} turnovers", it: "{a} / {b} palle perse" },

  // ══════════════════ RESUMEN — FOOTER / EXPORT ══════════════════
  res_exportar_json: { es: "📤 Exportar JSON", en: "📤 Export JSON", it: "📤 Esporta JSON" },
  res_footer_json: {
    es: "El JSON contiene todo el partido (config + eventos + tiempos + acciones + tanda). Útil para archivar, hacer merge entre iPads o importar a Google Sheets después.",
    en: "The JSON holds the whole match (config + events + times + actions + shootout). Useful to archive, merge between iPads or import to Google Sheets later.",
    it: "Il JSON contiene l'intera partita (config + eventi + tempi + azioni + serie di rigori). Utile per archiviare, unire tra iPad o importare in Google Sheets in seguito.",
  },
  res_export_error: { es: "No he podido exportar el JSON: {detalle}", en: "Couldn't export the JSON: {detalle}", it: "Non sono riuscito a esportare il JSON: {detalle}" },

  // ══════════════════ NOMBRES DE PARTE (NOMBRE_PARTE) ══════════════════
  parte_1t: { es: "1ª parte", en: "1st period", it: "1º tempo" },
  parte_2t: { es: "2ª parte", en: "2nd period", it: "2º tempo" },
  parte_pr1: { es: "Prórroga 1", en: "Extra time 1", it: "Supplementare 1" },
  parte_pr2: { es: "Prórroga 2", en: "Extra time 2", it: "Supplementare 2" },

  // ══════════════════ CAMPO / PORTERÍA (componentes) ══════════════════
  campo_atacante: { es: "Atacante", en: "Attacker", it: "Attaccante" },
  campo_ataca_der: { es: "{nombre} ataca →", en: "{nombre} attacks →", it: "{nombre} attacca →" },
  campo_ataca_izq: { es: "← {nombre} ataca", en: "← {nombre} attacks", it: "← {nombre} attacca" },

  // ══════════════════ PRESETS DE COMPETICIÓN (etiqueta visible) ══════════════════
  // OJO: las CLAVES de competición (LIGA, COPA_REY…) son identificadores y NO
  // se traducen. Solo su etiqueta visible. db.ts mantiene el label español como
  // origen; aquí va la traducción que muestra nuevo/page.tsx.
  comp_LIGA: { es: "Liga (2×20')", en: "League (2×20')", it: "Campionato (2×20')" },
  comp_COPA_REY: { es: "Copa del Rey (2×20' + 2×5' + tanda)", en: "Copa del Rey (2×20' + 2×5' + shootout)", it: "Copa del Rey (2×20' + 2×5' + rigori)" },
  comp_COPA_ESPANA: { es: "Copa de España (2×20' + 2×5' + tanda)", en: "Copa de España (2×20' + 2×5' + shootout)", it: "Copa de España (2×20' + 2×5' + rigori)" },
  comp_COPA_MUNDO: { es: "Copa del Mundo (2×20' + 2×5' + tanda)", en: "World Cup (2×20' + 2×5' + shootout)", it: "Coppa del Mondo (2×20' + 2×5' + rigori)" },
  comp_COPA_MADRID: { es: "Copa de Madrid (2×20' + 2×5' + tanda)", en: "Copa de Madrid (2×20' + 2×5' + shootout)", it: "Copa de Madrid (2×20' + 2×5' + rigori)" },
  comp_AMISTOSO: { es: "Amistoso (2×20')", en: "Friendly (2×20')", it: "Amichevole (2×20')" },
  comp_PLAYOFF: { es: "Playoff (2×20' + 2×5' + tanda)", en: "Playoff (2×20' + 2×5' + shootout)", it: "Playoff (2×20' + 2×5' + rigori)" },
  comp_SUPERCOPA: { es: "Supercopa (2×20' + 2×5' + tanda)", en: "Supercup (2×20' + 2×5' + shootout)", it: "Supercoppa (2×20' + 2×5' + rigori)" },

  // ══════════════════ CÓDIGOS DE RESULTADO DE DISPARO (botones modales) ══════════════════
  // El VALOR almacenado es siempre el código ES (PUERTA/PALO/FUERA/BLOQUEADO,
  // GOL/PARADA/POSTE). Aquí solo la etiqueta visible del botón.
  disp_PUERTA: { es: "PUERTA", en: "ON TGT", it: "IN PORTA" },
  disp_PALO: { es: "PALO", en: "POST", it: "PALO" },
  disp_FUERA: { es: "FUERA", en: "WIDE", it: "FUORI" },
  disp_BLOQUEADO: { es: "BLOQUEADO", en: "BLOCK", it: "MURATO" },
  disp_GOL: { es: "GOL", en: "GOAL", it: "GOL" },
  disp_PARADA: { es: "PARADA", en: "SAVE", it: "PARATA" },
  disp_POSTE: { es: "POSTE", en: "POST", it: "PALO" },

  // ══════════════════ SELECTOR DE IDIOMA (demo) ══════════════════
  selector_idioma_label: { es: "Idioma", en: "Language", it: "Lingua" },
};

/** Etiqueta visible de un código de resultado de disparo (valor almacenado = ES). */
export function labelResultadoDisparo(codigo: string): string {
  const entrada = CATALOGO[`disp_${codigo}`];
  return entrada ? (entrada[_idioma] ?? codigo) : codigo;
}

// Mapa valor-canónico-ES de acción de gol → clave del catálogo. El VALOR de
// la acción almacenado en el evento es SIEMPRE el español (no se traduce);
// aquí solo se mapea para mostrar. Incluye alias "10 m" (con espacio) que usa
// el resumen para penaltis normalizados.
const CLAVE_ACCION_GOL: Record<string, string> = {
  "Córner": "acc_corner", "Banda": "acc_banda", "Falta": "acc_falta",
  "5x4": "acc_5x4", "4x5": "acc_4x5", "4x3": "acc_4x3", "3x4": "acc_3x4",
  "Contraataque": "acc_contraataque", "Robo zona alta": "acc_robo_zona_alta",
  "Salida de presión": "acc_salida_presion",
  "1x1 banda": "acc_1x1_banda", "Ataque posicional": "acc_ataque_posicional",
  "10m": "acc_10m", "10 m": "acc_10m", "Penalti": "acc_penalti",
  "2ª jugada": "acc_2a_jugada", "Otra": "acc_otra",
};

/** Etiqueta visible de una acción de gol (valor almacenado = ES canónico). */
export function labelAccionGol(accion: string): string {
  const clave = CLAVE_ACCION_GOL[accion];
  return clave ? (CATALOGO[clave]?.[_idioma] ?? accion) : accion;
}

/**
 * Etiqueta visible de un preset de competición en el idioma activo.
 * En español devuelve EXACTAMENTE el label de db.ts (mismo texto que antes).
 * Si no hay clave catalogada (p.ej. una competición futura), cae al label que
 * se le pase. Las CLAVES de competición no se tocan.
 */
export function labelCompeticion(codigo: string, labelES: string): string {
  const entrada = CATALOGO[`comp_${codigo}`];
  if (!entrada) return labelES;
  return entrada[_idioma] ?? labelES;
}
