/**
 * Test de «el mismo partido en directo y en vídeo cuenta una vez» (20/11/2026).
 * Ejecutar:  node --experimental-strip-types src/lib/duplicadosVideo.test.ts
 *
 * Datos INVENTADOS: solo lo que mira la regla (config, modo, actualizado).
 */
import type { Partido } from "./db.ts";
import { mismoPartido, normalizarTexto, quitarDuplicadosVideo } from "./duplicadosVideo.ts";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); return; }
  fallos += 1;
  console.log(`  ❌ ${msg}`);
}

function partido(id: string, o: { modo?: "directo" | "video"; pid?: string; fecha: string; rival: string; act: number }): Partido {
  return {
    id, estado: "finalizado", modo: o.modo, actualizado: o.act,
    config: { partido_id: o.pid ?? "", fecha: o.fecha, rival: o.rival } as Partido["config"],
  } as Partido;
}
const ids = (ps: Partido[]) => ps.map((p) => p.id).sort().join(",");

console.log("Normalizar:");
ok(normalizarTexto(" Valdepeñas  FS ") === "valdepenas fs", "sin tildes, sin mayúsculas, espacios fuera");
ok(normalizarTexto("Jaén") === normalizarTexto("JAEN"), "Jaén = JAEN");

console.log("Directo + vídeo con el mismo partido_id:");
{
  const d = partido("d1", { modo: "directo", pid: "J5.RIVALA", fecha: "2026-10-01", rival: "Rival A", act: 1 });
  const v = partido("v1", { modo: "video", pid: "J5.RIVALA", fecha: "2026-10-02", rival: "Rival A (vídeo)", act: 2 });
  const r = quitarDuplicadosVideo([d, v]);
  ok(ids(r.cuentan) === "v1", "cuenta solo el de vídeo (aunque cambie la fecha o el texto del rival)");
  ok(ids(r.directosFuera) === "d1" && r.videosFuera.length === 0, "el directo queda fuera");
}

console.log("Sin partido_id: misma fecha y rival con tildes y mayúsculas:");
{
  const d = partido("d2", { fecha: "2026-10-08", rival: "Valdepeñas", act: 5 }); // sin modo = directo
  const v = partido("v2", { modo: "video", fecha: "2026-10-08", rival: "VALDEPENAS", act: 3 });
  const r = quitarDuplicadosVideo([d, v]);
  ok(ids(r.cuentan) === "v2", "cuenta el de vídeo aunque el directo se tocara después");
  ok(ids(r.directosFuera) === "d2", "el directo (sin campo modo) queda fuera");
  const otroDia = partido("v3", { modo: "video", fecha: "2026-10-09", rival: "Valdepeñas", act: 6 });
  ok(!mismoPartido(d, otroDia), "otra fecha = otro partido");
}

console.log("Distinto partido_id en los dos: son partidos distintos:");
{
  const a = partido("a", { modo: "directo", pid: "J1.X", fecha: "2026-10-15", rival: "X", act: 1 });
  const b = partido("b", { modo: "video", pid: "COPA.X", fecha: "2026-10-15", rival: "X", act: 2 });
  ok(quitarDuplicadosVideo([a, b]).cuentan.length === 2, "los dos cuentan");
}

console.log("Dos vídeos del mismo partido (+ su directo):");
{
  const d = partido("d4", { modo: "directo", pid: "J7.RIVALB", fecha: "2026-11-01", rival: "Rival B", act: 10 });
  const v1 = partido("v4a", { modo: "video", pid: "J7.RIVALB", fecha: "2026-11-01", rival: "Rival B", act: 20 });
  const v2 = partido("v4b", { modo: "video", fecha: "2026-11-01", rival: "rival b", act: 30 });
  const r = quitarDuplicadosVideo([v2, d, v1]);
  ok(ids(r.cuentan) === "v4b", "cuenta el vídeo modificado más tarde");
  ok(ids(r.videosFuera) === "v4a" && ids(r.directosFuera) === "d4", "el vídeo viejo y el directo, fuera");
}

console.log("Solo en directo:");
{
  const d1 = partido("s1", { modo: "directo", pid: "J8.C", fecha: "2026-11-08", rival: "C", act: 1 });
  const d2 = partido("s2", { modo: "directo", fecha: "2026-11-15", rival: "D", act: 2 });
  const r = quitarDuplicadosVideo([d1, d2]);
  ok(ids(r.cuentan) === "s1,s2" && !r.directosFuera.length && !r.videosFuera.length, "cuentan tal cual");
}

console.log("Una temporada mezclada:");
{
  const lista = [
    partido("m1", { modo: "directo", pid: "J1.A", fecha: "2026-09-01", rival: "A", act: 1 }),
    partido("m2", { modo: "video", pid: "J1.A", fecha: "2026-09-01", rival: "A", act: 2 }),
    partido("m3", { modo: "directo", fecha: "2026-09-08", rival: "Bé", act: 3 }),
    partido("m4", { modo: "directo", fecha: "2026-09-15", rival: "C", act: 4 }),
    partido("m5", { modo: "video", fecha: "2026-09-08", rival: "BE", act: 5 }),
  ];
  const r = quitarDuplicadosVideo(lista);
  ok(ids(r.cuentan) === "m2,m4,m5", "3 partidos cuentan");
  ok(r.directosFuera.length === 2, "2 directos fuera");
  ok(r.cuentan[0].id === "m2", "se respeta el orden de llegada");
}

if (fallos) { console.log(`\n❌ ${fallos} fallo(s)`); process.exit(1); }
console.log("\n✅ Todo bien");
