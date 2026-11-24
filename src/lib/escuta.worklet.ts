// O AudioWorklet do timer: roda o `Detector` (src/lib/detector.ts) no fio de áudio, 128 amostras por vez (~2,7 ms a 48 kHz), contando amostras. É
// isso que dá a precisão: o `AnalyserNode` só é lido no `requestAnimationFrame` (~16 ms) e não diz em que amostra o pico aconteceu.
// Mensagens para a página (`port`):
//   { t: "evento", tipo: "apito" | "disparo", quadro }  `quadro` = número da amostra no relógio do AudioContext (divida pela taxa para ter segundos)
//   { t: "envelope", picos }                            um ponto a cada ~5 ms (pico absoluto), em lotes, para desenhar a linha do tempo
// Da página para cá: { t: "parar" }.
import { Detector, type OpcoesDetector } from "./detector";

// O escopo do worklet não está nos tipos do DOM: o mínimo que se usa.
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: { processorOptions?: unknown });
}
declare function registerProcessor(nome: string, classe: new (options?: { processorOptions?: unknown }) => AudioWorkletProcessor): void;

/** Um ponto do envelope a cada ~5 ms. */
const AMOSTRAS_POR_PICO_S = 0.005;
/** Quantos picos vão juntos numa mensagem (~50 ms). */
const PICOS_POR_LOTE = 10;

class ProcessadorDeEscuta extends AudioWorkletProcessor {
  private readonly detector: Detector;
  private readonly porPico = Math.max(1, Math.round(sampleRate * AMOSTRAS_POR_PICO_S));
  /** O número da amostra do relógio do AudioContext em que o detector começou (a amostra 0 dele). */
  private quadroInicial = -1;
  private maximo = 0;
  private contadas = 0;
  private picos: number[] = [];
  private parado = false;
  /** O envelope só é calculado e postado se alguém o pediu (`{ t: "envelope", ligado: true }`): na escuta comum ninguém o consome (CONS-048). */
  private envelopeLigado = false;

  constructor(options?: { processorOptions?: unknown }) {
    super(options);
    const o = (options?.processorOptions ?? {}) as { opcoes?: Partial<OpcoesDetector> };
    this.detector = new Detector(sampleRate, o.opcoes);
    this.port.onmessage = (e: MessageEvent) => this.aoMensagem(e.data as { t?: string; ligado?: boolean } | null);
  }

  private aoMensagem(m: { t?: string; ligado?: boolean } | null): void {
    const t = m?.t;
    if (t === "parar") this.parado = true;
    else if (t === "reabrir-apito") this.detector.reabrirApito();
    else if (t === "envelope") {
      this.envelopeLigado = m?.ligado === true;
      this.maximo = 0;
      this.contadas = 0;
      this.picos = [];
    }
  }

  process(entradas: Float32Array[][]): boolean {
    if (this.parado) return false;
    const canal = entradas[0]?.[0];
    if (canal) this.consumir(canal); // sem entrada (microfone ainda não ligado, ou um furo): segue esperando
    return true;
  }

  /** Um bloco de amostras: roda o detector (cobrindo antes qualquer furo) e acumula o envelope. */
  private consumir(canal: Float32Array): void {
    if (this.quadroInicial < 0) this.quadroInicial = currentFrame;
    // Um furo (o microfone sumiu por alguns blocos: troca de rota, Bluetooth) faz o relógio do contexto andar sem o detector: sem alimentá-lo com silêncio, todos os
    // disparos seguintes ficariam deslocados em relação ao apito já medido (07·REL-003).
    const furo = currentFrame - (this.quadroInicial + this.detector.amostrasVistas);
    if (furo > 0) this.detectar(new Float32Array(furo));
    this.detectar(canal);
    if (this.envelopeLigado) this.acumularEnvelope(canal);
  }

  private detectar(amostras: Float32Array): void {
    this.detector.processar(amostras).forEach((e) => this.port.postMessage({ t: "evento", tipo: e.tipo, quadro: this.quadroInicial + e.amostra }));
  }

  private acumularAmostra(a: number): void {
    if (a > this.maximo) this.maximo = a;
    if (++this.contadas < this.porPico) return;
    this.picos.push(this.maximo);
    this.maximo = 0;
    this.contadas = 0;
  }

  private acumularEnvelope(canal: Float32Array): void {
    for (let i = 0; i < canal.length; i++) this.acumularAmostra(Math.abs(canal[i]));
    if (this.picos.length < PICOS_POR_LOTE) return;
    this.port.postMessage({ t: "envelope", picos: this.picos });
    this.picos = [];
  }
}

registerProcessor("nicska-detector", ProcessadorDeEscuta);
