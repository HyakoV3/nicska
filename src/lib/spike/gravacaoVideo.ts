// SPIKE S1, passo 3 (EXPERIMENTAL, descartável): o vídeo do spike (câmera num `getUserMedia` separado) e o gravador B (vídeo + áudio, 2 Mbps, um pedaço por segundo).
import { BITS_POR_SEGUNDO } from "../audioComum";
import { abrirCamera, aguardarPrimeiroQuadro, descreverTrilhaDeVideo, ligarPrevia, type PrimeiroQuadro } from "./camera";
import { evento } from "./estado.svelte";
import { resumirFps, type ResumoFps } from "./estatisticas";
import { escolherMimeVideo } from "./mime";
import type { Lado } from "./restricoes";

export const VIDEO_BITS_POR_SEGUNDO = 2_000_000;

export type VideoAberto = { fluxo: MediaStream; trilha: MediaStreamTrack | undefined; settingsInicio: MediaTrackSettings; primeiroQuadro: PrimeiroQuadro };

/** Abre a câmera (separada do microfone), mostra na `previa` e espera o 1º quadro. */
export async function abrirVideo({ fps, lado, previa }: { fps: number; lado: Lado; previa: HTMLVideoElement }): Promise<VideoAberto> {
  const t0 = performance.now();
  const fluxo = await abrirCamera({ lado, fps });
  ligarPrevia(previa, fluxo);
  const primeiroQuadro = await aguardarPrimeiroQuadro(previa, t0);
  return { fluxo, trilha: fluxo.getVideoTracks()[0], settingsInicio: descreverTrilhaDeVideo(fluxo).settings, primeiroQuadro };
}

/** Escuta `mute`, `unmute` e `ended` de uma trilha e anexa à linha do tempo. */
export function vigiarTrilha(trilha: MediaStreamTrack | null | undefined, nome: string): void {
  for (const e of ["mute", "unmute", "ended"]) trilha?.addEventListener(e, () => evento(`trilha-${nome}-${e}`, { readyState: trilha.readyState }));
}

export type GravadorB = { gravador: MediaRecorder; pedacos: Blob[]; mimePedido: string | null; parar: () => Promise<Blob> };

function opcoesDoGravadorB(mime: string | null): MediaRecorderOptions {
  const o: MediaRecorderOptions = { videoBitsPerSecond: VIDEO_BITS_POR_SEGUNDO, audioBitsPerSecond: BITS_POR_SEGUNDO };
  if (mime) o.mimeType = mime;
  return o;
}

/** Começa o gravador B sobre vídeo + áudio, `timeslice` de 1000 ms, no primeiro formato suportado da preferência. */
export function iniciarGravadorB(trilhas: MediaStreamTrack[]): GravadorB {
  const mimePedido = escolherMimeVideo((t) => MediaRecorder.isTypeSupported(t));
  const gravador = new MediaRecorder(new MediaStream(trilhas), opcoesDoGravadorB(mimePedido));
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => void (e.data.size > 0 && pedacos.push(e.data));
  gravador.onerror = () => evento("gravadorB-onerror");
  gravador.onpause = () => evento("gravadorB-onpause");
  gravador.onstart = () => evento("gravadorB-onstart", { mimeType: gravador.mimeType });
  const parou = new Promise<void>((ok) => (gravador.onstop = () => (evento("gravadorB-onstop"), ok())));
  gravador.start(1000);
  const parar = async () => {
    if (gravador.state !== "inactive") gravador.stop();
    await Promise.race([parou, new Promise((ok) => setTimeout(ok, 5000))]);
    return new Blob(pedacos, { type: gravador.mimeType || mimePedido || "" });
  };
  return { gravador, pedacos, mimePedido, parar };
}

type ComQuadros = HTMLVideoElement & { requestVideoFrameCallback?: (f: (agora: number, meta: { presentedFrames: number }) => void) => number };

/** Conta os quadros apresentados na pré-visualização enquanto grava (`requestVideoFrameCallback`). */
export function contarEnquantoGrava(video: HTMLVideoElement): { parar: () => { resumo: ResumoFps; quadrosApresentados: number | null } } {
  const v = video as ComQuadros;
  const instantes: number[] = [];
  const estado = { vivo: true, apresentados: null as number | null };
  const passo = (agora: number, meta: { presentedFrames: number }) => {
    if (!estado.vivo) return;
    instantes.push(agora);
    estado.apresentados = meta.presentedFrames;
    v.requestVideoFrameCallback?.(passo);
  };
  v.requestVideoFrameCallback?.(passo);
  return { parar: () => ((estado.vivo = false), { resumo: resumirFps(instantes), quadrosApresentados: estado.apresentados }) };
}
