/**
 * Test de «Importar partido» (19/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/importarPartido.test.ts
 *
 * Caso real: un compañero rehace el partido del 18/11 en vídeo desde Safari en
 * su Mac, lo exporta, y Arkaitz lo quiere en el iPad del club. Aquí se vigila:
 *   1. Ida y vuelta: exportar → importar da EL MISMO partido (todas las
 *      acciones), y se puede volver a exportar e importar.
 *   2. Choque: con el mismo id no se pisa; «guardar los dos» = id nuevo + marca.
 *   3. Otro club: por la etiqueta o, sin ella, por la plantilla → nada.
 *   4. Ficheros que no son un partido → nada, y con el motivo.
 *   5. Partido a medias con el reloj en marcha → entra parado, se puede seguir.
 *   6. La pantalla de verdad: botón en los dos aspectos, selector para iPad,
 *      pregunta antes de guardar y textos en los tres idiomas.
 */
import { readFileSync } from "node:fs";
import type { Partido } from "./db.ts";
import {
  paraExportar, validarArchivo, aplicarDecision, deducirClub, pararReloj,
  contarAcciones, FORMATO_EXPORTACION, APP_EXPORTACION,
} from "./importarPartido.ts";
import { ROSTER_DEMO, ROSTER_REAL, ROSTER_FILIAL, ROSTER_JUVENIL } from "./roster.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg}${JSON.stringify(a) === JSON.stringify(b) ? "" : ` (esperaba ${JSON.stringify(b)?.slice(0, 120)}, salió ${JSON.stringify(a)?.slice(0, 120)})`}`);
}

const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const nombres = (r: { nombre: string }[]) => r.map((j) => j.nombre);
const DEMO = nombres(ROSTER_DEMO);
const INTER = nombres(ROSTER_REAL);
const FILIAL = nombres(ROSTER_FILIAL);
const JUVENIL = nombres(ROSTER_JUVENIL);

/** El partido de ejemplo de la demo: uno de verdad, terminado, en vídeo, con
 *  236 acciones. Es lo que sale de «Exportar JSON» (sin la etiqueta: de antes). */
const ejemplo = (): Partido => JSON.parse(leer("../../public/_demo_partido.json"));
const AHORA = 1_763_550_000_000;
const exportar = (p: Partido, cliente = "pulso", ahora = AHORA) =>
  JSON.stringify(paraExportar(p, { cliente, version: "abc1234", ahora }), null, 2);
const sinMarca = (p: Partido) => { const { importado, ...r } = p; return r; };

/** Un partido del Inter montado a mano (para los casos de club y de reloj). */
function partidoInter(): Partido {
  const p = ejemplo();
  const conv = ["JUGADOR", "JUGADOR", ...INTER.filter((n) => n !== "JUGADOR" && n !== "JUGADOR").slice(0, 10)];
  return {
    ...p, id: "p_inter_1", estado: "en_curso",
    config: { ...p.config!, partido_id: "J8.ELPOZO", rival: "ELPOZO", convocados: conv,
      pista_inicial: { portero: conv[0], pista1: conv[2], pista2: conv[3], pista3: conv[4], pista4: conv[5] } },
    enPista: [conv[0], conv[2], conv[3], conv[4], conv[5]],
    eventos: [], tiempos: {}, acciones: { porJugador: {} },
  };
}

