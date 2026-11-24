// Motor B da exportação com os tempos (V3, o recuo do caminho C): toca o vídeo num <video> escondido, pinta cada quadro + overlay num <canvas>
// (requestVideoFrameCallback), e um MediaRecorder grava o `captureStream` do canvas com o som do próprio vídeo. Demora o TAMANHO do vídeo (1× o tempo real)
// e reencoda com o codificador do gravador (MP4 se o aparelho grava MP4, senão WebM): a janela avisa. O som passa pelo WebAudio só até o gravador, nunca
// pelos alto-falantes (o elemento ligado a um `MediaElementSource` não toca sozinho). Com o app escondido, vídeo e gravador pausam juntos (achado 19).
// Tudo se solta no fim: faixas, contexto de áudio, gravador, <video> e URL.
import { comDuracao } from "../webm/duracao";
import { bitrateDaExportacao, conferirSinal, tamanhoDaExportacao, type AoProgresso, type EntradaDaExportacao, type MotorDeExportacao } from "./exportacao";
import { criarDesenhista, criarTela, type Tela } from "./quadroComOverlay";
import { abrirVideoEscondido, tocarAteOFim, type VideoEscondido } from "./videoEscondido";

/** O que o gravador do motor B tenta, do melhor ao recuo (MP4 primeiro: é o que os apps tocam). */
export const FORMATOS_DO_GRAVADOR = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"] as const;

/** O primeiro formato que o gravador aceita, ou nulo. */
export function formatoDoGravador(aceita: (tipo: string) => boolean): string | null {
  return FORMATOS_DO_GRAVADOR.find((t) => aceita(t)) ?? null;
}

type CanvasComCaptura = HTMLCanvasElement & { captureStream(fps?: number): MediaStream };
type FaixaDoCanvas = MediaStreamTrack & { requestFrame?: () => void };
/** O que se abriu para gravar e precisa ser solto. */
type Gravacao = { gravador: MediaRecorder; pedacos: Blob[]; faixas: MediaStreamTrack[]; audio: AudioContext; faixa: FaixaDoCanvas };

/** O som do <video> levado só ao gravador (um destino de fluxo, não os alto-falantes). */
function somDoVideo(el: HTMLVideoElement): { audio: AudioContext; faixas: MediaStreamTrack[] } {
  const audio = new AudioContext();
  const destino = audio.createMediaStreamDestination();
  audio.createMediaElementSource(el).connect(destino);
  void audio.resume().catch(() => {});
  return { audio, faixas: destino.stream.getAudioTracks() };
}

/** Liga o canvas (um quadro por pedido: `captureStream(0)` + `requestFrame`) e o som ao gravador, no formato escolhido. */
function abrirGravacao(canvas: CanvasComCaptura, v: VideoEscondido, c: { tipo: string; bitrate: number }): Gravacao {
  const fluxo = canvas.captureStream(0);
  const faixa = fluxo.getVideoTracks()[0] as FaixaDoCanvas | undefined;
  if (!faixa) throw new Error("exportar: o canvas não deu faixa de vídeo");
  const { audio, faixas } = somDoVideo(v.el);
  const todas = [faixa, ...faixas];
  const gravador = new MediaRecorder(new MediaStream(todas), { mimeType: c.tipo, videoBitsPerSecond: c.bitrate, audioBitsPerSecond: 128_000 });
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (e) => e.data.size > 0 && pedacos.push(e.data);
  return { gravador, pedacos, faixas: todas, audio, faixa };
}

/** Para o gravador e espera o último pedaço. */
function pararGravador(g: MediaRecorder): Promise<void> {
  if (g.state === "inactive") return Promise.resolve();
  return new Promise((ok) => {
    g.addEventListener("stop", () => ok(), { once: true });
    g.stop();
  });
}

function soltarGravacao(g: Gravacao): void {
  if (g.gravador.state !== "inactive") g.gravador.stop();
  for (const f of g.faixas) f.stop();
  void g.audio.close().catch(() => {});
}

/** O arquivo gravado com o tipo sem codec; WebM ganha a duração no cabeçalho (o mesmo remendo do vídeo gravado, C6). */
async function arquivoGravado(g: Gravacao, tipo: string): Promise<Blob> {
  const limpo = tipo.split(";")[0].trim();
  const blob = new Blob(g.pedacos, { type: limpo });
  return limpo === "video/webm" ? comDuracao(blob) : blob;
}

/** Grava o vídeo inteiro: cada quadro pintado vira um quadro do fluxo; vídeo escondido e gravador pausam e retomam juntos. */
async function gravar(v: VideoEscondido, g: Gravacao, c: { entrada: EntradaDaExportacao; aoProgresso: AoProgresso; sinal: AbortSignal; tela: Tela }): Promise<void> {
  const desenhar = criarDesenhista(c.tela, c.entrada.desenho);
  g.gravador.start(1000);
  const avisos = { pausou: () => g.gravador.state === "recording" && g.gravador.pause(), retomou: () => g.gravador.state === "paused" && g.gravador.resume() };
  await tocarAteOFim(v, (t) => {
    desenhar(v.el, t);
    g.faixa.requestFrame?.();
    c.aoProgresso(v.duracaoS ? Math.min(1, t / v.duracaoS) : null);
  }, c.sinal, avisos);
  await pararGravador(g.gravador);
}

async function exportar(entrada: EntradaDaExportacao, aoProgresso: AoProgresso, sinal: AbortSignal): Promise<Blob> {
  const tipo = formatoDoGravador((t) => MediaRecorder.isTypeSupported(t));
  if (!tipo) throw new Error("exportar: o aparelho não grava vídeo");
  const v = await abrirVideoEscondido(entrada.video, false, sinal);
  let g: Gravacao | null = null;
  try {
    const tamanho = tamanhoDaExportacao(v.largura, v.altura); // 4K sai em 1080p: o canvas de 4K em tempo real não acompanharia
    const tela = criarTela(tamanho.largura, tamanho.altura, false);
    g = abrirGravacao(tela.canvas as CanvasComCaptura, v, { tipo, bitrate: bitrateDaExportacao(entrada.video.size, v.duracaoS ?? Number.NaN) });
    await gravar(v, g, { entrada, aoProgresso, sinal, tela });
    conferirSinal(sinal);
    aoProgresso(1);
    return await arquivoGravado(g, g.gravador.mimeType || tipo);
  } finally {
    if (g) soltarGravacao(g);
    v.soltar();
  }
}

export const motorTempoReal: MotorDeExportacao = { id: "tempo-real", exportar };
