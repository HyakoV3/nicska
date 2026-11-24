// A vibração 3/2/1 para quem não ouve (IPSC 8.3.9.1: 3 = "Are you ready?", 2 = "Standby", 1 = sinal de partida). Só os padrões, sem tocar no aparelho.
// Um padrão é a lista do `navigator.vibrate`: vibra, pausa, vibra... (ms). Distintos entre si e das vibrações de entender (80) e cancelar ([40, 60, 40]) das batidas.

/** 3 toques curtos: "Are you ready?". */
export const PADRAO_PRONTO: readonly number[] = [90, 110, 90, 110, 90];
/** 2 toques médios: "Standby". */
export const PADRAO_STANDBY: readonly number[] = [260, 160, 260];
/** 1 toque longo: o sinal de partida. */
export const PADRAO_PARTIDA: readonly number[] = [700];
/** Pausa entre o "Are you ready?" e o "Standby" (ms). */
export const PAUSA_ENTRE_COMANDOS_MS = 700;

/** Quanto dura um padrão (ms). */
export const duracaoDoPadrao = (p: readonly number[]): number => p.reduce((s, v) => s + v, 0);

/** O aviso do Standby em 3/2/1: os 3 toques, a pausa e os 2 toques, num padrão só (um `vibrate` só, sem relógio nosso para atrasar), e quanto dura (ms). */
export function avisoTresDois(): { padrao: number[]; duracaoMs: number } {
  const padrao = [...PADRAO_PRONTO, PAUSA_ENTRE_COMANDOS_MS, ...PADRAO_STANDBY];
  return { padrao, duracaoMs: duracaoDoPadrao(padrao) };
}
