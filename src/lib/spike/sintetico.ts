// SPIKE S2 (EXPERIMENTAL, descartável): o blob sintético do teste de armazenamento, gerado em pedaços (sem alocar tudo de uma vez).

/** Os tamanhos dos pedaços que somam `total` bytes (o último pode ser menor). */
export function dividirEmPedacos(total: number, tamanho: number): number[] {
  if (total <= 0 || tamanho <= 0) return [];
  const cheios = Math.floor(total / tamanho);
  const sobra = total - cheios * tamanho;
  return [...Array<number>(cheios).fill(tamanho), ...(sobra > 0 ? [sobra] : [])];
}

/** Um pedaço de `n` bytes com um padrão que muda a cada pedaço (para o conteúdo não ser todo igual). */
export function pedacoSintetico(n: number, indice: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = (i * 31 + indice * 7) & 255;
  return bytes;
}

export const MIB = 1024 * 1024;

/** Os pedaços (Blobs de `tamanho` bytes) de um vídeo falso de `total` bytes; cada buffer vira Blob na hora e é solto. */
export function pedacosSinteticos(total: number, tamanho = MIB): Blob[] {
  return dividirEmPedacos(total, tamanho).map((n, i) => new Blob([pedacoSintetico(n, i)], { type: "video/webm" }));
}
