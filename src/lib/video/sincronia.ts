// Leva o tempo do <video> ao overlay, quadro a quadro, sem o overlay depender do elemento (o mesmo overlay vai servir ao vídeo importado, I-04).
// Tocando: `requestVideoFrameCallback` quando existe (o `mediaTime` é o do quadro que está NA TELA, o encaixe mais justo); senão um laço de
// `requestAnimationFrame` lendo `currentTime`. Parado: `timeupdate`/`seeked` bastam (arrastar a barra, pular a um disparo). O laço só roda enquanto o
// vídeo toca e é SEMPRE cancelado ao pausar, ao terminar e ao desligar, para não gastar bateria com o vídeo parado ou fora da tela.

type QuadroDoVideo = (agora: number, meta: { mediaTime: number }) => void;
/** O que se usa do <video> (o elemento de verdade, ou um falso nos testes). */
export type ElementoDeVideo = Pick<HTMLVideoElement, "currentTime" | "paused" | "addEventListener" | "removeEventListener"> & {
  requestVideoFrameCallback?: (cb: QuadroDoVideo) => number;
  cancelVideoFrameCallback?: (h: number) => void;
};
/** Pedir e cancelar quadros de animação (os do navegador, ou falsos nos testes). */
export type Quadros = { pedir: (cb: () => void) => number; cancelar: (h: number) => void };
export type AoTempo = (tempoS: number) => void;

const quadrosDoNavegador: Quadros = { pedir: (cb) => requestAnimationFrame(cb), cancelar: (h) => cancelAnimationFrame(h) };

/** Eventos em que o vídeo pode ter mudado de lugar sem estar tocando (ou acabou de parar): lê o `currentTime` uma vez. */
const EVENTOS_DE_LEITURA = ["timeupdate", "seeked", "seeking", "loadedmetadata", "pause", "ended"] as const;

class Sincronia {
  /** O pedido de quadro em andamento (de um dos dois tipos), ou nulo com o laço parado. */
  private pedido: { h: number; doVideo: boolean } | null = null;
  private readonly ler = () => this.aoTempo(this.el.currentTime);
  private readonly tocar = () => this.comecar();
  private readonly parar = () => this.cancelar();

  constructor(
    private readonly el: ElementoDeVideo,
    private readonly aoTempo: AoTempo,
    private readonly quadros: Quadros,
  ) {}

  ligar(): void {
    for (const e of EVENTOS_DE_LEITURA) this.el.addEventListener(e, this.ler);
    this.el.addEventListener("play", this.tocar);
    this.el.addEventListener("pause", this.parar);
    this.el.addEventListener("ended", this.parar);
    this.ler();
    if (!this.el.paused) this.comecar();
  }

  desligar(): void {
    this.cancelar();
    for (const e of EVENTOS_DE_LEITURA) this.el.removeEventListener(e, this.ler);
    this.el.removeEventListener("play", this.tocar);
    this.el.removeEventListener("pause", this.parar);
    this.el.removeEventListener("ended", this.parar);
  }

  /** Pede o próximo quadro (se o laço ainda não está pedindo). */
  private comecar(): void {
    if (this.pedido) return;
    const rvfc = this.el.requestVideoFrameCallback;
    if (rvfc) this.pedido = { h: rvfc.call(this.el, this.aoQuadroDoVideo), doVideo: true };
    else this.pedido = { h: this.quadros.pedir(this.aoQuadro), doVideo: false };
  }

  private readonly aoQuadroDoVideo: QuadroDoVideo = (_agora, meta) => {
    this.pedido = null;
    this.aoTempo(meta.mediaTime);
    if (!this.el.paused) this.comecar();
  };

  private readonly aoQuadro = () => {
    this.pedido = null;
    this.ler();
    if (!this.el.paused) this.comecar();
  };

  private cancelar(): void {
    if (!this.pedido) return;
    if (this.pedido.doVideo) this.el.cancelVideoFrameCallback?.call(this.el, this.pedido.h);
    else this.quadros.cancelar(this.pedido.h);
    this.pedido = null;
  }
}

/** Passa a mandar o tempo do vídeo (s) a `aoTempo` e devolve a função que desliga tudo (laço e eventos). */
export function acompanharVideo(el: ElementoDeVideo, aoTempo: AoTempo, quadros: Quadros = quadrosDoNavegador): () => void {
  const s = new Sincronia(el, aoTempo, quadros);
  s.ligar();
  return () => s.desligar();
}
