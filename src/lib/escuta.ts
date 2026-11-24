// A escuta do timer: abre o microfone CRU (sem cancelamento de eco, supressão de ruído nem ganho automático, mono), liga o AudioWorklet que roda o
// detector e, no mesmo fluxo, o MediaRecorder que guarda o áudio da tentativa (para revisar e reprocessar, Etapa 4).
//
// Sem o cancelamento de eco desligado o celular APAGARIA o próprio apito do microfone; sem o ganho automático desligado ele baixaria o ganho depois
// do 1º tiro e perderia os seguintes. Com os filtros desligados, o app confere `getSettings()` da trilha (`filtrosDesligados`).
import workletUrl from "./escuta.worklet.ts?worker&url";
import type { OpcoesDetector, TipoEvento } from "./detector";
import { ligarDetector, type Mensagem } from "./escutaLigacao";
import { GravadorDaEscuta } from "./escutaGravador";
import { fabricasDoNavegador, type Fabricas } from "./escutaNavegador";

/** Um evento do detector: `tempo` em segundos no relógio do `AudioContext` da escuta (`contexto.currentTime`). */
export type EventoEscuta = { tipo: TipoEvento; quadro: number; tempo: number };

/** O áudio da tentativa. `inicioCtx`: o instante (s, no relógio do AudioContext da escuta) em que a gravação começou; serve para achar o zero no áudio quando o apito não foi ouvido. */
export type Tentativa = { blob: Blob; tipo: string; segundos: number; inicioCtx: number | null };

/** Desiste (com `AbortError`) se a tentativa `minha` não é mais a vigente (`geracao`). */
function desistirSeObsoleta(fabricas: Fabricas, minha: number, geracao: number): void {
  if (minha !== geracao) throw fabricas.erro("escuta cancelada", "AbortError");
}

export class Escuta {
  /** Quem recebe os eventos do detector (o apito e cada disparo), na hora em que chegam do worklet. */
  aoEvento: ((e: EventoEscuta) => void) | null = null;
  /** Quem recebe os picos do envelope (um a cada ~5 ms), em lotes, para desenhar a linha do tempo. Sem quem o receba o worklet nem o calcula (CONS-048). */
  get aoEnvelope(): ((picos: number[]) => void) | null {
    return this._aoEnvelope;
  }
  set aoEnvelope(f: ((picos: number[]) => void) | null) {
    this._aoEnvelope = f;
    this.no?.port.postMessage({ t: "envelope", ligado: f !== null });
  }
  private _aoEnvelope: ((picos: number[]) => void) | null = null;
  /** O microfone ou o áudio foram tirados do app (ligação, outro app, permissão revogada): quem usa deve parar e avisar. */
  aoInterromper: (() => void) | null = null;
  /** Os filtros do microfone estão mesmo desligados? Só é conhecido depois de `iniciar`; `null` quando o navegador não diz. */
  filtrosDesligados: boolean | null = null;

  private ctx: AudioContext | null = null;
  private fluxo: MediaStream | null = null;
  private no: AudioWorkletNode | null = null;
  private readonly gravador: GravadorDaEscuta;
  private inicio = 0;
  private inicioCtx: number | null = null;
  /** Muda a cada `iniciar` e a cada `soltar`: um `iniciar` que ainda esperava (permissão, módulo) vê o número mudado, solta só o que é dele e desiste. */
  private geracao = 0;

  constructor(private readonly fabricas: Fabricas = fabricasDoNavegador) {
    this.gravador = new GravadorDaEscuta(fabricas);
  }

  /** O contexto de áudio da escuta: o apito deve ser agendado nele, para o instante agendado e os eventos terem o mesmo relógio. */
  get contexto(): AudioContext | null {
    return this.ctx;
  }

