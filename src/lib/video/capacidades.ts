// O que o aparelho oferece para exportar com os tempos (V3), lido na hora (a WebView do Android muda de versão com a loja): WebCodecs com H.264 (motor A),
// captura do canvas e gravador (motor B) e o quadro a quadro do <video>. A escolha pelo que se leu é pura (`motoresPossiveis`, exportacao.ts). Nada aqui
// joga: uma API ausente ou que falha conta como "não tem". O H.264 é conferido numa resolução comum (720p); o motor A confere de novo com a do vídeo, já reduzida a no máximo 1080p (um vídeo gravado em 4K sai em 1080p: `tamanhoDaExportacao`).
import { motoresPossiveis, type Capacidades, type IdDoMotor, type MotorDeExportacao } from "./exportacao";
import { formatoDoGravador, motorTempoReal } from "./motorTempoReal";
import { configAvc, motorWebCodecs } from "./motorWebCodecs";

const temFuncao = (alvo: unknown, nome: string): boolean => typeof (alvo as Record<string, unknown> | undefined)?.[nome] === "function";

/** WebCodecs inteiro para o motor A: codificadores, quadros, dados de áudio e o WebAudio que decodifica o som do arquivo. */
function temWebCodecs(): boolean {
  return ["VideoEncoder", "VideoFrame", "AudioEncoder", "AudioData", "OfflineAudioContext"].every((n) => typeof (globalThis as Record<string, unknown>)[n] === "function");
}

function gravadorDoMotorB(): string | null {
  if (typeof MediaRecorder === "undefined" || !temFuncao(MediaRecorder, "isTypeSupported")) return null;
  return formatoDoGravador((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

/** Lê o que o aparelho tem. */
export async function lerCapacidades(): Promise<Capacidades> {
  if (typeof document === "undefined") return { webCodecs: false, avc: false, quadroAQuadro: false, captura: false, gravador: null };
  const webCodecs = temWebCodecs();
  const avc = webCodecs && (await configAvc(1280, 720, 2_000_000).catch(() => null)) !== null;
  const quadroAQuadro = temFuncao(HTMLVideoElement.prototype, "requestVideoFrameCallback");
  const captura = temFuncao(HTMLCanvasElement.prototype, "captureStream") && typeof AudioContext === "function" && temFuncao(AudioContext.prototype, "createMediaStreamDestination");
  return { webCodecs, avc, quadroAQuadro, captura, gravador: gravadorDoMotorB() };
}

const MOTORES: Record<IdDoMotor, MotorDeExportacao> = { webcodecs: motorWebCodecs, "tempo-real": motorTempoReal };

/** Os motores de verdade, na ordem de preferência, para o que o aparelho tem. */
export const motoresDoAparelho = (c: Capacidades): MotorDeExportacao[] => motoresPossiveis(c).map((id) => MOTORES[id]);
