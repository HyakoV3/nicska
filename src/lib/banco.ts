// O pedaço genérico de falar com o IndexedDB da WebView: abrir com limite de espera e novas tentativas, reabrir se a conexão cair, e transações que só
// terminam quando o navegador CONFIRMA a escrita. `armazenamento.ts` usa isto.
import { rastro } from "./audioComum";

export const pedido = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, falha) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error ?? new Error("falha no armazenamento"));
  });

/** Roda `fn` numa transação e devolve o que ela devolver DEPOIS de a transação terminar de verdade; qualquer erro ou cota estourada rejeita e desfaz tudo. */
export function transacao<T>(banco: IDBDatabase, lojas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise((ok, falha) => {
    let resultado: T;
    const t = banco.transaction(lojas, modo);
    aoTerminar(t, () => ok(resultado), falha);
    executar(fn, t).then((r) => (resultado = r), desistirDe(t, falha));
  });
}

/** Liga os três fins possíveis da transação: `ok` quando o navegador confirma, `falha` se der erro ou ela for cancelada. */
function aoTerminar(t: IDBTransaction, ok: () => void, falha: (e: unknown) => void): void {
  t.oncomplete = ok;
  t.onerror = () => falha(t.error ?? new Error("falha no armazenamento"));
  t.onabort = () => falha(t.error ?? new Error("transação cancelada"));
}

/** O que fazer quando `fn` joga: rejeitar e desfazer a transação. */
const desistirDe = (t: IDBTransaction, falha: (e: unknown) => void) => (e: unknown) => {
  falha(e);
  abortar(t);
};

/** Roda `fn` (que pode jogar na hora ou devolver uma promessa) sempre como promessa. */
const executar = async <T>(fn: (t: IDBTransaction) => Promise<T> | T, t: IDBTransaction): Promise<T> => fn(t);

function abortar(t: IDBTransaction): void {
  try {
    t.abort();
  } catch {
    /* já terminou */
  }
}

const acabou = (c: IDBCursorWithValue | null, passo: (c: IDBCursorWithValue) => boolean | void): boolean => !c || passo(c) === true;

/** Percorre um cursor: `passo` recebe cada posição e devolve `true` para parar; sem mais registros a promessa termina. (Quem chama dá o `continue` por aqui.) */
export function percorrer(r: IDBRequest<IDBCursorWithValue | null>, passo: (c: IDBCursorWithValue) => boolean | void): Promise<void> {
  return new Promise<void>((ok, falha) => {
    r.onerror = () => falha(r.error ?? new Error("falha ao ler"));
    r.onsuccess = () => (acabou(r.result, passo) ? ok() : r.result!.continue());
  });
}

/** Quanto se espera cada tentativa de abrir o banco (ms) e quantas se fazem. */
export const ESPERA_AO_ABRIR_MS = 3000;
export const TENTATIVAS_DE_ABRIR = 3;
const MOTIVO_SEM_RESPOSTA = "o armazenamento não respondeu a esta tentativa de abrir";

/** Espera `promessa`, mas rejeita com `motivo` se ela não terminar em `ms`. */
export function comLimite<T>(promessa: Promise<T>, ms: number, motivo: string): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falha) => {
    relogio = setTimeout(() => falha(new Error(motivo)), ms);
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(relogio));
}

/** Só o estouro do limite vira "sem resposta" (nulo); qualquer outro erro segue. A conexão que chegar depois é fechada. */
function semResposta(e: unknown, { nome, tentativa, n }: { nome: string; tentativa: Promise<IDBDatabase>; n: number }): null {
  if (!(e instanceof Error && e.message === MOTIVO_SEM_RESPOSTA)) throw e;
  tentativa.then((b) => b.close(), () => {});
  rastro(`armazenamento ${nome}: sem resposta ao abrir (tentativa ${n} de ${TENTATIVAS_DE_ABRIR})`);
  return null;
}

/** Quando a conexão abre: se ela cair ou outra aba pedir upgrade, `esquecer` a conexão para a próxima chamada reabrir. */
function ligarConexao(b: IDBDatabase, esquecer: () => void): IDBDatabase {
  b.onclose = esquecer;
  b.onversionchange = () => {
    b.close();
    esquecer();
  };
  return b;
}

export class Banco {
  private abrindo: Promise<IDBDatabase> | null = null;

  /** `criar` monta as lojas (da versão `anterior` em diante) ao abrir; `fabrica` devolve o IndexedDB (um falso nos testes). */
  constructor(
    private readonly nome: string,
    private readonly versao: number,
    private readonly criar: (b: IDBDatabase, anterior: number) => void,
    private readonly fabrica: () => IDBFactory | undefined = () => (typeof indexedDB === "undefined" ? undefined : indexedDB),
  ) {}

  private readonly esquecer = (): void => void (this.abrindo = null);

  private criarLojas(b: IDBDatabase, anterior: number): void {
    rastro(`armazenamento ${this.nome}: criando o banco`);
    this.criar(b, anterior);
  }

  private abrirUma(idb: IDBFactory): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((ok, falha) => {
      const r = idb.open(this.nome, this.versao);
      r.onupgradeneeded = (e) => this.criarLojas(r.result, e.oldVersion);
      r.onsuccess = () => ok(ligarConexao(r.result, this.esquecer));
      r.onerror = () => falha(r.error ?? new Error("não abriu o armazenamento"));
      r.onblocked = () => falha(new Error("armazenamento bloqueado"));
    });
  }

  /** Uma tentativa de abrir, com limite de espera. Devolve nulo se o armazenamento não respondeu a tempo (e fecha a conexão que chegar depois). */
  private tentarAbrir(idb: IDBFactory, n: number): Promise<IDBDatabase | null> {
    const tentativa = this.abrirUma(idb);
    return comLimite(tentativa, ESPERA_AO_ABRIR_MS, MOTIVO_SEM_RESPOSTA).catch((e) => semResposta(e, { nome: this.nome, tentativa, n }));
  }

  private async abrirComTentativas(idb: IDBFactory): Promise<IDBDatabase> {
    for (let i = 1; i <= TENTATIVAS_DE_ABRIR; i++) {
      const b = await this.tentarAbrir(idb, i);
      if (b) return b;
    }
    throw new Error("o armazenamento não respondeu ao abrir");
  }

  abrir(): Promise<IDBDatabase> {
    if (this.abrindo) return this.abrindo;
    const idb = this.fabrica();
    if (!idb) return Promise.reject(new Error("armazenamento indisponível"));
    // Uma falha ao abrir não fica guardada: a próxima chamada tenta de novo.
    this.abrindo = this.abrirComTentativas(idb).catch((e) => {
      this.abrindo = null;
      throw e;
    });
    return this.abrindo;
  }

  /** Fecha a conexão (nos testes, para recomeçar do zero). */
  async fechar(): Promise<void> {
    const b = await this.abrindo?.catch(() => null);
    b?.close();
    this.abrindo = null;
  }
}
