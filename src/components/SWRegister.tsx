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

    // La carpeta donde vive ESTA app, tal cual se usó al construirla. Antes se
    // adivinaba con `pathname.includes("/arkaitz-2526/crono")`, y ahí estaba el
    // fallo: "/arkaitz-2526/crono-demo" y "/arkaitz-2526/crono-filial"
    // CONTIENEN esa cadena. La demo y el filial registraban el service worker
    // DEL INTER, con el scope del Inter — que no cubre su ruta — y se quedaban
    // SIN service worker: sin funcionamiento offline, que es justo lo que su
    // guía les promete para el pabellón (visto el 30/8/2026, comprobado en la
    // web publicada: controlado = false).
    const base = (process.env.NEXT_PUBLIC_BASEPATH || "").replace(/\/$/, "");
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

    // Y AL VOLVER A LA APP. En un iPad, reabrir desde el selector de apps
    // REANUDA la página: no hay navegación, no se pide nada a la red y el
    // service worker ni se entera de que hay versión nueva. Podías cerrar y
    // abrir veinte veces y seguir con el crono de hace semanas (30/8/2026:
    // le pasó a Arkaitz con un build anterior al 22/8). Al volver a primer
    // plano se pregunta explícitamente.
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarDeSW);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return null;
}
