/**
 * Test de «Editar datos del partido» (cabecera, 25/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/editarCabecera.test.ts
 *
 * Datos INVENTADOS (rivales y jugadores de mentira).
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import type { Partido, ConfigPartido, Evento } from "./db.ts";
// Las librerías importan sin extensión (como pide Next): aquí se les pone .ts.
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const {
  aplicarCabecera, validarCabecera, hayCambiosCabecera, otrosMismoPartido, cabeceraDe, segundosUsados,
} = await import("./editarCabecera.ts");
const { quitarDuplicadosVideo } = await import("./duplicadosVideo.ts");
const { ordenarPartidos } = await import("./ordenPartidos.ts");
const { incluido, FILTRO_TODO } = await import("./filtroTotales.ts");
const { COMPETICIONES, opcionesCompeticion } = await import("./competiciones.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

function config(o: Partial<ConfigPartido> = {}): ConfigPartido {
  return {
    rival: "FICTICIO FS", fecha: "2026-08-20", hora: "19:00", lugar: "Pabellón",
    competicion: "LIGA", local: false, partido_id: "J1.FICTICIO",
    convocados: ["ALFA", "BETA"], pista_inicial: { portero: "ALFA", pista1: "BETA", pista2: "", pista3: "", pista4: "" },
    duracionParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 },
    permiteTanda: false, direccionInter1T: "der", ...o,
  };
}
function evento(id: string, parte: "1T" | "2T" | "PR1" | "PR2", seg: number): Evento {
  return { id, tipo: "gol", equipo: "INTER", goleador: "BETA", cuarteto: [], parte, segundosParte: seg,
    segundosPartido: seg, timestampReal: 1, marcador: { inter: 1, rival: 0 } } as Evento;
}
function partido(id: string, o: { cfg?: Partial<ConfigPartido>; modo?: "directo" | "video"; eventos?: Evento[]; act?: number } = {}): Partido {
  return {
    id, estado: "finalizado", modo: o.modo ?? "directo", config: config(o.cfg),
    cronometro: { parteActual: "2T", segundosParte: 1200, ultimoStart: null,
      segundosGuardadosPorParte: { "1T": 1200, "2T": 1200, PR1: 0, PR2: 0 } },
    enPista: [], tiempos: {
      BETA: { nombre: "BETA", totalSegundos: 1500, porParte: { "1T": 800, "2T": 700, PR1: 0, PR2: 0 },
        segTurnoActual: null, turnoStart: null, ultimaSalida: null, segDescansoActual: null, descansoStart: null, segTurnoUltimo: null },
    },
    marcador: { inter: 1, rival: 0 },
    stats: { faltas: {} as any, amarillas: {} as any, tiemposMuerto: {} as any },
    eventos: o.eventos ?? [evento("e1", "1T", 300), evento("e2", "2T", 1100)],
    acciones: { porJugador: { BETA: { dpp: 1 } as any } },
    disparosRival: { puerta: 0, fuera: 0, palo: 0, bloqueado: 0 },
    tanda: { activa: false, tiros: [], marcador: { inter: 0, rival: 0 } },
    actualizado: o.act ?? 1000,
  } as Partido;
}

console.log("── Cambiar la cabecera no toca lo demás ──");
{
  const p = partido("p_aaa_1");
  const n = aplicarCabecera(p, { competicion: "AMISTOSO", fecha: "2026-08-21", hora: "12:30",
    rival: "  otro rival ", partido_id: " amis.otro ", lugar: " Fuera ", local: true, modo: "video",
    direccionInter1T: "izq", permiteTanda: true });
  ok(n.id === p.id, "el id del partido NO cambia");
  ok(n.config!.competicion === "AMISTOSO", "LIGA → AMISTOSO");
  ok(n.config!.fecha === "2026-08-21" && n.config!.hora === "12:30", "fecha y hora nuevas");
  ok(n.config!.rival === "OTRO RIVAL" && n.config!.partido_id === "AMIS.OTRO", "rival y código como en Nuevo partido (sin espacios, mayúsculas)");
  ok(n.config!.lugar === "Fuera" && n.config!.local === true, "lugar y casa/fuera");
  ok(n.modo === "video" && n.config!.direccionInter1T === "izq" && n.config!.permiteTanda === true, "modo, dirección y tanda");
  ok(n.eventos === p.eventos, "los eventos son LOS MISMOS (ni copiados)");
  ok(n.tiempos === p.tiempos && n.acciones === p.acciones && n.marcador === p.marcador, "minutos, acciones y marcador intactos");
  ok(n.config!.convocados === p.config!.convocados, "convocados intactos");
  ok(JSON.stringify(n.config!.duracionParte) === JSON.stringify(p.config!.duracionParte),
    "cambiar la competición NO aplica sus duraciones (el partido ya se jugó)");
  ok(p.config!.competicion === "LIGA" && p.modo === "directo", "el original no se muta");
  ok(n.actualizado === p.actualizado, "no toca `actualizado` (lo pone el guardado, y así la cola lo sube)");
}

console.log("── Lo que no viene se queda ──");
{
  const p = partido("p_aaa_1");
  const n = aplicarCabecera(p, { hora: "20:00" });
  ok(n.config!.rival === p.config!.rival && n.config!.competicion === "LIGA" && n.modo === "directo", "solo cambia la hora");
  ok(!hayCambiosCabecera(p, cabeceraDe(p)), "abrir y guardar sin tocar = sin cambios (no se marca para subir)");
  ok(hayCambiosCabecera(p, { competicion: "AMISTOSO" }), "cambiar la competición sí es un cambio");
  ok(!hayCambiosCabecera(p, { rival: " ficticio fs " }), "el mismo rival escrito distinto no es un cambio");
}

console.log("── Validación ──");
{
  const p = partido("p_aaa_1");
  ok(validarCabecera(p, cabeceraDe(p)) === null, "tal cual está, se puede guardar");
  ok(validarCabecera(p, { rival: "  " })?.clave === "nuevo_alert_rival", "sin rival, no");
  ok(validarCabecera(p, { partido_id: "" })?.clave === "nuevo_alert_id", "sin código, no");
  ok(validarCabecera(p, { fecha: "20/08/2026" })?.clave === "edc_err_fecha", "fecha mal escrita, no");
  ok(validarCabecera(p, { duracionParte: { "2T": 0 } })?.clave === "edc_err_parte_cero", "una parte con acciones no puede quedarse en 0");
  const corta = validarCabecera(p, { duracionParte: { "2T": 900 } });
  ok(corta?.clave === "edc_err_parte_corta" && (corta as any).usados === 1200, "ni más corta que lo apuntado (aquí, el reloj de la 2ª hasta 20:00)");
  ok(validarCabecera(p, { duracionParte: { PR1: 300, PR2: 300 } }) === null, "añadir prórroga sí se puede");
  ok(validarCabecera(p, { duracionParte: { "1T": 1500 } }) === null, "alargar sí se puede");
  // Partido viejo con un evento en el descuento: se guarda sin tocar duraciones.
  const viejo = partido("p_aaa_2", { eventos: [evento("e9", "2T", 1260)] });
  ok(segundosUsados(viejo)["2T"] === 1260, "segundos usados: el evento más tardío");
  ok(validarCabecera(viejo, { competicion: "AMISTOSO" }) === null, "un evento pasado de tiempo no impide cambiar otra cosa");
}

console.log("── Duplicados directo + vídeo ──");
{
  const directo = partido("p_d", { cfg: { partido_id: "J1.FICTICIO" }, act: 1 });
  const video = partido("p_v", { cfg: { partido_id: "OTRO.CODIGO" }, modo: "video", act: 2 });
  ok(otrosMismoPartido(directo, [directo, video]).length === 0, "antes: códigos distintos, partidos distintos");
  ok(quitarDuplicadosVideo([directo, video]).cuentan.length === 2, "antes: cuentan los dos");
  const vEd = aplicarCabecera(video, { partido_id: "j1.ficticio" });
  ok(otrosMismoPartido(vEd, [directo, video]).map((x) => x.id).join() === "p_d", "al poner el mismo código, se avisa del otro (y no de sí mismo)");
  const r = quitarDuplicadosVideo([directo, vEd]);
  ok(r.cuentan.length === 1 && r.cuentan[0].id === "p_v", "y en Totales cuenta solo el de vídeo, una vez");
  // Separar: cambiar fecha/rival a uno que no tiene código.
  const a = partido("p_a", { cfg: { partido_id: "", fecha: "2026-08-20", rival: "FICTICIO FS" } });
  const b = partido("p_b", { cfg: { partido_id: "", fecha: "2026-08-20", rival: "FICTICIO FS" }, modo: "video" });
  ok(quitarDuplicadosVideo([a, b]).cuentan.length === 1, "sin código, misma fecha y rival = el mismo");
  const bEd = aplicarCabecera(b, { fecha: "2026-08-27" });
  ok(quitarDuplicadosVideo([a, bEd]).cuentan.length === 2 && otrosMismoPartido(bEd, [a, b]).length === 0,
    "cambiar la fecha los separa: ya no se pisan");
  ok(ordenarPartidos([a, bEd])[0].id === "p_b", "y la lista se ordena por la fecha nueva");
}

console.log("── Totales sigue al cambio de competición ──");
{
  const p = partido("p_x");
  const soloLiga = { compsFuera: COMPETICIONES.filter((c) => c !== "LIGA"), sueltos: {} };
  ok(incluido(p, soloLiga), "como LIGA entra en «Solo liga»");
  ok(!incluido(aplicarCabecera(p, { competicion: "AMISTOSO" }), soloLiga), "pasado a AMISTOSO, ya no");
  ok(incluido(aplicarCabecera(p, { competicion: "AMISTOSO" }), FILTRO_TODO), "con «Todas», sí");
  const conExcepcion = { compsFuera: [], sueltos: { p_x: false } };
  ok(!incluido(aplicarCabecera(p, { competicion: "AMISTOSO", fecha: "2026-09-01" }), conExcepcion),
    "las excepciones de Totales van por id: siguen valiendo tras editar");
}

console.log("── Competiciones: una sola lista ──");
{
  ok(COMPETICIONES.includes("AMISTOSO" as any) && COMPETICIONES.includes("LIGA" as any), "lleva LIGA y AMISTOSO");
  ok(opcionesCompeticion("LIGA").length === COMPETICIONES.length, "una conocida no añade nada");
  ok(opcionesCompeticion("TORNEO_RARO").at(-1) === "TORNEO_RARO", "una desconocida (importada) se conserva en el desplegable");
  const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  for (const f of ["../app/nuevo/page.tsx", "../components/NuevoPartidoNuevo.tsx", "../components/EditarCabecera.tsx"]) {
    const src = leer(f);
    ok(/from "@\/lib\/competiciones"/.test(src) && !/\["LIGA", "COPA_REY"/.test(src), `${f.split("/").pop()} usa la lista común`);
  }
  const st = leer("./store.ts");
  ok(/setSaqueInicial, editarCabecera,\n/.test(st), "store: editarCabecera pasa por el candado de «solo mirar»");
  const res = leer("../app/resumen/page.tsx");
  ok((res.match(/data-edc-abrir/g) ?? []).length === 2, "resumen: el botón está en los dos aspectos");
}

console.log(fallos ? `\n❌ ${fallos} fallo(s)` : "\n✅ Todo bien");
if (fallos) process.exit(1);
