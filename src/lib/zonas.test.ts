/**
 * Test de las zonas del mapa de disparos del resumen (15/9/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/zonas.test.ts
 *
 * Un tiro que se cae del mapa no avisa: el mapa enseña uno menos y parece un
 * dato. Pasó con los goles desde nuestra propia mitad.
 */
import {
  contarPorZona, zonaMapaResumen, ZONAS_MAPA_RESUMEN, type ResultadoTiro,
} from "./zonas.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

type Tiro = { res: ResultadoTiro; zonaCampo?: string };
const enElMapa = (conteos: Record<string, { total: number }>) =>
  Object.values(conteos).reduce((a, c) => a + c.total, 0);

console.log("── Zonas del mapa del resumen ──");

// 1 · Los dos últimos goles del Cartagena (J1, 13/9/2026, versión de vídeo)
{
  // El 5-2 desde D8 y el 6-2 desde D3, a puerta vacía desde nuestro campo. El
  // mapa enseñaba el resto de tiros y estos dos no salían por ninguna parte.
  const tiros: Tiro[] = [
    { res: "GOL", zonaCampo: "A4" },
    { res: "PUERTA", zonaCampo: "A5" },
    { res: "FUERA", zonaCampo: "A8" },
    { res: "GOL", zonaCampo: "D8" },
    { res: "GOL", zonaCampo: "D3" },
  ];
  const { conteos, sinZona } = contarPorZona(tiros);
  igual([conteos.A11.GOL, conteos.A11.total], [2, 2],
        "los dos goles desde nuestra mitad salen en la zona de esa mitad");
  igual(conteos.A4.GOL, 1, "el gol desde la A4 sigue en la A4");
  igual(enElMapa(conteos) + sinZona, tiros.length,
        "el mapa y la nota de «sin zona» suman todos los tiros");
}

// 2 · Toda la mitad propia cuenta en la A11; la de ataque, cada una en la suya
{
  for (let i = 1; i <= 10; i++) {
    igual(zonaMapaResumen(`D${i}`), "A11", `D${i} cuenta en la A11`);
  }
  for (const z of ZONAS_MAPA_RESUMEN) igual(zonaMapaResumen(z), z, `${z} se queda en ${z}`);
  igual(zonaMapaResumen(" d8 "), "A11", "en minúsculas o con espacios, igual");
}

// 3 · Ningún tiro se pierde: lo que no tiene zona que pintar va a la nota
{
  // "__skip__" es lo que guarda el botón de «saltar zona» al apuntar.
  const raros = [undefined, "", "__skip__", "D0", "D11", "X3"];
  for (const z of raros) {
    igual(zonaMapaResumen(z), "", `${JSON.stringify(z)} no es una zona del mapa`);
  }
  const tiros: Tiro[] = raros.map((z) => ({ res: "FUERA", zonaCampo: z }));
  const { conteos, sinZona } = contarPorZona(tiros);
  igual([enElMapa(conteos), sinZona], [0, raros.length],
        "sin zona que pintar van todos a la nota de «sin zona», no desaparecen");
}

// 4 · El mapa recibe siempre sus 11 zonas, aunque estén a cero
{
  igual(Object.keys(contarPorZona([]).conteos), ZONAS_MAPA_RESUMEN, "las 11 zonas, en orden");
}

console.log(fallos ? `\n❌ Zonas: ${fallos} fallo(s)` : "\n✅ Zonas OK (0 fallos)");
process.exit(fallos ? 1 : 0);
