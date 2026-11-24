// As peças do navegador que a escuta usa (AudioContext, AudioWorkletNode, MediaRecorder, getUserMedia, DOMException), atrás de uma interface:
// a `Escuta` recebe as fábricas e não instancia nada concreto, e os testes entregam falsos. `fabricasDoNavegador` são as de verdade.
import { BITS_POR_SEGUNDO, escolherFormato } from "./audioComum";
import type { OpcoesDetector } from "./detector";

export interface Fabricas {
  /** O navegador sabe abrir o microfone? */
  temMicrofone(): boolean;
  /** O contexto de áudio (nasce no toque, não depois da espera pela permissão). */
  contexto(): AudioContext;
  /** O microfone CRU: sem cancelamento de eco, supressão de ruído nem ganho automático, mono. */
  abrirMicrofone(): Promise<MediaStream>;
  /** O nó do worklet que roda o detector. */
  no(ctx: AudioContext, opcoes: Partial<OpcoesDetector>): AudioWorkletNode;
  /** O gravador do fluxo, ou nulo se o aparelho não grava. `tipo`: o formato escolhido. */
  gravador(fluxo: MediaStream): { gravador: MediaRecorder; tipo: string } | null;
  erro(mensagem: string, nome: string): Error;
}

export const fabricasDoNavegador: Fabricas = {
  temMicrofone: () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
  contexto: () => new AudioContext({ latencyHint: "interactive" }),
  abrirMicrofone: () =>
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    }),
  no: (ctx, opcoes) =>
    new AudioWorkletNode(ctx, "nicska-detector", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { opcoes },
    }),
  gravador: (fluxo) => {
    if (typeof MediaRecorder === "undefined") return null;
    const preferido = escolherFormato((t) => MediaRecorder.isTypeSupported(t));
    const gravador = preferido
      ? new MediaRecorder(fluxo, { mimeType: preferido, audioBitsPerSecond: BITS_POR_SEGUNDO })
      : new MediaRecorder(fluxo, { audioBitsPerSecond: BITS_POR_SEGUNDO });
    return { gravador, tipo: gravador.mimeType || preferido || "" };
  },
  erro: (mensagem, nome) => new DOMException(mensagem, nome),
};
