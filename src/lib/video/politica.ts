// A política de guardar vídeos (puro), pelos dois limites da pessoa (Ajustes → Retenção): quanto espaço reservar (bytes) e por quanto tempo guardar (dias; nulo = sem prazo).
// Apaga primeiro o que passou do prazo e depois, do mais antigo ao mais novo, o que ainda estourar o espaço. Os fixados nunca são apagados, nem o vídeo recém-salvo
// (`preservar`): um vídeo sozinho maior que o espaço fica (a pessoa acabou de gravá-lo), e o excesso só some quando entrar outro.

export const MB = 1024 * 1024;
export const DIA_MS = 24 * 60 * 60 * 1000;

export type LimitesDeVideo = { bytes: number; dias: number | null };
/**
 * O espaço que a pessoa pode reservar (o controle desliza de 256 em 256 MB) e os prazos que ela escolhe. O mínimo é 1 GB: o maior vídeo possível (200 s em 4K30 a ~18 Mbps)
 * tem ~431 MB, então 1 GB guarda 2 deles (e ~10 de 1080p30 na duração máxima); abaixo disso a retenção apagaria o vídeo anterior a cada gravação em 4K.
 * Padrão 2 GB: ~4 vídeos de 4K de 200 s, ~19 de 1080p30 de 200 s, ou ~29 de 4K de 30 s.
 */
export const ESPACO_DE_VIDEO = { min: 1024 * MB, max: 8192 * MB, passo: 256 * MB } as const;
export const PRAZOS_DE_VIDEO = [7, 30, 90, null] as const;
export const limitesDeVideoPadrao = (): LimitesDeVideo => ({ bytes: 2048 * MB, dias: 30 });

/** O que a política precisa saber de cada vídeo. */
export type VideoGuardado = { id: string; bytes: number; atualizadoEm: number; fixado?: boolean };

/** Quais ids apagar, agora (`agora` em ms; os testes passam o deles). `preservar`: ids que nunca se apagam (o vídeo recém-salvo), como os fixados. */
export function aApagar(videos: VideoGuardado[], limites: LimitesDeVideo, agora: number = Date.now(), preservar: readonly string[] = []): string[] {
  const corte = limites.dias === null ? -Infinity : agora - limites.dias * DIA_MS;
  const fica = (v: VideoGuardado) => v.fixado || preservar.includes(v.id);
  const ids = videos.filter((v) => !fica(v) && v.atualizadoEm < corte).map((v) => v.id);
  const restam = videos.filter((v) => !ids.includes(v.id)).sort((a, b) => a.atualizadoEm - b.atualizadoEm);
  let bytes = restam.reduce((s, v) => s + v.bytes, 0);
  for (const v of restam) {
    if (bytes <= limites.bytes) break;
    if (fica(v)) continue;
    ids.push(v.id);
    bytes -= v.bytes;
  }
  return ids;
}

/** O espaço para mostrar à pessoa: MB abaixo de 1 GB, GB (uma casa) acima, no formato do idioma. */
export function formatarEspaco(bytes: number, idioma: string): string {
  const gb = bytes / (1024 * MB);
  const numero = (n: number, casas: number) => new Intl.NumberFormat(idioma, { maximumFractionDigits: casas }).format(n);
  return gb >= 1 ? `${numero(gb, 1)} GB` : `${numero(Math.round(bytes / MB), 0)} MB`;
}
