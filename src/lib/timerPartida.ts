// Os passos de partida de uma tentativa que não dependem do estado do Timer: sortear o atraso, abrir o microfone e fazer o aviso do Standby.
import type { PrefsTimer } from "./preferencias";
import type { Dependencias, MotivoDoErroDoTimer } from "./timerTipos";

/** Atraso sorteado entre o mínimo e o máximo (ms, inteiro); fixo se iguais. */
export function sortearAtraso({ minMs, maxMs }: { minMs: number; maxMs: number }, aleatorio: number): number {
  const min = Math.min(minMs, maxMs);
  const max = Math.max(minMs, maxMs);
  return Math.round(min + (max - min) * Math.min(0.999999, Math.max(0, aleatorio)));
}

/** Abre o microfone com os ajustes da tentativa. Devolve o motivo do erro, "obsoleta" se a tentativa já foi cancelada enquanto abria (e então solta o que abriu), ou nulo se abriu. */
export async function abrirEscuta(d: Dependencias, t: { prefs: PrefsTimer; fone: boolean; minha: number; vigente: (minha: number) => boolean }): Promise<MotivoDoErroDoTimer | "obsoleta" | null> {
  let erro: MotivoDoErroDoTimer | null = null;
  try {
    await d.escuta.iniciar({ sensibilidade: t.prefs.sensibilidade, tempoMortoMs: t.prefs.tempoMortoMs, esperarApito: !t.fone });
  } catch (e) {
    erro = d.motivoDoErro(e);
  }
  if (t.vigente(t.minha)) return erro;
  if (erro === null) d.escuta.soltar();
  return "obsoleta";
}

/** O aviso do Standby (vibração e bipe, se ligados): devolve quanto dura (ms). Se falhar, segue sem ele. */
export async function avisarSemFalha(d: Dependencias, prefs: PrefsTimer): Promise<number> {
  try {
    return Math.max(0, (await d.avisar?.(prefs)) ?? 0);
  } catch (e) {
    console.warn("timer: o aviso do Standby falhou; segue sem ele", e);
    return 0;
  }
}

/** Para a escuta e pega o áudio da tentativa; numa escuta cortada (`incompleta`) uma falha ao parar vira "sem áudio". */
export function pararEscuta(d: Dependencias, incompleta: boolean) {
  const parada = d.escuta.parar();
  return incompleta ? parada.catch(() => null) : parada;
}
