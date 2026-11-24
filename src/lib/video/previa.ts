// A pré-visualização da câmera do modo vídeo (V1c). Abre a câmera num `getUserMedia` só dela (o microfone fica com a escuta, C2) e só quando a pessoa toca em Standby no modo vídeo (a tela cheia abre e a câmera liga, V2b): isso também pede a permissão da câmera ANTES do Standby, longe do limite de 10 s do gravador. O Android não abre a mesma
// câmera duas vezes, então o gravador da tentativa usa este mesmo fluxo (emprestado) enquanto a prévia está ligada. Desliga fora da aba, com o app oculto e
// depois de 60 s sem Standby (C14: calor e bateria); durante o Standby e a gravação ela fica, porque é a imagem que está sendo gravada.
import { fabricasDeVideoDoNavegador, motivoDaCamera, pararFaixas, type FabricasDeVideo, type MotivoSemVideo } from "./fabricasDeVideo";
import { abrirCameraComRecuo, type CameraAberta } from "./camera";
import type { Camera, Qualidade } from "./formato";

/** Quanto a prévia fica ligada sem Standby (ms). */
export const PREVIA_OCIOSA_MS = 60_000;

/** O que decide se a prévia pode continuar ligada. `paradaHaMs`: quanto tempo desde que ela ligou ou desde o fim do último Standby. */
export type SituacaoDaPrevia = { modoVideo: boolean; abaAtiva: boolean; visivel: boolean; ocupado: boolean; paradaHaMs: number };

/**
 * A prévia pode ficar ligada? Com o app oculto, nunca (a câmera para de qualquer jeito). Durante o Standby e a gravação, sempre (o vídeo sai dela, mesmo
 * que a pessoa troque de aba). Parado: só no modo vídeo, na aba Timer e antes de 60 s.
 */
export function previaPodeFicar(s: SituacaoDaPrevia): boolean {
  if (!s.visivel) return false;
  if (s.ocupado) return true;
  return s.modoVideo && s.abaAtiva && s.paradaHaMs < PREVIA_OCIOSA_MS;
}

/** O fluxo da câmera da prévia: ligar, desligar e o aviso de que mudou (a câmera caiu, outro app a tomou). */
export class PreviaDaCamera {
  /** Quem desenha a prévia: chamado quando o fluxo some sozinho. */
  aoMudar: (() => void) | null = null;
  private _fluxo: MediaStream | null = null;
  /** A altura que a câmera entregou, se foi MENOS que a pedida (o 4K recuou para 1080p, ou veio menos ainda): a tela avisa. Nulo = entregou o pedido. */
  recuouPara: number | null = null;
  /** Muda a cada `ligar` e `desligar`: uma câmera que chega depois de desligada é solta e esquecida. */
  private geracao = 0;

  constructor(private readonly fabricas: Pick<FabricasDeVideo, "temCamera" | "abrirCamera"> = fabricasDeVideoDoNavegador) {}

  get fluxo(): MediaStream | null {
    return this._fluxo;
  }

  /** Abre a câmera (troca a que estava). Devolve nulo se ligou (ou se foi desligada no meio), ou o motivo de não ter imagem. Nunca lança. */
  async ligar(camera: Camera, qualidade: Qualidade): Promise<MotivoSemVideo | null> {
    this.desligar();
    const minha = ++this.geracao;
    if (!this.fabricas.temCamera()) return "sem_camera";
    let aberta: CameraAberta;
    try {
      aberta = await abrirCameraComRecuo((r) => this.fabricas.abrirCamera(r), camera, qualidade);
    } catch (e) {
      return minha === this.geracao ? motivoDaCamera(e) : null;
    }
    const fluxo = aberta.fluxo;
    if (minha !== this.geracao) {
      pararFaixas(fluxo); // desligada enquanto a câmera abria: ela não pode ficar ligada
      return null;
    }
    this._fluxo = fluxo;
    this.recuouPara = aberta.recuou ? aberta.entregue.altura : null;
    fluxo.getVideoTracks().forEach((t) => t.addEventListener("ended", () => this.caiu(fluxo)));
    return null;
  }

  /** Solta a câmera (pode ser chamado à vontade). */
  desligar(): void {
    this.geracao++;
    const f = this._fluxo;
    this._fluxo = null;
    this.recuouPara = null;
    if (f) pararFaixas(f);
  }

  private caiu(fluxo: MediaStream): void {
    if (this._fluxo !== fluxo) return;
    this.desligar();
    this.aoMudar?.();
  }
}
