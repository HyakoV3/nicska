// Detector de apito e disparos, PURO (sem navegador nem relógio): recebe amostras e devolve eventos com o NÚMERO DA AMOSTRA onde aconteceram.
// A mesma lógica serve ao AudioWorklet (tempo real, quadro a quadro) e ao reprocessamento do áudio guardado (Etapa 4).
//
// O que os áudios reais mostraram (2 vídeos de treino, 9 mm e .22, docs/calibracao.md): cada tiro sobe de repente, satura, e deixa uma cauda de
// 0,5 a 1 s (eco do estande e compressão do áudio). Limiar fixo mais tempo morto conta a cauda e o ruído dentro dela como tiros. Por isso o
// disparo é uma SUBIDA sobre o que ainda soa: o envelope tem de passar de `SUBIDA` vezes a "cauda", um máximo que decai devagar.
// O apito é um tom fixo: acha-se com Goertzel (energia na frequência dele ÷ energia total). O disparo que cai num tom é o próprio apito, não um tiro.
//
// Os números abaixo são hipóteses medidas em áudio de WhatsApp (AAC); a Etapa 1 os confirma com gravação crua do app.

export type TipoEvento = "apito" | "disparo";
export type Evento = { tipo: TipoEvento; amostra: number };

export type OpcoesDetector = {
  /** 0 a 1: quanto maior, mais sensível (piso de nível mais baixo). */
  sensibilidade: number;
  /** Intervalo mínimo entre dois disparos (ms). */
  tempoMortoMs: number;
  /** Frequência do apito (Hz). */
  frequenciaApito: number;
  /** Procura o apito? Depois de achado (ou se desligado), tons não geram mais evento de apito. */
  esperarApito: boolean;
};

export const OPCOES_PADRAO: OpcoesDetector = { sensibilidade: 0.6, tempoMortoMs: 60, frequenciaApito: 2700, esperarApito: true };

/** Piso de nível (RMS de 2 ms, escala 0 a 1) para a sensibilidade: 0,6 vale 0,05; 1 vale o mínimo de 0,01. */
export function pisoDeNivel(sensibilidade: number): number {
  const s = Math.min(1, Math.max(0, Number.isFinite(sensibilidade) ? sensibilidade : OPCOES_PADRAO.sensibilidade));
  return Math.max(0.01, 0.125 * (1 - s));
}

/** O envelope tem de passar de tantas vezes a cauda para contar como disparo. */
export const SUBIDA = 2.2;
/** Constante de tempo (s) com que a cauda decai. */
export const TAU_CAUDA_S = 0.06;
const JANELA_ENVELOPE_S = 0.002;
/** O envelope é comparado com a cauda de tantos segundos atrás: a cauda que acompanha o envelope amostra a amostra nunca deixaria a subida passar de 2×. */
const ATRASO_CAUDA_S = 0.004;
/** Espera (s) depois da subida para decidir se foi tom (apito) ou tiro. */
const CONFIRMACAO_S = 0.03;
const HISTORICO_S = 0.15;
/** Fração do pico em que se marca o início de um som (volta-se até o envelope cair abaixo dela). */
const FRACAO_INICIO = 0.35;
/** A partir de que fração da energia total na frequência do apito o trecho conta como tom. */
const FRACAO_TOM = 0.3;
const NIVEL_MINIMO_TOM = 0.01;
const JANELA_TOM_S = 0.02;
const PASSO_TOM_S = 0.0025;
const HITS_PARA_APITO = 8;
/** O Goertzel soma três frequências vizinhas (±50 Hz): relógios e alto-falantes não acertam o tom ao hertz. */
const DESVIOS_TOM_HZ = [-50, 0, 50];

/** Fração da energia de `x[ini, fim)` que está perto de `frequencia` (0 a 1; um tom puro dá cerca de 1). */
export function fracaoDeTom(x: ArrayLike<number>, ini: number, fim: number, frequencia: number, taxa: number): number {
  const n = fim - ini;
  if (n <= 0) return 0;
  let energia = 0;
  for (let i = ini; i < fim; i++) energia += x[i] * x[i];
  if (energia <= 1e-12) return 0;
  let tom = 0;
  for (const d of DESVIOS_TOM_HZ) {
    const w = (2 * Math.PI * (frequencia + d)) / taxa;
    const c = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = ini; i < fim; i++) {
      const s0 = x[i] + c * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    tom += s1 * s1 + s2 * s2 - c * s1 * s2; // |X|² de Goertzel
  }
  return Math.min(1, (2 * tom) / (n * energia));
}

type Candidato = { n: number; resolverEm: number };

