// A duração do vídeo da tentativa (C6). O MediaRecorder do Android grava WebM "ao vivo": o Segment tem tamanho desconhecido e o Info não traz `Duration`, então
// o <video> mostra duração infinita e o pulo (seek) fica ruim. Ao MONTAR o vídeo para tocar (nunca ao gravar: o que está no banco fica como veio), o Info é
// reescrito com a `Duration` = o maior instante de bloco achado nos Clusters. Só se mexe no caso que se entende: Segment de tamanho desconhecido e sem
// SeekHead/Cues (eles guardam posições que o remendo deslocaria). `Cues` (o índice) NÃO são criados: o pulo continua sendo por `currentTime`, procurando no
// blob local, e se é rápido e preciso o bastante só o aparelho diz (S2). Arquivo que não se entende volta como estava.
import { lerElemento, lerInteiro, lerTamanho, type Elemento } from "./ebml";

const ID = {
  segmento: 0x18538067, info: 0x1549a966, duracao: 0x4489, cluster: 0x1f43b675, tempo: 0xe7,
  simples: 0xa3, grupo: 0xa0, bloco: 0xa1, indice: 0x114d9b74, cues: 0x1c53bb6b,
};
const MESTRES = new Set([ID.segmento, ID.cluster, ID.grupo]);
const ABORTAR = -1;

/** O que a varredura achou: onde está o Info (`pos` = começo do cabeçalho dele), o instante do Cluster aberto e o maior instante de bloco (na escala do arquivo). */
type Varredura = { info: { pos: number; ini: number; fim: number } | null; tempoDoCluster: number; ultimo: number; temIndice: boolean };

/** O que trocar para o arquivo ganhar a duração: os bytes `[0, ate)` viram `cabecalho`; o resto segue igual. */
export type Remendo = { ate: number; cabecalho: Uint8Array };

/** O instante relativo de um (Simple)Block: inteiro de 16 bits com sinal, logo depois do número da faixa. */
function tempoDoBloco(d: Uint8Array): number {
  const faixa = lerTamanho(d, 0);
  if (!faixa || d.length < faixa.n + 2) return 0;
  const v = (d[faixa.n]! << 8) | d[faixa.n + 1]!;
  return v >= 0x8000 ? v - 0x10000 : v;
}

function anotar(b: Uint8Array, v: Varredura, el: Elemento & { pos: number; fim: number }): void {
  const dados = b.subarray(el.ini, el.fim);
  if (el.id === ID.info && !v.info) v.info = { pos: el.pos, ini: el.ini, fim: el.fim };
  else if (el.id === ID.indice || el.id === ID.cues) v.temIndice = true;
  else if (el.id === ID.tempo) v.tempoDoCluster = lerInteiro(dados);
  else if (el.id === ID.simples || el.id === ID.bloco) v.ultimo = Math.max(v.ultimo, v.tempoDoCluster + tempoDoBloco(dados));
}

/** Um passo: entra nos mestres (sem usar o tamanho deles, que pode ser desconhecido) e pula as folhas pelo tamanho. Devolve a próxima posição. */
function passo(b: Uint8Array, v: Varredura, pos: number): number {
  const el = lerElemento(b, pos);
  if (!el) return b.length; // fim (ou lixo no fim): usa o que deu para ler
  if (el.id === ID.segmento && el.tam !== -1) return ABORTAR; // arquivo já finalizado, com posições próprias: não se mexe
  if (MESTRES.has(el.id)) return el.ini;
  if (el.tam < 0) return ABORTAR;
  const fim = Math.min(el.ini + el.tam, b.length);
  anotar(b, v, { ...el, pos, fim });
  return fim;
}

function varrer(b: Uint8Array): Varredura | null {
  const v: Varredura = { info: null, tempoDoCluster: 0, ultimo: 0, temIndice: false };
  let i = 0;
  while (i >= 0 && i < b.length) i = passo(b, v, i);
  return i === ABORTAR ? null : v;
}

/** O Info já tem `Duration`? (Os filhos do Info são todos folhas.) */
function duracaoNoInfo(info: Uint8Array): number | null {
  for (let i = 0; i < info.length; ) {
    const el = lerElemento(info, i);
    if (!el || el.tam < 0) return null;
    if (el.id === ID.duracao) return lerFloat(info.subarray(el.ini, el.ini + el.tam));
    i = el.ini + el.tam;
  }
  return null;
}

function lerFloat(d: Uint8Array): number | null {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  if (d.length === 8) return dv.getFloat64(0);
  return d.length === 4 ? dv.getFloat32(0) : null;
}

function juntar(partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  partes.reduce((i, p) => (saida.set(p, i), i + p.length), 0);
  return saida;
}

/** O Info de novo: o mesmo conteúdo mais a `Duration` (float de 8 bytes), com o tamanho escrito em 8 bytes (cabe qualquer coisa). */
function infoComDuracao(info: Uint8Array, duracao: number): Uint8Array {
  const campo = new Uint8Array(11);
  campo.set([0x44, 0x89, 0x88]);
  new DataView(campo.buffer).setFloat64(3, duracao);
  const tamanho = new Uint8Array(8);
  tamanho[0] = 0x01;
  new DataView(tamanho.buffer).setUint32(4, info.length + campo.length); // os 3 bytes do meio ficam 0: Info nunca passa de 4 GB
  return juntar([Uint8Array.of(0x15, 0x49, 0xa9, 0x66), tamanho, info, campo]);
}

/** O remendo que dá a duração ao WebM gravado ao vivo, ou nulo se não precisa (já tem) ou não dá para fazer com segurança. */
export function remendoDaDuracao(b: Uint8Array): Remendo | null {
  const v = varrer(b);
  if (!v?.info || v.temIndice || v.ultimo <= 0) return null;
  const info = b.subarray(v.info.ini, v.info.fim);
  if (duracaoNoInfo(info) !== null) return null;
  return { ate: v.info.fim, cabecalho: juntar([b.subarray(0, v.info.pos), infoComDuracao(info, v.ultimo)]) };
}

/** A `Duration` do arquivo (na escala dele: ms com a escala padrão), ou nulo se não há. */
export function lerDuracaoDoWebm(b: Uint8Array): number | null {
  const v = varrer(b);
  return v?.info ? duracaoNoInfo(b.subarray(v.info.ini, v.info.fim)) : null;
}

/** O vídeo pronto para tocar: com a duração, quando dá; senão, o mesmo blob. Só o cabeçalho é copiado (o resto é uma fatia do blob original). */
export async function comDuracao(blob: Blob): Promise<Blob> {
  try {
    const r = remendoDaDuracao(new Uint8Array(await blob.arrayBuffer()));
    return r ? new Blob([r.cabecalho as BlobPart, blob.slice(r.ate)], { type: blob.type }) : blob;
  } catch (e) {
    console.warn("webm: não deu para pôr a duração; toca como veio", e);
    return blob;
  }
}
