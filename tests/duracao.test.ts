import { describe, expect, it, vi } from "vitest";
import { lerOpusDoWebm } from "../src/lib/webm";
import { comDuracao, lerDuracaoDoWebm, remendoDaDuracao } from "../src/lib/webm/duracao";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

// A duração posta no WebM gravado ao vivo (C6), ao montar o vídeo para tocar. WebM mínimos à mão (como em webm.test.ts) e a fixture real do Chrome ao vivo.
const cat = (...p: number[][]) => p.flat();
const el = (id: number[], dados: number[]) => cat(id, [0x80 | dados.length], dados);
const elDesc = (id: number[], filhos: number[]) => cat(id, [0xff], filhos);
const info = (...filhos: number[][]) => el([0x15, 0x49, 0xa9, 0x66], cat(el([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40]), ...filhos)); // TimecodeScale 1 ms
const simples = (tempo: number) => el([0xa3], [0x81, (tempo >> 8) & 0xff, tempo & 0xff, 0x80, 1, 2]);
const cluster = (tempo: number, ...filhos: number[][]) => elDesc([0x1f, 0x43, 0xb6, 0x75], cat(el([0xe7], [(tempo >> 8) & 0xff, tempo & 0xff]), ...filhos));
const segmento = (...filhos: number[][]) => elDesc([0x18, 0x53, 0x80, 0x67], cat(...filhos));
const arquivo = (...filhos: number[][]) => Uint8Array.from(cat(el([0x1a, 0x45, 0xdf, 0xa3], []), segmento(...filhos)));
const aplicar = (b: Uint8Array) => {
  const r = remendoDaDuracao(b)!;
  const saida = new Uint8Array(r.cabecalho.length + b.length - r.ate);
  saida.set(r.cabecalho);
  saida.set(b.subarray(r.ate), r.cabecalho.length);
  return saida;
};

describe("remendoDaDuracao", () => {
  it("põe no Info a Duration = maior instante de bloco (Cluster + relativo), sem mexer no resto", () => {
    const b = arquivo(info(), cluster(0, simples(0), simples(33)), cluster(1000, simples(0), simples(966)));
    const saida = aplicar(b);
    expect(lerDuracaoDoWebm(b)).toBeNull();
    expect(lerDuracaoDoWebm(saida)).toBe(1966);
    const r = remendoDaDuracao(b)!;
    expect(Array.from(saida.subarray(r.cabecalho.length))).toEqual(Array.from(b.subarray(r.ate))); // os Clusters seguem iguais
  });
  it("instante relativo negativo (inteiro com sinal) é respeitado", () => {
    expect(lerDuracaoDoWebm(aplicar(arquivo(info(), cluster(500, simples(0), simples(0xffff)))))).toBe(500);
  });
  it("já tem Duration, tem índice (SeekHead/Cues), Segment de tamanho conhecido, sem Info ou sem blocos: não mexe", () => {
    const dur = el([0x44, 0x89], [0x40, 0x8f, 0x40, 0, 0, 0, 0, 0]); // 1000.0
    expect(remendoDaDuracao(arquivo(info(dur), cluster(0, simples(10))))).toBeNull();
    expect(remendoDaDuracao(arquivo(el([0x11, 0x4d, 0x9b, 0x74], [0]), info(), cluster(0, simples(10))))).toBeNull();
    const conhecido = Uint8Array.from(cat(el([0x1a, 0x45, 0xdf, 0xa3], []), el([0x18, 0x53, 0x80, 0x67], cat(info(), el([0xec], [0])))));
    expect(remendoDaDuracao(conhecido)).toBeNull();
    expect(remendoDaDuracao(arquivo(cluster(0, simples(10))))).toBeNull();
    expect(remendoDaDuracao(arquivo(info()))).toBeNull();
    expect(remendoDaDuracao(Uint8Array.of(1, 2, 3))).toBeNull();
  });
  it("arquivo cortado no meio de um bloco: usa o que deu para ler (o instante do bloco cortado ainda vale)", () => {
    const b = arquivo(info(), cluster(0, simples(10)), cluster(2000, simples(40)));
    expect(lerDuracaoDoWebm(aplicar(b.subarray(0, b.length - 3)))).toBe(2040);
  });
  it("o arquivo remendado continua legível: os mesmos blocos para o leitor de Opus", () => {
    const opus = [...new TextEncoder().encode("OpusHead"), 1, 1, 0x38, 1, 0x80, 0xbb, 0, 0, 0, 0, 0];
    const faixa = el([0xae], cat(el([0xd7], [1]), el([0x86], [...new TextEncoder().encode("A_OPUS")]), el([0x63, 0xa2], opus)));
    const b = arquivo(info(), el([0x16, 0x54, 0xae, 0x6b], faixa), cluster(0, simples(0), simples(20)), cluster(40, simples(0)));
    const saida = aplicar(b);
    expect(lerDuracaoDoWebm(saida)).toBe(40);
    expect(lerOpusDoWebm(saida)!.pacotes.length).toBe(3);
  });
  it("WebM real do ffmpeg (já finalizado, ou ao vivo com SeekHead): nada a fazer, para não deslocar as posições do índice", () => {
    expect(remendoDaDuracao(bytesDe(OPUS_WEBM))).toBeNull();
    expect(remendoDaDuracao(bytesDe(OPUS_WEBM_AO_VIVO))).toBeNull();
  });
});

describe("comDuracao (o blob para tocar)", () => {
  it("devolve um blob novo com a duração e o mesmo tipo", async () => {
    const b = arquivo(info(), cluster(0, simples(0), simples(1500)));
    const saida = await comDuracao(new Blob([b], { type: "video/webm" }));
    expect(saida.type).toBe("video/webm");
    expect(lerDuracaoDoWebm(new Uint8Array(await saida.arrayBuffer()))).toBe(1500);
  });
  it("arquivo que não se entende ou leitura que falha: o mesmo blob", async () => {
    const estranho = new Blob([Uint8Array.of(9, 9, 9)]);
    expect(await comDuracao(estranho)).toBe(estranho);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const quebrado = { arrayBuffer: () => Promise.reject(new Error("lido")) } as unknown as Blob;
    expect(await comDuracao(quebrado)).toBe(quebrado);
  });
});
