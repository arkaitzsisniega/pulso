"use client";

/**
 * SelectorIdioma — selector de idioma flotante, SOLO para la DEMO.
 *
 * Se renderiza únicamente cuando NEXT_PUBLIC_DEMO=1 (mismo interruptor que usa
 * roster.ts para los nombres falsos). En el build del Inter (sin esa variable)
 * NO se monta nada: el idioma queda fijo al de NEXT_PUBLIC_IDIOMA (es) y el
 * comportamiento es idéntico al de antes de i18n.
 *
 * Al cambiar de idioma llama a setIdioma(), que avisa a todos los componentes
 * suscritos vía useIdioma() y re-renderizan con el texto del nuevo idioma.
 */
import { IDIOMAS_DISPONIBLES, setIdioma, useIdioma, type Idioma } from "@/lib/i18n";

const ES_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export default function SelectorIdioma() {
  // Suscribe al idioma activo (re-render al cambiar).
  const idioma = useIdioma();

  // Fuera de la demo no mostramos nada (el Inter va siempre en español).
  if (!ES_DEMO) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[60] flex items-center gap-1 bg-zinc-900/90 border border-zinc-700 rounded-full px-2 py-1 shadow-lg backdrop-blur">
      {IDIOMAS_DISPONIBLES.map((op) => (
        <button
          key={op.codigo}
          onClick={() => setIdioma(op.codigo as Idioma)}
          title={op.etiqueta}
          className={`px-2.5 py-1 rounded-full text-sm font-bold transition-colors ${
            idioma === op.codigo
              ? "bg-emerald-700 text-white"
              : "text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          {op.bandera} {op.codigo.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
