// Motor A da exportação com os tempos (V3, achado 19 da revisão): cada quadro do vídeo (lido do <video> escondido, videoEscondido.ts) vira imagem + overlay
// num canvas, vai ao `VideoEncoder` em H.264 e o MP4 é montado pelo `mp4-muxer` (MIT; carregado só ao exportar). O som sai do próprio arquivo: decodificado
// pelo WebAudio e recodificado em AAC pelo `AudioEncoder` (Opus no MP4 se o aparelho não tiver AAC). MP4 + H.264 + AAC é o que o WhatsApp e os outros apps
// tocam sem conversão. O vídeo toca 1× (o decodificador é o do <video>): não é mais rápido que o tempo real, mas o arquivo é MP4 de verdade.
// Só roda se o codificador aceita H.264 NA RESOLUÇÃO DO VÍDEO; senão joga `MotorIndisponivel` e o motor B tenta. Encoder, decoder, <video> e URL sempre se soltam.
import type { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { MotorIndisponivel, bitrateDaExportacao, conferirSinal, tamanhoDaExportacao, type AoProgresso, type EntradaDaExportacao, type MotorDeExportacao } from "./exportacao";
import { criarDesenhista, criarTela, type Tela } from "./quadroComOverlay";
import { abrirVideoEscondido, tocarAteOFim, type VideoEscondido } from "./videoEscondido";

/** Do mais ao menos desejado: Main e High no nível 4.0 (até 1080p), Baseline 4.0 e Baseline 3.1 (até 720p). A exportação sai em até 1080p (`tamanhoDaExportacao`), então não precisa do nível 5.x. */
export const CODECS_AVC = ["avc1.4d0028", "avc1.640028", "avc1.42e028", "avc1.42001f"] as const;
const TAXA_DO_AUDIO = 48_000;
/** Mais que isto na fila do codificador e o vídeo pausa até esvaziar (memória contida em vídeo longo). */
const FILA_MAXIMA = 4;
/** Depois de quantos quadros se confere se o codificador entrega a configuração do vídeo. */
const QUADROS_DA_SONDA = 5;
type Mux = Muxer<ArrayBufferTarget>;
type AudioDoVideo = { buffer: AudioBuffer; codec: "aac" | "opus"; config: AudioEncoderConfig };

/** A configuração H.264 que o aparelho aceita para `largura` × `altura`, ou nula. */
export async function configAvc(largura: number, altura: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS_AVC) {
    const config: VideoEncoderConfig = { codec, width: largura, height: altura, bitrate, framerate: 30, latencyMode: "quality", avc: { format: "avc" } };
    const r = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (r?.supported) return config;
  }
  return null;
}

/** O som do vídeo decodificado (48 kHz) e o codificador de áudio que o aparelho tem (AAC, senão Opus). Sem som ou sem codificador: o motor não serve. */
async function prepararAudio(video: Blob): Promise<AudioDoVideo> {
  let buffer: AudioBuffer;
  try {
    buffer = await new OfflineAudioContext(1, 1, TAXA_DO_AUDIO).decodeAudioData(await video.arrayBuffer());
  } catch {
    throw new MotorIndisponivel("o som do vídeo não decodificou");
  }
  const base = { sampleRate: TAXA_DO_AUDIO, numberOfChannels: Math.min(2, buffer.numberOfChannels), bitrate: 128_000 };
  for (const [codec, nome] of [["mp4a.40.2", "aac"], ["opus", "opus"]] as const) {
    const r = await AudioEncoder.isConfigSupported({ ...base, codec }).catch(() => null);
    if (r?.supported) return { buffer, codec: nome, config: { ...base, codec } };
  }
  throw new MotorIndisponivel("sem codificador de áudio para MP4");
}

/** Espera a fila do codificador baixar (o evento `dequeue` quando há; senão olha de 10 em 10 ms). */
function esvaziar(enc: VideoEncoder | AudioEncoder): Promise<void> {
  return new Promise((ok) => {
    const olhar = () => (enc.state === "closed" || enc.encodeQueueSize <= 1 ? ok() : setTimeout(olhar, 10));
    olhar();
  });
}

/** O pedaço de som que começa na amostra `i` (até 1 s), planar: um canal depois do outro. */
function pedacoDeAudio(buffer: AudioBuffer, i: number, canais: number): AudioData {
  const n = Math.min(TAXA_DO_AUDIO, buffer.length - i);
  const dados = new Float32Array(n * canais);
  for (let c = 0; c < canais; c++) dados.set(buffer.getChannelData(c).subarray(i, i + n), c * n);
  return new AudioData({ format: "f32-planar", sampleRate: TAXA_DO_AUDIO, numberOfFrames: n, numberOfChannels: canais, timestamp: Math.round((i / TAXA_DO_AUDIO) * 1e6), data: dados });
}

