import { describe, expect, it } from "vitest";
import { amostrasDoPacote, crcOgg, escreverOgg, webmParaOgg } from "../src/lib/ogg";
import { lerOpusDoWebm } from "../src/lib/webm";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

const fixture = (n: string) => bytesDe(n === "opus-0.webm" ? OPUS_WEBM : OPUS_WEBM_AO_VIVO);
const texto = (b: Uint8Array) => String.fromCharCode(...b);

/** Percorre as páginas Ogg conferindo o CRC de cada uma. */
function paginas(b: Uint8Array) {
  const out: { tipo: number; granule: number; seq: number; pacotes: number; crcOk: boolean }[] = [];
  let i = 0;
  while (i < b.length) {
    expect(texto(b.subarray(i, i + 4))).toBe("OggS");
    const n = b[i + 26]!;
    let corpo = 0;
    for (let k = 0; k < n; k++) corpo += b[i + 27 + k]!;
    const total = 27 + n + corpo;
    const v = new DataView(b.buffer, b.byteOffset + i, total);
    const copia = b.slice(i, i + total);
    new DataView(copia.buffer).setUint32(22, 0, true);
    out.push({ tipo: b[i + 5]!, granule: v.getUint32(6, true) + v.getUint32(10, true) * 2 ** 32, seq: v.getUint32(18, true), pacotes: b.subarray(i + 27, i + 27 + n).filter((x) => x < 255).length, crcOk: crcOgg(copia) === v.getUint32(22, true) });
    i += total;
  }
  return out;
}

describe("crcOgg", () => {
  it("bate com o valor conhecido do CRC do Ogg (CRC-32/MPEG-2 sem inversões, de '123456789' = 0x89A1897F)", () => {
    expect(crcOgg(new TextEncoder().encode("123456789"))).toBe(0x89a1897f);
  });
});

describe("amostrasDoPacote", () => {
  it("lê a duração do byte TOC", () => {
    expect(amostrasDoPacote(new Uint8Array([0b01111000]))).toBe(960); // CELT 20 ms, 1 quadro
    expect(amostrasDoPacote(new Uint8Array([0b01111001]))).toBe(1920); // 2 quadros
    expect(amostrasDoPacote(new Uint8Array([0b01111011, 3]))).toBe(2880); // código 3, 3 quadros
    expect(amostrasDoPacote(new Uint8Array([0b00000000]))).toBe(480); // SILK 10 ms
    expect(amostrasDoPacote(new Uint8Array([]))).toBe(0);
  });
});

describe.each(["opus-0.webm", "opus-ao-vivo.webm"])("WebM → Ogg (%s)", (nome) => {
  it("lê o Opus: OpusHead mono 48 kHz e os pacotes", () => {
    const o = lerOpusDoWebm(fixture(nome))!;
    expect(texto(o.cabecalho.subarray(0, 8))).toBe("OpusHead");
    expect(o.cabecalho[9]).toBe(1); // canais
    expect(o.pacotes.length).toBeGreaterThan(20);
  });
  it("escreve um Ogg válido: páginas em ordem, CRC certo, granule = pre-skip + amostras, fim marcado", () => {
    const webm = fixture(nome);
    const o = lerOpusDoWebm(webm)!;
    const ogg = webmParaOgg(webm)!;
    const p = paginas(ogg);
    expect(p.every((x) => x.crcOk)).toBe(true);
    expect(p.map((x) => x.seq)).toEqual(p.map((_, i) => i));
    expect(p[0]!.tipo).toBe(0x02);
    expect(p[p.length - 1]!.tipo).toBe(0x04);
    expect(texto(ogg.subarray(28, 36))).toBe("OpusHead");
    const preSkip = new DataView(o.cabecalho.buffer, o.cabecalho.byteOffset).getUint16(10, true);
    const amostras = o.pacotes.reduce((s, x) => s + amostrasDoPacote(x), 0);
    expect(p[p.length - 1]!.granule).toBe(preSkip + amostras - o.descarte);
    // todos os pacotes estão lá (2 páginas de cabeçalho + os de áudio)
    expect(p.slice(2).reduce((s, x) => s + x.pacotes, 0)).toBe(o.pacotes.length);
  });
});

