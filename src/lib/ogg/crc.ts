// O CRC-32 das páginas Ogg (RFC 3533).

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 do Ogg: polinômio 0x04C11DB7, valor inicial 0, sem inversão de bits nem XOR final. */
export function crcOgg(b: Uint8Array): number {
  let c = 0;
  for (const x of b) c = ((c << 8) ^ TABELA_CRC[((c >>> 24) ^ x) & 0xff]!) >>> 0;
  return c;
}