/** Detector incremental: `processar(quadro)` pode receber blocos de qualquer tamanho (128 amostras no worklet). */
export class Detector {
  private readonly op: OpcoesDetector;
  private readonly piso: number;
  private readonly janelaEnv: number;
  private readonly tamHist: number;
  private readonly tamConf: number;
  private readonly tamTom: number;
  private readonly passoTom: number;
  private readonly morto: number;
  private readonly decaimento: number;
  private readonly quadrados: Float64Array;
  private readonly amostras: Float32Array; // histórico circular do sinal
  private readonly envelope: Float32Array; // histórico circular do envelope
  private readonly caudas: Float32Array; // histórico circular da cauda
  private readonly atrasoCauda: number;
  private soma = 0;
  private n = 0; // número de amostras já vistas
  private cauda = 0;
  private ultimoDisparo = -Infinity;
  private candidato: Candidato | null = null;
  private apitoAchado = false;
  private proximoTom: number;
  private hits = 0;
  /** Depois de `reabrirApito`, o tom que já estava tocando não vale de novo: só um tom NOVO, depois de ele cessar. */
  private esperandoFimDoTom = false;

  constructor(
    readonly taxa: number,
    opcoes: Partial<OpcoesDetector> = {},
  ) {
    this.op = { ...OPCOES_PADRAO, ...opcoes };
    this.piso = pisoDeNivel(this.op.sensibilidade);
    this.janelaEnv = Math.max(1, Math.round(taxa * JANELA_ENVELOPE_S));
    this.tamHist = Math.ceil(taxa * HISTORICO_S);
    this.tamConf = Math.round(taxa * CONFIRMACAO_S);
    this.tamTom = Math.round(taxa * JANELA_TOM_S);
    this.passoTom = Math.max(1, Math.round(taxa * PASSO_TOM_S));
    this.morto = Math.round((taxa * this.op.tempoMortoMs) / 1000);
    this.decaimento = Math.exp(-1 / (TAU_CAUDA_S * taxa));
    this.quadrados = new Float64Array(this.janelaEnv);
    this.amostras = new Float32Array(this.tamHist);
    this.envelope = new Float32Array(this.tamHist);
    this.caudas = new Float32Array(this.tamHist);
    this.atrasoCauda = Math.max(1, Math.round(taxa * ATRASO_CAUDA_S));
    this.proximoTom = this.tamTom;
  }

  /**
   * Volta a procurar o apito: o que se achou como apito não era o certo (o timer descartou-o por estar fora da janela do instante agendado: uma voz, o timer de outra
   * baia). Sem isto o detector, que só diz "apito" uma vez, calaria o apito de verdade.
   */
  reabrirApito(): void {
    this.apitoAchado = false;
    this.esperandoFimDoTom = true;
    this.hits = 0;
    this.proximoTom = this.n + this.passoTom;
  }

  /** Quantas amostras já passaram pelo detector. */
  get amostrasVistas(): number {
    return this.n;
  }

  processar(quadro: ArrayLike<number>): Evento[] {
    const eventos: Evento[] = [];
    for (let k = 0; k < quadro.length; k++) this.passo(quadro[k], eventos);
    return eventos;
  }

  private passo(v: number, eventos: Evento[]): void {
    const n = this.n;
    // envelope: RMS das últimas `janelaEnv` amostras
    const q = v * v;
    const pos = n % this.janelaEnv;
    this.soma += q - this.quadrados[pos];
    this.quadrados[pos] = q;
    const env = Math.sqrt(Math.max(0, this.soma) / this.janelaEnv);
    this.amostras[n % this.tamHist] = v;
    this.envelope[n % this.tamHist] = env;

    // subida sobre a cauda: candidato a disparo (ou ao apito)
    const caudaAntes = n >= this.atrasoCauda ? this.caudas[(n - this.atrasoCauda) % this.tamHist] : this.cauda;
    if (!this.candidato && env > this.piso && env > SUBIDA * caudaAntes && n - this.ultimoDisparo > this.morto) {
      this.candidato = { n, resolverEm: n + this.tamConf };
      this.ultimoDisparo = n;
    }
    this.cauda = Math.max(env, this.cauda * this.decaimento);
    this.caudas[n % this.tamHist] = this.cauda;

    this.n = n + 1;
    if (this.candidato && this.n > this.candidato.resolverEm) this.resolverCandidato(eventos);
    // apito que sobe devagar (sem subida brusca): acha-se pelo tom
    if (this.op.esperarApito && !this.apitoAchado && this.n >= this.proximoTom) {
      this.proximoTom += this.passoTom;
      this.olharTom(eventos);
    }
  }

  private lido(i: number): number {
    return this.amostras[i % this.tamHist];
  }

  private env(i: number): number {
    return this.envelope[i % this.tamHist];
  }

  /** Início do som que sobe perto de `n`: volta até o envelope cair abaixo de uma fração do pico logo adiante. */
  private inicioDoSom(n: number, limite: number): number {
    const fimPico = Math.min(this.n - 1, n + Math.round(this.taxa * 0.005));
    let pico = 0;
    for (let i = Math.max(0, n - 1); i <= fimPico; i++) pico = Math.max(pico, this.env(i));
    const minimo = Math.max(0, this.n - this.tamHist);
    let j = n;
    while (j > minimo && n - j < limite && this.env(j - 1) > FRACAO_INICIO * pico) j--;
    return j;
  }

  private tomEm(ini: number, fim: number): number {
    const x = new Float32Array(fim - ini);
    for (let i = ini; i < fim; i++) x[i - ini] = this.lido(i);
    return fracaoDeTom(x, 0, x.length, this.op.frequenciaApito, this.taxa);
  }

