// A montagem do resultado de uma tentativa que terminou: o resumo dos disparos, o detector usado e o zero na linha do tempo do áudio.
import type { Tentativa } from "./escuta";
import type { PrefsTimer } from "./preferencias";
import { resumir } from "./tentativa";
import type { Instantaneo, Resultado } from "./timerTipos";

/** `zero`: o instante zero no relógio do áudio da escuta (nulo se não houve); `audio`: o que a escuta gravou. */
export function montarResultado(i: { id?: string; inicioIso: string; estado: Instantaneo; prefs: PrefsTimer; audio: Tentativa | null; zero: number | null; incompleta?: boolean }): Resultado {
  const { estado, prefs, audio, zero } = i;
  return {
    ...(i.id ? { id: i.id } : {}),
    data: i.inicioIso,
    atrasoMs: estado.atrasoMs ?? 0,
    inicio: estado.inicio ?? "estimado",
    disparosMs: estado.disparosMs,
    resumo: resumir(estado.disparosMs),
    detector: { versao: 1, sensibilidade: prefs.sensibilidade, tempoMortoMs: prefs.tempoMortoMs },
    audio,
    zeroNoAudioS: zero !== null && audio?.inicioCtx != null ? Math.max(0, zero - audio.inicioCtx) : null,
    ...(i.incompleta ? { incompleta: true } : {}),
  };
}
