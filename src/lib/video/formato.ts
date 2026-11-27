// O formato, a qualidade e as restrições do vídeo da tentativa (V1). A pessoa escolhe a resolução (720p, 1080p ou, avançado, 4K) e a taxa (30 ou 60 fps) em Ajustes; o bitrate sai da tabela abaixo
// (C9 da revisão: as contas de tamanho só valem assim). O que a câmera entrega de verdade pode ser menos: o app lê `getSettings()` e mostra o real.
// 4K (2160p) é avançado, só a 30 fps, e recua para 1080p se a câmera não o entrega (ver `abrirCameraComRecuo`, camera.ts).

export type Altura = 720 | 1080 | 2160;
export type Qualidade = { altura: Altura; fps: 30 | 60 };
/** 2160p (4K) é opção AVANÇADA: o teste no aparelho (S1) não rodou, e 4K esquenta e ocupa muito. Fica no fim da lista. */
export const ALTURAS = [720, 1080, 2160] as const;
export const TAXAS = [30, 60] as const;
export const qualidadePadrao = (): Qualidade => ({ altura: 720, fps: 30 });
/** As taxas de cada resolução: 4K e 1080p só a 30 fps (4K60 passa de 30 Mbps; o 1080p60 entregou ~6 fps reais no aparelho de teste, relatório de desempenho); 720p tem 30 e 60. */
export const taxasDa = (altura: Altura): readonly (30 | 60)[] => (altura === 720 ? TAXAS : [30]);
/** Uma qualidade possível: 4K e 1080p voltam para 30 fps (uma preferência guardada como 1080p60 é lida como 1080p30). */
export const normalizarQualidade = (q: Qualidade): Qualidade => (q.altura !== 720 && q.fps !== 30 ? { altura: q.altura, fps: 30 } : q);

/**
 * Bitrate do vídeo (bits por segundo) de cada qualidade: 720p30 = 2 Mbps; o dobro de quadros pede ~1,75x; 1080p tem 2,25x os pixels (1080p60 saiu: `normalizarQualidade` o leva a 30 fps). 4K30 = 18 Mbps
 * (4x os pixels do 1080p; as referências de H.264 em 4K30 vão de ~16 Mbps (recomendação de streaming) a ~40 Mbps (câmera de celular): fica na parte baixa
 * porque o codificador do WebView é de hardware simples e a prioridade é não esquentar nem encher o espaço; para ver o cronômetro e o disparo basta).
 */
const BITS_DO_VIDEO: Record<string, number> = { "720-30": 2_000_000, "720-60": 3_500_000, "1080-30": 4_000_000, "2160-30": 18_000_000 };
export const bitsDoVideo = (q: Qualidade): number => { const n = normalizarQualidade(q); return BITS_DO_VIDEO[`${n.altura}-${n.fps}`]; };
export const BITS_DO_AUDIO_NO_VIDEO = 64_000;
const LARGURAS = { 720: 1280, 1080: 1920, 2160: 3840 } as const;

/** O vídeo mais longo que uma tentativa grava (s): atraso máximo do apito (10 s) + espera do apito (~2 s) + `TEMPO_MAXIMO_MS` (180 s), arredondado. */
export const DURACAO_MAXIMA_DO_VIDEO_S = 200;

/** A qualidade que a câmera entregou de fato, pelo lado menor da imagem (`getSettings()`): abaixo de ~1,4x do 720p é 720p, abaixo de ~1,4x do 1080p é 1080p. Sem dados, a pedida. */
export function qualidadeEntregue(pedida: Qualidade, ladoMenor: number | null | undefined): Qualidade {
  if (!ladoMenor || ladoMenor <= 0) return pedida;
  const altura: Altura = ladoMenor >= 1500 ? 2160 : ladoMenor >= 900 ? 1080 : 720;
  return normalizarQualidade({ altura: Math.min(altura, pedida.altura) as Altura, fps: pedida.fps });
}
/** O lado menor da primeira faixa de vídeo do fluxo (px), ou nulo se o aparelho não diz. */
export function ladoMenorDoFluxo(fluxo: MediaStream): number | null {
  const s = fluxo.getVideoTracks()[0]?.getSettings?.();
  return s?.width && s?.height ? Math.min(s.width, s.height) : null;
}

/** Do mais ao menos desejado: WebM (o que o Android WebView grava hoje) antes do MP4 (só em WebView novo). Sem `codecs` o navegador escolhe. */
export const FORMATOS_DE_VIDEO = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm",
  "video/mp4",
] as const;

/** O primeiro formato que `aceita`, ou nulo se o aparelho não grava vídeo. */
export function escolherFormatoDeVideo(aceita: (tipo: string) => boolean): string | null {
  for (const tipo of FORMATOS_DE_VIDEO) if (aceita(tipo)) return tipo;
  return null;
}

export type Camera = "traseira" | "frontal";

/** As restrições do `getUserMedia` só de vídeo (a câmera tem fluxo próprio; o do microfone fica como está): a qualidade escolhida como ideal, sem áudio. */
export function restricoesDaCamera(camera: Camera, q: Qualidade = qualidadePadrao()): MediaStreamConstraints {
  return {
    audio: false,
    video: { facingMode: { ideal: camera === "traseira" ? "environment" : "user" }, width: { ideal: LARGURAS[q.altura] }, height: { ideal: q.altura }, frameRate: { ideal: q.fps } },
  };
}

/** Tamanho esperado de um vídeo de `segundos` s (bytes): a base do aviso de espaço e da conta "cabem N vídeos". */
export const bytesEsperados = (segundos: number, q: Qualidade = qualidadePadrao()): number => Math.round(((bitsDoVideo(q) + BITS_DO_AUDIO_NO_VIDEO) / 8) * segundos);
