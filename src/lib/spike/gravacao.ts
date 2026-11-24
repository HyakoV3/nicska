// SPIKE S1, passo 3 (EXPERIMENTAL, descartável): uma execução do teste principal. Áudio pela `Escuta` real (gravador A), vídeo à parte (gravador B), detector contando estalos.
import { BITS_POR_SEGUNDO } from "../audioComum";
import { definirSonda, estadoDaTrilha } from "./cicloDeVida";
import { evento, liberarCameras, ultimoVideo } from "./estado.svelte";
import { bytesPorSegundo, derivaDoRelogio, intervalosEntreEstalos, razaoDoEsperado, type AmostraDeRelogio } from "./estatisticas";
import { abrirAudio, type AudioAberto } from "./gravacaoAudio";
import { VIDEO_BITS_POR_SEGUNDO, abrirVideo, contarEnquantoGrava, iniciarGravadorB, vigiarTrilha, type GravadorB, type VideoAberto } from "./gravacaoVideo";
import type { Entrada } from "./relatorio";
import { FPS_DO_MODO, entregouTaxa, type Lado, type Modo } from "./restricoes";
import { testarReproducao } from "./reproducao";
import { lerBateria, simples } from "./util";

export type PedidoGravacao = { modo: Modo; segundos: number; lado: Lado; previa: HTMLVideoElement; aoEstalo: (total: number) => void; aoTempo: (s: number) => void };

/** Deixa passar `segundos`, amostrando o relógio do áudio contra o `performance.now()` a cada segundo. */
function esperarGravando(p: PedidoGravacao, audio: AudioAberto): Promise<AmostraDeRelogio[]> {
  const amostras: AmostraDeRelogio[] = [];
  const amostrar = () => amostras.push({ perfMs: performance.now(), ctxS: audio.escuta.contexto?.currentTime ?? 0 });
  amostrar();
  return new Promise((ok) => {
    let s = 0;
    const id = setInterval(() => {
      amostrar();
      p.aoTempo(++s);
      if (s < p.segundos) return;
      clearInterval(id);
      ok(amostras);
    }, 1000);
  });
}

type Medido = { amostras: AmostraDeRelogio[]; blobB: Blob | null; gravadorB: GravadorB | null; segundosB: number; fps: ReturnType<ReturnType<typeof contarEnquantoGrava>["parar"]> | null; settingsFim: MediaTrackSettings | null };

/** Grava de verdade: liga o gravador B (se há vídeo), espera, e para tudo. */
async function gravarPor(p: PedidoGravacao, audio: AudioAberto, video: VideoAberto | null): Promise<Medido> {
  const trilhas = [video?.trilha, audio.trilha].filter((t): t is MediaStreamTrack => !!t);
  const gravadorB = video ? iniciarGravadorB(trilhas) : null;
  const contador = video ? contarEnquantoGrava(p.previa) : null;
  const t0 = performance.now();
  const amostras = await esperarGravando(p, audio);
  const segundosB = (performance.now() - t0) / 1000;
  const fps = contador?.parar() ?? null;
  const settingsFim = video?.trilha?.getSettings ? simples(video.trilha.getSettings()) : null;
  return { amostras, blobB: (await gravadorB?.parar()) ?? null, gravadorB, segundosB, fps, settingsFim };
}

const bateriaEmPct = (b: Awaited<ReturnType<typeof lerBateria>>) => (b ? { nivelPct: Math.round(b.nivel * 100), carregando: b.carregando } : null);

function relatarDetector(audio: AudioAberto): Entrada {
  const rel = audio.estalos.map((e) => ({ ...e, relS: Math.round((e.tempoCtxS - audio.inicioCtxS) * 1000) / 1000 }));
  return { disparos: rel.length, eventos: rel, intervalosMs: intervalosEntreEstalos(rel.map((e) => e.tempoCtxS)) };
}

