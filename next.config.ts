import type { NextConfig } from "next";
import { rosterParaBuild } from "./cargarRoster.mjs";
import { sobreParaBuild } from "./cifrarPlantilla.mjs";

// Export estático condicional para desplegar en GitHub Pages.
// Sólo se activa cuando NEXT_EXPORT=1 (lo usa el workflow / build manual).
// En dev (`npm run dev`) sigue siendo el server completo normal.
const isExport = process.env.NEXT_EXPORT === "1";
const basePath = isExport ? (process.env.CRONO_BASEPATH || "/pulso/crono") : "";

// Plantilla PRIVADA del club que se construye (24/11/2026). No está en el
// código: sale de un secreto de GitHub Actions o de un fichero local ignorado
// por git (ver cargarRoster.mjs). Si falta para el Inter, el filial o el
// juvenil, esto LANZA y el build no empieza. La demo no necesita nada.
const plantilla = rosterParaBuild();
// Y desde el 25/11/2026 entra CIFRADA con la contraseña del club (ver
// cifrarPlantilla.mjs): en los ficheros publicados no queda ningún nombre en
// claro. Sin contraseña (o con una que no es la del club) esto también LANZA.
const sobre = sobreParaBuild(plantilla);
if (plantilla.jugadores) {
  console.log(`  Plantilla «${plantilla.cliente}»: ${plantilla.jugadores.length} jugadores, CIFRADA (${plantilla.origen.startsWith("variable") ? plantilla.origen : "fichero local"})`);
}

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,            // GH Pages sirve mejor /ruta/index.html
  images: { unoptimized: true },  // requerido por output: export
  // Next cambia cada `process.env.CRONO_ROSTER_CIFRADO` del código por este
  // texto al construir (lo lee src/lib/clientes.ts): el SOBRE cifrado, nunca la
  // plantilla en claro. En la demo va vacío.
  env: {
    CRONO_ROSTER_CIFRADO: sobre,
  },
};

export default nextConfig;
