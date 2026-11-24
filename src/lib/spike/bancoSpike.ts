// SPIKE S2, passo 4 (EXPERIMENTAL, descartável): o IndexedDB do spike. Banco PRÓPRIO (`nicska-spike`): nunca toca nos dados reais do app.

export const NOME_DO_BANCO = "nicska-spike";

const pedir = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, falha) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => falha(r.error))));

/** Termina quando a transação confirma (o dado está gravado), não quando o `put` volta. */
export const terminar = (tx: IDBTransaction): Promise<void> =>
  new Promise((ok, falha) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => falha(tx.error);
    tx.onabort = () => falha(tx.error ?? new DOMException("transação abortada", "AbortError"));
  });

/** Abre (e cria, se preciso) o banco do spike: `blocos` (chave solta), `pedacos` (chave `[id, n]`). */
export function abrirBanco(): Promise<IDBDatabase> {
  const req = indexedDB.open(NOME_DO_BANCO, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore("blocos");
    req.result.createObjectStore("pedacos", { keyPath: ["id", "n"] });
  };
  return pedir(req);
}

export async function gravarBloco(db: IDBDatabase, id: string, valor: Blob | ArrayBuffer): Promise<void> {
  const tx = db.transaction("blocos", "readwrite");
  tx.objectStore("blocos").put(valor, id);
  await terminar(tx);
}

export const lerBloco = (db: IDBDatabase, id: string): Promise<Blob | ArrayBuffer | undefined> => pedir(db.transaction("blocos").objectStore("blocos").get(id));

/** Um registro por pedaço, chave `[id, n]`, numa transação só. */
export async function gravarPedacos(db: IDBDatabase, id: string, pedacos: Blob[]): Promise<void> {
  const tx = db.transaction("pedacos", "readwrite");
  const loja = tx.objectStore("pedacos");
  pedacos.forEach((dados, n) => loja.put({ id, n, dados }));
  await terminar(tx);
}

/** Os pedaços de `id`, na ordem de `n`. */
export async function lerPedacos(db: IDBDatabase, id: string): Promise<Blob[]> {
  const faixa = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
  const registros = await pedir(db.transaction("pedacos").objectStore("pedacos").getAll(faixa));
  return (registros as Array<{ dados: Blob }>).map((r) => r.dados);
}

/** Apaga o banco inteiro do spike. */
export function apagarBanco(): Promise<void> {
  return new Promise((ok, falha) => {
    const req = indexedDB.deleteDatabase(NOME_DO_BANCO);
    req.onsuccess = () => ok();
    req.onerror = () => falha(req.error);
    req.onblocked = () => ok(); // outra aba segura o banco: some quando fechar
  });
}
