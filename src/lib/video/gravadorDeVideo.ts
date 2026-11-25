// O vídeo da tentativa (V1b): abre a câmera num `getUserMedia` PRÓPRIO (o do microfone fica como está, C2), junta a imagem dela à faixa de áudio do microfone
// num fluxo composto e grava com um SEGUNDO MediaRecorder (C1: o gravador do áudio, que alimenta o detector, o reprocesso e o Ogg, não muda). Cada pedaço de ~1 s
// vai direto ao IndexedDB, em ordem, por uma fila de promessas: nada de juntar dezenas de MB na memória (C7), e uma queda no meio deixa o que já foi gravado.
// Nunca derruba a escuta: se a câmera falhar, a tentativa segue só com áudio e `iniciar` diz por quê. O vídeo usa o MESMO id da tentativa (nasce no Standby).
// V1c: o Android não abre a mesma câmera duas vezes, então, com a pré-visualização ligada, o gravador usa o fluxo DELA (emprestado: não o para ao fim, a
// prévia segue para a próxima tentativa); com a prévia desligada (ou com a faixa já encerrada), abre a câmera como antes. Guarda também quanto depois do
// áudio o vídeo começou (`inicioDoVideoMs`, ver alinhamento.ts), para a Revisão achar cada disparo no vídeo.
import type { ArmazenamentoDeVideos } from "../armazenamento/videos";
import { aguardarParada } from "../escutaGravador";
import type { LimitesDeVideo } from "./politica";
import { fabricasDeVideoDoNavegador, motivoDaCamera, pararFaixas, type FabricasDeVideo, type MotivoSemVideo } from "./fabricasDeVideo";
import { abrirCameraComRecuo } from "./camera";
import { ladoMenorDoFluxo, qualidadeEntregue, type Camera, type Qualidade } from "./formato";
import { deslocamentoDoVideoMs } from "./alinhamento";

export type { MotivoSemVideo } from "./fabricasDeVideo";

/**
 * O que gravar: `id` da tentativa, o fluxo do microfone (a faixa de áudio vai junto no vídeo; nulo = vídeo mudo), a câmera e a qualidade escolhidas.
 * `inicioDoAudioMs`: quando a gravação do áudio começou (`performance.now()`), para medir o atraso do vídeo; `fluxoDaCamera`: a câmera já aberta pela prévia.
 */
export type PedidoDeVideo = { id: string; audio: MediaStream | null; camera: Camera; qualidade: Qualidade; inicioDoAudioMs?: number; fluxoDaCamera?: MediaStream | null };
/** As operações do banco que o vídeo usa (o `armazenamento` do app, ou um falso). Guardar o zero é opcional (um falso pode não ter). */
export type LojaDeVideos = Pick<ArmazenamentoDeVideos, "iniciarVideo" | "gravarPedaco" | "finalizarVideo" | "apagarVideo" | "limparVideos"> &
  Partial<Pick<ArmazenamentoDeVideos, "definirZeroDoVideo">>;

/** Quanto se espera a câmera abrir (ms): sem limite, uma câmera que nunca responde prenderia o Standby em "preparando". */
export const LIMITE_DA_CAMERA_MS = 10_000;

/** A câmera da gravação; `emprestada`: é o fluxo da prévia, que continua dela (não é parado ao fim). */
type CameraDaGravacao = { fluxo: MediaStream; emprestada: boolean };
type Gravacao = { id: string; gravador: MediaRecorder; camera: CameraDaGravacao; n: number };

export class GravadorDeVideo {
  private gravacao: Gravacao | null = null;
  /** O vídeo guardado cuja tentativa ainda não foi salva: é apagado se ela for cancelada, descartada ou substituída por outra. */
  private pendente: string | null = null;
  /** Todas as escritas no banco, em ordem (iniciar, pedaços, finalizar, apagar, limpar): uma só começa quando a anterior acabou. */
  private fila: Promise<void> = Promise.resolve();
  private parada: Promise<void> | null = null;
  /** Muda a cada `iniciar` e `cancelar`: uma câmera que chega depois de cancelada é solta e esquecida. */
  private geracao = 0;

  constructor(
    private readonly loja: LojaDeVideos,
    private readonly fabricas: FabricasDeVideo = fabricasDeVideoDoNavegador,
  ) {}

  get gravando(): boolean {
    return this.gravacao !== null;
  }