  private resolverCandidato(eventos: Evento[]): void {
    const c = this.candidato!;
    this.candidato = null;
    const inicio = this.inicioDoSom(c.n, Math.round(this.taxa * 0.006));
    const tom = this.tomEm(Math.max(inicio, this.n - this.tamHist), this.n);
    if (tom >= FRACAO_TOM) {
      // um tom, não um tiro: é o apito (o primeiro), ou um som alheio que se ignora
      if (this.op.esperarApito && !this.apitoAchado) {
        this.apitoAchado = true;
        eventos.push({ tipo: "apito", amostra: inicio });
      }
      return;
    }
    eventos.push({ tipo: "disparo", amostra: inicio });
  }

  private olharTom(eventos: Evento[]): void {
    const fim = this.n;
    const ini = fim - this.tamTom;
    let energia = 0;
    for (let i = ini; i < fim; i++) energia += this.lido(i) ** 2;
    const nivel = Math.sqrt(energia / this.tamTom);
    const tom = nivel >= NIVEL_MINIMO_TOM ? this.tomEm(ini, fim) : 0;
    if (this.esperandoFimDoTom) {
      if (tom < FRACAO_TOM) this.esperandoFimDoTom = false;
      this.hits = 0;
      return;
    }
    this.hits = tom >= FRACAO_TOM ? this.hits + 1 : 0;
    if (this.hits < HITS_PARA_APITO) return;
    this.apitoAchado = true;
    // o início está antes da primeira janela que acertou: volta até o envelope cair
    const primeiro = fim - (this.hits - 1) * this.passoTom;
    let pico = 0;
    for (let i = Math.max(0, primeiro - this.tamTom); i <= fim; i++) pico = Math.max(pico, this.env(i));
    const minimo = Math.max(0, this.n - this.tamHist);
    let j = fim - 1;
    while (j > minimo && this.env(j - 1) > FRACAO_INICIO * pico) j--;
    eventos.push({ tipo: "apito", amostra: j });
    // um candidato a disparo aberto sobre este mesmo tom não é tiro
    if (this.candidato) this.candidato = null;
  }
}

export type Resultado = {
  /** Amostra do início do apito, ou null se não foi ouvido. */
  apito: number | null;
  /** Amostras dos disparos, na ordem. */
  disparos: number[];
};

/** Janela (s no áudio) em que um tom ainda vale como apito; fora dela o apito é descartado e o detector volta a procurar, como o Timer faz ao vivo (`timerFase`). */
export type JanelaDoApito = { iniS: number; fimS: number };

/**
 * Roda o detector sobre um áudio inteiro (reprocessamento e testes), em blocos de 128 amostras como o worklet. Com `janelaApito`, um apito fora dela é
 * descartado e o detector é reaberto (`reabrirApito`), o mesmo que a escuta ao vivo faz quando o Timer classifica o tom como fora da janela.
 */
export function analisar(x: ArrayLike<number>, taxa: number, opcoes: Partial<OpcoesDetector> = {}, janelaApito?: JanelaDoApito): Resultado {
  const d = new Detector(taxa, opcoes);
  const r: Resultado = { apito: null, disparos: [] };
  const BLOCO = 128;
  const bloco = new Float32Array(BLOCO);
  for (let i = 0; i < x.length; i += BLOCO) {
    const n = Math.min(BLOCO, x.length - i);
    for (let k = 0; k < n; k++) bloco[k] = x[i + k];
    for (const e of d.processar(n === BLOCO ? bloco : bloco.subarray(0, n))) {
      if (e.tipo === "apito") {
        const t = e.amostra / taxa;
        if (janelaApito && (t < janelaApito.iniS || t > janelaApito.fimS)) d.reabrirApito();
        else r.apito ??= e.amostra;
      } else r.disparos.push(e.amostra);
    }
  }
  return r;
}

export function detectarApito(x: ArrayLike<number>, taxa: number, opcoes: Partial<OpcoesDetector> = {}): number | null {
  return analisar(x, taxa, opcoes).apito;
}

export function detectarDisparos(x: ArrayLike<number>, taxa: number, opcoes: Partial<OpcoesDetector> = {}): number[] {
  return analisar(x, taxa, opcoes).disparos;
}

/**
 * Instantes dos disparos em ms desde o apito (o zero da tentativa). Sem apito ouvido, usa `inicioEstimadoAmostra` (o instante agendado mais a
 * latência de saída) e devolve `inicio: "estimado"`. Disparos antes do zero são descartados.
 */
export function temposEmMs(r: Resultado, taxa: number, inicioEstimadoAmostra?: number): { inicio: "detectado" | "estimado"; disparos_ms: number[] } | null {
  const zero = r.apito ?? inicioEstimadoAmostra;
  if (zero === undefined) return null;
  const ms = r.disparos.filter((a) => a >= zero).map((a) => Math.round(((a - zero) / taxa) * 1000));
  return { inicio: r.apito !== null ? "detectado" : "estimado", disparos_ms: ms };
}
