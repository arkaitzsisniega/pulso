/**
 * Test de las cuentas del informe con el aspecto nuevo (23/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/informeNuevo.test.ts
 *
 * Vigila lo que el dibujo da por bueno: la familia de cada situación (el color
 * de su etiqueta), que las etiquetas de la línea de tiempo no se monten, el
 * marcador en escalones y, sobre todo, los MAPAS: qué es gol, qué es disparo a
 * puerta y que nada se cuente dos veces.
 */
import type { GolNuevo } from "./informeNuevo.ts";

// informeNuevo.ts importa lanzamientos.ts como el resto de la app, sin la
// extensión (así lo quiere el build): aquí se le enseña a node a probar con ".ts".
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      try { return siguiente(`${especificador}.ts`, contexto); } catch { /* tal cual */ }
    }
    return siguiente(especificador, contexto);
  },
});
const {
  contarMapas, escalonesMarcador, familiaSituacion, finEje, minutoAbs, mezclar,
  nivelesEtiquetas, nombreBonito, radioBurbuja, resumenGoles, tintaSobre, tinteZona,
} = await import("./informeNuevo.ts");

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log("── Nombres y minutos ──");
ok(nombreBonito("JUGADOR") === "Jugador", "«JUGADOR» → «Jugador»");
ok(nombreBonito("J.JUGADOR") === "J.Jugador", "«J.JUGADOR» → «J.Jugador»");
ok(nombreBonito("CD SERENO") === "CD Sereno", "las siglas de dos letras se quedan");
ok(nombreBonito("PUERTA DE HIERRO") === "Puerta de Hierro", "«de», «la»… en minúscula");
ok(nombreBonito("Jugador") === "Jugador", "lo que ya viene con minúsculas se respeta");
ok(nombreBonito("") === "", "vacío sigue vacío");
ok(minutoAbs(65) === "01:05" && minutoAbs(2399.6) === "40:00", "minutos con dos cifras");

console.log("── Familias de situación (el color de la etiqueta) ──");
ok(familiaSituacion("5x4") === "superioridad", "5x4 → superioridad");
ok(familiaSituacion("Incorporación de portero") === "superioridad", "incorporación de portero → superioridad");
ok(familiaSituacion("Córner") === "abp" && familiaSituacion("Penalti") === "abp"
  && familiaSituacion("10m") === "abp" && familiaSituacion("FSB") === "abp",
  "córner, penalti, 10 m y FSB → balón parado");
ok(familiaSituacion("Contraataque") === "transicion", "contraataque → transición");
ok(familiaSituacion("Robo zona alta") === "transicion", "robo en zona alta → transición");
ok(familiaSituacion("Pérdida en salida de presión") === "transicion", "pérdida en salida de presión → transición");
ok(familiaSituacion("Ataque posicional") === "ataque", "ataque posicional → ataque");
ok(familiaSituacion("") === "ataque", "sin situación → ataque (azul neutro)");

console.log("── Línea de tiempo: etiquetas sin montarse ──");
ok(igual(nivelesEtiquetas([100, 400, 700], 100), [0, 0, 0]), "separadas, todas abajo del todo");
ok(igual(nivelesEtiquetas([100, 150, 200, 500], 100), [0, 1, 2, 0]), "juntas, se apilan; la siguiente libre baja");
ok(igual(nivelesEtiquetas([100, 150, 260], 100), [0, 1, 0]), "vuelve al primer nivel en cuanto cabe");

const gol = (seg: number, nuestro: boolean, nos: number, rival: number): GolNuevo => ({
  seg, nuestro, nos, rival, goleador: "", asistente: "", situacion: "",
  situacionOriginal: "", portero: "", enPista: [],
});
const goles = [gol(300, false, 0, 1), gol(430, true, 1, 1), gol(1500, true, 2, 1)];

console.log("── Marcador a lo largo del partido ──");
ok(igual(escalonesMarcador(goles, 2400),
  [{ seg: 0, dif: 0 }, { seg: 300, dif: -1 }, { seg: 430, dif: 0 }, { seg: 1500, dif: 1 }, { seg: 2400, dif: 1 }]),
  "un escalón por gol y hasta el final del partido");
