// Os pedaços de baixo nível do EBML (a base do Matroska/WebM): IDs, tamanhos, inteiros e textos curtos. O leitor de Opus fica em `webm.ts`; a duração do vídeo, em `duracao.ts`.

/** Lê um ID (1 a 4 bytes, com os bits de tamanho mantidos). */
export function lerId(b: Uint8Array, i: number): { v: number; n: number } | null {
  const p = b[i];
  if (p === undefined || p === 0) return null;
  const n = Math.clz32(p) - 23; // 1 a 4
  if (n > 4 || i + n > b.length) return null;
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[i + k]!;
  return { v, n };
}

/** Lê um tamanho (1 a 8 bytes, sem o marcador). `v` é -1 quando o tamanho é desconhecido (todos os bits em 1). */
export function lerTamanho(b: Uint8Array, i: number): { v: number; n: number } | null {
  const p = b[i];
  if (p === undefined || p === 0) return null;
  const n = Math.clz32(p) - 23;
  if (i + n > b.length) return null;
  let v = p & (0xff >> n);
  let tudoUm = v === 0xff >> n;
  for (let k = 1; k < n; k++) {
    const c = b[i + k]!;
    if (c !== 0xff) tudoUm = false;
    v = v * 256 + c;
  }
  return { v: tudoUm ? -1 : v, n };
}

/** Texto curto (CodecID, "OpusHead"): sem o preenchimento de zeros do fim e sem passar dos 64 bytes (um elemento enorme não estoura a pilha). */
export const texto = (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 64)).replace(/\0+$/, "");

/** Inteiro de até 8 bytes, big-endian; `assinado` estende o sinal pelo primeiro bit. */
export function lerInteiro(dados: Uint8Array, assinado = false): number {
  let n = assinado && dados[0]! & 0x80 ? -1 : 0;
  for (const c of dados) n = n * 256 + c;
  return n;
}

/** Um elemento: o ID, o tamanho declarado (`tam`, -1 se desconhecido) e onde começam os dados (`ini`). */
export type Elemento = { id: number; tam: number; ini: number };

/** Lê o cabeçalho (ID e tamanho) do elemento que começa em `i`; nulo se não há um ali. */
export function lerElemento(b: Uint8Array, i: number): Elemento | null {
  const id = lerId(b, i);
  const tam = id && lerTamanho(b, i + id.n);
  return id && tam ? { id: id.v, tam: tam.v, ini: i + id.n + tam.n } : null;
}
