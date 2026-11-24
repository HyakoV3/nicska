// Os dados do Nicska no IndexedDB da própria WebView, só neste aparelho (nada sai dele): percursos, tentativas e o áudio de cada tentativa. Sobrevivem a fechar o
// app; somem se a pessoa limpar os dados do app (por isso existe o backup, `exportar`/`importar`). A classe `Armazenamento` é a fachada, montada em camadas
// (cada uma num arquivo de `armazenamento/`): base (esquema e conexão) -> percursos e atiradores -> tentativas e áudio -> esta, com o backup e as contagens.
import { pedido, percorrer, transacao } from "./banco";
import { novidades, type Atirador, type Importavel, type Novidades, type Percurso, type TentativaGuardada } from "./documento";
import type { Resumo } from "./armazenamento/base";
import { porNomeDoAtirador } from "./armazenamento/percursos";
import { ArmazenamentoDeVideos } from "./armazenamento/videos";

export { NOME_DO_BANCO, type Pagina, type Posicao, type Resumo, type ResumoDoPercurso } from "./armazenamento/base";
export type { Avatar } from "./armazenamento/avatares";
export type { MetaDoVideo } from "./armazenamento/videos";
export { LIMITE_PARA_GUARDAR_MS, TAMANHO_DA_PAGINA } from "./armazenamento/tentativas";

type Ids = { percursos: Set<string>; tentativas: Set<string>; atiradores: Set<string> };

const LOJAS_DO_BACKUP = ["percursos", "tentativas", "atiradores"];
/** Apagar tudo leva também o que o backup não leva: os áudios e os avatares. */
const LOJAS_A_APAGAR = [...LOJAS_DO_BACKUP, "audios", "avatares", "videos", "videos_pedacos"];

/** Os ids que já existem, lidos dentro da transação `t` (que tem de incluir as três lojas). */
async function lerIds(t: IDBTransaction): Promise<Ids> {
  const chaves = async (loja: string) => new Set((await pedido(t.objectStore(loja).getAllKeys())) as string[]);
  return { atiradores: await chaves("atiradores"), percursos: await chaves("percursos"), tentativas: await chaves("tentativas") };
}

/** Grava o que é novo, dentro da transação `t`. */
function gravarNovidades(t: IDBTransaction, n: Novidades): void {
  for (const a of n.atiradores) t.objectStore("atiradores").put(a);
  for (const p of n.percursos) t.objectStore("percursos").put(p);
  for (const x of n.tentativas) t.objectStore("tentativas").put(x);
}

/** Quantos percursos e tentativas há, e quantos bytes de áudio, lidos na transação `t`. */
async function contar(t: IDBTransaction): Promise<Resumo> {
  const percursos = await pedido(t.objectStore("percursos").count());
  let tentativas = 0;
  let bytesDeAudio = 0;
  await percorrer(t.objectStore("tentativas").openCursor(), (c) => {
    tentativas++;
    bytesDeAudio += (c.value as TentativaGuardada).audio?.bytes ?? 0;
  });
  return { percursos, tentativas, bytesDeAudio };
}

export class Armazenamento extends ArmazenamentoDeVideos {
  // ---- backup ----

  /** Tudo, para o backup: os percursos e todas as tentativas (sem os áudios). */
  async tudo(): Promise<{ percursos: Percurso[]; tentativas: TentativaGuardada[]; atiradores: Atirador[] }> {
    const b = await this.abrir();
    return transacao(b, LOJAS_DO_BACKUP, "readonly", async (t) => {
      const percursos = (await pedido(t.objectStore("percursos").getAll())) as Percurso[];
      const tentativas = (await pedido(t.objectStore("tentativas").getAll())) as TentativaGuardada[];
      const atiradores = (await pedido(t.objectStore("atiradores").getAll())) as Atirador[];
      return {
        atiradores: atiradores.sort(porNomeDoAtirador),
        percursos: percursos.sort((x, y) => x.criado_em - y.criado_em || x.id.localeCompare(y.id)),
        tentativas: tentativas.sort((x, y) => x.quando - y.quando || x.id.localeCompare(y.id)),
      };
    });
  }

  /** Os ids que já existem (para `novidades`). */
  async ids(): Promise<Ids> {
    const b = await this.abrir();
    return transacao(b, LOJAS_DO_BACKUP, "readonly", lerIds);
  }

  /** Guarda o que o backup traz de novo, numa transação só (ou entra tudo ou nada). Sem áudio: ele nunca vai no backup. */
  async importar(n: Novidades): Promise<void> {
    const b = await this.abrir();
    await transacao(b, LOJAS_DO_BACKUP, "readwrite", (t) => gravarNovidades(t, n));
  }

  /**
   * Importa o que o arquivo tem de novo, tudo numa transação só: ler os ids que já existem, separar o novo (`novidades`) e gravar. Assim duas importações ao mesmo
   * tempo não se atropelam (a segunda espera a primeira e já vê os ids dela). Devolve o que entrou.
   */
  async importarDocumento(imp: Importavel, meuId?: string): Promise<Novidades> {
    const b = await this.abrir();
    return transacao(b, LOJAS_DO_BACKUP, "readwrite", async (t) => {
      const novas = novidades(imp, await lerIds(t), meuId);
      gravarNovidades(t, novas);
      return novas;
    });
  }

  async resumo(): Promise<Resumo> {
    const b = await this.abrir();
    return transacao(b, ["percursos", "tentativas"], "readonly", contar);
  }

  /** Apaga tudo (o que "limpar os dados do app" faria). */
  async apagarTudo(): Promise<void> {
    const b = await this.abrir();
    await transacao(b, LOJAS_A_APAGAR, "readwrite", (t) => {
      for (const loja of LOJAS_A_APAGAR) t.objectStore(loja).clear();
    });
  }
}

export const armazenamento = new Armazenamento();