ok(igual(escalonesMarcador([], 2400), [{ seg: 0, dif: 0 }, { seg: 2400, dif: 0 }]), "sin goles, plano en 0");
ok(igual(resumenGoles(goles, 1200), { nos: 2, rival: 1, descNos: 1, descRival: 1 }), "resumen y descanso");
ok(finEje(goles, 0) === 2400, "el eje dura 40′ como mínimo");
ok(finEje([gol(2700, true, 1, 0)], 2400) === 2730, "con prórroga, llega al último gol");

console.log("── Mapas: goles y disparos a puerta ──");
const ev = [
  { tipo: "gol", equipo: "INTER", zonaCampo: "A4", zonaPorteria: "P6" },
  { tipo: "gol", equipo: "INTER", zonaCampo: "D8", zonaPorteria: "P9" },
  { tipo: "gol", equipo: "INTER", zonaCampo: "__skip__", zonaPorteria: "" },
  { tipo: "disparo", equipo: "INTER", resultado: "PUERTA", zonaPorteria: "P6" },
  { tipo: "disparo", equipo: "INTER", resultado: "PUERTA", zonaPorteria: "P1" },
  { tipo: "disparo", equipo: "INTER", resultado: "FUERA", zonaPorteria: "P1" },
  { tipo: "disparo", equipo: "INTER", resultado: "PUERTA", zonaPorteria: "P6", golId: "g1" },
  { tipo: "penalti", equipo: "INTER", resultado: "GOL", zonaPorteria: "P2" },
  { tipo: "diezm", equipo: "INTER", resultado: "GOL", zonaPorteria: "P3", golId: "g9" },
  { tipo: "diezm", equipo: "RIVAL", resultado: "PARADA", zonaPorteria: "P5" },
  { tipo: "fsb", equipo: "RIVAL", resultado: "FUERA", zonaPorteria: "P4" },
  { tipo: "gol", equipo: "RIVAL", zonaCampo: "A1", zonaPorteria: "P7" },
  { tipo: "falta", equipo: "RIVAL", zonaCampo: "A1" },
];
const m = contarMapas(ev);
ok(m.nos.goles === 4, "goles nuestros: 3 goles + el penalti sin gol enlazado (el 10 m enlazado no repite)");
ok(igual(m.nos.campo, { A4: 1 }), "solo las zonas A1..A10 van al medio campo");
ok(m.nos.desdeSuCampo === 1, "el gol desde D8 cuenta como «desde su campo»");
ok(igual(m.nos.porteria, { P6: 1, P9: 1, P2: 1 }), "goles por cuadrante (el que no tiene cuadrante no se inventa)");
ok(m.nos.aPuerta.P6 === 2, "P6: el gol y un disparo a puerta (el enlazado al gol no cuenta dos veces)");
ok(m.nos.aPuerta.P1 === 1, "el disparo fuera NO es a puerta");
ok(m.nos.aPuertaTotal === 6, "a puerta en total, con cuadrante o sin él: 3 goles + el penalti + 2 disparos");
ok(m.rival.goles === 1 && m.rival.aPuerta.P5 === 1 && !m.rival.aPuerta.P4,
  "rival: el 10 m parado es a puerta y la FSB fuera no");
ok(m.hayDatos, "hay datos para pintar");
ok(!contarMapas([{ tipo: "gol", equipo: "INTER" }]).hayDatos, "goles sin zona → sin mapas");

console.log("── Colores ──");
ok(tinteZona(0, 3, "#0d7a4f") === "", "una zona sin gol no se tiñe");
ok(tinteZona(3, 3, "#0d7a4f") === "#0d7a4f", "la de más goles, el color entero");
ok(mezclar("#ffffff", "#000000", 0.5) === "#808080", "mezcla a medias");
ok(tintaSobre("#0d7a4f") === "#ffffff" && tintaSobre("#f7f9fc") === "#0b1b33", "letra blanca o tinta según el fondo");
ok(radioBurbuja(0, 4) === 0 && radioBurbuja(4, 4) === 34 && radioBurbuja(1, 4) < radioBurbuja(2, 4),
  "burbuja: más goles, más grande");

console.log(fallos ? `\n❌ Informe nuevo: ${fallos} fallo(s)` : "\n✅ Informe nuevo OK (0 fallos)");
if (fallos) process.exit(1);
