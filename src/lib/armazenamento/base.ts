// A base do armazenamento: o esquema do IndexedDB `nk-dados`, os tipos de resposta e a conexão. As camadas de cima (percursos, tentativas, backup) herdam daqui.
// Três lojas principais no banco: percursos { id, nome, ... }; tentativas (o MESMO documento do JSON, documento.ts; índice [percurso_id, quando, id] para paginar um
// percurso da mais nova para a mais antiga); audios { dados, tipo }, chaveado pelo id da tentativa, lido só ao ouvir; atiradores (as outras pessoas); e avatares { dados, tipo, atualizadoEm }, a foto do perfil, chaveada pelo id do atirador.
import { Banco } from "../banco";
import type { TentativaGuardada } from "../documento";

export const NOME_DO_BANCO = "nk-dados";
const VERSAO = 4;

export type Posicao = { quando: number; id: string };
export type Pagina = { itens: TentativaGuardada[]; temMais: boolean };
export type ResumoDoPercurso = { tentativas: number; ultima: number; melhorMs: number | null };
export type Resumo = { percursos: number; tentativas: number; bytesDeAudio: number };

const criarV1 = (b: IDBDatabase): void => {
  b.createObjectStore("percursos", { keyPath: "id" });
  b.createObjectStore("tentativas", { keyPath: "id" }).createIndex("porPercurso", ["percurso_id", "quando", "id"]);
  b.createObjectStore("audios");
};

/** As outras pessoas, de arquivos importados (Etapa 8). */
const criarV2 = (b: IDBDatabase): void => {
  b.createObjectStore("atiradores", { keyPath: "id" });
};

/** A foto do perfil de cada atirador { dados, tipo, atualizadoEm }, chaveada pelo id do atirador (só neste aparelho; fora do backup e do JSON no P0a). */
const criarV3 = (b: IDBDatabase): void => {
  b.createObjectStore("avatares");
};

/** O vídeo da tentativa: `videos` { tipo, pedacos, bytes, parcial, fixado, atualizadoEm } por id da tentativa e `videos_pedacos` por [id, n] (só neste aparelho; fora do backup e do JSON). */
const criarV4 = (b: IDBDatabase): void => {
  b.createObjectStore("videos");
  b.createObjectStore("videos_pedacos");
};

/** Monta o que falta do esquema, da versão `anterior` do banco (0 se é novo) até a atual. */
function criar(b: IDBDatabase, anterior: number): void {
  if (anterior < 1) criarV1(b);
  if (anterior < 2) criarV2(b);
  if (anterior < 3) criarV3(b);
  if (anterior < 4) criarV4(b);
}

export class BaseDoArmazenamento {
  private readonly banco: Banco;

  /** `fabrica` devolve o IndexedDB (um falso nos testes). */
  constructor(fabrica?: () => IDBFactory | undefined) {
    this.banco = new Banco(NOME_DO_BANCO, VERSAO, criar, fabrica);
  }

  protected abrir = () => this.banco.abrir();

  async fechar(): Promise<void> {
    await this.banco.fechar();
  }
}
