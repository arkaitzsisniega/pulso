/**
 * escudo.ts — Dónde está el escudo del club activo (rediseño · 18/11/2026).
 *
 * El escudo sale arriba a la izquierda en las cabeceras del aspecto NUEVO
 * (inicio, partido nuevo, directo, resumen y totales). Cada club pone el suyo
 * con una imagen en `public/escudos/` y una línea en su entrada de
 * `lib/clientes.ts` (campo `escudo`). Inter, filial y juvenil llevan el del
 * Inter; la demo, el logo de PULSO.
 *
 * Aquí solo se arma la ruta con la carpeta de cada build (`/pulso/crono`,
 * `/pulso/crono-filial`…): en GitHub Pages una ruta sin ella da 404. El
 * service worker la guarda para el modo sin conexión porque el layout la
 * precarga en todas las páginas (ver `app/layout.tsx` y `public/sw.js`).
 *
 * Ni el aspecto clásico ni el informe lo usan: el informe tiene su propia
 * marca (`lib/marca.ts` → `public/marca.png`) y sale igual que siempre.
 */

/** Une la carpeta del build y el fichero del escudo sin barras dobles. */
export function rutaEscudo(base: string, fichero: string): string {
  const b = (base || "").replace(/\/+$/, "");
  const f = fichero.replace(/^\/+/, "");
  return `${b}/${f}`;
}
