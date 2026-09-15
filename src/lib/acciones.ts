/**
 * Nombre y bloque de cada acción individual (15/9/2026).
 *
 * El editor post-partido solo conocía las seis básicas: al abrir un saque o
 * una anticipación, el desplegable enseñaba «PF» como si fuera lo guardado, y
 * no dejaba elegir ninguna de vídeo. Aquí están TODAS, con los nombres que ya
 * salen al apuntarlas (mismas claves de i18n.ts) y en los bloques del modal:
 * las del menú principal, las stats de vídeo y las de portero.
 *
 * Los códigos (pf, antB…) son los nombres de los contadores y la importación
 * del club los lee tal cual: aquí solo se les pone nombre, no se renombran.
 *
 * Sin React ni cliente activo, para poder probarlo con node:
 *   node --experimental-strip-types src/lib/acciones.test.ts
 */
import type { AccionIndTipo } from "./db";

/** El t() de i18n.ts. Se recibe en vez de importarlo porque i18n.ts tira del
 *  cliente activo, y entonces esto no se podría probar con node. */
type Traducir = (clave: string) => string;

type Bloque = "basicas" | "video" | "portero";

/** [bloque, clave del nombre, clave de cómo acabó si acaba bien o mal].
 *  Record a propósito: un tipo nuevo en AccionIndTipo sin su línea aquí no
 *  compila. El orden es el de los botones del modal. */
const ACCIONES: Record<AccionIndTipo, [Bloque, string, string?]> = {
  robos: ["basicas", "lblacc_robos"],
  cortes: ["basicas", "lblacc_cortes"],
  pf: ["basicas", "lblacc_pf"],
  pnf: ["basicas", "lblacc_pnf"],
  bdg: ["basicas", "lblacc_bdg"],
  bdp: ["basicas", "lblacc_bdp"],

  duelC_g: ["video", "vid_duelC", "vid_ganado"],
  duelC_p: ["video", "vid_duelC", "vid_perdido"],
  duelP_g: ["video", "vid_duelP", "vid_ganado"],
  duelP_p: ["video", "vid_duelP", "vid_perdido"],
  unoAtq_g: ["video", "vid_unoAtq", "vid_ganado"],
  unoAtq_p: ["video", "vid_unoAtq", "vid_perdido"],
  unoDef_g: ["video", "vid_unoDef", "vid_ganado"],
  unoDef_p: ["video", "vid_unoDef", "vid_perdido"],
  conexPivot: ["video", "vid_conexPivot"],
  corteConex: ["video", "vid_corteConex"],
  ultCob: ["video", "vid_ultCob"],
  // Con las de campo y no en el bloque de portero: la tienen todos.
  antB: ["video", "vid_anticipacion", "vid_buena"],
  antM: ["video", "vid_anticipacion", "vid_mala"],

  saqueB: ["portero", "vid_saque", "vid_bueno"],
  saqueM: ["portero", "vid_saque", "vid_malo"],
  paseB: ["portero", "vid_pase", "vid_bueno"],
  paseM: ["portero", "vid_pase", "vid_malo"],
  cobBR: ["portero", "vid_cob", "vid_cob_br"],
  cobBN: ["portero", "vid_cob", "vid_cob_bn"],
  cobMR: ["portero", "vid_cob", "vid_cob_mr"],
  cobMN: ["portero", "vid_cob", "vid_cob_mn"],
  achique: ["portero", "vid_achique"],
};

const TITULO_BLOQUE: Record<Bloque, string[]> = {
  basicas: ["ed_acc_basicas"],
  video: ["res_stats_video"],
  portero: ["res_stats_video", "vid_portero"],
};

/** Nombre legible de una acción individual: «❌ Pérdida forzada», «Saque ·
 *  ✅ Bueno». Un código que no se conoce sale tal cual, nunca con el nombre
 *  de otra acción. */
export function etiquetaAccionInd(accion: string, t: Traducir): string {
  const a = (ACCIONES as Record<string, [Bloque, string, string?] | undefined>)[accion];
  if (!a) return accion;
  const [, nombre, resultado] = a;
  return resultado ? `${t(nombre)} · ${t(resultado)}` : t(nombre);
}

/** Todas las acciones individuales, por bloques y en el orden del modal: las
 *  opciones del desplegable «Acción» del editor. */
export function gruposAccionInd(t: Traducir): { titulo: string; opciones: { v: AccionIndTipo; lbl: string }[] }[] {
  const todas = Object.keys(ACCIONES) as AccionIndTipo[];
  return (Object.keys(TITULO_BLOQUE) as Bloque[]).map((b) => ({
    titulo: TITULO_BLOQUE[b].map((c) => t(c)).join(" · "),
    opciones: todas
      .filter((a) => ACCIONES[a][0] === b)
      .map((a) => ({ v: a, lbl: etiquetaAccionInd(a, t) })),
  }));
}
