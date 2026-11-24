/** Segundos -> "m:ss" (ex.: 75 -> "1:15"). Valores inválidos ou negativos viram "0:00". */
export function formatarTempo(segundos: number): string {
  const total = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Fração concluída entre 0 e 1 (0 se a duração for desconhecida). */
export function fracao(decorrido: number, duracao: number): number {
  if (!(duracao > 0) || !Number.isFinite(decorrido)) return 0;
  return Math.min(1, Math.max(0, decorrido / duracao));
}
