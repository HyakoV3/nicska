// Os tipos e as constantes da máquina de estados do timer (timer.ts), em arquivo próprio para a classe ficar só com a lógica.
import type { EventoEscuta, Tentativa } from "./escuta";
import type { OpcoesDetector } from "./detector";
import type { PrefsTimer } from "./preferencias";
import type { Resumo } from "./tentativa";
import type { MotivoSemVideo, PedidoDeVideo } from "./video/gravadorDeVideo";

export type EstadoDoTimer = "parado" | "preparando" | "atraso" | "apito" | "escutando" | "resultado" | "erro";
export type MotivoDoErroDoTimer = "negada" | "sem_microfone" | "indisponivel" | "falhou" | "audio_perdido";

/** Quanto, depois do instante agendado, se espera o apito chegar ao microfone antes de dar o início por estimado (ms). */
export const ESPERA_DO_APITO_MS = 1500;
/** Com fone o apito não chega ao microfone: o início já é estimado, e a escuta começa depois do apito (ms). */
export const DURACAO_DO_APITO_MS = 500;
/** Quanto antes do instante agendado um tom ainda pode ser o apito (s): folga para a imprecisão do instante, nunca para um tom que já vinha tocando. */
export const FOLGA_ANTES_DO_APITO_S = 0.05;
/** Nenhuma tentativa passa disto (ms). */
export const TEMPO_MAXIMO_MS = 180_000;

export type Resultado = {
  /** O id da tentativa, sorteado no Standby (o vídeo já é guardado com ele antes de a tentativa ser salva); a Revisão salva com este mesmo id. */
  id?: string;
  /** ISO 8601 com o fuso, de quando a tentativa começou. */
  data: string;
  atrasoMs: number;
  inicio: "detectado" | "estimado";
  disparosMs: number[];
  resumo: Resumo;
  detector: { versao: 1; sensibilidade: number; tempoMortoMs: number };
  /** O áudio guardado da tentativa (para revisar e reprocessar), se o aparelho gravou. */
  audio: Tentativa | null;
  /** O instante zero na linha do tempo do áudio (s desde o começo dele), segundo a escuta ao vivo; serve de reserva quando o apito não está no áudio. */
  zeroNoAudioS: number | null;
  /** A escuta foi cortada no meio (ligação, outro app tirou o microfone): vale o que foi detectado até ali, e a tentativa fica marcada (CONS-023). */
  incompleta?: boolean;
};

export type Instantaneo = {
  estado: EstadoDoTimer;
  erro: MotivoDoErroDoTimer | null;
  /** O atraso sorteado desta tentativa (ms); null antes do sorteio. */
  atrasoMs: number | null;
  /** Os disparos até agora, em ms desde o apito. */
  disparosMs: number[];
  inicio: "detectado" | "estimado" | null;
  /** Há fone ligado: o apito sai nele e o início fica estimado. */
  avisoDeFone: boolean;
  resultado: Resultado | null;
  /** Modo vídeo pedido, mas a tentativa segue só com áudio: o porquê (a tela avisa). Ausente fora do modo vídeo ou com o vídeo gravando. */
  semVideo?: MotivoSemVideo | null;
  /** O zero da tentativa (o apito, s no relógio do áudio da escuta), desde que a escuta começa: o cronômetro ao vivo da tela cheia do vídeo conta dele. */
  zeroS?: number | null;
};

export interface EscutaLike {
  aoEvento: ((e: EventoEscuta) => void) | null;
  aoInterromper: (() => void) | null;
  iniciar(opcoes: Partial<OpcoesDetector>): Promise<void>;
  parar(): Promise<Tentativa | null>;
  soltar(): void;
  /** Volta a procurar o apito depois de descartar um tom fora da janela. Opcional (um falso pode não ter). */
  reabrirApito?(): void;
  /** O fluxo do microfone aberto (só leitura): a faixa de áudio dele entra também no vídeo. Opcional (um falso pode não ter). */
  readonly fluxoDoMicrofone?: MediaStream | null;
  /** Quando a gravação do áudio começou (`performance.now()`, ms): o vídeo mede o próprio atraso contra isto. Opcional (um falso pode não ter). */
  readonly inicioDaGravacaoMs?: number | null;
}

/** O que a tentativa no modo vídeo pede: a câmera e a qualidade (quem chama lê de Ajustes; o Timer não lê preferências) e, se ligada, o fluxo da prévia. */
export type OpcoesDeVideo = Pick<PedidoDeVideo, "camera" | "qualidade" | "fluxoDaCamera">;

/** O vídeo da tentativa (o `GravadorDeVideo`, ou um falso). Nunca lança: falhas viram "só áudio". */
export interface VideoLike {
  iniciar(p: PedidoDeVideo): Promise<MotivoSemVideo | null>;
  /** Fim normal: finaliza o vídeo (inteiro, se não tinha parado antes). */
  parar(): Promise<void>;
  /** Cancelada ou descartada sem salvar: solta a câmera e apaga o vídeo não salvo. */
  cancelar(): Promise<void>;
}

export interface ApitoLike {
  /** Agenda o apito para daqui a `emSegundos` no relógio do áudio da escuta; null se foi cancelado. `quando` e os eventos usam o mesmo relógio. */
  agendar(emSegundos: number): Promise<{ quando: number; atraso: number } | null>;
  cancelar(): void;
}

export type Dependencias = {
  escuta: EscutaLike;
  apito: ApitoLike;
  /** O vídeo da tentativa; sem ele, ou sem `OpcoesDeVideo` no `iniciar`, a tentativa é só áudio. */
  video?: VideoLike;
  /** Um id novo para a tentativa (o `novoId` do app; os testes passam o deles). */
  novoId: () => string;
  /** O aviso de que o Standby começou (vibração, bipe curto): devolve quanto ele dura (ms); o atraso sorteado só começa a contar DEPOIS dele. Opcional. */
  avisar?: (prefs: PrefsTimer) => Promise<number>;
  /** O 1 toque da vibração 3/2/1 no instante agendado do apito, e a parada de qualquer vibração ao cancelar. Opcionais. */
  vibrarPartida?: (prefs: PrefsTimer) => void;
  pararVibracao?: () => void;
  /** Agenda `fn` para daqui a `ms`; devolve o cancelamento. */
  em: (ms: number, fn: () => void) => () => void;
  /** Número em [0, 1). */
  sortear: () => number;
  /** Liga o serviço Android (devolve true se ele assumiu) e o solta. Fora do Android: sem efeito. */
  armarServico: () => boolean;
  desarmarServico: () => void;
  foneConectado: () => boolean;
  /** Traduz o erro do navegador. */
  motivoDoErro: (e: unknown) => "negada" | "sem_microfone" | "indisponivel" | "falhou";
  /** ISO 8601 de agora (um falso nos testes). */
  agoraIso: () => string;
};