console.log("── 1 · Ida y vuelta: exportar → importar = el mismo partido ──");
{
  const orig = ejemplo();
  const txt = exportar(orig);
  const meta = JSON.parse(txt).exportacion;
  igual(meta, { app: APP_EXPORTACION, formato: FORMATO_EXPORTACION, cliente: "pulso", version: "abc1234", exportado: AHORA },
    "el fichero lleva la etiqueta (app, formato, club, versión, hora)");
  const r = validarArchivo(txt, { cliente: "pulso", roster: DEMO, ahora: AHORA + 5000 });
  ok(r.ok, "el fichero del propio crono se acepta");
  if (r.ok) {
    ok(!("exportacion" in r.partido), "la etiqueta no se guarda en el aparato");
    igual(sinMarca(r.partido), orig, "MISMO partido: config, marcador, tiempos, stats y las 236 acciones");
    igual(r.partido.eventos.length, 236, "236 acciones");
    igual(contarAcciones(r.partido), orig.eventos.length + orig.tanda.tiros.length, "contarAcciones = eventos + tiros de la tanda");
    igual(r.partido.importado, { el: AHORA + 5000, idOriginal: "demo_partido_1" }, "con la marca de importado");
    ok(r.club === "etiqueta" && !r.enCurso && !r.relojParado, "club por la etiqueta, terminado, reloj sin tocar");
    // Y otra vuelta: el importado se exporta e importa igual.
    const r2 = validarArchivo(exportar(r.partido), { cliente: "pulso", roster: DEMO, ahora: AHORA + 9000 });
    ok(r2.ok && JSON.stringify(sinMarca(r2.partido)) === JSON.stringify(orig), "segunda vuelta (importado → exportar → importar): idéntico");
    ok(r2.ok && r2.partido.importado?.el === AHORA + 9000, "la marca vieja se sustituye por la nueva");
  }
  // Un fichero de ANTES de la etiqueta (exportado tal cual hasta hoy).
  const viejo = validarArchivo(JSON.stringify(orig, null, 2), { cliente: "pulso", roster: DEMO, ahora: AHORA });
  ok(viejo.ok && viejo.club === "plantilla", "un fichero sin etiqueta (de antes) entra comprobando la plantilla");
  ok(viejo.ok && JSON.stringify(sinMarca(viejo.partido)) === JSON.stringify(orig), "y también idéntico");
  const bom = validarArchivo("﻿" + exportar(orig), { cliente: "pulso", roster: DEMO });
  ok(bom.ok, "con BOM delante (algunos editores lo meten) también se lee");
  // Lo opcional que no traían los partidos viejos se rellena como uno nuevo.
  const sinOpc: Record<string, unknown> = { ...orig };
  delete sinOpc.tanda; delete sinOpc.incorporacionesRival; delete sinOpc.modo;
  const ro = validarArchivo(JSON.stringify(sinOpc), { cliente: "pulso", roster: DEMO });
  ok(ro.ok && ro.partido.tanda.tiros.length === 0 && ro.partido.incorporacionesRival?.total === 0 && ro.partido.modo === "directo",
    "sin tanda / incorporaciones / modo (partidos viejos): se rellenan como en un partido nuevo");
}

