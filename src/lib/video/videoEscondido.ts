// O <video> escondido que os dois motores de exportação (V3) tocam para ler os quadros: o próprio navegador decodifica o WebM (sem índice, C6, o pulo é ruim;
// tocar de ponta a ponta não depende dele) e o `requestVideoFrameCallback` entrega cada quadro com o `mediaTime` (o tempo DO QUADRO no vídeo, o mesmo
// encaixe que o player usa em sincronia.ts). Com o app escondido não chegam quadros: o vídeo pausa e retoma ao voltar (a janela pede para ficar aberto).
// Tudo que se abre aqui (URL de objeto, elemento) se solta em `soltar`, inclusive se a exportação foi cancelada ou falhou.
import { conferirSinal } from "./exportacao";

type QuadroDoVideo = (agora: number, meta: { mediaTime: number }) => void;
type VideoComQuadros = HTMLVideoElement & { requestVideoFrameCallback(cb: QuadroDoVideo): number; cancelVideoFrameCallback(h: number): void };
export type VideoEscondido = { el: VideoComQuadros; largura: number; altura: number; duracaoS: number | null; soltar: () => void };

/** Sem quadro novo por este tempo com o vídeo tocando e o app à vista, a exportação desiste (em vez de ficar presa para sempre). */
const ESPERA_MAXIMA_MS = 15_000;

/** Abre o vídeo num <video> fora da tela, mudo ou não (o motor B precisa do som pelo WebAudio), e espera os metadados. */
export async function abrirVideoEscondido(blob: Blob, mudo: boolean, sinal: AbortSignal): Promise<VideoEscondido> {
  const url = URL.createObjectURL(blob);
  const el = document.createElement("video") as VideoComQuadros;
  const soltar = () => {
    el.pause();
    el.removeAttribute("src");
    el.load(); // solta o decodificador do elemento já, sem esperar o coletor
    URL.revokeObjectURL(url);
  };
  Object.assign(el, { muted: mudo, playsInline: true, preload: "auto", src: url });
  try {
    await esperarEvento(el, "loadedmetadata", sinal);
    if (!el.videoWidth || !el.videoHeight) throw new Error("exportar: vídeo sem imagem");
    const duracaoS = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
    return { el, largura: el.videoWidth, altura: el.videoHeight, duracaoS, soltar };
  } catch (e) {
    soltar();
    throw e;
  }
}

/** Espera um evento do elemento; `error` do elemento ou o cancelamento rejeitam. */
function esperarEvento(el: HTMLVideoElement, nome: string, sinal: AbortSignal): Promise<void> {
  return new Promise((ok, falha) => {
    const fim = (f: () => void) => () => {
      el.removeEventListener(nome, bom);
      el.removeEventListener("error", ruim);
      sinal.removeEventListener("abort", parou);
      f();
    };
    const bom = fim(ok);
    const ruim = fim(() => falha(new Error(`exportar: o vídeo não abriu (${el.error?.code ?? "?"})`)));
    const parou = fim(() => falha(new DOMException("exportação cancelada", "AbortError")));
    el.addEventListener(nome, bom, { once: true });
    el.addEventListener("error", ruim, { once: true });
    sinal.addEventListener("abort", parou, { once: true });
  });
}

/** Um quadro novo: o motor desenha/codifica e, se devolver uma promessa (fila cheia), o vídeo pausa até ela cumprir. */
export type AoQuadro = (mediaTimeS: number) => void | Promise<void>;
/** Avisos ao motor quando o vídeo pausa (app escondido, fila cheia) e retoma: o motor B pausa e retoma o gravador junto. */
export type AoPausar = { pausou?: () => void; retomou?: () => void };

/** Toca o vídeo do começo ao fim, chamando `aoQuadro` a cada quadro novo; cumpre no `ended`. Cancelar, erro do elemento ou travar rejeitam. */
export function tocarAteOFim(v: VideoEscondido, aoQuadro: AoQuadro, sinal: AbortSignal, avisos: AoPausar = {}): Promise<void> {
  conferirSinal(sinal);
  return new Promise((ok, falha) => new Tocador(v.el, { aoQuadro, avisos, sinal, ok, falha }).comecar());
}