  /** A taxa de amostragem em que o detector roda (Hz); 0 antes de `iniciar`. */
  get taxa(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  /** O fluxo do microfone (só leitura; nulo antes de `iniciar`): o vídeo da tentativa leva a faixa de áudio dele. Quem o usa não deve parar as faixas. */
  get fluxoDoMicrofone(): MediaStream | null {
    return this.fluxo;
  }

  /** Quando a gravação do áudio começou (`performance.now()`, ms; nulo antes de `iniciar`): o vídeo da tentativa mede o próprio atraso contra isto. */
  get inicioDaGravacaoMs(): number | null {
    return this.inicioCtx === null ? null : this.inicio;
  }

  get ativa(): boolean {
    return this.no !== null;
  }

  /**
   * Abre o microfone e liga o detector. Chamar a partir de um toque (o áudio só inicia depois de um gesto).
   * Se `soltar` (cancelar) ou outro `iniciar` vierem enquanto isto espera, este termina com `AbortError` sem mexer no que é da tentativa nova.
   */
  async iniciar(opcoes: Partial<OpcoesDetector> = {}): Promise<void> {
    if (this.ativa) return;
    if (!this.fabricas.temMicrofone()) throw this.fabricas.erro("sem microfone", "NotSupportedError");
    if (this.ctx) this.soltar(); // um iniciar anterior ainda esperando: este o substitui
    const minha = ++this.geracao;
    // O contexto nasce AGORA, no toque, e não depois da espera pela permissão.
    const ctx = this.fabricas.contexto();
    this.ctx = ctx;
    try {
      await this.abrir({ ctx, minha, opcoes });
    } catch (e) {
      if (minha !== this.geracao) throw e; // já foi solta (por quem cancelou): não há nada nosso a soltar
      this.soltar();
      throw e;
    }
  }

  private async abrir({ ctx, minha, opcoes }: { ctx: AudioContext; minha: number; opcoes: Partial<OpcoesDetector> }): Promise<void> {
    void ctx.resume().catch(() => {});
    await ctx.audioWorklet.addModule(workletUrl);
    desistirSeObsoleta(this.fabricas, minha, this.geracao);
    const fluxo = await this.fabricas.abrirMicrofone();
    if (minha !== this.geracao) fluxo.getTracks().forEach((t) => t.stop()); // chegou tarde: o microfone não pode ficar aberto
    desistirSeObsoleta(this.fabricas, minha, this.geracao);
    this.fluxo = fluxo;
    const s = fluxo.getAudioTracks()[0]?.getSettings?.() ?? {};
    this.filtrosDesligados = "echoCancellation" in s ? !s.echoCancellation && !s.noiseSuppression && !s.autoGainControl : null;
    await ctx.resume();
    desistirSeObsoleta(this.fabricas, minha, this.geracao);
    // Daqui até o fim não há mais espera: nada pode mudar a geração no meio.
    const no = this.fabricas.no(ctx, opcoes);
    this.no = no;
    if (this._aoEnvelope) no.port.postMessage({ t: "envelope", ligado: true });
    const aoInterromper = () => this.aoInterromper?.();
    ligarDetector({
      ctx, fluxo, no, aoInterromper,
      ativa: () => this.no !== null,
      aoMensagem: (m: Mensagem) => {
        if (m.t === "evento") this.aoEvento?.({ tipo: m.tipo, quadro: m.quadro, tempo: m.quadro / ctx.sampleRate });
        else this.aoEnvelope?.(m.picos);
      },
    });
    this.gravador.iniciar(fluxo, aoInterromper);
    this.inicioCtx = ctx.currentTime;
    this.inicio = performance.now();
  }

  /** Para a escuta e entrega o áudio da tentativa (ou nulo se não há gravador). O microfone é devolvido ao aparelho. */
  async parar(): Promise<Tentativa | null> {
    const segundos = (performance.now() - this.inicio) / 1000;
    const audio = await this.gravador.parar();
    const inicioCtx = this.inicioCtx;
    this.soltar();
    if (!audio || audio.blob.size === 0) return null;
    return { blob: audio.blob, tipo: audio.tipo, segundos, inicioCtx };
  }

  /** Pede ao detector que volte a procurar o apito (o que ele achou foi descartado como falso). */
  reabrirApito(): void {
    this.no?.port.postMessage({ t: "reabrir-apito" });
  }

  /** Devolve o microfone e o áudio ao aparelho e esquece tudo. Também cancela um `iniciar` que ainda espera. */
  soltar(): void {
    this.geracao++;
    soltarNo(this.no);
    this.no = null;
    this.fluxo?.getTracks().forEach((t) => t.stop());
    this.fluxo = null;
    this.gravador.soltar();
    this.inicioCtx = null;
    fecharContexto(this.ctx);
    this.ctx = null;
  }

}

function soltarNo(no: AudioWorkletNode | null): void {
  if (!no) return;
  no.port.postMessage({ t: "parar" });
  no.port.onmessage = null;
  no.disconnect();
}

function fecharContexto(ctx: AudioContext | null): void {
  if (!ctx) return;
  ctx.onstatechange = null;
  if (ctx.state !== "closed") void ctx.close().catch(() => {});
}
