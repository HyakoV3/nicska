// O vídeo de cada tentativa (V1): loja `videos` { tipo, pedacos, bytes, parcial, fixado, atualizadoEm }, chaveada pelo id da tentativa, e loja `videos_pedacos`,
// chaveada por [id, n], com um Blob por pedaço (C7: nada de um bloco só de dezenas de MB). O Blob inteiro só é montado ao tocar. Fora do backup e do JSON.
import { pedido, transacao } from "../banco";
import { ArmazenamentoDeAvatares } from "./avatares";
import { apagarVideoNa, faixaDoVideo } from "./videosBase";
import { acharOrfaos, emLotes, resumoDosOrfaos, type VideoParaVarredura } from "../video/orfaos";
import { aApagar, type LimitesDeVideo, type VideoGuardado } from "../video/politica";

/**
 * `inicioDoVideoMs`: quanto depois do início da gravação do ÁUDIO a do vídeo começou (a câmera abre depois do microfone); metas antigas, sem o campo, valem 0.
 * `zeroNoAudioMs`: o zero (apito) na linha do tempo do áudio, como ficou na Revisão ao salvar; é o que leva um disparo da tentativa salva ao instante no vídeo.
 */
export type MetaDoVideo = { tipo: string; pedacos: number; bytes: number; parcial: boolean; fixado: boolean; finalizado?: boolean; atualizadoEm: number; inicioDoVideoMs?: number; zeroNoAudioMs?: number };

/** Lê a meta de `id` na transação `t` e, se existir, grava a versão que `mudar` devolve (uma leitura e uma escrita na mesma transação: nada se perde no meio). */
async function mudarMetaNa(t: IDBTransaction, id: string, mudar: (m: MetaDoVideo) => MetaDoVideo): Promise<void> {
  const meta = await pedido(t.objectStore("videos").get(id) as IDBRequest<MetaDoVideo | undefined>);
  if (meta) t.objectStore("videos").put(mudar(meta), id);
}

