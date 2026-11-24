// O encaixe entre a linha do tempo do ÁUDIO (onde o detector acha o apito e os disparos) e a do VÍDEO (outro gravador, que começa depois: a câmera só abre
// depois do microfone). Os dois começos são medidos no mesmo relógio (`performance.now()`, logo depois de cada `start()`); a diferença fica na meta do vídeo
// (`inicioDoVideoMs`). Um instante t no áudio é, no vídeo, t - inicioDoVideoMs. A medida é do pedido de início, não do primeiro quadro: o desvio que sobra
// (o codificador do aparelho) só se confirma no celular e não afeta o tempo medido, só onde o vídeo para ao tocar numa marca.

/** O instante `instanteNoAudioS` (s desde o começo do áudio) no vídeo (s desde o começo dele). Antes de o vídeo começar, fica no começo (0). */
export function instanteNoVideoS(instanteNoAudioS: number, inicioDoVideoMs = 0): number {
  const s = instanteNoAudioS - inicioDoVideoMs / 1000;
  return Number.isFinite(s) ? Math.max(0, s) : 0;
}

/** Onde está o zero e de quanto o vídeo vem atrasado: o bastante para levar qualquer disparo (ms desde o apito) ao vídeo. */
export type Encaixe = { zeroNoAudioS: number; inicioDoVideoMs: number };

/** O disparo `disparoMs` (ms desde o apito) no vídeo (s); `disparoMs` 0 é o próprio apito. */
export const disparoNoVideoS = (e: Encaixe, disparoMs: number): number => instanteNoVideoS(e.zeroNoAudioS + disparoMs / 1000, e.inicioDoVideoMs);

/**
 * O apito no vídeo (s), SEM prender no começo: o overlay mede tudo a partir dele, e um zero de antes do vídeo começar (apito antes da câmera abrir)
 * preso em 0 adiantaria todos os tempos. Negativo quer dizer "o apito tocou antes do primeiro quadro". Valores inválidos valem 0.
 */
export function zeroNoVideoS(e: Encaixe): number {
  const s = e.zeroNoAudioS - e.inicioDoVideoMs / 1000;
  return Number.isFinite(s) ? s : 0;
}

/** O deslocamento a guardar: quanto depois do áudio o vídeo começou (ms, nunca negativo; sem o início do áudio, 0 = como as metas antigas). */
export function deslocamentoDoVideoMs(inicioDoAudioMs: number | undefined, inicioDoVideoMs: number): number {
  if (inicioDoAudioMs === undefined || !Number.isFinite(inicioDoAudioMs) || !Number.isFinite(inicioDoVideoMs)) return 0;
  return Math.max(0, Math.round(inicioDoVideoMs - inicioDoAudioMs));
}