describe("páginas e validações", () => {
  const cab = () => lerOpusDoWebm(fixture("opus-0.webm"))!.cabecalho;
  const pacote = (n: number) => {
    const p = new Uint8Array(n);
    p[0] = 0b01111000; // CELT 20 ms
    return p;
  };
  it("pacotes grandes: a página fecha antes de passar de 255 valores de lacing", () => {
    const grandes = Array.from({ length: 120 }, () => pacote(1275)); // 5 valores cada: 50 por página passariam de 255
    const p = paginas(escreverOgg(cab(), grandes));
    expect(p.every((x) => x.crcOk)).toBe(true);
    expect(p.slice(2).reduce((s, x) => s + x.pacotes, 0)).toBe(120);
  });
  it("o DiscardPadding tira do fim o que não é áudio", () => {
    const o = lerOpusDoWebm(fixture("opus-0.webm"))!;
    const a = paginas(escreverOgg(o.cabecalho, o.pacotes, { descarte: 0 }));
    const b = paginas(escreverOgg(o.cabecalho, o.pacotes, { descarte: 500 }));
    expect(a[a.length - 1]!.granule - b[b.length - 1]!.granule).toBe(500);
  });
  it("pacote de exatamente 255 bytes usa 2 valores de lacing (255 e 0) e continua sendo 1 pacote", () => {
    const p = paginas(escreverOgg(cab(), [pacote(255), pacote(510), pacote(10)]));
    expect(p.every((x) => x.crcOk)).toBe(true);
    expect(p.slice(2).reduce((s, x) => s + x.pacotes, 0)).toBe(3);
  });
  it("mais de 50 pacotes pequenos: páginas de até 50, só a última marcada como fim", () => {
    const p = paginas(escreverOgg(cab(), Array.from({ length: 120 }, () => pacote(10))));
    expect(p.slice(2).map((x) => x.pacotes)).toEqual([50, 50, 20]);
    expect(p.slice(2).map((x) => x.tipo)).toEqual([0, 0, 0x04]);
    expect(p[2]!.granule).toBe(312 + 50 * 960); // pre-skip da fixture + 50 pacotes de 20 ms
  });
  it("DiscardPadding maior que o áudio: o granule final não fica abaixo do pre-skip", () => {
    const p = paginas(escreverOgg(cab(), [pacote(10)], { descarte: 100000 }));
    expect(p[p.length - 1]!.granule).toBe(312);
  });
  it("recusa OpusHead inválido, sem pacotes e pacote code-3 com 0 ou quadros demais", () => {
    expect(() => escreverOgg(new Uint8Array(5), [pacote(10)])).toThrow();
    expect(() => escreverOgg(cab(), [])).toThrow();
    expect(() => escreverOgg(cab(), [new Uint8Array([0b01111011, 0])])).toThrow(); // 0 quadros
    expect(() => escreverOgg(cab(), [new Uint8Array([0b01111011, 7])])).toThrow(); // 7 x 20 ms > 120 ms
    expect(amostrasDoPacote(new Uint8Array([0b01111011, 6]))).toBe(5760);
  });
});

describe("casos de erro", () => {
  it("não é WebM: devolve null", () => {
    expect(webmParaOgg(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(webmParaOgg(new Uint8Array([]))).toBeNull();
  });
  it("arquivo cortado no meio: usa o que deu para ler", () => {
    const webm = fixture("opus-ao-vivo.webm");
    const cheio = lerOpusDoWebm(webm)!.pacotes.length;
    const cortado = lerOpusDoWebm(webm.subarray(0, webm.length - 300))!;
    expect(cortado.pacotes.length).toBeGreaterThan(0);
    expect(cortado.pacotes.length).toBeLessThan(cheio);
  });
  it("pacote enorme demais para uma página: erro (quem chama usa o original)", () => {
    const cab = lerOpusDoWebm(fixture("opus-0.webm"))!.cabecalho;
    expect(() => escreverOgg(cab, [new Uint8Array(70000)])).toThrow();
  });
});
