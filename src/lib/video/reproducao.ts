// Tocar o vídeo de uma tentativa (Revisão e Histórico): monta o Blob dos pedaços, dá a ele a duração (C6, webm/duracao.ts) e cria a URL de objeto, que é
// SEMPRE revogada ao fechar (ou ao abrir outro). Um `abrir` antigo que termina depois de fechado é descartado sem deixar URL viva. Sem vídeo: nulo.
import type { ArmazenamentoDeVideos, MetaDoVideo } from "../armazenamento/videos";
import { comDuracao } from "../webm/duracao";
import type { Encaixe } from "./alinhamento";

export type LojaDeReproducao = Pick<ArmazenamentoDeVideos, "video" | "metaDoVideo">;
/** Criar e revogar URLs de objeto (as do navegador, ou falsas nos testes). */
export type Urls = { criar: (b: Blob) => string; revogar: (url: string) => void };
export type VideoParaTocar = { url: string; meta: MetaDoVideo };

const urlsDoNavegador: Urls = { criar: (b) => URL.createObjectURL(b), revogar: (u) => URL.revokeObjectURL(u) };

export class ReproducaoDoVideo {
  private url: string | null = null;
  /** Muda a cada `abrir` e `fechar`: o que um `abrir` antigo traz depois disso é jogado fora. */
  private geracao = 0;

  constructor(
    private readonly loja: LojaDeReproducao,
    private readonly urls: Urls = urlsDoNavegador,
    private readonly preparar: (b: Blob) => Promise<Blob> = comDuracao,
  ) {}

  /** Abre o vídeo da tentativa `id` (fecha o anterior). Nulo se não há vídeo, se falhou ou se foi fechado no meio. Nunca lança. */
  async abrir(id: string): Promise<VideoParaTocar | null> {
    this.fechar();
    const minha = ++this.geracao;
    try {
      const [meta, blob] = await Promise.all([this.loja.metaDoVideo(id), this.loja.video(id)]);
      if (!meta || !blob || minha !== this.geracao) return null;
      const pronto = await this.preparar(blob);
      if (minha !== this.geracao) return null;
      this.url = this.urls.criar(pronto);
      return { url: this.url, meta };
    } catch (e) {
      console.warn("video: não deu para abrir o vídeo da tentativa", e);
      return null;
    }
  }

  /** Revoga a URL (se havia) e descarta um `abrir` em andamento. Pode ser chamado à vontade. */
  fechar(): void {
    this.geracao++;
    if (this.url) this.urls.revogar(this.url);
    this.url = null;
  }
}

/** O encaixe para levar disparos ao vídeo: o zero da Revisão (se veio) ou o guardado ao salvar; sem zero conhecido, nulo (o vídeo toca, mas sem pulos). */
export function encaixeDoVideo(meta: MetaDoVideo, zeroNoAudioS?: number | null): Encaixe | null {
  const zero = zeroNoAudioS ?? (meta.zeroNoAudioMs !== undefined ? meta.zeroNoAudioMs / 1000 : null);
  return zero === null ? null : { zeroNoAudioS: zero, inicioDoVideoMs: meta.inicioDoVideoMs ?? 0 };
}

/** As metas dos vídeos das tentativas `ids` que têm vídeo (a lista do Histórico mostra "com vídeo" sem abrir nenhum). */
export async function metasDosVideos(loja: Pick<ArmazenamentoDeVideos, "metaDoVideo">, ids: string[]): Promise<Record<string, MetaDoVideo>> {
  const metas = await Promise.all(ids.map((id) => loja.metaDoVideo(id)));
  return Object.fromEntries(ids.flatMap((id, i) => (metas[i] ? [[id, metas[i]]] : [])));
}
