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
 *   • "INTER" / "Inter" es el NOMBRE PROPIO del equipo (Movistar Inter FS), NO
 *     texto de interfaz: nunca se traduce. El nombre del rival viene de la
 *     config del partido (cfg.rival), tampoco se toca aquí.
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
 * SELECTOR DE IDIOMA (solo demo)
 * ═══════════════════════════════════════════════════════════════════════════
 *   - Idioma INICIAL = NEXT_PUBLIC_IDIOMA (default "es").
 *   - En la DEMO (NEXT_PUBLIC_DEMO=1) se renderiza <SelectorIdioma/> y el
 *     usuario puede cambiar a EN/IT en caliente; setIdioma() avisa a todos los
 *     componentes suscritos vía useIdioma() y re-renderizan con el nuevo texto.
 *   - En el build del Inter (sin NEXT_PUBLIC_DEMO) el selector NO aparece y el
 *     idioma queda fijo al de la variable de entorno (es). Comportamiento
 *     idéntico al de antes de i18n.
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

export type Idioma = "es" | "en" | "it";

// Idioma base / clave. Todo recae aquí si falta una traducción.
export const IDIOMA_BASE: Idioma = "es";

// Idiomas que ofrece el selector de la demo. El español siempre primero.
export const IDIOMAS_DISPONIBLES: { codigo: Idioma; etiqueta: string; bandera: string }[] = [
  { codigo: "es", etiqueta: "Español", bandera: "🇪🇸" },
  { codigo: "en", etiqueta: "English", bandera: "🇬🇧" },
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
let _idioma: Idioma = normaliza(process.env.NEXT_PUBLIC_IDIOMA);
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
    () => normaliza(process.env.NEXT_PUBLIC_IDIOMA),
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
  cargando: { es: "Cargando…", en: "Loading…" },
  inicio: { es: "🏠 Inicio", en: "🏠 Home" },
  atras: { es: "← Atrás", en: "← Back" },
  guardar: { es: "GUARDAR", en: "SAVE" },
  reiniciar: { es: "Reiniciar", en: "Reset" },
  sin_asignar: { es: "SIN ASIGNAR", en: "UNASSIGNED" },
  sin_asignar_min: { es: "Sin asignar", en: "Unassigned" },
  saltar_zona_guardar: { es: "Saltar zona y guardar", en: "Skip zone and save" },
  saltar_zona_campo: { es: "Saltar zona del campo", en: "Skip pitch zone" },
  saltar_zona_campo_corto: { es: "Saltar zona campo", en: "Skip pitch zone" },
  saltar_zona_porteria: { es: "Saltar zona portería", en: "Skip goal zone" },
  saltar_zona_porteria_guardar: { es: "Saltar zona portería y guardar", en: "Skip goal zone and save" },
  cuerpo_tecnico: { es: "🧠 Cuerpo técnico (CT)", en: "🧠 Coaching staff (CS)" },

  // ══════════════════ HOME (page.tsx) ══════════════════
  home_titulo: { es: "⚽ Crono Inter FS", en: "⚽ Inter FS Timer" },
  home_subtitulo: {
    es: "Cronómetro y registro en directo para el banquillo del Movistar Inter FS.",
    en: "Live match timer and event tracker for the Movistar Inter FS bench.",
  },
  home_partido_en_curso: { es: "⏳ Hay un partido en curso", en: "⏳ A match is in progress" },
  home_continuar: { es: "⏯ Continuar partido", en: "⏯ Resume match" },
  home_nuevo: { es: "🏁 Nuevo partido", en: "🏁 New match" },
  home_offline: {
    es: "Funciona offline. Instala en el iPad como app: Compartir → Añadir a pantalla inicio.",
    en: "Works offline. Install on the iPad as an app: Share → Add to Home Screen.",
  },

  // ══════════════════ LOGIN (AuthGate.tsx) ══════════════════
  login_titulo: { es: "Crono Inter FS", en: "Inter FS Timer" },
  login_subtitulo: {
    es: "Acceso restringido al cuerpo técnico. Introduce la contraseña.",
    en: "Restricted access for the coaching staff. Enter the password.",
  },
  login_placeholder: { es: "Contraseña", en: "Password" },
  login_incorrecta: { es: "Contraseña incorrecta.", en: "Incorrect password." },
  login_error_validar: { es: "Error al validar: {detalle}", en: "Validation error: {detalle}" },
  login_comprobando: { es: "Comprobando…", en: "Checking…" },
  login_entrar: { es: "Entrar", en: "Enter" },
  login_olvidada: {
    es: "Si la has olvidado, pregunta a Arkaitz.",
    en: "If you forgot it, ask Arkaitz.",
  },

  // ══════════════════ NUEVO PARTIDO (nuevo/page.tsx) ══════════════════
  nuevo_titulo: { es: "⚽ Nuevo partido", en: "⚽ New match" },
  nuevo_rival: { es: "Rival", en: "Opponent" },
  nuevo_rival_ph: { es: "Ej: VALDEPEÑAS", en: "e.g. VALDEPEÑAS" },
  nuevo_id_partido: { es: "ID partido", en: "Match ID" },
  nuevo_fecha: { es: "Fecha", en: "Date" },
  nuevo_hora: { es: "Hora", en: "Time" },
  nuevo_lugar: { es: "Lugar", en: "Venue" },
  nuevo_lugar_ph: { es: "Pabellón...", en: "Arena..." },
  nuevo_competicion: { es: "Competición", en: "Competition" },
  nuevo_inter_local: { es: "Inter juega como LOCAL", en: "Inter plays at HOME" },
  nuevo_duracion_titulo: { es: "Duración por parte (min) — preset:", en: "Period length (min) — preset:" },
  nuevo_1a_parte: { es: "1ª parte", en: "1st period" },
  nuevo_2a_parte: { es: "2ª parte", en: "2nd period" },
  nuevo_prorroga1_no: { es: "Prórroga 1 (0 = no)", en: "Extra time 1 (0 = none)" },
  nuevo_prorroga2_no: { es: "Prórroga 2 (0 = no)", en: "Extra time 2 (0 = none)" },
  nuevo_permite_tanda: {
    es: "Permite tanda de penaltis si hay empate (eliminatoria)",
    en: "Allow penalty shootout if drawn (knockout)",
  },
  nuevo_direccion_pregunta: {
    es: "¿Hacia dónde ataca INTER en la 1ª parte? (vista del banquillo)",
    en: "Which way does INTER attack in the 1st period? (bench view)",
  },
  nuevo_izquierda: { es: "← Izquierda", en: "← Left" },
  nuevo_derecha: { es: "Derecha →", en: "Right →" },
  nuevo_direccion_nota: {
    es: "En 2ª parte cambian de campo automáticamente. El rival siempre ataca en sentido contrario a Inter.",
    en: "In the 2nd period they switch ends automatically. The opponent always attacks the opposite way to Inter.",
  },
  nuevo_convocados: { es: "Convocados (toca para conmutar)", en: "Squad (tap to toggle)" },
  nuevo_convocados_count: { es: "{n} convocados", en: "{n} called up" },
  nuevo_pista_inicial: { es: "Pista inicial", en: "Starting line-up" },
  nuevo_portero: { es: "🥅 Portero", en: "🥅 Goalkeeper" },
  nuevo_pista_n: { es: "⚽ Pista {n}", en: "⚽ Court {n}" },
  nuevo_elige: { es: "— elige —", en: "— choose —" },
  nuevo_empezar: { es: "🏁 EMPEZAR PARTIDO", en: "🏁 START MATCH" },
  nuevo_iniciando: { es: "⏳ Iniciando…", en: "⏳ Starting…" },
  // alerts de validación
  nuevo_alert_rival: { es: "Pon el nombre del rival", en: "Enter the opponent's name" },
  nuevo_alert_id: {
    es: "Pon el ID del partido (ej: J29.VALDEPEÑAS)",
    en: "Enter the match ID (e.g. J29.VALDEPEÑAS)",
  },
  nuevo_alert_cinco: {
    es: "Selecciona los 5 jugadores en pista (portero + 4 campo)",
    en: "Select the 5 players on court (goalkeeper + 4 outfield)",
  },
  nuevo_alert_distintos: {
    es: "Los 5 jugadores deben ser distintos",
    en: "The 5 players must be different",
  },
  nuevo_alert_no_convocados: {
    es: "Estos jugadores en pista NO están convocados:\n  · {lista}\n\nMárcalos como convocados arriba o cambia el select por uno que sí esté.",
    en: "These players on court are NOT in the squad:\n  · {lista}\n\nAdd them to the squad above or pick one that is.",
  },
  nuevo_alert_no_inicio: {
    es: "No pude iniciar el partido. Mira la consola.",
    en: "Couldn't start the match. Check the console.",
  },

  // ══════════════════ PARTIDO — HEADER / CONTROLES ══════════════════
  part_cargando: { es: "Cargando…", en: "Loading…" },
  part_no_en_curso: { es: "No hay partido en curso.", en: "No match in progress." },
  part_crear_nuevo: { es: "🏁 Crear partido nuevo", en: "🏁 Create new match" },
  part_fin_parte: { es: "⏱️ Fin de parte", en: "⏱️ End of period" },
  part_iniciar: { es: "▶ INICIAR", en: "▶ START" },
  part_pausar: { es: "⏸ PAUSAR", en: "⏸ PAUSE" },
  part_volver_parte_confirm: {
    es: "¿Volver a la parte anterior? (estás en {parte})",
    en: "Go back to the previous period? (you're in {parte})",
  },
  part_volver_parte_title: {
    es: "Volver a la parte anterior (deshacer ⏭)",
    en: "Go back to the previous period (undo ⏭)",
  },
  part_parte_btn: { es: "⏭ parte", en: "⏭ period" },

  // ══════════════════ PARTIDO — BANNERS INFERIORIDAD / SUPERIORIDAD ══════════════════
  part_inferioridad: { es: "INFERIORIDAD · expulsado {jugador}", en: "DOWN A PLAYER · sent off {jugador}" },
  part_inferioridad_nota: {
    es: "Acaba a los 2 min o si el rival mete gol.",
    en: "Ends after 2 min or if the opponent scores.",
  },
  part_superioridad: { es: "SUPERIORIDAD · rival {jugador} fuera", en: "UP A PLAYER · opponent {jugador} off" },
  part_superioridad_nota: {
    es: "Acaba a los 2 min o si nosotros metemos gol.",
    en: "Ends after 2 min or if we score.",
  },
  part_inf_terminada: {
    es: "Inferioridad terminada — mete a un jugador",
    en: "Back to even — put a player on",
  },
  part_inf_huecos: { es: " ({n} huecos)", en: " ({n} slots)" },
  part_inf_toca_entra: {
    es: "Toca a quien entra. Vuelves a 5 en pista.",
    en: "Tap who comes on. Back to 5 on court.",
  },
  part_inf_nadie: {
    es: "No queda nadie disponible en el banquillo.",
    en: "No one left available on the bench.",
  },

  // ══════════════════ PARTIDO — AVISOS PORTEROS ══════════════════
  part_porteros_dos: {
    es: "Hay {n} porteros en pista ({lista}). Revísalo: solo uno puede estar.",
    en: "There are {n} goalkeepers on court ({lista}). Check it: only one is allowed.",
  },
  part_sin_portero: { es: "Sin portero en pista (portero-jugador).", en: "No goalkeeper on court (flying goalkeeper)." },

  // ══════════════════ PARTIDO — AJUSTE RELOJ ══════════════════
  part_ajustar_reloj: { es: "Ajustar reloj:", en: "Adjust clock:" },
  part_ajustar_nota: {
    es: "(ajusta también tiempo de jugadores en pista)",
    en: "(also adjusts on-court players' time)",
  },

  // ══════════════════ PARTIDO — PISTA / BANQUILLO ══════════════════
  part_en_pista: { es: "EN PISTA (toca un jugador para apuntar acciones)", en: "ON COURT (tap a player to log actions)" },
  part_banquillo: {
    es: "BANQUILLO (toca un jugador para amarilla / falta / cambiar)",
    en: "BENCH (tap a player for yellow / foul / sub)",
  },
  part_expulsado: { es: "EXPULSADO", en: "SENT OFF" },
  part_expulsado_title: { es: "Expulsado", en: "Sent off" },
  part_amarilla_title: { es: "Amarilla", en: "Yellow card" },
  part_sin_dorsal: { es: "—", en: "—" },
  part_parte_corto: { es: "parte {tiempo}", en: "period {tiempo}" },

  // ══════════════════ PARTIDO — BOTONES ACCIÓN COLECTIVA ══════════════════
  btn_gol: { es: "⚽ GOL", en: "⚽ GOAL" },
  btn_disp_rival: { es: "🎯 DISP. RIVAL", en: "🎯 OPP. SHOT" },
  btn_falta: { es: "⚠️ FALTA", en: "⚠️ FOUL" },
  btn_amarilla: { es: "🟨 AMARILLA", en: "🟨 YELLOW" },
  btn_roja: { es: "🟥 ROJA", en: "🟥 RED" },
  btn_cambio: { es: "🔄 CAMBIO", en: "🔄 SUB" },
  btn_tm: { es: "🛑 T.M.", en: "🛑 T.O." },
  btn_pen10m: { es: "🎯 PEN/10M", en: "🎯 PEN/10M" },
  btn_deshacer: { es: "↶ Deshacer", en: "↶ Undo" },
  btn_tiempos: { es: "📊 TIEMPOS", en: "📊 TIMES" },
  btn_tanda: { es: "🥇 TANDA", en: "🥇 SHOOTOUT" },
  btn_resumen: { es: "🏁 RESUMEN", en: "🏁 SUMMARY" },

  // ══════════════════ PARTIDO — STATS COMPACTAS ══════════════════
  part_stats_parte: { es: "Stats {parte}", en: "Stats {parte}" },
  part_faltas: { es: "Faltas", en: "Fouls" },
  part_ama_rival: { es: "🟨 {rival}:", en: "🟨 {rival}:" },
  part_roja_rival_exp: { es: "🟥 {rival} expulsado:", en: "🟥 {rival} sent off:" },
  part_inter_4falta: { es: "⚠️ Inter: 4ª falta. Ojo.", en: "⚠️ Inter: 4th foul. Careful." },
  part_inter_5falta: {
    es: "⚠️ Inter: 5ª falta. La siguiente es 10 m.",
    en: "⚠️ Inter: 5th foul. The next one is a 10 m.",
  },
  part_inter_6falta: {
    es: "⚠️ Inter {n}ª falta → 10 m a favor del rival",
    en: "⚠️ Inter {n}th foul → 10 m for the opponent",
  },
  part_rival_4falta: { es: "⚠️ Rival: 4ª falta. Ojo.", en: "⚠️ Opponent: 4th foul. Careful." },
  part_rival_5falta: {
    es: "⚠️ Rival: 5ª falta. La siguiente es 10 m.",
    en: "⚠️ Opponent: 5th foul. The next one is a 10 m.",
  },
  part_rival_6falta: {
    es: "⚠️ Rival {n}ª falta → 10 m a favor del Inter",
    en: "⚠️ Opponent {n}th foul → 10 m for Inter",
  },

  // ══════════════════ MODAL CONFIRMACIONES (expulsión rival / falta CT) ══════════════════
  conf_2a_ama_rival_titulo: { es: "🟥 2ª amarilla del rival", en: "🟥 Opponent's 2nd yellow" },
  conf_2a_ama_rival_texto: {
    es: "El dorsal {dorsal} del {rival} ya tenía una amarilla. ¿Se queda el rival con uno menos?",
    en: "Opponent number {dorsal} ({rival}) already had a yellow. Do they go down a player?",
  },
  conf_2a_ama_rival_nota: {
    es: "(Sí = expulsión + crono de 2 min de superioridad para nosotros.)",
    en: "(Yes = sending-off + 2-min power-play timer for us.)",
  },
  conf_si_uno_menos: { es: "Sí, uno menos", en: "Yes, down a player" },
  conf_no_siguen: { es: "No, siguen igual", en: "No, unchanged" },
  conf_ama_ct_titulo: { es: "🟨 Amarilla al cuerpo técnico", en: "🟨 Yellow to the coaching staff" },
  conf_ama_ct_texto: {
    es: "Tarjeta al banquillo de {equipo}. ¿Conlleva falta de equipo (suma a las acumuladas de la parte)?",
    en: "Card to the {equipo} bench. Does it count as a team foul (adds to the period's accumulated fouls)?",
  },
  conf_si_suma_falta: { es: "Sí, suma falta", en: "Yes, count foul" },
  conf_no: { es: "No", en: "No" },

  // ══════════════════ MODAL ACCIÓN BANQUILLO ══════════════════
  mab_titulo: { es: "🪑 {jugador} (banquillo)", en: "🪑 {jugador} (bench)" },
  mab_amarilla: { es: "🟨 Amarilla", en: "🟨 Yellow" },
  mab_roja: { es: "🟥 Roja", en: "🟥 Red" },
  mab_falta: { es: "⚠️ Falta", en: "⚠️ Foul" },
  mab_entra_por: { es: "🔄 …o entra por (sale de pista):", en: "🔄 …or comes on for (leaves court):" },

  // ══════════════════ MODAL CAMBIO ══════════════════
  mc_titulo: { es: "🔄 Cambio", en: "🔄 Substitution" },
  mc_sale: { es: "SALE de pista", en: "OFF the court" },
  mc_entra: { es: "ENTRA por {sale} (tap = aplicar)", en: "ON for {sale} (tap = apply)" },
  mc_slot_vacio_title: {
    es: "Dejar slot vacío en pista (inferioridad numérica)",
    en: "Leave an empty slot on court (playing short)",
  },

  // ══════════════════ MODAL FALTA ══════════════════
  mf_titulo: { es: "⚠️ Falta", en: "⚠️ Foul" },
  mf_que_equipo: { es: "¿Qué equipo la comete?", en: "Which team commits it?" },
  mf_la_cometemos: { es: "La COMETEMOS nosotros", en: "WE commit it" },
  mf_la_comete_rival: { es: "La COMETE {rival}", en: "{rival} commits it" },
  mf_jugador_comete: {
    es: "¿Qué jugador la comete? (o sin asignar / RIVAL-MANO)",
    en: "Which player commits it? (or unassigned / OPP-HANDBALL)",
  },
  mf_quien_recibe: { es: "¿Quién la recibe? (o sin asignar)", en: "Who is fouled? (or unassigned)" },
  mf_rival_mano: { es: "RIVAL / MANO", en: "OPP / HANDBALL" },
  mf_jugador_banquillo_title: { es: "Jugador en banquillo", en: "Player on bench" },
  mf_zona_produce: {
    es: "Zona del campo donde se produce (tap = aplicar)",
    en: "Pitch zone where it happens (tap = apply)",
  },

  // ══════════════════ MODAL AMARILLA ══════════════════
  mam_titulo: { es: "🟨 Tarjeta amarilla", en: "🟨 Yellow card" },
  mam_equipo: { es: "Equipo", en: "Team" },
  mam_jugador_saltar: { es: "Jugador (tap = aplicar) o saltar", en: "Player (tap = apply) or skip" },
  mam_dorsal_rival: { es: "Dorsal del rival que recibe la amarilla", en: "Opponent number who gets the yellow" },

  // ══════════════════ MODAL ROJA ══════════════════
  mroja_titulo: { es: "🟥 Tarjeta roja (expulsión)", en: "🟥 Red card (sending-off)" },
  mroja_jugador_expulsado: { es: "Jugador expulsado (tap = aplicar)", en: "Player sent off (tap = apply)" },
  mroja_dorsal_rival: { es: "Dorsal del rival expulsado", en: "Opponent number sent off" },

  // ══════════════════ TECLADO DORSAL RIVAL ══════════════════
  tdr_dorsal_sel: { es: "Dorsal seleccionado:", en: "Selected number:" },

  // ══════════════════ MODAL TM (tiempo muerto) ══════════════════
  mtm_titulo: { es: "🛑 Tiempo muerto", en: "🛑 Time-out" },
  mtm_prorroga: { es: "En la prórroga no hay tiempos muertos.", en: "There are no time-outs in extra time." },
  mtm_usado: { es: " ✓ usado", en: " ✓ used" },
  mtm_nota: {
    es: "Cada equipo tiene 1 tiempo muerto por parte. El que ya lo gastó queda deshabilitado.",
    en: "Each team has 1 time-out per period. Whoever used it is disabled.",
  },

  // ══════════════════ MODAL GOL ══════════════════
  mg_titulo: { es: "⚽ GOL", en: "⚽ GOAL" },
  mg_goleador: { es: "Goleador (tap)", en: "Scorer (tap)" },
  mg_asistente: { es: "Asistente (tap o saltar)", en: "Assist (tap or skip)" },
  mg_sin_asistente: { es: "sin asistente", en: "no assist" },
  mg_accion_gol: { es: "Acción del gol", en: "Goal action" },
  mg_zona_tira: { es: "Zona del campo desde donde se tira", en: "Pitch zone the shot is taken from" },
  mg_porteria_entra_accion: {
    es: "Portería: ¿dónde entra el {accion}? (tap = guardar)",
    en: "Goal: where does the {accion} go in? (tap = save)",
  },
  mg_porteria_entra: { es: "Portería: ¿dónde entra? (tap = guardar)", en: "Goal: where does it go in? (tap = save)" },
  mg_portero_rival_ph: {
    es: "Portero rival (opcional, p.ej. 'DIDAC')",
    en: "Opponent goalkeeper (optional, e.g. 'DIDAC')",
  },
  // Acciones de gol (ACCIONES_GOL). Identificadores cortos de jugada.
  acc_corner: { es: "Córner", en: "Corner" },
  acc_banda: { es: "Banda", en: "Throw-in" },
  acc_falta: { es: "Falta", en: "Free kick" },
  acc_5x4: { es: "5x4", en: "5x4" },
  acc_4x5: { es: "4x5", en: "4x5" },
  acc_4x3: { es: "4x3", en: "4x3" },
  acc_3x4: { es: "3x4", en: "3x4" },
  acc_contraataque: { es: "Contraataque", en: "Counterattack" },
  acc_robo_zona_alta: { es: "Robo zona alta", en: "High-press steal" },
  acc_1x1_banda: { es: "1x1 banda", en: "1v1 wing" },
  acc_ataque_posicional: { es: "Ataque posicional", en: "Positional attack" },
  acc_10m: { es: "10m", en: "10m" },
  acc_penalti: { es: "Penalti", en: "Penalty" },
  acc_otra: { es: "Otra", en: "Other" },

  // ══════════════════ MODAL DISPARO RIVAL ══════════════════
  mdr_titulo: { es: "🎯 Disparo del {rival}", en: "🎯 {rival} shot" },
  mdr_intro: {
    es: "Para apuntar un disparo del rival que NO fue gol. Si fue gol del rival, usa el botón ⚽ GOL.",
    en: "To log an opponent shot that was NOT a goal. If it was an opponent goal, use the ⚽ GOAL button.",
  },
  mdr_como_acabo: { es: "¿Cómo acabó el disparo?", en: "How did the shot end?" },
  mdr_puerta_nota: {
    es: "PUERTA = a puerta pero parado por nuestro portero.",
    en: "ON TARGET = on goal but saved by our goalkeeper.",
  },
  mdr_zona_campo: { es: "Zona del campo (desde donde tira el rival)", en: "Pitch zone (where the opponent shoots from)" },
  mdr_zona_porteria_portero: { es: "Zona de portería (a dónde tiró) + portero nuestro", en: "Goal zone (where it went) + our goalkeeper" },
  mdr_portero_paro: { es: "Portero nuestro (el que paró)", en: "Our goalkeeper (the one who saved)" },
  mdr_guarda_auto_porteria: {
    es: "Se guardará automáticamente al marcar la zona de portería.",
    en: "It saves automatically once you mark the goal zone.",
  },
  mdr_guarda_auto_campo: {
    es: "Se guardará automáticamente al marcar la zona del campo.",
    en: "It saves automatically once you mark the pitch zone.",
  },

  // ══════════════════ MODAL PENALTI / 10M ══════════════════
  mp_titulo: { es: "🎯 Penalti / 10 metros", en: "🎯 Penalty / 10 metres" },
  mp_tipo: { es: "Tipo", en: "Type" },
  mp_penalti_6m: { es: "Penalti (6m)", en: "Penalty (6m)" },
  mp_10m: { es: "10 metros", en: "10 metres" },
  mp_favor_contra: { es: "¿A favor o en contra?", en: "For or against?" },
  mp_a_favor: { es: "A FAVOR (lo tira Inter)", en: "FOR (Inter takes it)" },
  mp_en_contra: { es: "EN CONTRA (lo tira {rival})", en: "AGAINST ({rival} takes it)" },
  mp_tirador_nuestro: { es: "Tirador nuestro (tap)", en: "Our taker (tap)" },
  mp_portero_rival_ph: { es: "Portero rival (opcional)", en: "Opponent goalkeeper (optional)" },
  mp_portero_nuestro: { es: "Portero nuestro (tap)", en: "Our goalkeeper (tap)" },
  mp_tirador_rival_ph: { es: "Tirador rival (texto, opcional)", en: "Opponent taker (text, optional)" },
  mp_resultado: { es: "Resultado", en: "Outcome" },
  mp_zona_no_aplica: {
    es: "Zona portería (no aplica) — pulsa GUARDAR",
    en: "Goal zone (n/a) — tap SAVE",
  },
  mp_zona_guardar: { es: "Zona de portería (tap = guardar)", en: "Goal zone (tap = save)" },

  // ══════════════════ MODAL ACCIÓN INDIVIDUAL ══════════════════
  mai_titulo: { es: "📊 {jugador}", en: "📊 {jugador}" },
  mai_intro: {
    es: "Todas las acciones abren el mapa para situar la zona del campo.",
    en: "Every action opens the map to place the pitch zone.",
  },
  mai_disparo: { es: "🎯 DISPARO", en: "🎯 SHOT" },
  mai_cambio_rapido: {
    es: "🔄 Cambio rápido — toca al jugador de banquillo que entra:",
    en: "🔄 Quick sub — tap the bench player coming on:",
  },
  mai_no_banquillo: { es: "No hay jugadores en banquillo.", en: "No players on the bench." },
  // Partido en dos trozos para conservar el <strong> alrededor del nombre.
  mai_sale_pre: { es: "Sale ", en: "" },
  mai_sale_post: { es: ", entra el que pulses.", en: " goes off, whoever you tap comes on." },
  mai_en_que_zona: { es: "¿En qué zona del campo? (tap = guardar)", en: "Which pitch zone? (tap = save)" },
  mai_disparo_de: { es: "🎯 Disparo de {jugador}", en: "🎯 {jugador} shot" },
  mai_resultado_disparo: { es: "Resultado del disparo (tap)", en: "Shot outcome (tap)" },
  mai_zona_dispara: { es: "Zona del campo desde donde se dispara (tap)", en: "Pitch zone the shot is taken from (tap)" },
  mai_zona_porteria_tap: { es: "Zona de portería (tap = guardar)", en: "Goal zone (tap = save)" },
  mai_disparo_flecha: { es: "🎯 {jugador} → {res}", en: "🎯 {jugador} → {res}" },
  mai_disparo_puerta_desde: { es: "🎯 {jugador} → PUERTA desde {zona}", en: "🎯 {jugador} → ON TARGET from {zona}" },
  // Etiquetas de acción individual (LBL_ACCION en partido)
  lblacc_pf: { es: "❌ Pérdida forzada", en: "❌ Forced turnover" },
  lblacc_pnf: { es: "❌ Pérdida NO forzada", en: "❌ Unforced turnover" },
  lblacc_robos: { es: "🔁 Robo", en: "🔁 Steal" },
  lblacc_cortes: { es: "✂️ Corte", en: "✂️ Interception" },
  lblacc_bdg: { es: "🥇 Bal. dividido ganado", en: "🥇 Loose ball won" },
  lblacc_bdp: { es: "🥈 Bal. dividido perdido", en: "🥈 Loose ball lost" },
  // Botones grandes del menú de acción individual
  mai_btn_robo: { es: "🔁 Robo", en: "🔁 Steal" },
  mai_btn_corte: { es: "✂️ Corte", en: "✂️ Interception" },
  mai_btn_pf: { es: "❌ PF", en: "❌ FT" },
  mai_btn_pf_sub: { es: "forzada", en: "forced" },
  mai_btn_pnf: { es: "❌ PNF", en: "❌ UT" },
  mai_btn_pnf_sub: { es: "no forzada", en: "unforced" },
  mai_btn_bdg: { es: "🥇 BDG", en: "🥇 LBW" },
  mai_btn_bdg_sub: { es: "dividido ganado", en: "loose ball won" },
  mai_btn_bdp: { es: "🥈 BDP", en: "🥈 LBL" },
  mai_btn_bdp_sub: { es: "dividido perdido", en: "loose ball lost" },

  // ══════════════════ MODAL TIEMPOS (en partido) ══════════════════
  mt_titulo: { es: "📊 Tiempo jugado por jugador", en: "📊 Minutes played per player" },
  mt_jugador: { es: "Jugador", en: "Player" },
  mt_total: { es: "Total", en: "Total" },
  mt_en_pista: { es: "EN PISTA", en: "ON COURT" },
  mt_total_minutos: { es: "Total minutos jugados", en: "Total minutes played" },
  mt_nota: {
    es: "El valor de la parte actual incluye los segundos en vivo (se actualiza con el reloj). Los porteros marcados en amarillo.",
    en: "The current period's value includes live seconds (updates with the clock). Goalkeepers shown in yellow.",
  },

  // ══════════════════ MODAL TANDA ══════════════════
  mta_titulo: { es: "🥇 Tanda de penaltis · {inter} - {rival}", en: "🥇 Penalty shootout · {inter} - {rival}" },
  mta_tiros_realizados: { es: "Tiros realizados ({n})", en: "Shots taken ({n})" },
  mta_ninguno: { es: "— ninguno aún —", en: "— none yet —" },
  mta_deshacer: { es: "↶ Deshacer último tiro", en: "↶ Undo last shot" },
  mta_apuntar_tiro: { es: "Apuntar tiro #{n}", en: "Log shot #{n}" },
  mta_quien_lanza: { es: "¿Quién lanza?", en: "Who takes it?" },
  mta_tirador: { es: "Tirador (tap)", en: "Taker (tap)" },
  mta_portero_nuestro: { es: "Portero nuestro (tap)", en: "Our goalkeeper (tap)" },
  mta_tirador_rival_ph: { es: "Tirador rival (texto, opcional)", en: "Opponent taker (text, optional)" },
  mta_resultado: { es: "Resultado", en: "Outcome" },
  mta_zona_fuera: { es: "Guardar (FUERA)", en: "Save (WIDE)" },
  mta_zona_porteria: { es: "Zona portería (tap = guardar)", en: "Goal zone (tap = save)" },
  mta_cerrar: { es: "Cerrar tanda", en: "Close shootout" },

  // ══════════════════ MODAL CAMBIO DE PARTE ══════════════════
  mcp_titulo_1t: { es: "🔵 Final de 1ª parte", en: "🔵 End of 1st period" },
  mcp_titulo_2t: { es: "🏁 Final del partido (2ª parte)", en: "🏁 End of match (2nd period)" },
  mcp_titulo_pr1: { es: "🟣 Final de prórroga 1", en: "🟣 End of extra time 1" },
  mcp_titulo_pr2: { es: "🏁 Final de prórroga 2", en: "🏁 End of extra time 2" },
  mcp_empate: { es: "⚠️ Empate · hay que decidir cómo seguir", en: "⚠️ Draw · decide how to continue" },
  mcp_empezar_2a: { es: "Empezar 2ª parte", en: "Start 2nd period" },
  mcp_empezar_pr2: { es: "Empezar prórroga 2", en: "Start extra time 2" },
  mcp_disparos: { es: "🎯 Disparos", en: "🎯 Shots" },
  mcp_total: { es: "total", en: "total" },
  mcp_puerta: { es: "Puerta", en: "On target" },
  mcp_palo: { es: "Palo", en: "Post" },
  mcp_fuera: { es: "Fuera", en: "Wide" },
  mcp_bloq: { es: "Bloq.", en: "Block." },
  mcp_perdidas: { es: "❌ Pérdidas", en: "❌ Turnovers" },
  mcp_forzada: { es: "Forzada", en: "Forced" },
  mcp_no_forzada: { es: "No forzada", en: "Unforced" },
  mcp_total_lbl: { es: "Total", en: "Total" },
  mcp_recuperaciones: { es: "✅ Recuperaciones", en: "✅ Recoveries" },
  mcp_robos: { es: "Robos", en: "Steals" },
  mcp_cortes: { es: "Cortes", en: "Interceptions" },
  mcp_divididos: { es: "⚖️ Balones divididos", en: "⚖️ Loose balls" },
  mcp_ganados: { es: "Ganados", en: "Won" },
  mcp_no_ganados: { es: "No ganados", en: "Lost" },
  mcp_ratio: { es: "Ratio", en: "Ratio" },
  mcp_tiempos_jugador: { es: "⏱ Tiempos por jugador ({parte})", en: "⏱ Times per player ({parte})" },
  mcp_total_partido: { es: "Total partido", en: "Match total" },
  mcp_acciones_indiv: { es: "👤 Acciones individuales (jugadores con stats)", en: "👤 Individual actions (players with stats)" },
  mcp_disp: { es: "Disp", en: "Shots" },
  mcp_perd: { es: "Pérd", en: "TO" },
  mcp_recup: { es: "Recup", en: "Rec" },
  mcp_divid: { es: "Divid", en: "Loose" },
  mcp_como_seguimos: { es: "¿Cómo seguimos?", en: "How do we continue?" },
  mcp_hay_prorroga: { es: "🟣 Hay prórroga de", en: "🟣 Extra time of" },
  mcp_min_cada_parte: { es: "min cada parte", en: "min each period" },
  mcp_empezar_prorroga: { es: "▶ Empezar prórroga ({a}+{b} min)", en: "▶ Start extra time ({a}+{b} min)" },
  mcp_directo_tanda: { es: "🥇 Pasar directo a tanda de penaltis", en: "🥇 Go straight to penalty shootout" },
  mcp_finalizar_resumen: { es: "🏁 Finalizar partido y ver resumen", en: "🏁 Finish match and view summary" },
  mcp_tanda: { es: "🥇 Tanda de penaltis", en: "🥇 Penalty shootout" },

  // ══════════════════ RESUMEN — CABECERA / TABS ══════════════════
  res_no_partido: { es: "No hay partido para resumir.", en: "No match to summarise." },
  res_volver_partido: { es: "← Volver al partido", en: "← Back to match" },
  res_titulo: { es: "🏁 Resumen del partido", en: "🏁 Match summary" },
  res_inicio_flecha: { es: "Inicio →", en: "Home →" },
  res_tanda_penaltis: { es: "🥇 Tanda penaltis:", en: "🥇 Penalty shootout:" },
  res_tiros: { es: "({n} tiros)", en: "({n} shots)" },
  res_estado: { es: "Estado:", en: "Status:" },
  res_partes_jugadas: { es: "Partes jugadas:", en: "Periods played:" },
  res_tab_general: { es: "📊 General", en: "📊 Overview" },
  res_tab_tiempos: { es: "⏱ Tiempos", en: "⏱ Times" },
  res_tab_individual: { es: "👤 Individual", en: "👤 Individual" },
  res_tab_cronograma: { es: "📅 Cronograma", en: "📅 Timeline" },
  res_tab_disparos: { es: "🎯 Disparos", en: "🎯 Shots" },
  res_tab_analisis: { es: "🧠 Análisis", en: "🧠 Analysis" },

  // ══════════════════ RESUMEN — GENERAL ══════════════════
  res_disparos: { es: "🎯 Disparos", en: "🎯 Shots" },
  res_puerta: { es: "Puerta", en: "On target" },
  res_palo: { es: "Palo", en: "Post" },
  res_fuera: { es: "Fuera", en: "Wide" },
  res_bloqueados: { es: "Bloqueados", en: "Blocked" },
  res_total: { es: "Total", en: "Total" },
  res_stats_inter: { es: "📊 Stats INTER", en: "📊 INTER stats" },
  res_perdidas: { es: "❌ Pérdidas", en: "❌ Turnovers" },
  res_forzada: { es: "Forzada", en: "Forced" },
  res_no_forzada: { es: "No forzada", en: "Unforced" },
  res_recuperaciones: { es: "✅ Recuperaciones", en: "✅ Recoveries" },
  res_robos: { es: "Robos", en: "Steals" },
  res_cortes: { es: "Cortes", en: "Interceptions" },
  res_divididos: { es: "⚖️ Balones divididos", en: "⚖️ Loose balls" },
  res_ganados: { es: "Ganados", en: "Won" },
  res_no_ganados: { es: "No ganados", en: "Lost" },
  res_ratio: { es: "Ratio", en: "Ratio" },
  res_goles_partido: { es: "⚽ Goles del partido", en: "⚽ Match goals" },
  res_sin_goles: { es: "Aún no hay goles registrados.", en: "No goals logged yet." },
  res_gol_rival: { es: "⚽ Gol del rival", en: "⚽ Opponent goal" },
  res_asist: { es: "asist.", en: "assist" },
  res_desde: { es: "desde {zona}", en: "from {zona}" },
  res_a_zona: { es: "a {zona}", en: "to {zona}" },
  res_en_pista: { es: "En pista:", en: "On court:" },
  res_tanda_titulo: { es: "🥇 Tanda de penaltis", en: "🥇 Penalty shootout" },

  // ══════════════════ RESUMEN — TIEMPOS ══════════════════
  res_tiempo_jugado: { es: "⏱ Tiempo jugado por jugador", en: "⏱ Minutes played per player" },
  res_tiempo_nota: {
    es: "Color de fila según minutos jugados (rojo = más, verde = menos). Porteros sin código de color.",
    en: "Row colour by minutes played (red = more, green = less). Goalkeepers have no colour code.",
  },
  res_jugador: { es: "Jugador", en: "Player" },
  res_tiempos_total: { es: "Total", en: "Total" },
  res_en_pista_badge: { es: "EN PISTA", en: "ON COURT" },
  res_total_acumulado: { es: "Total acumulado", en: "Cumulative total" },

  // ══════════════════ RESUMEN — INDIVIDUAL ══════════════════
  res_stats_indiv: { es: "👤 Stats individuales por jugador", en: "👤 Individual stats per player" },
  res_indiv_nota: {
    es: "Disparos (azul) · Pérdidas (rojo) · Recuperaciones (verde) · Balones divididos (morado) · Presencia en goles (dorado). Desliza horizontalmente si no entra todo en la pantalla.",
    en: "Shots (blue) · Turnovers (red) · Recoveries (green) · Loose balls (purple) · Goal presence (gold). Scroll horizontally if it doesn't all fit.",
  },
  res_col_jug: { es: "Jug.", en: "Plr." },
  res_col_disparos: { es: "🎯 DISPAROS", en: "🎯 SHOTS" },
  res_col_perd: { es: "❌ PÉRD.", en: "❌ TURN." },
  res_col_recup: { es: "✅ RECUP.", en: "✅ REC." },
  res_col_div: { es: "⚖️ DIV.", en: "⚖️ LOOSE" },
  res_col_goles: { es: "⚽ GOLES", en: "⚽ GOALS" },
  res_th_puer: { es: "Puer.", en: "Tgt." },
  res_th_palo: { es: "Palo", en: "Post" },
  res_th_fuera: { es: "Fuera", en: "Wide" },
  res_th_bloq: { es: "Bloq.", en: "Blk." },
  res_th_robos: { es: "Robos", en: "Steals" },
  res_th_cortes: { es: "Cortes", en: "Int." },
  res_title_puerta: { es: "Puerta", en: "On target" },
  res_title_palo: { es: "Palo", en: "Post" },
  res_title_fuera: { es: "Fuera", en: "Wide" },
  res_title_bloqueado: { es: "Bloqueado", en: "Blocked" },
  res_title_total_disp: { es: "Total disparos", en: "Total shots" },
  res_title_forzada: { es: "Forzada", en: "Forced" },
  res_title_no_forzada: { es: "No forzada", en: "Unforced" },
  res_title_ganados: { es: "Ganados", en: "Won" },
  res_title_perdidos: { es: "Perdidos", en: "Lost" },
  res_title_goles_marcados: { es: "Goles marcados", en: "Goals scored" },
  res_title_asistencias: { es: "Asistencias", en: "Assists" },
  res_title_gf: { es: "Goles a favor con él en pista", en: "Goals for while on court" },
  res_title_gc: { es: "Goles en contra con él en pista", en: "Goals against while on court" },
  res_indiv_leyenda: {
    es: "+GF / −GC: goles a favor y en contra mientras el jugador estaba EN PISTA (cuenta presencia en cada gol, no solo participación directa). Para porteros, GC = goles encajados estando él bajo palos.",
    en: "+GF / −GA: goals for and against while the player was ON COURT (counts presence at each goal, not just direct involvement). For goalkeepers, GA = goals conceded while in goal.",
  },
  // abreviaturas de gol (cabecera tabla individual)
  res_abbr_g: { es: "G", en: "G" },
  res_abbr_a: { es: "A", en: "A" },
  res_abbr_gf: { es: "+GF", en: "+GF" },
  res_abbr_gc: { es: "-GC", en: "-GA" },

  // ══════════════════ RESUMEN — CRONOGRAMA ══════════════════
  res_crono_titulo: { es: "📅 Cronograma del partido", en: "📅 Match timeline" },
  res_crono_sin_partes: { es: "Aún no hay partes jugadas para mostrar.", en: "No periods played to show yet." },
  res_crono_todo: { es: "Todo", en: "All" },
  res_crono_eventos: { es: "EVENTOS", en: "EVENTS" },
  res_crono_tramo_pista: { es: "Tramo EN PISTA", en: "ON COURT spell" },
  res_crono_leyenda_iconos: {
    es: "· ⚽ goles · 🟨 tarjetas · F faltas · • disparos",
    en: "· ⚽ goals · 🟨 cards · F fouls · • shots",
  },
  res_crono_nota: {
    es: "Pasa el dedo / cursor por encima de cada marca o tramo para ver el detalle. Los tramos verdes son minutos EN PISTA del jugador (amarillo si es portero).",
    en: "Hover your finger / cursor over each marker or spell for details. Green spells are the player's ON COURT minutes (yellow if goalkeeper).",
  },
  // tooltips del cronograma (descripciones cortas)
  res_crono_tt_gol: { es: "GOL", en: "GOAL" },
  res_crono_tt_falta: { es: "Falta", en: "Foul" },
  res_crono_tt_disparo: { es: "Disparo", en: "Shot" },

  // ══════════════════ RESUMEN — DISPAROS (pestaña) ══════════════════
  resd_disparos_lbl: { es: "disparos", en: "shots" },
  resd_resumen_parte: { es: "📊 Resumen por parte y resultado", en: "📊 Summary by period and outcome" },
  resd_parte: { es: "Parte", en: "Period" },
  resd_total: { es: "Total", en: "Total" },
  resd_leyenda: {
    es: "Gol = a puerta y entró. Parada = a puerta pero la atajó el portero. Palo = al poste o travesaño. Bloqueado = lo cortó un defensor antes del marco. Fuera = ni a puerta ni bloqueado.",
    en: "Goal = on target and in. Save = on target but stopped by the goalkeeper. Post = hit the post or crossbar. Blocked = cut off by a defender before the goal. Wide = neither on target nor blocked.",
  },
  resd_mapa_campo: { es: "📍 Mapa del campo — desde dónde tira", en: "📍 Pitch map — where shots are taken from" },
  resd_mapa_campo_nota: {
    es: "Intensidad del verde = nº de disparos en esa zona. Cada zona muestra el total y desglose: Goles · Paradas · Palo · Bloqueados · Fuera. La dirección de ataque coincide con la configurada para la 1ª parte.",
    en: "Green intensity = number of shots in that zone. Each zone shows the total and breakdown: Goals · Saves · Post · Blocked · Wide. The attack direction matches the one set for the 1st period.",
  },
  resd_sin_zona_campo: {
    es: "{n} disparos sin zona del campo apuntada (no se eligió zona al registrarlos).",
    en: "{n} shots with no pitch zone logged (no zone was chosen when recording them).",
  },
  resd_mapa_porteria: { es: "🥅 Zona de portería a la que tira", en: "🥅 Goal zone shots are aimed at" },
  resd_mapa_porteria_nota: {
    es: "P1–P3 arriba (escuadras y centro alto), P4–P6 media, P7–P9 ras de suelo. Color = nº de disparos dirigidos ahí.",
    en: "P1–P3 top (top corners and high centre), P4–P6 mid, P7–P9 along the ground. Colour = number of shots aimed there.",
  },
  resd_sin_disparos_zona: { es: "Sin disparos a esta zona", en: "No shots to this zone" },
  resd_sin_zona_porteria: {
    es: "{n} disparos sin zona de portería apuntada{extra}.",
    en: "{n} shots with no goal zone logged{extra}.",
  },
  resd_sin_zona_porteria_rival: {
    es: " (normal en disparos del rival si no se registró el destino)",
    en: " (normal for opponent shots if the destination wasn't recorded)",
  },
  // Etiquetas de resultado de disparo (LABEL_RES)
  resd_res_gol: { es: "Gol", en: "Goal" },
  resd_res_parada: { es: "Parada", en: "Save" },
  resd_res_palo: { es: "Palo", en: "Post" },
  resd_res_bloqueado: { es: "Bloqueado", en: "Blocked" },
  resd_res_fuera: { es: "Fuera", en: "Wide" },

  // ══════════════════ RESUMEN — ANÁLISIS ══════════════════
  resa_quintetos: { es: "🟢 Quintetos iniciales", en: "🟢 Starting fives" },
  resa_quintetos_nota: {
    es: "Con qué 5 jugadores empezamos cada parte (incluido el portero).",
    en: "Which 5 players we started each period with (goalkeeper included).",
  },
  resa_sin_datos: { es: "Sin datos", en: "No data" },
  resa_asistencias: { es: "🎯 Asistencias", en: "🎯 Assists" },
  resa_sin_asistencias: { es: "Sin asistencias registradas todavía.", en: "No assists logged yet." },
  resa_parejas: { es: "Parejas asistente → goleador", en: "Assist → scorer pairs" },
  resa_eficiencia: { es: "🎯 Eficiencia ofensiva", en: "🎯 Attacking efficiency" },
  resa_sin_disparos: { es: "Sin disparos registrados todavía.", en: "No shots logged yet." },
  resa_disparos: { es: "Disparos", en: "Shots" },
  resa_a_puerta: { es: "A puerta", en: "On target" },
  resa_goles: { es: "Goles", en: "Goals" },
  resa_pct_gol: { es: "% gol", en: "% goal" },
  resa_pct_puerta: { es: "% puerta", en: "% on target" },
  resa_title_pct_gol: { es: "% goles / disparos", en: "% goals / shots" },
  resa_title_pct_puerta: { es: "% disparos a puerta / total", en: "% on-target shots / total" },
  resa_cuartetos: { es: "⚔️ Cuartetos por +/-", en: "⚔️ Outfield fours by +/-" },
  resa_sin_cuartetos: {
    es: "Sin goles asociados a cuartetos todavía. Se calculan a partir del cuarteto en pista cuando cae cada gol.",
    en: "No goals tied to outfield fours yet. They're computed from the four on court when each goal is scored.",
  },
  resa_transiciones: { es: "⚡ Transiciones (ventana 20s)", en: "⚡ Transitions (20s window)" },
  resa_transiciones_nota: {
    es: "% recuperaciones que acaban en gol nuestro (transición ofensiva efectiva) · % pérdidas que acaban en gol del rival (vulnerabilidad post-pérdida). Ambas miradas dentro de los siguientes 20 segundos.",
    en: "% of recoveries that end in a goal for us (effective attacking transition) · % of turnovers that end in an opponent goal (post-turnover vulnerability). Both measured within the next 20 seconds.",
  },
  resa_recup_gol: { es: "↗️ Recuperación → Gol", en: "↗️ Recovery → Goal" },
  resa_recup_de: { es: "{a} / {b} recuperaciones", en: "{a} / {b} recoveries" },
  resa_perdida_gol: { es: "↘️ Pérdida → Gol rival", en: "↘️ Turnover → Opponent goal" },
  resa_perdidas_de: { es: "{a} / {b} pérdidas", en: "{a} / {b} turnovers" },

  // ══════════════════ RESUMEN — FOOTER / EXPORT ══════════════════
  res_exportar_json: { es: "📤 Exportar JSON", en: "📤 Export JSON" },
  res_footer_json: {
    es: "El JSON contiene todo el partido (config + eventos + tiempos + acciones + tanda). Útil para archivar, hacer merge entre iPads o importar a Google Sheets después.",
    en: "The JSON holds the whole match (config + events + times + actions + shootout). Useful to archive, merge between iPads or import to Google Sheets later.",
  },
  res_export_error: { es: "No he podido exportar el JSON: {detalle}", en: "Couldn't export the JSON: {detalle}" },

  // ══════════════════ NOMBRES DE PARTE (NOMBRE_PARTE) ══════════════════
  parte_1t: { es: "1ª parte", en: "1st period" },
  parte_2t: { es: "2ª parte", en: "2nd period" },
  parte_pr1: { es: "Prórroga 1", en: "Extra time 1" },
  parte_pr2: { es: "Prórroga 2", en: "Extra time 2" },

  // ══════════════════ CAMPO / PORTERÍA (componentes) ══════════════════
  campo_atacante: { es: "Atacante", en: "Attacker" },
  campo_ataca_der: { es: "{nombre} ataca →", en: "{nombre} attacks →" },
  campo_ataca_izq: { es: "← {nombre} ataca", en: "← {nombre} attacks" },

  // ══════════════════ PRESETS DE COMPETICIÓN (etiqueta visible) ══════════════════
  // OJO: las CLAVES de competición (LIGA, COPA_REY…) son identificadores y NO
  // se traducen. Solo su etiqueta visible. db.ts mantiene el label español como
  // origen; aquí va la traducción que muestra nuevo/page.tsx.
  comp_LIGA: { es: "Liga (2×20')", en: "League (2×20')" },
  comp_COPA_REY: { es: "Copa del Rey (2×20' + 2×5' + tanda)", en: "Copa del Rey (2×20' + 2×5' + shootout)" },
  comp_COPA_ESPANA: { es: "Copa de España (2×20' + 2×5' + tanda)", en: "Copa de España (2×20' + 2×5' + shootout)" },
  comp_COPA_MUNDO: { es: "Copa del Mundo (2×20' + 2×5' + tanda)", en: "World Cup (2×20' + 2×5' + shootout)" },
  comp_AMISTOSO: { es: "Amistoso (2×20')", en: "Friendly (2×20')" },
  comp_PLAYOFF: { es: "Playoff (2×20' + 2×5' + tanda)", en: "Playoff (2×20' + 2×5' + shootout)" },
  comp_SUPERCOPA: { es: "Supercopa (2×20' + 2×5' + tanda)", en: "Supercup (2×20' + 2×5' + shootout)" },

  // ══════════════════ CÓDIGOS DE RESULTADO DE DISPARO (botones modales) ══════════════════
  // El VALOR almacenado es siempre el código ES (PUERTA/PALO/FUERA/BLOQUEADO,
  // GOL/PARADA/POSTE). Aquí solo la etiqueta visible del botón.
  disp_PUERTA: { es: "PUERTA", en: "ON TGT" },
  disp_PALO: { es: "PALO", en: "POST" },
  disp_FUERA: { es: "FUERA", en: "WIDE" },
  disp_BLOQUEADO: { es: "BLOQUEADO", en: "BLOCK" },
  disp_GOL: { es: "GOL", en: "GOAL" },
  disp_PARADA: { es: "PARADA", en: "SAVE" },
  disp_POSTE: { es: "POSTE", en: "POST" },

  // ══════════════════ SELECTOR DE IDIOMA (demo) ══════════════════
  selector_idioma_label: { es: "Idioma", en: "Language" },
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
  "1x1 banda": "acc_1x1_banda", "Ataque posicional": "acc_ataque_posicional",
  "10m": "acc_10m", "10 m": "acc_10m", "Penalti": "acc_penalti", "Otra": "acc_otra",
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