export class ArmazenamentoDeVideos extends ArmazenamentoDeAvatares {
  /** Abre o registro do vídeo (sem pedaços ainda), com o deslocamento do vídeo em relação ao áudio. Recomeçar com o mesmo id apaga o que havia. */
  async iniciarVideo(id: string, tipo: string, inicioDoVideoMs = 0): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos", "videos_pedacos"], "readwrite", (t) => {
      apagarVideoNa(t, id);
      t.objectStore("videos").put({ tipo, pedacos: 0, bytes: 0, parcial: false, fixado: false, finalizado: false, atualizadoEm: Date.now(), inicioDoVideoMs } satisfies MetaDoVideo, id);
    });
  }

  /** Guarda o pedaço `n` e atualiza a conta, numa transação só (uma queda no meio deixa o que já foi gravado). */
  async gravarPedaco(id: string, n: number, dados: Blob): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos", "videos_pedacos"], "readwrite", async (t) => {
      const meta = await pedido(t.objectStore("videos").get(id) as IDBRequest<MetaDoVideo | undefined>);
      if (!meta) throw new Error("vídeo não iniciado");
      t.objectStore("videos_pedacos").put(dados, [id, n]);
      t.objectStore("videos").put({ ...meta, pedacos: Math.max(meta.pedacos, n + 1), bytes: meta.bytes + dados.size, atualizadoEm: Date.now() }, id);
    });
  }

  /** Marca o fim: `parcial` se o vídeo parou antes da tentativa (app oculto, câmera caiu, C8). */
  async finalizarVideo(id: string, parcial: boolean): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos"], "readwrite", (t) => mudarMetaNa(t, id, (m) => ({ ...m, parcial, finalizado: true, atualizadoEm: Date.now() })));
  }

  /** Guarda o zero (apito) no áudio como ficou na Revisão: a tentativa salva leva cada disparo ao instante dele no vídeo. Sem vídeo, nada acontece. */
  async definirZeroDoVideo(id: string, zeroNoAudioMs: number): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos"], "readwrite", (t) => mudarMetaNa(t, id, (m) => ({ ...m, zeroNoAudioMs })));
  }

  async metaDoVideo(id: string): Promise<MetaDoVideo | null> {
    const b = await this.abrir();
    return (await transacao(b, ["videos"], "readonly", (t) => pedido(t.objectStore("videos").get(id) as IDBRequest<MetaDoVideo | undefined>))) ?? null;
  }

  /** O vídeo inteiro (pedaços juntos), ou nulo se não existe ou está vazio. */
  async video(id: string): Promise<Blob | null> {
    const b = await this.abrir();
    const [meta, pedacos] = await transacao(b, ["videos", "videos_pedacos"], "readonly", (t) =>
      Promise.all([pedido(t.objectStore("videos").get(id) as IDBRequest<MetaDoVideo | undefined>), pedido(t.objectStore("videos_pedacos").getAll(faixaDoVideo(id)) as IDBRequest<Blob[]>)]),
    );
    return meta && pedacos.length ? new Blob(pedacos, { type: meta.tipo }) : null;
  }

  async apagarVideo(id: string): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos", "videos_pedacos"], "readwrite", (t) => apagarVideoNa(t, id));
  }

  /** "Fixar": o vídeo não entra na limpeza automática (conceito novo, só local). */
  async fixarVideo(id: string, fixado: boolean): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["videos"], "readwrite", (t) => mudarMetaNa(t, id, (m) => ({ ...m, fixado })));
  }

  /** Quanto os vídeos ocupam e quantos são (tela de armazenamento de Ajustes). */
  async resumoDosVideos(): Promise<{ videos: number; bytes: number }> {
    const todos = await this.listarVideos();
    return { videos: todos.length, bytes: todos.reduce((s, v) => s + v.bytes, 0) };
  }

  private async listarVideos(): Promise<VideoGuardado[]> {
    const b = await this.abrir();
    return transacao(b, ["videos"], "readonly", async (t) => {
      const loja = t.objectStore("videos");
      const [chaves, metas] = await Promise.all([pedido(loja.getAllKeys() as IDBRequest<string[]>), pedido(loja.getAll() as IDBRequest<MetaDoVideo[]>)]);
      return chaves.map((id, i) => ({ id, bytes: metas[i].bytes, atualizadoEm: metas[i].atualizadoEm, fixado: metas[i].fixado }));
    });
  }

  /** Aplica a política (prazo e espaço; fixados e `preservar`, o vídeo recém-salvo, ficam). Devolve os ids apagados. */
  async limparVideos(limites: LimitesDeVideo, preservar: readonly string[] = []): Promise<string[]> {
    const ids = aApagar(await this.listarVideos(), limites, Date.now(), preservar);
    for (const id of ids) await this.apagarVideo(id);
    return ids;
  }

  /**
   * Varre e apaga os vídeos soltos (ver video/orfaos.ts). Apaga em lotes de `LOTE`, cedendo o fio entre eles, para não travar a abertura do app.
   * `inicioDaSessao` e `protegidos` guardam o que ainda é da sessão atual. Devolve quantos itens e bytes saíram.
   */
  async limparOrfaos(inicioDaSessao: number, protegidos: Iterable<string> = [], agora: number = Date.now()): Promise<{ n: number; bytes: number }> {
    const b = await this.abrir();
    const [chaves, metas, idsDePedacos, idsDeTentativas] = await transacao(b, ["videos", "videos_pedacos", "tentativas"], "readonly", (t) =>
      Promise.all([
        pedido(t.objectStore("videos").getAllKeys() as IDBRequest<string[]>),
        pedido(t.objectStore("videos").getAll() as IDBRequest<MetaDoVideo[]>),
        pedido(t.objectStore("videos_pedacos").getAllKeys() as IDBRequest<IDBValidKey[][]>),
        pedido(t.objectStore("tentativas").getAllKeys() as IDBRequest<string[]>),
      ]),
    );
    const videos: VideoParaVarredura[] = chaves.map((id, i) => ({ id, bytes: metas[i].bytes, pedacos: metas[i].pedacos, atualizadoEm: metas[i].atualizadoEm, fixado: metas[i].fixado, finalizado: metas[i].finalizado }));
    const orfaos = acharOrfaos({ videos, idsDePedacos: idsDePedacos.map((k) => k[0] as string), idsDeTentativas, protegidos, inicioDaSessao, agora });
    const ids = [...orfaos.videos.map((v) => v.id), ...orfaos.pedacosSoltos];
    for (const lote of emLotes(ids, LOTE)) {
      await transacao(b, ["videos", "videos_pedacos"], "readwrite", (t) => lote.forEach((id) => apagarVideoNa(t, id)));
      await new Promise<void>((ok) => setTimeout(ok, 0));
    }
    return resumoDosOrfaos(orfaos);
  }
}

const LOTE = 10;
