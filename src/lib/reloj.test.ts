/**
 * Test del reloj del partido (16/8/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/reloj.test.ts
 *
 * Demuestra que la medida del tiempo es EXACTA (no deriva) a lo largo de
 * cientos de ciclos play/pausa, y que la presentación (cuenta atrás y momento
 * de repintado) se comporta como un marcador real.
 */
import { segundosVivos, formatCuentaAtras, msHastaSiguienteCambio, type CronoLike } from "./reloj.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`);
  else { fallos++; console.log(`  ❌ ${msg}`); }
}
function casi(a: number, b: number, eps = 1e-6) { return Math.abs(a - b) <= eps; }

// ── Simulador de play/pausa idéntico al store (misma aritmética) ────────────
function play(c: CronoLike, now: number): CronoLike {
  return c.ultimoStart != null ? c : { ...c, ultimoStart: now };
}
function pausa(c: CronoLike, now: number): CronoLike {
  if (c.ultimoStart == null) return c;
  return { segundosParte: c.segundosParte + (now - c.ultimoStart) / 1000, ultimoStart: null };
}

console.log("1) Sin deriva: 500 ciclos play/pausa con duraciones 'feas' (ms sueltos)");
{
  let c: CronoLike = { segundosParte: 0, ultimoStart: null };
  let now = 1_700_000_000_000;
  let jugadoRealMs = 0;
  // Ticks del render entre medias NO deben influir (solo leen).
  for (let i = 0; i < 500; i++) {
    c = play(c, now);
    const dJuego = 1000 + ((i * 7919) % 4321);          // 1.0-5.3 s, irregular
    for (let t = 0; t < dJuego; t += 250) segundosVivos(c, now + t); // "ticks" de lectura
    now += dJuego; jugadoRealMs += dJuego;
    c = pausa(c, now);
    now += 300 + ((i * 104729) % 2000);                  // pausa irregular
  }
  ok(casi(c.segundosParte * 1000, jugadoRealMs, 1e-3),
     `tras 500 ciclos: crono=${(c.segundosParte).toFixed(3)}s · real=${(jugadoRealMs / 1000).toFixed(3)}s`);
}

console.log("2) En vivo: el valor leído coincide con el tiempo de pared en cualquier instante");
{
  const c: CronoLike = { segundosParte: 100, ultimoStart: 5_000_000 };
  ok(casi(segundosVivos(c, 5_000_000), 100), "en el instante del play → 100.000");
  ok(casi(segundosVivos(c, 5_000_000 + 12_345), 112.345), "12,345 s después → 112.345");
  ok(casi(segundosVivos({ segundosParte: 100, ultimoStart: null }, 9_999_999), 100), "pausado → no avanza");
}

console.log("3) Cuenta atrás tipo marcador (ceil)");
{
  ok(formatCuentaAtras(1200) === "20:00", "1200 s → 20:00");
  ok(formatCuentaAtras(1199.999) === "20:00", "1199.999 s (recién arrancado) → sigue 20:00 (antes: 19:59)");
  ok(formatCuentaAtras(1199.0) === "19:59", "1199.000 s → 19:59");
  ok(formatCuentaAtras(0.4) === "00:01", "0.4 s → 00:01 (aún no ha acabado)");
  ok(formatCuentaAtras(0) === "00:00", "0 s → 00:00");
  ok(formatCuentaAtras(-3) === "00:00", "negativo → 00:00");
  ok(formatCuentaAtras(59.2) === "01:00", "59.2 s → 01:00");
}

console.log("4) Repintado en el límite exacto del segundo");
{
  // Cuenta atrás: dur 1200; llevamos 10.3 s → restan 1189.7 → el ceil cambia
  // cuando resten 1189.0 → dentro de 700 ms.
  const c: CronoLike = { segundosParte: 10.3, ultimoStart: null };
  const ms = msHastaSiguienteCambio(c, 1200, 0);
  ok(ms >= 700 && ms <= 702, `cuenta atrás: 10.3 s jugados → repintar en ~700 ms (${ms})`);
  // Transcurrido (sin dur): 10.3 → cambia al llegar a 11.0 → 700 ms.
  const ms2 = msHastaSiguienteCambio(c, 0, 0);
  ok(ms2 >= 700 && ms2 <= 702, `transcurrido: 10.3 s → repintar en ~700 ms (${ms2})`);
  // Justo en un entero: siguiente cambio dentro de ~1 s.
  const ms3 = msHastaSiguienteCambio({ segundosParte: 10, ultimoStart: null }, 1200, 0);
  ok(ms3 >= 999 && ms3 <= 1000, `en un segundo exacto → ~1000 ms (${ms3})`);
  // Nunca 0 ni negativo (evita bucles calientes)
  for (let s = 0; s < 5; s += 0.137) ok(msHastaSiguienteCambio({ segundosParte: s, ultimoStart: null }, 1200, 0) >= 1, `nunca <1 ms (s=${s.toFixed(3)})`);
}

console.log(fallos === 0 ? "\n✅ Reloj OK (0 fallos)" : `\n❌ ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
