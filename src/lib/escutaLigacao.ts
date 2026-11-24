// A ligação do microfone ao detector: fluxo → nó do worklet → ganho zero → destino, as mensagens do worklet e o olho nas quedas (trilha que acaba, contexto que sai de `running`).
import type { TipoEvento } from "./detector";

export type Mensagem = { t: "evento"; tipo: TipoEvento; quadro: number } | { t: "envelope"; picos: number[] };

export type Ligacao = {
  ctx: AudioContext;
  fluxo: MediaStream;
  no: AudioWorkletNode;
  /** Chamado a cada mensagem do worklet. */
  aoMensagem: (m: Mensagem) => void;
  /** O microfone ou o áudio caíram. */
  aoInterromper: () => void;
  /** A escuta ainda é esta (uma mudança de estado de um contexto já solto não conta como queda). */
  ativa: () => boolean;
};

export function ligarDetector(l: Ligacao): void {
  const { ctx, fluxo, no } = l;
  no.port.onmessage = (e: MessageEvent<Mensagem>) => l.aoMensagem(e.data);
  // O worklet só roda se a saída dele chega ao destino; um ganho zero o liga sem fazer o microfone tocar no alto-falante.
  const mudo = ctx.createGain();
  mudo.gain.value = 0;
  ctx.createMediaStreamSource(fluxo).connect(no).connect(mudo).connect(ctx.destination);
  fluxo.getTracks().forEach((t) => t.addEventListener("ended", l.aoInterromper));
  ctx.onstatechange = () => {
    if (ctx.state !== "running" && l.ativa()) l.aoInterromper();
  };
}
