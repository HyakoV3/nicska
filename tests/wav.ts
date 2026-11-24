// Leitor mínimo de WAV PCM 16 bits mono (os fixtures de tests/fixtures/), achando o bloco `data` entre os blocos de cabeçalho.
import { readFileSync } from "node:fs";

export function lerWav(caminho: string): { amostras: Float32Array; taxa: number } {
  const b = readFileSync(caminho);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let taxa = 0;
  let pos = 12;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const tam = v.getUint32(pos + 4, true);
    if (id === "fmt ") taxa = v.getUint32(pos + 12, true);
    if (id === "data") {
      const n = Math.min(tam, b.length - pos - 8) >> 1;
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = v.getInt16(pos + 8 + 2 * i, true) / 32768;
      return { amostras: x, taxa };
    }
    pos += 8 + tam + (tam & 1);
  }
  throw new Error(`sem bloco data em ${caminho}`);
}
