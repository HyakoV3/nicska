// Apagar o vídeo de uma tentativa (loja `videos` + pedaços em `videos_pedacos`), à parte para as camadas de baixo (tentativas) poderem usar sem ciclo de importação.

export const faixaDoVideo = (id: string) => globalThis.IDBKeyRange.bound([id, 0], [id, Infinity]);

/** Apaga o vídeo (meta e pedaços) na transação `t`, que tem de incluir as duas lojas. */
export function apagarVideoNa(t: IDBTransaction, id: string): void {
  t.objectStore("videos").delete(id);
  t.objectStore("videos_pedacos").delete(faixaDoVideo(id));
}
