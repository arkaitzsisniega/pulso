import type { NextConfig } from "next";
import { rosterParaBuild } from "./cargarRoster.mjs";

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
if (plantilla.jugadores) {
  console.log(`  Plantilla «${plantilla.cliente}»: ${plantilla.jugadores.length} jugadores (${plantilla.origen.startsWith("variable") ? plantilla.origen : "fichero local"})`);
}

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,            // GH Pages sirve mejor /ruta/index.html
  images: { unoptimized: true },  // requerido por output: export
  // Next cambia cada `process.env.CRONO_ROSTER_PRIVADO` del código por este
  // texto al construir (lo lee src/lib/clientes.ts). En la demo va vacío.
  env: {
    CRONO_ROSTER_PRIVADO: JSON.stringify(plantilla.jugadores ?? []),
  },
};

export default nextConfig;
