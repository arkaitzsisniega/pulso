import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./tema-nuevo.css";
import AuthGate from "@/components/AuthGate";
import SWRegister from "@/components/SWRegister";
import SelectorIdioma from "@/components/SelectorIdioma";
import { CLIENTE } from "@/lib/clientes";
import { rutaEscudo } from "@/lib/escudo";
import { ficheroEscudoInforme } from "@/lib/marca";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Letras del aspecto NUEVO del crono (rediseño 16/11/2026). Van DENTRO de la
// app (src/fonts, licencia OFL), no se piden a internet: el crono tiene que
// funcionar en un pabellón sin cobertura. Solo declaran sus variables CSS; el
// aspecto clásico no las usa y se ve exactamente igual que antes.
const barlow = localFont({
  src: [
    { path: "../fonts/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});
const interTexto = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

// Cuando se hace `output: 'export'` con basePath, Next NO prefija
// automáticamente los paths absolutos de manifest/iconos en `metadata`.
// Hay que añadir el prefijo a mano (en dev no hay prefijo, queda igual).
const BP = process.env.NEXT_EXPORT === "1" ? (process.env.CRONO_BASEPATH || "/pulso/crono") : "";

// Cada cliente referencia su propio manifest (mismas rutas relativas, solo
// cambia el nombre del PWA al instalarlo). El Inter mantiene "manifest.json"
// intacto; los demás usan "manifest-<id>.json" (p.ej. la demo → manifest-pulso.json).
const MANIFEST = `${BP}/manifest${CLIENTE.id === "inter" ? "" : `-${CLIENTE.id}`}.json`;

// Icono de la pantalla de inicio («Añadir a pantalla de inicio» en Safari).
// Desde el 23/11/2026 TODOS los clientes (inter, filial, juvenil y la demo)
// llevan el emblema de PULSO con un pequeño cronómetro (decisión de Arkaitz:
// «la web y el crono van con el icono de PULSO»). public/icons-pulso/, fondo
// blanco opaco: iOS pinta de negro lo transparente. Los cuatro manifest
// apuntan a la misma carpeta.
const ICONOS = `${BP}/icons-pulso`;
const APPLE_TOUCH = `${ICONOS}/icon-180.png`;

export const metadata: Metadata = {
  title: CLIENTE.appTitulo,
  description: `Crono de partido en directo para el cuerpo técnico de ${CLIENTE.nombreLargo}`,
  manifest: MANIFEST,
  appleWebApp: {
    capable: true,
    title: CLIENTE.appTitulo,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: `${ICONOS}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${ICONOS}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: APPLE_TOUCH, sizes: "180x180", type: "image/png" },
      { url: `${ICONOS}/icon-152.png`, sizes: "152x152", type: "image/png" },
      { url: `${ICONOS}/icon-167.png`, sizes: "167x167", type: "image/png" },
      { url: `${ICONOS}/icon-180.png`, sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1B5E20",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} ${interTexto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* El escudo del club (cabeceras del aspecto nuevo). Precargado en
            TODAS las páginas para que el service worker lo guarde al instalarse
            (busca en el HTML las rutas de /escudos/) y salga sin conexión. React
            lo sube al <head>. */}
        <link rel="preload" as="image" href={rutaEscudo(BP, CLIENTE.escudo)} />
        {/* Y el del informe del partido, si el club tiene uno aparte para el
            papel (el Inter: el verde). Mismo motivo: que el informe lo pinte
            sin conexión. La demo lleva marca.png, que el service worker guarda
            al instalarse. */}
        {!CLIENTE.demo && ficheroEscudoInforme(CLIENTE) !== CLIENTE.escudo && (
          <link rel="preload" as="image" href={rutaEscudo(BP, ficheroEscudoInforme(CLIENTE))} />
        )}
        <SWRegister />
        <AuthGate>{children}</AuthGate>
        <SelectorIdioma />
      </body>
    </html>
  );
}