/** Codifica o som inteiro, de 1 s em 1 s, antes da imagem: é rápido e o muxer guarda tudo até o fim. */
async function codificarAudio(a: AudioDoVideo, mux: Mux, sinal: AbortSignal): Promise<void> {
  let erro: unknown = null;
  const enc = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: (e) => (erro = e) });
  try {
    enc.configure(a.config);
    for (let i = 0; i < a.buffer.length && !erro; i += TAXA_DO_AUDIO) {
      conferirSinal(sinal);
      const pedaco = pedacoDeAudio(a.buffer, i, a.config.numberOfChannels);
      enc.encode(pedaco);
      pedaco.close();
      if (enc.encodeQueueSize > FILA_MAXIMA) await esvaziar(enc);
    }
    await enc.flush();
    if (erro) throw erro;
  } finally {
    if (enc.state !== "closed") enc.close();
  }
}

type Codificacao = { entrada: EntradaDaExportacao; mux: Mux; aoProgresso: AoProgresso; sinal: AbortSignal };

/** O que fazer a cada quadro: desenhar imagem + overlay, codificar (um quadro-chave a cada 2 s: o pulo no arquivo final fica bom) e contar o progresso. */
function aCadaQuadro(v: VideoEscondido, enc: VideoEncoder, c: Codificacao & { tela: Tela; falhou: () => unknown }): (t: number) => Promise<void> | undefined {
  const desenhar = criarDesenhista(c.tela, c.entrada.desenho);
  let ultimaChave = Number.NEGATIVE_INFINITY;
  return (t) => {
    const erro = c.falhou();
    if (erro) throw erro;
    desenhar(v.el, t);
    const quadro = new VideoFrame(c.tela.canvas, { timestamp: Math.round(t * 1e6) });
    const chave = t - ultimaChave >= 2;
    if (chave) ultimaChave = t;
    enc.encode(quadro, { keyFrame: chave });
    quadro.close();
    c.aoProgresso(v.duracaoS ? Math.min(1, t / v.duracaoS) : null);
    return enc.encodeQueueSize > FILA_MAXIMA ? esvaziar(enc) : undefined;
  };
}

/** Toca o vídeo inteiro e codifica cada quadro com o overlay. */
async function codificarVideo(v: VideoEscondido, config: VideoEncoderConfig, c: Codificacao): Promise<void> {
  let erro: unknown = null;
  let quadros = 0;
  let comConfig = false;
  const enc = new VideoEncoder({
    output: (q, m) => {
      quadros++;
      comConfig ||= !!m?.decoderConfig;
      c.mux.addVideoChunk(q, m);
    },
    error: (e) => (erro = e),
  });
  try {
    enc.configure(config);
    const tela = criarTela(config.width, config.height, true);
    // Alguns codificadores de aparelho não entregam a configuração (SPS/PPS) com o 1º quadro: sem ela o MP4 não monta. Não é falha da pessoa: passa ao motor B.
    // Confere nos primeiros quadros (e não só no fim), para não processar o vídeo inteiro duas vezes (motor A inteiro e depois o B).
    const conferir = () => {
      if (erro) throw erro;
      if (quadros === 0 || !comConfig) throw new MotorIndisponivel(`o codificador H.264 do aparelho não entregou a configuração do vídeo (${quadros} quadros)`);
    };
    const cada = aCadaQuadro(v, enc, { ...c, tela, falhou: () => erro });
    let n = 0;
    await tocarAteOFim(v, (t) => (++n === QUADROS_DA_SONDA ? Promise.resolve(cada(t)).then(() => enc.flush()).then(conferir) : cada(t)), c.sinal);
    await enc.flush();
    conferir();
  } finally {
    if (enc.state !== "closed") enc.close();
  }
}

async function exportar(entrada: EntradaDaExportacao, aoProgresso: AoProgresso, sinal: AbortSignal): Promise<Blob> {
  const v = await abrirVideoEscondido(entrada.video, true, sinal);
  try {
    const { largura, altura } = tamanhoDaExportacao(v.largura, v.altura);
    const config = await configAvc(largura, altura, bitrateDaExportacao(entrada.video.size, v.duracaoS ?? Number.NaN));
    if (!config) throw new MotorIndisponivel(`H.264 não aceita ${v.largura}×${v.altura}`);
    const audio = await prepararAudio(entrada.video);
    conferirSinal(sinal);
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const alvo = new ArrayBufferTarget();
    const audioDoMux = { codec: audio.codec, numberOfChannels: audio.config.numberOfChannels, sampleRate: TAXA_DO_AUDIO };
    const mux = new Muxer({ target: alvo, video: { codec: "avc", width: config.width, height: config.height }, audio: audioDoMux, fastStart: "in-memory", firstTimestampBehavior: "cross-track-offset" });
    await codificarAudio(audio, mux, sinal);
    await codificarVideo(v, config, { entrada, mux, aoProgresso, sinal });
    mux.finalize();
    aoProgresso(1);
    return new Blob([alvo.buffer], { type: "video/mp4" });
  } finally {
    v.soltar();
  }
}

export const motorWebCodecs: MotorDeExportacao = { id: "webcodecs", exportar };
