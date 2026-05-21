"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (offline) SOLO en producción (GitHub Pages).
 * En local (npm run dev) NO se registra, para no cachear assets de dev y
 * liarnos con el hot-reload. Si el navegador no soporta SW, no pasa nada:
 * la app sigue funcionando online.
 */
export default function SWRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return; // dev: no SW

    // La app vive bajo /arkaitz-2526/crono en producción; "" si se sirviera
    // en la raíz. Detectamos por la ruta para registrar el SW con el scope
    // correcto.
    const base = window.location.pathname.includes("/arkaitz-2526/crono")
      ? "/arkaitz-2526/crono"
      : "";
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .catch(() => {
        /* sin conexión o no soportado: la app sigue igual */
      });
  }, []);

  return null;
}
