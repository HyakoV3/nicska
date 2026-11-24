// Os textos dos avisos do modo vídeo que dependem de um motivo (a tela só escolhe a chave; o texto está nos dicionários, src/lib/i18n).
import type { MotivoSemVideo } from "./fabricasDeVideo";

export type ChaveDoSemVideo = `registro.sem_video_${MotivoSemVideo}`;

/** Por que a tentativa segue só com o áudio, na chave do aviso: "negada" → "registro.sem_video_negada". */
export const chaveDoSemVideo = (m: MotivoSemVideo): ChaveDoSemVideo => `registro.sem_video_${m}`;

export type ChaveDaPrevia = `registro.previa_${MotivoSemVideo}`;

/** Por que a prévia não abriu, na chave do aviso (a tentativa ainda pode tentar abrir a câmera no Standby). */
export const chaveDaPrevia = (m: MotivoSemVideo): ChaveDaPrevia => `registro.previa_${m}`;
