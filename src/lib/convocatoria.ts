// Convocatoria habitual de un partido (Arkaitz, 18/11/2026): si no son 14 se
// AVISA, pero no se impide (12, 15 o 16 se pueden convocar).
export const CONVOCATORIA_HABITUAL = 14;

export function avisoConvocatoria(n: number): boolean {
  return n > 0 && n !== CONVOCATORIA_HABITUAL;
}
