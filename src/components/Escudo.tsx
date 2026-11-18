"use client";

/**
 * Escudo.tsx — El escudo del club activo, para las cabeceras del aspecto
 * NUEVO. La imagen y su ruta salen de `CLIENTE.escudo` (lib/clientes.ts) y
 * `lib/escudo.ts`. El tamaño lo pone quien lo usa (clase CSS): la imagen se
 * ajusta dentro sin deformarse, sea un escudo alto o un logo apaisado.
 */
import { CLIENTE } from "@/lib/clientes";
import { rutaEscudo } from "@/lib/escudo";

export const RUTA_ESCUDO = rutaEscudo(process.env.NEXT_PUBLIC_BASEPATH || "", CLIENTE.escudo);

export function Escudo(props: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- export estático, sin optimizador de imágenes
    <img src={RUTA_ESCUDO} alt={CLIENTE.nombreLargo} draggable={false}
      className={`pz-escudo ${props.className ?? ""}`} />
  );
}
