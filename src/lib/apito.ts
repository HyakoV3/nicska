// O apito de início: um tom curto e fixo, agendado no relógio do áudio. Tem o seu PRÓPRIO `AudioContext`, criado no toque da pessoa (o áudio só
// inicia depois de um gesto). O instante zero da tentativa NÃO é o agendado: é o início do apito como o microfone o ouviu (docs/roadmap, seção 5),
// o que anula a latência de saída. Frequência e duração são hipóteses até a Etapa 1 (docs/calibracao.md).

import vozUrl from "./audio/voz-standby.ogg?url";

/**
 * O apito padrão: 2700 Hz por 0,5 s, medido no áudio de dois vídeos reais de treino (9 mm e .22, 2026-11-21): o tom estava em 2700 Hz
 * (bin de 50 Hz) e durava cerca de 0,5 s. Não há frequência ou duração mandada pelas regras da IPSC (só o atraso de 1 a 4 s depois do "Stand by"),
 * nem publicada pelos fabricantes de timers que consultei; confirmar com gravação crua do app (docs/calibracao.md).
 */
export const FREQUENCIA_PADRAO = 2700;
export const DURACAO_PADRAO = 0.5;
/** Pico do apito: o fundo de escala. O digital não passa daqui; quem ajusta o resto é o volume de mídia do celular. */
const GANHO = 1.0;
/** O bipe de aviso do Standby: 1000 Hz, 0,15 s, bem abaixo do apito em volume para nunca parecer o sinal. */
export const FREQUENCIA_AVISO = 1000;
export const DURACAO_AVISO = 0.15;
const GANHO_AVISO = 0.5;
/**
 * A senoide de 2700 Hz entra num saturador (tanh) com esta pré-amplificação: o pico continua em 1,0, mas o sinal vira quase uma onda quadrada, com
 * RMS de ~0,93 em vez de 0,71 (+2,4 dB sobre uma senoide de pico cheio e ~+4 dB sobre os 0,8 de antes). A frequência fundamental é a mesma, então
 * o detector (Goertzel em 2700 Hz) continua achando o apito: ~80% da energia de uma quadrada está na fundamental.
 */
export const SATURACAO = 4;

/** A curva do saturador: tanh(SATURACAO · x) normalizada para que o pico de uma senoide de amplitude 1 seja exatamente 1. */
export function curvaDeSaturacao(pontos = 1024, saturacao = SATURACAO): Float32Array {
  const curva = new Float32Array(pontos);
  const norma = Math.tanh(saturacao);
  for (let i = 0; i < pontos; i++) curva[i] = Math.tanh((saturacao * (2 * i)) / (pontos - 1) - saturacao) / norma;
  return curva;
}

/** Quanto o som demora a sair do aparelho depois de agendado (s). Fone Bluetooth: 100 a 300 ms. Zero se o contexto não está rodando. */
export function atrasoDeSaida(ctx: Pick<AudioContext, "state" | "outputLatency">): number {
  const l = ctx.outputLatency;
  return ctx.state === "running" && Number.isFinite(l) ? Math.max(0, l) : 0;
}

/** O arquivo da voz embutido no app. */
const vozEmbutida = async (): Promise<ArrayBuffer> => {
  const r = await fetch(vozUrl);
  if (!r.ok) throw new Error(`voz: HTTP ${r.status}`);
  return r.arrayBuffer();
};

/** Depois do fim da voz do Standby, esta folga (ms) antes de o atraso sorteado começar a contar: a sala ainda ressoa e a pessoa precisa do instante para ouvir o "pronto". */
export const FOLGA_DEPOIS_DA_VOZ_MS = 300;

export type OpcoesApito = {
  /** Entrega os bytes da voz do Standby (o arquivo embutido, `?url`); um falso nos testes. */
  voz?: () => Promise<ArrayBuffer>;
  /** Cria (ou entrega) o contexto de áudio; um falso nos testes. */
  contexto?: () => AudioContext;
  /**
   * O contexto é de outra peça (a escuta do timer): o apito agenda nele, para o instante agendado e os eventos do detector terem o mesmo relógio,
   * e NÃO o fecha. Sem isto o apito cria o seu próprio contexto, no toque, e o fecha ao terminar.
   */
  compartilhado?: boolean;
};

export class Apito {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  /** Muda a cada `agendar()`, `cancelar()` e `fechar()`: um `agendar()` que ainda esperava o áudio e vê o número mudado já não vale. */
  private geracao = 0;

  constructor(private readonly opcoes: OpcoesApito = {}) {}

  /** Há um apito agendado ou soando? */
  get ativo(): boolean {
    return this.osc !== null;
  }

  /** Prepara o contexto (chamar no toque em "Standby"). */
  async preparar(): Promise<void> {
    if (!this.ctx || this.ctx.state === "closed" || this.opcoes.compartilhado) this.ctx = (this.opcoes.contexto ?? (() => new AudioContext()))();
    await this.ctx.resume();
  }

