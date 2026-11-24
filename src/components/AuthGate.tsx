"use client";

/**
 * AuthGate — barrera de acceso del crono.
 *
 * Pide una contraseña al primer acceso. Si es correcta, guarda en
 * localStorage `<club>_crono_auth=1` y deja pasar en futuras visitas.
 *
 * Dos maneras de comprobarla, según el build:
 *
 *  · DEMO (y clubes con plantilla pública): hash SHA-256 de lo escrito contra
 *    PASS_HASHES_CLIENTE, como siempre. Protección anti-curioso: los nombres
 *    son inventados.
 *  · INTER, FILIAL y JUVENIL (desde el 25/11/2026): el paquete trae la
 *    plantilla CIFRADA con la contraseña (lib/plantillaCifrada.ts). La
 *    contraseña es buena si la abre; la plantilla abierta se guarda en el
 *    aparato (para funcionar sin red) y se pone en ROSTER. Ya no viaja ningún
 *    hash en el paquete.
 *
 * Aparatos que ya estaban dentro con una versión anterior (tienen el «ya
 * entré» pero no la plantilla): la primera vez tras actualizar se pide la
 * contraseña UNA vez, explicándolo. Si hay un partido a medias, se puede
 * seguir sin contraseña con los convocados de ese partido (plantilla
 * provisional) — un partido nunca se queda bloqueado por esto.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { t, useIdioma } from "@/lib/i18n";
import {
  CLIENTE, CLIENTE_ID, PASS_HASHES_CLIENTE, SOBRE_PLANTILLA,
  estadoPlantilla, instalarPlantilla,
} from "@/lib/clientes";
import { abrirSobre, guardarPlantilla, plantillaDeUnPartido, type EstadoPlantilla } from "@/lib/plantillaCifrada";
import { db, type Partido } from "@/lib/db";

// La clave de sesión es por cliente para no cruzar logins entre clubes.
// Para el Inter da "inter_crono_auth", IDÉNTICO al de antes → no desloguea.
const STORAGE_KEY = `${CLIENTE.id}_crono_auth`;

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Fase = "comprobando" | "login" | "desbloquear" | "dentro";

function yaEntro(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** El partido a medias más reciente, si lo hay (para la plantilla provisional). */
async function partidoACurso(): Promise<Partido | null> {
  try {
    const lista = await db.partidos.where("estado").equals("en_curso").toArray();
    const conGente = lista.filter((p) => (p.config?.convocados?.length ?? 0) > 0);
    conGente.sort((a, b) => (b.actualizado ?? 0) - (a.actualizado ?? 0));
    return conGente[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Comprueba una contraseña. Con plantilla cifrada, la abre, la guarda y la
 * instala. Devuelve true si es la buena.
 */
async function comprobarContrasena(pass: string): Promise<boolean> {
  if (SOBRE_PLANTILLA) {
    const jugadores = await abrirSobre(SOBRE_PLANTILLA, pass);
    if (!jugadores) return false;
    // Si el aparato no deja guardar (modo privado), vale para esta sesión.
    guardarPlantilla(CLIENTE_ID, { v: 1, huella: SOBRE_PLANTILLA.huella, jugadores, el: Date.now() });
    instalarPlantilla(jugadores);
    return true;
  }
  return PASS_HASHES_CLIENTE.includes(await sha256(pass));
}

/** Formulario de contraseña (el de entrar y el de cargar la plantilla). */
function FormContrasena({ alAcertar, boton }: { alAcertar: () => void; boton: string }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || comprobando) return;
    setComprobando(true);
    setError("");
    try {
      if (await comprobarContrasena(input.trim())) {
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // si falla, al menos dejar entrar esta sesión
        }
        alAcertar();
      } else {
        setError(t("login_incorrecta"));
        setInput("");
      }
    } catch (e: any) {
      setError(t("login_error_validar", { detalle: e?.message || e }));
    } finally {
      setComprobando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <input type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("login_placeholder")}
        autoComplete="current-password"
        autoFocus
        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-lg text-center focus:outline-none focus:border-emerald-600" />
      {error && (
        <div className="text-red-400 text-sm text-center mt-3">{error}</div>
      )}
      <button type="submit" disabled={!input.trim() || comprobando}
        className={`w-full mt-4 py-3 rounded-lg text-lg font-bold ${
          !input.trim() || comprobando
            ? "bg-zinc-700 opacity-60"
            : "bg-emerald-700 hover:bg-emerald-600"
        }`}>
        {comprobando ? t("login_comprobando") : boton}
      </button>
    </form>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  useIdioma();
  const ruta = usePathname();
  const [fase, setFase] = useState<Fase>("comprobando");
  const [estado, setEstado] = useState<EstadoPlantilla>("abierta");
  const [enCurso, setEnCurso] = useState<Partido | null>(null);
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const [avisoCerrado, setAvisoCerrado] = useState(false);

  useEffect(() => {
    const entro = yaEntro();
    if (!SOBRE_PLANTILLA) {
      setFase(entro ? "dentro" : "login");
      return;
    }
    const e = estadoPlantilla();
    setEstado(e);
    if (e !== "falta") {
      // La plantilla ya está en ROSTER (la puso clientes.ts al cargar).
      setFase("dentro");
    } else if (entro) {
      // Estaba dentro con una versión sin plantilla cifrada: pedirla una vez.
      partidoACurso().then((p) => { setEnCurso(p); setFase("desbloquear"); });
    } else {
      setFase("login");
    }
  }, []);

  const alAcertar = () => {
    setEstado(SOBRE_PLANTILLA ? estadoPlantilla() : "abierta");
    setAvisoAbierto(false);
    setFase("dentro");
  };

  const seguirSinContrasena = () => {
    if (!enCurso) return;
    const jugadores = plantillaDeUnPartido(enCurso);
    guardarPlantilla(CLIENTE_ID, { v: 1, huella: "", jugadores, provisional: true, el: Date.now() });
    instalarPlantilla(jugadores);
    setEstado("provisional");
    setFase("dentro");
  };

  // Mientras comprobamos por primera vez, no renderizar nada (evita flash de
  // login antes de que veamos que estaba autorizado).
  if (fase === "comprobando") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <span className="text-sm text-zinc-500">{t("cargando")}</span>
      </div>
    );
  }

  if (fase === "dentro") {
    // Aviso (solo en la pantalla de inicio, nunca encima de un partido): la
    // plantilla que hay es la de antes o la provisional.
    const enInicio = ruta === "/" || ruta === "";
    const hayAviso = (estado === "vieja" || estado === "provisional") && enInicio && !avisoCerrado;
    return (
      <>
        {hayAviso && (
          <div className="bg-amber-900/90 text-amber-50 text-sm px-4 py-3 flex flex-wrap items-center gap-3 justify-center">
            <span>{t(estado === "vieja" ? "plant_aviso_vieja" : "plant_aviso_provisional")}</span>
            <button onClick={() => setAvisoAbierto(true)}
              className="bg-amber-600 hover:bg-amber-500 rounded-md px-3 py-1 font-bold">
              {t("plant_aviso_boton")}
            </button>
            <button onClick={() => setAvisoCerrado(true)} className="underline opacity-80">
              {t("plant_cerrar")}
            </button>
          </div>
        )}
        {avisoAbierto && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
            <div className="bg-zinc-900 text-zinc-100 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-xl font-bold text-center mb-4">{t("plant_cargar")}</h2>
              <FormContrasena alAcertar={alAcertar} boton={t("plant_cargar")} />
              <button onClick={() => setAvisoAbierto(false)}
                className="w-full mt-3 py-2 text-sm text-zinc-400 underline">
                {t("plant_cerrar")}
              </button>
            </div>
          </div>
        )}
        {children}
      </>
    );
  }

  if (fase === "desbloquear") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 gap-6">
        <div className="bg-zinc-900 rounded-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔐</div>
            <h1 className="text-2xl font-bold">{t("plant_titulo")}</h1>
            <p className="text-sm text-zinc-400 mt-2">{t("plant_explica")}</p>
          </div>
          <FormContrasena alAcertar={alAcertar} boton={t("plant_cargar")} />
          <p className="text-xs text-zinc-600 text-center mt-6">{t("login_olvidada")}</p>
        </div>
        {enCurso && (
          <div className="bg-zinc-900 border border-amber-700 rounded-2xl p-6 w-full max-w-md text-center">
            <h2 className="text-lg font-bold text-amber-300">{t("plant_partido_titulo")}</h2>
            <p className="text-sm text-zinc-300 mt-2">
              {t("plant_partido_explica", { rival: enCurso.config?.rival || "?" })}
            </p>
            <button onClick={seguirSinContrasena}
              className="w-full mt-4 py-3 rounded-lg text-lg font-bold bg-amber-700 hover:bg-amber-600">
              {t("plant_partido_seguir")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pantalla de login
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold">{t("login_titulo", { marca: CLIENTE.marcaTitulo })}</h1>
          <p className="text-sm text-zinc-400 mt-2">
            {t("login_subtitulo")}
          </p>
        </div>
        <FormContrasena alAcertar={alAcertar} boton={t("login_entrar")} />
        <p className="text-xs text-zinc-600 text-center mt-6">
          {t("login_olvidada")}
        </p>
      </div>
    </div>
  );
}