function relatarVideoB({ p, video, m, reproducao }: { p: PedidoGravacao; video: VideoAberto; m: Medido; reproducao: Entrada | null }): Entrada {
  const bytes = m.blobB?.size ?? 0;
  const pedida = FPS_DO_MODO[p.modo] ?? 0;
  return {
    mimePedido: m.gravadorB?.mimePedido ?? null, mimeDoGravador: m.gravadorB?.gravador.mimeType ?? null, tipoDoBlob: m.blobB?.type ?? null,
    bytes, pedacos: m.gravadorB?.pedacos.length ?? 0, bytesPorSegundo: bytesPorSegundo(bytes, m.segundosB),
    razaoDoEsperado: razaoDoEsperado(bytes, m.segundosB, VIDEO_BITS_POR_SEGUNDO + BITS_POR_SEGUNDO),
    segundosGravados: Math.round(m.segundosB * 100) / 100, segundosPedidos: p.segundos,
    settingsInicio: video.settingsInicio, settingsFim: m.settingsFim, primeiroQuadro: video.primeiroQuadro,
    resolucaoMudou: video.settingsInicio.width !== m.settingsFim?.width || video.settingsInicio.height !== m.settingsFim?.height,
    entregouTaxaPedida: entregouTaxa(pedida, video.settingsInicio.frameRate),
    fps: m.fps?.resumo ?? null, quadrosApresentados: m.fps?.quadrosApresentados ?? null, reproducao,
  };
}

function relatarAudioA({ t, segundosPedidos, filtros }: { t: { blob: Blob; tipo: string; segundos: number } | null; segundosPedidos: number; filtros: boolean | null }): Entrada {
  const bytes = t?.blob.size ?? 0;
  return {
    mime: t?.tipo ?? null, tipoDoBlob: t?.blob.type ?? null, bytes, segundos: t ? Math.round(t.segundos * 100) / 100 : 0, segundosPedidos,
    bytesPorSegundo: bytesPorSegundo(bytes, t?.segundos ?? 0), razaoDoEsperado: razaoDoEsperado(bytes, t?.segundos ?? 0, BITS_POR_SEGUNDO), filtrosDesligados: filtros,
  };
}

function guardarVideo(p: PedidoGravacao, m: Medido): void {
  if (!m.blobB || !m.gravadorB) return;
  Object.assign(ultimoVideo, { blob: m.blobB, pedacos: [...m.gravadorB.pedacos], modo: p.modo, mime: m.blobB.type, segundos: m.segundosB });
}

type Bat = Awaited<ReturnType<typeof lerBateria>>;

function ligarVigias(audio: AudioAberto, video: VideoAberto | null): void {
  vigiarTrilha(video?.trilha, "video");
  vigiarTrilha(audio.trilha, "audio");
  definirSonda(() => ({ trilhaVideo: estadoDaTrilha(video?.trilha), trilhaAudio: estadoDaTrilha(audio.trilha), ctxAudio: audio.escuta.contexto?.state ?? null }));
}

/** Grava, para, reproduz o vídeo e monta a entrada do relatório. */
async function medirExecucao({ p, audio, video, antes }: { p: PedidoGravacao; audio: AudioAberto; video: VideoAberto | null; antes: Bat }): Promise<Entrada> {
  evento("gravacao-inicio", { modo: p.modo });
  const m = await gravarPor(p, audio, video);
  evento("gravacao-fim", { modo: p.modo });
  const tentativa = await audio.escuta.parar();
  guardarVideo(p, m);
  const reproducao = m.blobB ? await testarReproducao(m.blobB, m.segundosB).catch((e: Error) => ({ erro: e.name })) : null;
  return {
    passo: "gravacao", modo: p.modo, audioA: relatarAudioA({ t: tentativa, segundosPedidos: p.segundos, filtros: audio.escuta.filtrosDesligados }),
    videoB: video ? relatarVideoB({ p, video, m, reproducao }) : null, detector: relatarDetector(audio),
    relogio: { amostras: m.amostras.map((a) => ({ perfMs: Math.round(a.perfMs), ctxS: Math.round(a.ctxS * 1000) / 1000 })), ...derivaDoRelogio(m.amostras) },
    bateria: { antes: bateriaEmPct(antes), depois: bateriaEmPct(await lerBateria()) }, temperatura: null,
  };
}

/** Roda uma execução completa no `modo` pedido e devolve a entrada do relatório. Chamar a partir de um toque (o áudio só inicia depois de um gesto). */
export async function executarGravacao(p: PedidoGravacao): Promise<Entrada> {
  liberarCameras();
  const audio = await abrirAudio(p.aoEstalo);
  const abertos: { video: VideoAberto | null } = { video: null };
  try {
    const antes = await lerBateria();
    const fps = FPS_DO_MODO[p.modo];
    abertos.video = fps ? await abrirVideo({ fps, lado: p.lado, previa: p.previa }) : null;
    ligarVigias(audio, abertos.video);
    return await medirExecucao({ p, audio, video: abertos.video, antes });
  } finally {
    definirSonda(null);
    abertos.video?.fluxo.getTracks().forEach((t) => t.stop());
    audio.escuta.soltar();
  }
}