console.log("── 2 · Choque: mismo id → se pregunta; nunca se pisa solo ──");
{
  const r = validarArchivo(exportar(ejemplo()), { cliente: "pulso", roster: DEMO, ahora: AHORA });
  if (!r.ok) { ok(false, "no se validó el ejemplo"); }
  else {
    const rep = aplicarDecision(r.partido, "reemplazar", "p_nuevo");
    ok(rep.id === "demo_partido_1" && rep === r.partido, "reemplazar: mismo id (y solo si lo elige él)");
    const dos = aplicarDecision(r.partido, "ambos", "p_nuevo");
    ok(dos.id === "p_nuevo", "guardar los dos: id NUEVO");
    igual(dos.importado, { el: AHORA, idOriginal: "demo_partido_1", copia: true }, "con la marca de copia «(importado)»");
    igual(dos.eventos, r.partido.eventos, "y con todas sus acciones");
    ok(dos.config?.partido_id === r.partido.config?.partido_id,
      "el código del partido (J8.ELPOZO…) NO se cambia: es el que usa el club al subirlo");
  }
  const store = leer("./store.ts");
  ok(/export async function partidoGuardado\(id: string\)/.test(store), "el store dice si ya hay uno con ese id");
  ok(/guardarPartidoImportado\(p: Partido, copia: boolean\)/.test(store)
     && store.includes('aplicarDecision(p, "ambos", nuevoIdPartido())'), "y guarda la copia con un id nuevo");
  const ui = leer("../components/ImportarPartido.tsx");
  const leerFn = ui.slice(ui.indexOf("const leer = async"), ui.indexOf("const cerrar"));
  ok(leerFn.indexOf("partidoGuardado(") > -1 && leerFn.indexOf("partidoGuardado(") < leerFn.indexOf("await guardar("),
    "la pantalla mira si ya existe ANTES de guardar");
  ok(/if \(aqui\) \{ setPaso\(\{ k: "choque"/.test(leerFn), "y si existe, pregunta (ventana de choque)");
  ok(['data-importar="ambos"', 'data-importar="reemplazar"', 'data-importar="cancelar"'].every((x) => ui.includes(x)),
    "con las tres salidas: guardar los dos, reemplazar, cancelar");
}

console.log("── 3 · Otro club: no se importa nada ──");
{
  const inter = partidoInter();
  const rf = validarArchivo(exportar(inter, "filial"), { cliente: "inter", roster: INTER });
  ok(!rf.ok && rf.error === "otro_club" && rf.detalle === "filial", "etiqueta del filial en el crono del Inter → otro_club (filial)");
  const rp = validarArchivo(exportar(ejemplo(), "pulso"), { cliente: "juvenil", roster: JUVENIL });
  ok(!rp.ok && rp.error === "otro_club", "la demo en el crono del juvenil → otro_club");
  const ri = validarArchivo(exportar(inter, "inter"), { cliente: "inter", roster: INTER });
  ok(ri.ok && ri.club === "etiqueta", "el del Inter en el del Inter → entra");
  // Sin etiqueta (ficheros de antes): la plantilla.
  const sv = validarArchivo(JSON.stringify(ejemplo()), { cliente: "inter", roster: INTER });
  ok(!sv.ok && sv.error === "otro_roster" && sv.n === 0 && sv.total === 14, "sin etiqueta, la demo en el Inter → 0 de 14 de la plantilla");
  const si = validarArchivo(JSON.stringify(inter), { cliente: "inter", roster: INTER });
  ok(si.ok && si.club === "plantilla", "sin etiqueta, el del Inter en el Inter → entra por la plantilla");
  // Filial y juvenil comparten unos chavales: no basta con uno o dos.
  const conv = JUVENIL.slice(0, 14);
  const d = deducirClub(conv, FILIAL);
  ok(!d.suyo, `14 del juvenil con la plantilla del filial → no es suyo (${d.n} de ${d.total})`);
  ok(deducirClub(FILIAL.slice(0, 14), FILIAL).suyo, "14 del filial con la del filial → suyo");
  ok(deducirClub(["A", "B", ...INTER.slice(0, 3)], INTER).suyo, "con alguna baja (3 de 5) sigue siendo suyo");
  ok(!deducirClub(["A", "B", "C", ...INTER.slice(0, 3)], INTER).suyo, "la mitad justa NO basta");
  ok(!deducirClub([], INTER).suyo, "sin convocados no se puede decir que sea suyo");
}

console.log("── 4 · Ficheros que no son un partido ──");
{
  const ctx = { cliente: "pulso", roster: DEMO };
  const err = (txt: string) => { const r = validarArchivo(txt, ctx); return r.ok ? "ok" : r.error; };
  igual(err(""), "vacio", "vacío");
  igual(err("hola, esto es un texto"), "no_json", "texto cualquiera");
  igual(err("<html></html>"), "no_json", "una página web");
  igual(err('{"formato":"crono-copia-v1","cliente":"pulso","partidos":[]}'), "es_copia", "la copia de seguridad de Totales → que se abra allí");
  igual(err("[]"), "es_copia", "una lista de partidos");
  igual(err("{}"), "no_partido", "un objeto vacío");
  igual(err('{"nombre":"factura"}'), "no_partido", "otro JSON cualquiera");
  const p = ejemplo();
  const roto = (f: (x: Record<string, any>) => void) => { const x: Record<string, any> = JSON.parse(JSON.stringify(p)); f(x); return JSON.stringify(x); };
  const det = (txt: string) => { const r = validarArchivo(txt, ctx); return r.ok ? "ok" : `${r.error}:${r.detalle}`; };
  igual(det(roto((x) => { delete x.eventos; })), "no_partido:eventos", "sin acciones → dice qué falta");
  igual(det(roto((x) => { x.config = null; })), "no_partido:config", "sin cabecera (partido sin configurar)");
  igual(det(roto((x) => { x.eventos[3].parte = "3T"; })), "no_partido:eventos[3]", "una acción en una parte que no existe");
  igual(det(roto((x) => { x.marcador = { inter: "2", rival: 1 }; })), "no_partido:marcador", "marcador con texto");
  igual(det(roto((x) => { x.estado = "borrado"; })), "no_partido:estado", "estado raro");
  igual(det(roto((x) => { x.cronometro.parteActual = "X"; })), "no_partido:cronometro", "cronómetro roto");
  igual(det(roto((x) => { x.exportacion = { app: "otra-app", formato: 1, cliente: "pulso" }; })), "no_partido:exportacion", "etiqueta de otra aplicación");
  igual(err(roto((x) => { x.exportacion = { app: APP_EXPORTACION, formato: FORMATO_EXPORTACION + 1, cliente: "pulso", version: "x", exportado: 1 }; })),
    "version", "formato de un crono MÁS NUEVO → que se actualice");
  igual(det(roto((x) => { x.eventos[0].tipo = "teletransporte"; })), "version:teletransporte", "una acción que este crono no conoce → más nuevo");
  const enorme = validarArchivo("x".repeat(20 * 1024 * 1024 + 1), ctx);
  ok(!enorme.ok && enorme.error === "grande", "más de 20 MB → demasiado grande");
}

console.log("── 5 · A medias y con el reloj en marcha ──");
{
  const p = partidoInter();
  const ref = AHORA;
  p.cronometro = { parteActual: "2T", segundosParte: 300, ultimoStart: ref - 10_000 };
  p.tiempos = {
    [p.enPista[0]]: { nombre: p.enPista[0], totalSegundos: 1500, porParte: { "1T": 1200, "2T": 300, PR1: 0, PR2: 0 },
      segTurnoActual: 60, turnoStart: ref - 10_000, ultimaSalida: null, segDescansoActual: null, descansoStart: null, segTurnoUltimo: null },
    BANQUILLO: { nombre: "BANQUILLO", totalSegundos: 0, porParte: { "1T": 0, "2T": 0, PR1: 0, PR2: 0 },
      segTurnoActual: null, turnoStart: null, ultimaSalida: ref - 50_000, segDescansoActual: 20, descansoStart: ref - 10_000, segTurnoUltimo: 30 },
  };
  const r = validarArchivo(exportar(p, "inter", ref), { cliente: "inter", roster: INTER, ahora: ref + 3_600_000 });
  ok(r.ok, "un partido a medias se acepta");
  if (r.ok) {
    ok(r.enCurso && r.relojParado, "se avisa: a medias (se puede «Continuar») y reloj parado");
    igual(r.partido.estado, "en_curso", "sigue «en curso»");
    igual(r.partido.cronometro, { parteActual: "2T", segundosParte: 310, ultimoStart: null },
      "el reloj se para en el segundo en que se EXPORTÓ (no una hora después, al importar)");
    const tj = r.partido.tiempos[p.enPista[0]];
    ok(tj.turnoStart === null && tj.segTurnoActual === 70 && tj.totalSegundos === 1510 && tj.porParte["2T"] === 310,
      "el que estaba en pista: +10 s a su turno, su total y su 2T");
    const tb = r.partido.tiempos.BANQUILLO;
    ok(tb.descansoStart === null && tb.segDescansoActual === 30, "el del banquillo: +10 s de descanso");
    igual(r.partido.enPista, p.enPista, "los cinco en pista, los mismos");
  }
  // Sin etiqueta: se para en el último guardado.
  const sinEt = { ...p, actualizado: ref - 4_000 };
  const r2 = validarArchivo(JSON.stringify(sinEt), { cliente: "inter", roster: INTER });
  ok(r2.ok && r2.partido.cronometro.segundosParte === 306, "sin etiqueta, se para en el último guardado («actualizado»)");
  // Con el reloj parado no se toca nada.
  const parado = partidoInter();
  ok(pararReloj(parado, ref).partido === parado && !pararReloj(parado, ref).parado, "con el reloj parado, el partido tal cual");
}

console.log("── 6 · La pantalla: botón, selector, aviso y textos ──");
{
  const inicio = leer("../app/page.tsx");
  const nuevo = leer("../components/InicioNuevo.tsx");
  const ui = leer("../components/ImportarPartido.tsx");
  const resumen = leer("../app/resumen/page.tsx");
  ok(inicio.includes('onClick={importar.abrir} data-importar-boton=""') && inicio.includes('{t("home_importar")}'),
    "aspecto clásico: botón «Importar partido»");
  ok(inicio.includes("onImportar={importar.abrir}") && nuevo.includes("onClick={props.onImportar}")
     && /<Ico\.bajar \/>\s*<span>\{sinEmojis\(t\("home_importar"\)\)\}/.test(nuevo),
    "aspecto nuevo: su botón con icono SVG y el texto sin emoji");
  ok(ui.includes('type="file" accept="application/json,.json"'), "selector de archivo que abre «Archivos» en el iPad");
  ok(ui.includes('e.target.value = ""'), "se puede volver a elegir el mismo archivo");
  ok(!/fetch\(|navigator\.onLine/.test(ui + leer("./importarPartido.ts")), "sin internet: no se pide nada a la red");
  ok(/paraExportar\(partido, \{ cliente: CLIENTE\.id, version: VERSION_CRONO \}\)/.test(resumen),
    "«Exportar JSON» escribe la etiqueta (club y versión)");
  ok(inicio.includes("p.importado &&") && nuevo.includes("p.importado &&"), "los importados llevan su marca en la lista (los dos aspectos)");

  const src = leer("./i18n.ts");
  const ini = src.indexOf("export const CATALOGO");
  const abre = src.indexOf("{", src.indexOf("=", ini));
  const CAT: Record<string, Record<string, string>> = new Function(`return ${src.slice(abre, src.indexOf("\n};", abre) + 2)}`)();
  const usadas = [...new Set([...ui.matchAll(/t\("((?:imp|home)_\w+)"/g), ...inicio.matchAll(/t\("(home_importa\w*)"/g)].map((m) => m[1]))];
  const faltan = usadas.filter((k) => !CAT[k] || !CAT[k].es || !CAT[k].en || !CAT[k].it);
  ok(usadas.length > 20 && faltan.length === 0, `los ${usadas.length} textos de la importación, en es / en / it (${faltan.join(", ") || "todos"})`);
  ok(CAT.home_importar.ico === "📥" && !/\p{Extended_Pictographic}/u.test(CAT.home_importar.es), "el emoji del botón va en «ico», no en el texto");
  const dn = leer("../components/DirectoNuevo.tsx");
  ok(dn.includes('"📥": { ico: "bajar" }'), "y con el aspecto nuevo ese emoji se dibuja como icono");
}

console.log(fallos ? `\n❌ Importar partido: ${fallos} fallo(s)` : "\n✅ Importar partido OK (0 fallos)");
process.exit(fallos ? 1 : 0);