  /** Quem quer saber quando chega cada pedaço (o medidor de desempenho, video/desempenho.ts): só observa, não muda nada; uma falha do ouvinte é ignorada. */
  private readonly ouvintesDePedaco = new Set<() => void>();
  /** Assina o aviso de pedaço chegado; devolve como cancelar. */
  ouvirPedacos(ouvinte: () => void): () => void {
    this.ouvintesDePedaco.add(ouvinte);
    return () => void this.ouvintesDePedaco.delete(ouvinte);
  }

  /** Abre a câmera e começa a gravar. Devolve nulo se gravando, ou o motivo de seguir só com áudio (nunca lança). Descarta um vídeo anterior não salvo. */
  async iniciar(p: PedidoDeVideo): Promise<MotivoSemVideo | null> {
    void this.cancelar();
    const minha = ++this.geracao;
    const tipo = this.fabricas.formato();
    if (!tipo) return "sem_formato";
    const daPrevia = cameraViva(p.fluxoDaCamera);
    if (daPrevia) return this.gravar(p, { fluxo: daPrevia, emprestada: true }, tipo, qualidadeEntregue(p.qualidade, ladoMenorDoFluxo(daPrevia)));
    if (!this.fabricas.temCamera()) return "sem_camera";
    let aberta: Awaited<ReturnType<typeof abrirCameraComRecuo>>;
    try {
      aberta = await abrirCameraComRecuo((r) => abrirComLimite(this.fabricas, r), p.camera, p.qualidade);
    } catch (e) {
      return motivoDaCamera(e);
    }
    const camera = aberta.fluxo;
    if (minha !== this.geracao) {
      pararFaixas(camera); // cancelada enquanto a câmera abria: ela não pode ficar ligada
      return "falhou";
    }
    return this.gravar(p, { fluxo: camera, emprestada: false }, tipo, aberta.entregue);
  }

  /** `qualidade`: a que a câmera entregou (o bitrate segue ela: um 4K que veio em 1080p grava com o bitrate do 1080p). */
  private gravar(p: PedidoDeVideo, camera: CameraDaGravacao, tipo: string, qualidade: Qualidade): MotivoSemVideo | null {
    let gravador: MediaRecorder;
    try {
      gravador = this.fabricas.gravador(this.fabricas.compor([...camera.fluxo.getVideoTracks(), ...(p.audio?.getAudioTracks() ?? [])]), tipo, qualidade);
    } catch (e) {
      console.warn("video: o gravador de vídeo não abriu; segue só com áudio", e);
      soltarCamera(camera);
      return "falhou";
    }
    const g: Gravacao = { id: p.id, gravador, camera, n: 0 };
    this.gravacao = g;
    this.pendente = p.id;
    gravador.ondataavailable = (e) => {
      this.avisarPedaco();
      this.guardar(g, e.data);
    };
    // A câmera que cai no meio (outro app a tomou, erro do gravador) para só o vídeo; o áudio e a tentativa seguem (C8).
    gravador.onerror = () => this.interromperSe(g);
    camera.fluxo.getVideoTracks().forEach((t) => t.addEventListener("ended", () => this.interromperSe(g)));
    gravador.start(1000);
    // Medido logo depois do `start`, como o áudio (Escuta): os dois começos no mesmo relógio. O registro vai à fila antes de qualquer pedaço (que leva ~1 s).
    const atraso = deslocamentoDoVideoMs(p.inicioDoAudioMs, (this.fabricas.agora ?? agoraDoNavegador)());
    void this.enfileirar(() => this.loja.iniciarVideo(p.id, gravador.mimeType || tipo, atraso)).catch(() => this.interromperSe(g));
    return null;
  }

  private avisarPedaco(): void {
    for (const o of this.ouvintesDePedaco) {
      try {
        o();
      } catch {
        // um medidor com defeito não pode atrapalhar a gravação
      }
    }
  }

  /** Um pedaço chegou: vai à fila com o próximo número. Se a escrita falhar (espaço cheio), o vídeo para como parcial. */
  private guardar(g: Gravacao, dados: Blob): void {
    if (dados.size === 0) return;
    const n = g.n++;
    void this.enfileirar(() => this.loja.gravarPedaco(g.id, n, dados)).catch(() => this.interromperSe(g));
  }

  private interromperSe(g: Gravacao): void {
    if (this.gravacao === g) void this.interromper();
  }

  /** Fim normal da tentativa: para o vídeo e o marca inteiro (se ele já tinha parado antes, fica parcial). Espera as escritas. */
  parar(): Promise<void> {
    return this.encerrar(false);
  }

