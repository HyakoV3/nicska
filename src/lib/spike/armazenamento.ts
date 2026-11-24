// SPIKE S2, passo 4 (EXPERIMENTAL, descartável): grava o vídeo no IndexedDB de três formas (bloco como ArrayBuffer, como o app guarda o áudio; bloco como Blob; em pedaços),
// mede o tempo de escrita e leitura e a memória do JavaScript, e remonta o Blob para tocar.
import { abrirBanco, gravarBloco, gravarPedacos, lerBloco, lerPedacos } from "./bancoSpike";
import { carregarVideo, type Carregado } from "./reproducao";
import { cronometrar, memoriaJs } from "./util";
import type { Entrada } from "./relatorio";

export type Alvo = { id: string; blob: Blob; pedacos: Blob[] };

type Forma = { nome: string; escrever: (db: IDBDatabase, a: Alvo) => Promise<void>; ler: (db: IDBDatabase, a: Alvo) => Promise<Blob> };

const comoBlob = async (v: Blob | ArrayBuffer | undefined, tipo: string): Promise<Blob> => (v instanceof Blob ? v : new Blob(v ? [v] : [], { type: tipo }));

const FORMAS: Forma[] = [
  { nome: "bloco-ArrayBuffer", escrever: async (db, a) => gravarBloco(db, `${a.id}-buf`, await a.blob.arrayBuffer()), ler: async (db, a) => comoBlob(await lerBloco(db, `${a.id}-buf`), a.blob.type) },
  { nome: "bloco-Blob", escrever: (db, a) => gravarBloco(db, `${a.id}-blob`, a.blob), ler: async (db, a) => comoBlob(await lerBloco(db, `${a.id}-blob`), a.blob.type) },
  { nome: "pedacos", escrever: (db, a) => gravarPedacos(db, a.id, a.pedacos), ler: async (db, a) => new Blob(await lerPedacos(db, a.id), { type: a.blob.type }) },
];

type Remontado = { bytes: number; carregado: Carregado | null };

/** Lê de volta, junta e tenta carregar no `<video>`: o que voltou do banco toca? */
async function remontar(blob: Blob): Promise<Remontado> {
  await blob.arrayBuffer(); // força a leitura de verdade (um Blob do IndexedDB é lazy)
  const { video, url, carregado } = await carregarVideo(blob);
  video.removeAttribute("src");
  URL.revokeObjectURL(url);
  return { bytes: blob.size, carregado };
}

async function ensaiarForma(db: IDBDatabase, forma: Forma, alvo: Alvo): Promise<Entrada> {
  const heapAntes = memoriaJs();
  try {
    const escrita = await cronometrar(() => forma.escrever(db, alvo));
    const heapDepoisDaEscrita = memoriaJs();
    const leitura = await cronometrar(async () => remontar(await forma.ler(db, alvo)));
    return { forma: forma.nome, escritaMs: escrita.ms, leituraMs: leitura.ms, remontou: leitura.valor, heapAntes, heapDepoisDaEscrita, heapDepoisDaLeitura: memoriaJs() };
  } catch (e) {
    return { forma: forma.nome, erro: { nome: (e as Error).name, mensagem: (e as Error).message }, heapAntes, heapDepoisDoErro: memoriaJs() };
  }
}

/** Roda as três formas com o mesmo conteúdo. */
export async function ensaiarArmazenamento(alvo: Alvo): Promise<Entrada> {
  const db = await abrirBanco();
  try {
    const formas: Entrada[] = [];
    for (const f of FORMAS) formas.push(await ensaiarForma(db, f, alvo));
    return { passo: "armazenamento", id: alvo.id, bytes: alvo.blob.size, pedacos: alvo.pedacos.length, blobType: alvo.blob.type, formas };
  } finally {
    db.close();
  }
}