  /**
   * Agenda o apito para daqui a `emSegundos` (no relógio do áudio). Devolve o instante agendado (`currentTime`) e a latência de saída, para
   * estimar o início quando o microfone não ouvir o apito; ou null se foi cancelado enquanto esperava.
   */
  async agendar(emSegundos: number, frequencia = FREQUENCIA_PADRAO, duracao = DURACAO_PADRAO): Promise<{ quando: number; atraso: number } | null> {
    const minha = ++this.geracao;
    await this.preparar();
    const ctx = this.ctx;
    if (!ctx || minha !== this.geracao) return null;
    this.parar();
    const quando = ctx.currentTime + Math.max(0, emSegundos);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequencia;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, quando);
    env.gain.linearRampToValueAtTime(GANHO, quando + 0.002); // subida de 2 ms: sem estalo, mas ainda um início nítido para o detector
    env.gain.setValueAtTime(GANHO, quando + duracao - 0.005);
    env.gain.linearRampToValueAtTime(0, quando + duracao);
    // senoide → saturador (quase quadrada, bem mais forte) → envelope com subida e descida curtas → saída
    const saturador = ctx.createWaveShaper();
    saturador.curve = curvaDeSaturacao() as Float32Array<ArrayBuffer>;
    saturador.oversample = "2x";
    osc.connect(saturador).connect(env).connect(ctx.destination);
    osc.onended = () => {
      if (this.osc === osc) this.osc = null;
    };
    osc.start(quando);
    osc.stop(quando + duracao + 0.01);
    this.osc = osc;
    return { quando, atraso: atrasoDeSaida(ctx) };
  }

  /**
   * Um bipe curto AGORA, para avisar que o Standby começou. Tom e duração diferentes do apito de propósito (1000 Hz, longe de 2700 Hz e das harmônicas dele): o
   * detector não o confunde com o apito, e quem ouve não o toma pelo sinal de partida (por isso é opcional e vem desligado). Devolve a duração (ms).
   */
  async avisar(frequencia = FREQUENCIA_AVISO, duracao = DURACAO_AVISO): Promise<number> {
    await this.preparar();
    const ctx = this.ctx;
    if (!ctx) return 0;
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequencia;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, agora);
    env.gain.linearRampToValueAtTime(GANHO_AVISO, agora + 0.005);
    env.gain.setValueAtTime(GANHO_AVISO, agora + duracao - 0.01);
    env.gain.linearRampToValueAtTime(0, agora + duracao);
    osc.connect(env).connect(ctx.destination);
    osc.onended = () => osc.disconnect();
    osc.start(agora);
    osc.stop(agora + duracao + 0.01);
    return Math.round(duracao * 1000);
  }

  private bufferDaVoz: AudioBuffer | null = null;

  /**
   * Fala "Standing by" AGORA e devolve quanto tempo o aviso dura (ms): a voz mais a folga. A voz é um arquivo curto embutido no app (gerado por voz neural, tratado em
   * `tools/recortar-voz.py`), decodificado uma vez e guardado. Se não der para carregar ou decodificar, devolve 0 e o Standby segue sem voz (a tela e a vibração valem).
   */
  async falar(): Promise<number> {
    await this.preparar();
    const ctx = this.ctx;
    if (!ctx) return 0;
    try {
      if (!this.bufferDaVoz) {
        const bytes = await (this.opcoes.voz ?? vozEmbutida)();
        this.bufferDaVoz = await ctx.decodeAudioData(bytes.slice(0));
      }
    } catch (e) {
      console.warn("apito: não foi possível carregar a voz do Standby", e);
      return 0;
    }
    const buffer = this.bufferDaVoz;
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(ctx.destination);
    fonte.onended = () => fonte.disconnect();
    fonte.start();
    this.voz = fonte;
    return Math.round(buffer.duration * 1000) + FOLGA_DEPOIS_DA_VOZ_MS;
  }

  private voz: AudioBufferSourceNode | null = null;

  /** O instante atual do relógio do áudio (s), ou null sem contexto. */
  agora(): number | null {
    return this.ctx?.currentTime ?? null;
  }

  /** Cancela o apito agendado ou soando, e a voz do Standby se ainda fala. */
  cancelar(): void {
    this.geracao++;
    this.parar();
    this.calarVoz();
  }

  private calarVoz(): void {
    const v = this.voz;
    this.voz = null;
    try {
      v?.stop();
    } catch {
      /* já tinha acabado */
    }
    v?.disconnect();
  }

  /** Cancela e devolve o áudio ao aparelho. */
  fechar(): void {
    this.geracao++;
    this.parar();
    this.calarVoz();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed" && !this.opcoes.compartilhado) void ctx.close().catch(() => {});
  }

  private parar(): void {
    const osc = this.osc;
    this.osc = null;
    if (!osc) return;
    try {
      osc.stop();
    } catch {
      /* já tinha parado */
    }
    osc.disconnect();
  }
}
