/**
 * guardadoDiferido.ts — El guardado del partido, con espera y SIN perder la
 * última escritura (20/11/2026).
 *
 * El BUG que arregla: «Finalizar partido y ver resumen» no finalizaba. El
 * partido se guarda 300 ms después del último cambio (para no escribir en cada
 * toque). Al darle al botón, el estado pasaba a «finalizado» y en el mismo
 * toque se saltaba a /resumen. Al salir de la pantalla del partido, React
 * limpiaba el temporizador del guardado pendiente… y lo CANCELABA: el
 * «finalizado» no llegaba nunca a la base del aparato. El resumen leía el
 * partido de la base, seguía «en curso», y en el inicio también. Lo mismo le
 * podía pasar a cualquier cosa apuntada justo antes de cambiar de pantalla (un
 * gol y «Inicio» en menos de 300 ms).
 *
 * La regla ahora: un guardado pendiente NUNCA se tira. Si la pantalla se va
 * (o la página se oculta) se escribe YA con lo último que había.
 *
 * Sin React ni Dexie: el temporizador y la escritura se inyectan, así se
 * prueba con node (guardadoDiferido.test.ts).
 */

export interface Temporizador {
  poner: (fn: () => void, ms: number) => unknown;
  quitar: (h: unknown) => void;
}

const TEMPORIZADOR_REAL: Temporizador = {
  poner: (fn, ms) => setTimeout(fn, ms),
  quitar: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class GuardadoDiferido<T> {
  private pendiente: T | null = null;
  private hayPendiente = false;
  private h: unknown = null;

  private readonly escribir: (valor: T) => void;
  private readonly esperaMs: number;
  private readonly tempo: Temporizador;

  constructor(escribir: (valor: T) => void, esperaMs: number,
              tempo: Temporizador = TEMPORIZADOR_REAL) {
    this.escribir = escribir;
    this.esperaMs = esperaMs;
    this.tempo = tempo;
  }

  /** Apunta `valor` para guardarlo dentro de `esperaMs` (sustituye al anterior). */
  programar(valor: T): void {
    this.pendiente = valor;
    this.hayPendiente = true;
    if (this.h != null) this.tempo.quitar(this.h);
    this.h = this.tempo.poner(() => { this.h = null; this.vaciar(); }, this.esperaMs);
  }

  /** Escribe YA lo pendiente, si lo hay (salir de la pantalla, ocultarse). */
  vaciar(): void {
    if (this.h != null) { this.tempo.quitar(this.h); this.h = null; }
    if (!this.hayPendiente) return;
    const v = this.pendiente as T;
    this.pendiente = null;
    this.hayPendiente = false;
    this.escribir(v);
  }

  /** Olvida lo pendiente SIN escribirlo. Solo para cuando lo pendiente ya no
   *  vale (iniciarPartido acaba de escribir otro partido entero). */
  descartar(): void {
    if (this.h != null) { this.tempo.quitar(this.h); this.h = null; }
    this.pendiente = null;
    this.hayPendiente = false;
  }

  /** ¿Queda algo sin escribir? */
  get pendienteDeEscribir(): boolean { return this.hayPendiente; }
}
