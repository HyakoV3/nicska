// Guardar, corrigir e apagar uma tentativa (e o áudio dela). Fica entre os percursos e as consultas de tentativas (`tentativas.ts`).
import { comLimite, pedido, transacao } from "../banco";
import type { TentativaGuardada } from "../documento";
import { ArmazenamentoDePercursos } from "./percursos";
import { apagarVideoNa } from "./videosBase";

/** Quanto se espera o armazenamento guardar uma tentativa antes de desistir e avisar (ms). */
export const LIMITE_PARA_GUARDAR_MS = 10000;

/** Troca (ou tira, se nula) a pontuação de `atual`, na transação `t`. Devolve a tentativa como ficou, ou nulo se ela não existe mais. */
async function trocarPontos(t: IDBTransaction, { id, pontos }: { id: string; pontos: TentativaGuardada["pontos"] | null }): Promise<TentativaGuardada | null> {
  const atual = (await pedido(t.objectStore("tentativas").get(id))) as TentativaGuardada | undefined;
  if (!atual) return null;
  const { pontos: _antigos, ...resto } = atual;
  const nova: TentativaGuardada = pontos ? { ...resto, pontos } : resto;
  t.objectStore("tentativas").put(nova);
  return nova;
}

export class ArmazenamentoDeEscritaDeTentativas extends ArmazenamentoDePercursos {
  /**
   * Guarda uma tentativa e o áudio dela (se houver), numa transação só: ou entram os dois ou nenhum. O áudio entra como **bytes** (`ArrayBuffer`) e não como `Blob`:
   * o `put` de um Blob do MediaRecorder já deixou de confirmar no CI. Devolve a tentativa como ficou (com `audio` preenchido).
   */
  async salvarTentativa(t: TentativaGuardada, audio?: { blob: Blob; tipo: string; segundos: number }): Promise<TentativaGuardada> {
    const dados = audio ? await audio.blob.arrayBuffer() : null;
    const final: TentativaGuardada = audio ? { ...t, audio: { tipo: audio.tipo, segundos: audio.segundos, bytes: audio.blob.size } } : { ...t };
    const b = await this.abrir();
    await comLimite(
      transacao(b, ["tentativas", "audios"], "readwrite", (tr) => {
        tr.objectStore("tentativas").put(final);
        if (dados) tr.objectStore("audios").put({ dados, tipo: audio!.tipo }, final.id);
      }),
      LIMITE_PARA_GUARDAR_MS,
      "o armazenamento demorou demais para guardar a tentativa",
    );
    return final;
  }

  /** Troca só a pontuação de uma tentativa já guardada (nula tira a pontuação). Devolve a tentativa como ficou, ou nulo se ela não existe mais. */
  async definirPontos(id: string, pontos: TentativaGuardada["pontos"] | null): Promise<TentativaGuardada | null> {
    const b = await this.abrir();
    return transacao(b, ["tentativas"], "readwrite", (t) => trocarPontos(t, { id, pontos }));
  }

  /**
   * Muda a tentativa para outro percurso (o erro comum: salvar no percurso errado). O `id` não muda (a importação deduplica por ele; o áudio e o vídeo são chaveados
   * por ele), só o `percurso_id`: o índice por percurso, o ranking, as sessões e os gráficos leem daí e acompanham sozinhos. Devolve a tentativa como ficou, ou nulo se ela
   * ou o percurso de destino não existem. Mover para o percurso em que já está não muda nada.
   */
  async trocarPercurso(id: string, percursoId: string): Promise<TentativaGuardada | null> {
    const b = await this.abrir();
    return transacao(b, ["tentativas", "percursos"], "readwrite", async (t) => {
      const atual = (await pedido(t.objectStore("tentativas").get(id))) as TentativaGuardada | undefined;
      const destino = await pedido(t.objectStore("percursos").getKey(percursoId));
      if (!atual || destino === undefined) return null;
      if (atual.percurso_id === percursoId) return atual;
      const nova: TentativaGuardada = { ...atual, percurso_id: percursoId };
      t.objectStore("tentativas").put(nova);
      return nova;
    });
  }

  /** O áudio de uma tentativa, ou nulo se não existe (importada de um backup, ou apagada). */
  async audio(id: string): Promise<Blob | null> {
    const b = await this.abrir();
    const v = await transacao(b, ["audios"], "readonly", (t) => pedido(t.objectStore("audios").get(id)) as Promise<{ dados: ArrayBuffer; tipo: string } | undefined>);
    return v ? new Blob([v.dados], { type: v.tipo }) : null;
  }

  async apagarTentativa(id: string): Promise<void> {
    const b = await this.abrir();
    await transacao(b, ["tentativas", "audios", "videos", "videos_pedacos"], "readwrite", (t) => {
      t.objectStore("tentativas").delete(id);
      t.objectStore("audios").delete(id);
      apagarVideoNa(t, id);
    });
  }
}
