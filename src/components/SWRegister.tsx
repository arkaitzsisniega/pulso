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
      .then((reg) => {
        // Pedir explícitamente que compruebe si hay versión nueva. iOS es
        // perezoso con esto en una app instalada: el 30/8/2026 Arkaitz cerró
        // y abrió el crono y seguía con un build de antes del 22/8.
        reg.update().catch(() => {});
      })
      .catch(() => {
        /* sin conexión o no soportado: la app sigue igual */
      });

    // Cuando el service worker NUEVO toma el control, la página que se está
    // viendo sigue siendo la vieja: hay que recargar una vez. Se hace SOLO en
    // la pantalla de inicio — recargar en mitad de un partido, aunque el
    // estado se recupere de IndexedDB, es lo último que quiere nadie con el
    // reloj corriendo.
    let recargando = false;
    const alCambiarDeSW = () => {
      if (recargando) return;
      const enInicio = window.location.pathname.replace(/\/$/, "")
        === base.replace(/\/$/, "");
      if (!enInicio) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarDeSW);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarDeSW);
    };
  }, []);

  return null;
}