  /** O vídeo parou antes da tentativa (app oculto, tela bloqueada, câmera caiu, C8): finaliza como parcial; o áudio segue. */
  interromper(): Promise<void> {
    return this.encerrar(true);
  }

  private encerrar(parcial: boolean): Promise<void> {
    const g = this.gravacao;
    if (!g) return this.parada ?? this.fila;
    this.gravacao = null;
    const parada = this.pararGravacao(g, parcial).finally(() => {
      if (this.parada === parada) this.parada = null;
    });
    this.parada = parada;
    return parada;
  }

  private async pararGravacao(g: Gravacao, parcial: boolean): Promise<void> {
    // O último pedaço chega antes do `onstop`: só depois dele a câmera é solta e o vídeo finalizado.
    await new Promise<void>((ok) => aguardarParada(g.gravador, ok));
    soltarGravacao(g);
    await this.enfileirar(() => this.loja.finalizarVideo(g.id, parcial)).catch(() => {});
  }

  /** Tentativa cancelada ou descartada sem salvar: solta a câmera na hora e apaga o vídeo dela. Um vídeo já confirmado (salvo) fica. */
  cancelar(): Promise<void> {
    this.geracao++;
    const g = this.gravacao;
    this.gravacao = null;
    if (g) soltarGravacao(g);
    const id = this.pendente;
    this.pendente = null;
    if (id) void this.enfileirar(() => this.loja.apagarVideo(id)).catch(() => {});
    return this.fila;
  }

  /**
   * A tentativa `id` foi salva: o vídeo dela fica (com o zero no áudio como ficou na Revisão, se veio), e a retenção de Ajustes apaga o que passou do prazo
   * ou do espaço (nunca este vídeo). Uma falha na limpeza não desfaz o salvar.
   */
  confirmar(id: string, limites: LimitesDeVideo, zeroNoAudioS?: number | null): Promise<void> {
    if (this.pendente === id) this.pendente = null;
    const definir = this.loja.definirZeroDoVideo?.bind(this.loja);
    if (definir && zeroNoAudioS != null) void this.enfileirar(() => definir(id, Math.round(zeroNoAudioS * 1000))).catch(() => {});
    return this.enfileirar(() => this.loja.limparVideos(limites, [id])).catch(() => {});
  }

  /** Põe `passo` no fim da fila; a promessa devolvida falha se ele falhar, mas a fila segue para o próximo. */
  private enfileirar(passo: () => Promise<unknown>): Promise<void> {
    const feito = this.fila.then(passo).then(() => {});
    this.fila = feito.catch((e) => console.warn("video: a escrita no banco falhou", e));
    return feito;
  }
}

/** Abre a câmera, mas desiste depois de `LIMITE_DA_CAMERA_MS`; uma câmera que chega depois disso é solta na hora. */
function abrirComLimite(f: FabricasDeVideo, restricoes: MediaStreamConstraints): Promise<MediaStream> {
  return new Promise<MediaStream>((ok, falha) => {
    let vencido = false;
    const limite = setTimeout(() => {
      vencido = true;
      falha(Object.assign(new Error("a câmera não respondeu"), { name: "TimeoutError" }));
    }, LIMITE_DA_CAMERA_MS);
    const chegou = (fluxo: MediaStream) => {
      clearTimeout(limite);
      if (vencido) pararFaixas(fluxo);
      else ok(fluxo);
    };
    f.abrirCamera(restricoes).then(chegou, (e) => {
      clearTimeout(limite);
      falha(e);
    });
  });
}

const agoraDoNavegador = () => performance.now();

/** O fluxo da prévia, se ainda tem imagem viva (uma faixa encerrada não grava nada: aí o gravador abre a câmera ele mesmo). */
function cameraViva(fluxo: MediaStream | null | undefined): MediaStream | null {
  return fluxo?.getVideoTracks().some((t) => t.readyState !== "ended") ? fluxo : null;
}

/** Solta a câmera, a menos que seja a da prévia (ela segue ligada para a próxima tentativa e é a prévia quem a desliga). */
function soltarCamera(c: CameraDaGravacao): void {
  if (!c.emprestada) pararFaixas(c.fluxo);
}

/** Esquece o gravador (para sem esperar, se ainda corria) e solta a câmera. As faixas de áudio são do microfone e ficam com a escuta. */
function soltarGravacao(g: Gravacao): void {
  const r = g.gravador;
  r.ondataavailable = null;
  r.onerror = null;
  r.onstop = null;
  if (r.state !== "inactive") {
    try {
      r.stop();
    } catch {
      // já parado
    }
  }
  soltarCamera(g.camera);
}
