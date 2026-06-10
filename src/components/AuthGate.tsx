"use client";

/**
 * AuthGate — barrera de acceso simple para el crono.
 *
 * Pide una contraseña al primer acceso. Si es correcta, guarda en
 * localStorage `inter_crono_auth=1` y deja pasar para futuras visitas.
 *
 * Seguridad: la contraseña NO se almacena en plano en el bundle.
 * Se guarda solo su hash SHA-256. Al validar, hashea el input y
 * compara. Esto evita que la contraseña aparezca literal en el JS
 * público (cualquiera con DevTools la vería).
 *
 * NOTA: esto es protección BÁSICA (anti-curioso). No es seguridad
 * criptográfica real: cualquier técnico con dev tools puede
 * setear `localStorage.inter_crono_auth = "1"` y entrar. Para más
 * seguridad habría que server-side auth, pero como es una PWA
 * estática y los datos NO son sensibles, esto es suficiente.
 */
import { useEffect, useState } from "react";
import { t, useIdioma } from "@/lib/i18n";
import { CLIENTE } from "@/lib/clientes";

// Las contraseñas válidas (hash SHA-256) salen del CLIENTE activo
// (src/lib/clientes.ts): una por club por defecto, admite varias.
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

export default function AuthGate({ children }: { children: React.ReactNode }) {
  useIdioma();
  // Estado: undefined = aún no comprobado (SSR / primer render), true = ok, false = pedir pass
  const [autorizado, setAutorizado] = useState<boolean | undefined>(undefined);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setAutorizado(true);
      } else {
        setAutorizado(false);
      }
    } catch {
      // Si localStorage no funciona (modo privado, etc.), pedir pass cada vez
      setAutorizado(false);
    }
  }, []);

  const intentarEntrar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || comprobando) return;
    setComprobando(true);
    setError("");
    try {
      const hash = await sha256(input.trim());
      if (CLIENTE.passHashes.includes(hash)) {
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // si falla, al menos dejar entrar esta sesión
        }
        setAutorizado(true);
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

  // Mientras comprobamos por primera vez, no renderizar nada (evita flash de
  // login antes de que veamos que estaba autorizado).
  if (autorizado === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <span className="text-sm text-zinc-500">{t("cargando")}</span>
      </div>
    );
  }

  if (autorizado) {
    return <>{children}</>;
  }

  // Pantalla de login
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold">{t("login_titulo")}</h1>
          <p className="text-sm text-zinc-400 mt-2">
            {t("login_subtitulo")}
          </p>
        </div>
        <form onSubmit={intentarEntrar}>
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
            {comprobando ? t("login_comprobando") : t("login_entrar")}
          </button>
        </form>
        <p className="text-xs text-zinc-600 text-center mt-6">
          {t("login_olvidada")}
        </p>
      </div>
    </div>
  );
}
