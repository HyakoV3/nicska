// SPIKE S1, passo 3 (EXPERIMENTAL, descartável): reproduzir o vídeo gravado e medir (carrega? duração é Infinity? seek, quadros descartados).
import { alvosDeSeek, erroDeSeek, numeroOuTexto, percentualDescartado } from "./estatisticas";
import { esperarEvento } from "./util";

export type Carregado = { carregou: boolean; duracao: number | string; duracaoInfinita: boolean; largura: number; altura: number };

/** Cria um `<video>` mudo fora da tela, com o blob, e espera os metadados. */
export async function carregarVideo(blob: Blob): Promise<{ video: HTMLVideoElement; url: string; carregado: Carregado }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const carregou = await esperarEvento(video, "loadedmetadata", 10_000);
  const carregado = { carregou, duracao: numeroOuTexto(video.duration), duracaoInfinita: video.duration === Infinity, largura: video.videoWidth, altura: video.videoHeight };
  return { video, url, carregado };
}

/** Pula para 1/3, 1/2 e 2/3 e mede o tempo até `seeked` e o erro. `duracao`: a do vídeo se finita, senão a gravada. */
export async function testarSeek(video: HTMLVideoElement, duracao: number): Promise<Array<Record<string, unknown>>> {
  const saida: Array<Record<string, unknown>> = [];
  for (const alvo of alvosDeSeek(duracao)) {
    const t0 = performance.now();
    const espera = esperarEvento(video, "seeked", 10_000);
    video.currentTime = alvo;
    const veio = await espera;
    saida.push({ alvoS: alvo, chegou: veio, ms: Math.round(performance.now() - t0), erroMs: erroDeSeek(alvo, video.currentTime) });
  }
  return saida;
}

/** Reproduz do início (até `maxS` segundos) e lê `getVideoPlaybackQuality()`. */
export async function testarReproducaoCompleta(video: HTMLVideoElement, maxS: number): Promise<Record<string, unknown>> {
  video.currentTime = 0;
  await esperarEvento(video, "seeked", 5000);
  const t0 = performance.now();
  try {
    await video.play();
  } catch (e) {
    return { tocou: false, erro: (e as Error).name };
  }
  await esperarEvento(video, "ended", maxS * 1000);
  video.pause();
  const q = video.getVideoPlaybackQuality?.();
  const segundos = (performance.now() - t0) / 1000;
  return {
    tocou: true,
    reproduzidoS: Math.round(segundos * 10) / 10,
    qualidade: q ? { total: q.totalVideoFrames, descartados: q.droppedVideoFrames, percentualDescartado: percentualDescartado(q.droppedVideoFrames, q.totalVideoFrames) } : null,
    fpsNaReproducao: q && segundos > 0 ? Math.round((q.totalVideoFrames / segundos) * 10) / 10 : null,
  };
}

/** Carrega o blob e roda seek e reprodução. `segundosGravados` serve de duração se `video.duration` é Infinity. */
export async function testarReproducao(blob: Blob, segundosGravados: number): Promise<Record<string, unknown>> {
  const { video, url, carregado } = await carregarVideo(blob);
  try {
    if (!carregado.carregou) return { ...carregado };
    const duracao = Number.isFinite(video.duration) ? video.duration : segundosGravados;
    const seek = await testarSeek(video, duracao);
    const reproducao = await testarReproducaoCompleta(video, Math.min(duracao, 30) + 3);
    return { ...carregado, seek, reproducao };
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