type Fim = { aoQuadro: AoQuadro; avisos: AoPausar; sinal: AbortSignal; ok: () => void; falha: (e: unknown) => void };

/** O laço de quadros de uma exportação: pede quadros, pausa ao esconder ou com a fila cheia, desiste se travar, e sempre solta os eventos ao terminar. */
class Tocador {
  private pedido: number | null = null;
  private esperando = false;
  private acabou = false;
  private ultimo = -1;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private visto = Date.now();
  private readonly aoEsconder = () => (document.hidden ? this.pausar() : this.retomar());
  private readonly aoFim = () => this.terminar(null);
  private readonly aoErro = () => this.terminar(new Error(`exportar: o vídeo falhou ao tocar (${this.el.error?.code ?? "?"})`));
  private readonly aoAbortar = () => this.terminar(new DOMException("exportação cancelada", "AbortError"));

  constructor(
    private readonly el: VideoComQuadros,
    private readonly f: Fim,
  ) {}

  comecar(): void {
    this.el.addEventListener("ended", this.aoFim);
    this.el.addEventListener("error", this.aoErro);
    this.f.sinal.addEventListener("abort", this.aoAbortar);
    document.addEventListener("visibilitychange", this.aoEsconder);
    this.relogio = setInterval(() => this.vigiar(), 1000);
    this.pedir();
    this.el.currentTime = 0;
    if (!document.hidden) this.tocar();
  }

  private tocar(): void {
    this.visto = Date.now();
    // Um `pause()` logo depois (fila cheia, app escondido) rejeita o `play()` com AbortError: não é falha nem cancelamento, só a pausa (o cancelar vem pelo sinal).
    this.el.play().catch((e) => (e instanceof DOMException && e.name === "AbortError" ? undefined : this.terminar(e)));
  }

  private pedir(): void {
    if (!this.acabou && this.pedido === null) this.pedido = this.el.requestVideoFrameCallback(this.aoQuadro);
  }

  private readonly aoQuadro: QuadroDoVideo = (_agora, meta) => {
    this.pedido = null;
    this.visto = Date.now();
    if (this.acabou || meta.mediaTime <= this.ultimo) return this.pedir();
    this.ultimo = meta.mediaTime;
    let fila: void | Promise<void>;
    try {
      fila = this.f.aoQuadro(meta.mediaTime);
    } catch (e) {
      return this.terminar(e);
    }
    this.pedir();
    if (fila) this.esperarFila(fila);
  };

  /** Fila cheia: pausa o vídeo até o motor esvaziar (sem isso, o codificador ficaria para trás e os quadros se acumulariam na memória). */
  private esperarFila(fila: Promise<void>): void {
    this.esperando = true;
    this.pausar();
    fila.then(
      () => {
        this.esperando = false;
        this.retomar();
      },
      (e) => this.terminar(e),
    );
  }

  private pausar(): void {
    if (this.acabou || this.el.paused) return;
    this.el.pause();
    this.f.avisos.pausou?.();
  }

  private retomar(): void {
    if (this.acabou || this.esperando || document.hidden || !this.el.paused || this.el.ended) return;
    this.f.avisos.retomou?.();
    this.tocar();
  }

  /** Tocando, à vista e sem quadro há muito tempo: travou (decodificador do aparelho, arquivo estranho). */
  private vigiar(): void {
    const parado = this.el.paused || document.hidden || this.esperando;
    if (parado) this.visto = Date.now();
    else if (Date.now() - this.visto > ESPERA_MAXIMA_MS) this.terminar(new Error("exportar: o vídeo parou de mandar quadros"));
  }

  private terminar(erro: unknown): void {
    if (this.acabou) return;
    this.acabou = true;
    if (this.pedido !== null) this.el.cancelVideoFrameCallback(this.pedido);
    if (this.relogio !== null) clearInterval(this.relogio);
    this.el.removeEventListener("ended", this.aoFim);
    this.el.removeEventListener("error", this.aoErro);
    this.f.sinal.removeEventListener("abort", this.aoAbortar);
    document.removeEventListener("visibilitychange", this.aoEsconder);
    this.el.pause();
    if (erro === null) this.f.ok();
    else this.f.falha(erro);
  }
}
