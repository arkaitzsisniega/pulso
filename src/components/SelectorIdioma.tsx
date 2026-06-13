"use client";

/**
 * SelectorIdioma — selector de idioma flotante.
 *
 * Se renderiza únicamente cuando el cliente NO fija idioma
 * (CLIENTE.idiomaFijo === null), es decir, en la demo multi-idioma. En el build
 * del Inter (idiomaFijo = "es") NO se monta nada: el idioma queda fijo y el
 * comportamiento es idéntico al de antes de i18n.
 *
 * Al cambiar de idioma llama a setIdioma(), que avisa a todos los componentes
 * suscritos vía useIdioma() y re-renderizan con el texto del nuevo idioma.
 */
import { IDIOMAS_DISPONIBLES, setIdioma, useIdioma, type Idioma } from "@/lib/i18n";
import { CLIENTE } from "@/lib/clientes";

// Solo se muestra si el cliente no fija idioma (demo). El Inter va fijo en "es".
const MOSTRAR_SELECTOR = CLIENTE.idiomaFijo === null;

export default function SelectorIdioma() {
  // Suscribe al idioma activo (re-render al cambiar).
  const idioma = useIdioma();

  // Cliente con idioma fijo (Inter): no mostramos nada.
  if (!MOSTRAR_SELECTOR) return null;

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
