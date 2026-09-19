/**
 * Test de la geometría del campo (18/9/2026, flecha del pase de gol).
 * Ejecutar:  node --experimental-strip-types src/lib/geometriaCampo.test.ts
 *
 * La flecha guarda puntos y la zona se calcula de ellos. Si el cálculo no
 * casa con el dibujo, el pase sale de "A4" cuando se tocó el área, y eso no
 * avisa: parece un dato.
 */
import { readFileSync } from "node:fs";
import {
  aCanonico, flechaSuficiente, largoFlechaM, normalizar, zonaDePunto, zonasDeFlecha,
  W, H,
} from "./geometriaCampo.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}
function igual(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`);
}

/** Zona de un punto dado en píxeles del dibujo (800 × 400, ataque a la derecha). */
const zonaPx = (px: number, py: number) => zonaDePunto(px / W, py / H);

console.log("── Geometría del campo ──");

// 1 · Un punto de dentro de cada una de las 20 zonas
{
  // En píxeles del dibujo de `Campo`, con el ataque a la derecha. No valen los
  // centros de las cajas: la 4 y la 5 envuelven el área y el centro de su caja
  // cae dentro de ella.
  const DENTRO: Record<string, [number, number]> = {
    A1: [760, 185], A2: [760, 215],     // el área, mitad de arriba y de abajo
    A3: [700, 25], A6: [700, 375],      // bandas de los primeros 10 m
    A4: [640, 120], A5: [640, 280],     // centro de los primeros 10 m
    A7: [500, 25], A10: [500, 375],     // bandas de los segundos 10 m
    A8: [500, 120], A9: [500, 280],     // centro de los segundos 10 m
  };
  for (const [zona, [px, py]] of Object.entries(DENTRO)) {
    igual(zonaPx(px, py), zona, `${zona} en su sitio`);
    // la misma zona de nuestra mitad es su espejo horizontal
    const d = zona.replace("A", "D");
    igual(zonaPx(W - px, py), d, `${d} en su sitio (espejo de ${zona})`);
  }
}

// 2 · El área tiene la forma de verdad: cuartos de círculo de 6 m desde los postes
{
  igual(zonaPx(720, 100), "A1", "dentro del arco de arriba (a 5,3 m del poste) es área");
  igual(zonaPx(690, 100), "A4", "fuera del arco (a 6,5 m del poste) ya no es área, aunque esté a 5,5 m del fondo");
  igual(zonaPx(690, 300), "A5", "lo mismo abajo");
  igual(zonaPx(690, 190), "A1", "entre los postes el área es la recta de 6 m");
  igual(zonaPx(670, 190), "A4", "y medio metro más allá, fuera");
  igual(zonaPx(799, 55), "A1", "el arco llega hasta la banda de 2,5 m pegado al fondo");
}

// 3 · Las rayas: gana la zona que el dibujo pinta encima (la que se lleva el toque)
{
  igual(zonaPx(400, 120), "A8", "en la línea de medio campo, la mitad del rival");
  igual(zonaPx(600, 120), "A8", "en la raya de 10 m, la de los segundos 10 m");
  igual(zonaPx(700, 50), "A4", "en la raya de la banda, el centro");
  igual(zonaPx(500, 200), "A9", "en la raya del centro, la de abajo");
}

// 4 · Espejo A ↔ D en toda la cuadrícula (menos la raya de medio campo exacta)
{
  let distintos = 0;
  let mirados = 0;
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 20; j++) {
      const x = (i + 0.37) / 40;
      const y = (j + 0.29) / 20;
      const a = zonaDePunto(x, y);
      const b = zonaDePunto(1 - x, y);
      const espejo = (z: string) => (z.startsWith("A") ? "D" : "A") + z.slice(1);
      mirados += 1;
      if (b !== espejo(a)) distintos += 1;
    }
  }
  igual(distintos, 0, `las dos mitades son espejo una de la otra (${mirados} puntos)`);
}

// 5 · El giro de la 2ª parte
{
  // En la 1T atacamos a la derecha y el dibujo va derecho; en la 2T se gira
  // 180°. El mismo sitio del campo se ve en (px, py) en la 1T y en
  // (800 − px, 400 − py) en la 2T: tiene que dar el MISMO punto guardado.
  const toques: [number, number][] = [[520, 80], [760, 185], [120, 330], [401, 199]];
  for (const [px, py] of toques) {
    igual(aCanonico(W - px, H - py, "izq"), aCanonico(px, py, "der"),
          `(${px}, ${py}) en la 1T = su giro en la 2T`);
  }
  // Una flecha entera: la de la 2T girada es la misma que la de la 1T.
  const f1 = { ...pref("x0", "y0", aCanonico(560, 90, "der")), ...pref("x1", "y1", aCanonico(740, 180, "der")) };
  const f2 = { ...pref("x0", "y0", aCanonico(240, 310, "izq")), ...pref("x1", "y1", aCanonico(60, 220, "izq")) };
  igual(f2, f1, "la flecha de la 2T, deshecho el giro, es la de la 1T");
  igual(zonasDeFlecha(f1), { origen: "A8", destino: "A1" }, "y sus zonas salen de los puntos");
  // En la 2T, lo que se ve a la derecha de la pantalla es NUESTRA portería.
  igual(zonaDePunto(aCanonico(790, 200, "izq").x, aCanonico(790, 200, "izq").y), "D2",
        "2T: tocar al lado de la portería de la derecha es nuestra área");
  igual(aCanonico(0, 0, "der"), { x: 0, y: 0 }, "esquina de arriba a la izquierda en la 1T: (0, 0)");
  igual(aCanonico(0, 0, "izq"), { x: 1, y: 1 }, "la misma esquina de la pantalla en la 2T: (1, 1)");
}

// 6 · Se guarda con 3 decimales y dentro del campo
{
  igual(normalizar(0.123456), 0.123, "3 decimales");
  igual(normalizar(-0.2), 0, "lo que se sale por un lado vuelve a la raya");
  igual(normalizar(1.7), 1, "y por el otro");
  igual(aCanonico(812, -10, "der"), { x: 1, y: 0 }, "un dedo que se sale del dibujo no guarda un punto fuera del campo");
}

// 7 · Una flecha de menos de 1 m no es un pase
{
  ok(!flechaSuficiente({ x0: 0.5, y0: 0.5, x1: 0.5225, y1: 0.5 }), "0,9 m a lo largo: no");
  ok(flechaSuficiente({ x0: 0.5, y0: 0.5, x1: 0.525, y1: 0.5 }), "1 m a lo largo: sí");
  ok(!flechaSuficiente({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.54 }), "0,8 m a lo ancho: no");
  ok(flechaSuficiente({ x0: 0.5, y0: 0.5, x1: 0.5, y1: 0.55 }), "1 m a lo ancho: sí");
  ok(!flechaSuficiente(null), "sin flecha: no");
  ok(!flechaSuficiente({ x0: 0.1, y0: NaN, x1: 0.9, y1: 0.5 } as never), "con un número roto: no");
  igual(Math.round(largoFlechaM({ x0: 0, y0: 0, x1: 1, y1: 1 }) * 100) / 100, 44.72,
        "de esquina a esquina, la diagonal de 40 × 20");
}

// 8 · Las medidas son las de Campo.tsx
{
  // Se copian para poder probar sin React; si alguien toca el dibujo y no esto,
  // las zonas de la flecha dejarían de ser las del dibujo sin avisar.
  const leer = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const constantes = (fuente: string) => {
    const out: Record<string, string> = {};
    for (const m of fuente.matchAll(/^export const (\w+) = ([^;]+);/gm)) out[m[1]] = m[2].trim();
    return out;
  };
  const campo = constantes(leer("../components/Campo.tsx"));
  const aqui = constantes(leer("./geometriaCampo.ts"));
  const NOMBRES = ["M", "W", "H", "POSTE_SUP_Y", "POSTE_INF_Y", "R_AREA",
                   "BANDA_SUP_Y", "BANDA_INF_Y", "X_MEDIA", "Y_CENTRO"];
  for (const n of NOMBRES) {
    ok(campo[n] !== undefined && campo[n] === aqui[n], `${n}: ${aqui[n]} (Campo.tsx: ${campo[n]})`);
  }
  const campoTxt = leer("../components/Campo.tsx");
  ok(campoTxt.includes("const X10 = der ? W - 10 * M : 10 * M;"), "la raya de 10 m está donde la calcula esto");
  ok(campoTxt.includes("const XAREA = der ? W - R_AREA : R_AREA;"), "y la recta del área también");
}

function pref(kx: string, ky: string, p: { x: number; y: number }) {
  return { [kx]: p.x, [ky]: p.y } as Record<string, number>;
}

console.log(fallos ? `\n❌ Geometría: ${fallos} fallo(s)` : "\n✅ Geometría OK (0 fallos)");
process.exit(fallos ? 1 : 0);
