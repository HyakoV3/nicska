// As peças do navegador que o vídeo da tentativa usa (getUserMedia da câmera, MediaStream composto, MediaRecorder de vídeo), atrás de uma interface,
// como em escutaNavegador.ts: o `GravadorDeVideo` não instancia nada concreto e os testes entregam falsos. `fabricasDeVideoDoNavegador` são as de verdade.
import { BITS_DO_AUDIO_NO_VIDEO, bitsDoVideo, escolherFormatoDeVideo, type Qualidade } from "./formato";

/** Por que a tentativa ficou só com áudio: a pessoa negou a câmera, não há câmera, o aparelho não grava vídeo, ou outra falha. A V1c mostra o aviso. */
export type MotivoSemVideo = "negada" | "sem_camera" | "sem_formato" | "falhou";

export interface FabricasDeVideo {
  /** O navegador sabe abrir a câmera? */
  temCamera(): boolean;
  /** O formato de vídeo que o aparelho grava (`escolherFormatoDeVideo`), ou nulo se não há `MediaRecorder` de vídeo. */
  formato(): string | null;
  /** Abre a câmera num `getUserMedia` só dela (o do microfone fica como está, C2). */
  abrirCamera(restricoes: MediaStreamConstraints): Promise<MediaStream>;
  /** Junta as faixas (imagem da câmera + áudio do microfone) num fluxo só, para o gravador de vídeo. */
  compor(faixas: MediaStreamTrack[]): MediaStream;
  /** O segundo gravador (vídeo + áudio), no `tipo` escolhido e com o bitrate fixo da qualidade (C9). */
  gravador(fluxo: MediaStream, tipo: string, q: Qualidade): MediaRecorder;
  /** O relógio do início da gravação (ms, o mesmo `performance.now()` da escuta). Opcional: sem ele, `performance.now()`. */
  agora?(): number;
}

export const fabricasDeVideoDoNavegador: FabricasDeVideo = {
  temCamera: () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
  formato: () => (typeof MediaRecorder === "undefined" ? null : escolherFormatoDeVideo((t) => MediaRecorder.isTypeSupported(t))),
  abrirCamera: (restricoes) => navigator.mediaDevices.getUserMedia(restricoes),
  compor: (faixas) => new MediaStream(faixas),
  gravador: (fluxo, tipo, q) => new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: bitsDoVideo(q), audioBitsPerSecond: BITS_DO_AUDIO_NO_VIDEO }),
};

/** Traduz o erro do `getUserMedia` da câmera no motivo que a tela explica (como `motivoDoErro` faz para o microfone). */
export function motivoDaCamera(e: unknown): MotivoSemVideo {
  const nome = typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") return "negada";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "sem_camera";
  return "falhou";
}

/** Para as faixas de um fluxo (devolve a câmera ao aparelho). */
export const pararFaixas = (fluxo: MediaStream): void => fluxo.getTracks().forEach((t) => t.stop());
