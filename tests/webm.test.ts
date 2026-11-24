import { describe, expect, it } from "vitest";
import { lerOpusDoWebm, opusHeadValido } from "../src/lib/webm";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

// Caracterização de `lerOpusDoWebm`: monta WebM mínimos à mão (EBML) para cobrir os ramos que as fixtures reais não cobrem.
const cat = (...p: number[][]) => p.flat();
const DESCONHECIDO = [0xff]; // tamanho de 1 byte com todos os bits em 1
const el = (id: number[], dados: number[]) => cat(id, [0x80 | dados.length], dados); // tamanho de 1 byte (dados < 127)
const elDesc = (id: number[], filhos: number[]) => cat(id, DESCONHECIDO, filhos);

const opusHead = (canais = 1, mapeamento = 0, preSkip = 312) => [...new TextEncoder().encode("OpusHead"), 1, canais, preSkip & 0xff, preSkip >> 8, 0x80, 0xbb, 0, 0, 0, 0, mapeamento];
const faixa = (opts: { num?: number; codec?: string; privado?: number[] } = {}) =>
  el([0xae], cat(el([0xd7], [opts.num ?? 1]), el([0x86], [...new TextEncoder().encode(opts.codec ?? "A_OPUS")]), el([0x63, 0xa2], opts.privado ?? opusHead())));
const tracks = (...f: number[][]) => el([0x16, 0x54, 0xae, 0x6b], cat(...f));
const bloco = (id: number[], faixaNum: number, flags: number, carga: number[]) => el(id, [0x80 | faixaNum, 0, 0, flags, ...carga]);
const simples = (carga: number[], faixaNum = 1, flags = 0x80) => bloco([0xa3], faixaNum, flags, carga);
const grupo = (carga: number[], faixaNum = 1, extra: number[] = []) => el([0xa0], cat(bloco([0xa1], faixaNum, 0, carga), extra));
const cluster = (...filhos: number[][]) => elDesc([0x1f, 0x43, 0xb6, 0x75], cat(el([0xe7], [0]), ...filhos));
const segmento = (...filhos: number[][]) => elDesc([0x18, 0x53, 0x80, 0x67], cat(...filhos));
const arquivo = (...filhos: number[][]) => Uint8Array.from(cat(el([0x1a, 0x45, 0xdf, 0xa3], []), segmento(...filhos)));
const tex = (b: Uint8Array) => String.fromCharCode(...b);

describe("lerOpusDoWebm: fixtures reais", () => {
  it.each([["comum", OPUS_WEBM], ["ao vivo", OPUS_WEBM_AO_VIVO]])("WebM %s: OpusHead mono 48 kHz, pacotes e descarte", (_n, b64) => {
    const o = lerOpusDoWebm(bytesDe(b64))!;
    expect(tex(o.cabecalho.subarray(0, 8))).toBe("OpusHead");
    expect(o.cabecalho[9]).toBe(1);
    expect(o.pacotes.length).toBeGreaterThan(20);
    expect(o.descarte).toBeGreaterThanOrEqual(0);
  });
});

describe("lerOpusDoWebm: WebM montado à mão", () => {
  it("SimpleBlock: devolve o cabeçalho e os pacotes (sem o cabeçalho do bloco)", () => {
    const o = lerOpusDoWebm(arquivo(tracks(faixa()), cluster(simples([1, 2, 3]), simples([4, 5]))))!;
    expect(Array.from(o.cabecalho)).toEqual(opusHead());
    expect(o.pacotes.map((p) => Array.from(p))).toEqual([[1, 2, 3], [4, 5]]);
    expect(o.descarte).toBe(0);
  });
  it("BlockGroup com Block (0xa1): também vira pacote", () => {
    const o = lerOpusDoWebm(arquivo(tracks(faixa()), cluster(grupo([9, 8, 7]), simples([6]))))!;
    expect(o.pacotes.map((p) => Array.from(p))).toEqual([[9, 8, 7], [6]]);
  });
  it("DiscardPadding (ns) vira amostras a 48 kHz; negativo vira 0", () => {
    const ns = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    const comDescarte = lerOpusDoWebm(arquivo(tracks(faixa()), cluster(grupo([1], 1, el([0x75, 0xa2], ns(20_000_000))))))!;
    expect(comDescarte.descarte).toBe(960);
    const negativo = lerOpusDoWebm(arquivo(tracks(faixa()), cluster(grupo([1], 1, el([0x75, 0xa2], [0xff, 0xff, 0xff, 0xff])))))!;
    expect(negativo.descarte).toBe(0);
  });
  it("cluster de tamanho desconhecido (e Segment): é percorrido por dentro", () => {
    const o = lerOpusDoWebm(arquivo(tracks(faixa()), cluster(simples([1])), cluster(simples([2]))))!;
    expect(o.pacotes).toHaveLength(2);
  });
  it("elementos desconhecidos com tamanho são pulados", () => {
    const lixo = el([0xec], [0, 0, 0, 0]); // Void
    const o = lerOpusDoWebm(arquivo(lixo, tracks(faixa()), cluster(lixo, simples([1]), lixo)))!;
    expect(o.pacotes).toHaveLength(1);
  });
  it("escolhe a faixa Opus entre várias e ignora os blocos das outras", () => {
    const o = lerOpusDoWebm(arquivo(tracks(faixa({ num: 1, codec: "V_VP8", privado: [1] }), faixa({ num: 2 })), cluster(simples([1], 1), simples([2], 2), simples([3], 2))))!;
    expect(o.pacotes.map((p) => Array.from(p))).toEqual([[2], [3]]);
  });
  it("CodecID com zeros de preenchimento no fim ainda é A_OPUS", () => {
    const f = el([0xae], cat(el([0xd7], [1]), el([0x86], [...new TextEncoder().encode("A_OPUS"), 0, 0]), el([0x63, 0xa2], opusHead())));
    expect(lerOpusDoWebm(arquivo(tracks(f), cluster(simples([1]))))).not.toBeNull();
  });
});

describe("lerOpusDoWebm: entradas inválidas ou cortadas", () => {
  it("vazio, lixo e só o cabeçalho EBML: null", () => {
    expect(lerOpusDoWebm(new Uint8Array([]))).toBeNull();
    expect(lerOpusDoWebm(new Uint8Array([0, 0, 0, 0]))).toBeNull();
    expect(lerOpusDoWebm(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(lerOpusDoWebm(Uint8Array.from(el([0x1a, 0x45, 0xdf, 0xa3], [])))).toBeNull();
  });
  it("sem pacotes (faixa e nenhum bloco): null", () => {
    expect(lerOpusDoWebm(arquivo(tracks(faixa()), cluster()))).toBeNull();
  });
  it("sem cabeçalho de faixa Opus (codec de vídeo): null", () => {
    expect(lerOpusDoWebm(arquivo(tracks(faixa({ codec: "V_VP8", privado: [1] })), cluster(simples([1]))))).toBeNull();
  });
  it("bloco antes de qualquer faixa: null", () => {
    expect(lerOpusDoWebm(arquivo(cluster(simples([1]))))).toBeNull();
  });
  it("bloco curto demais para ter o cabeçalho: null", () => {
    expect(lerOpusDoWebm(arquivo(tracks(faixa()), cluster(el([0xa3], [0x81, 0]))))).toBeNull();
  });
  it("lacing na faixa Opus: null; em outra faixa, o bloco só é pulado", () => {
    expect(lerOpusDoWebm(arquivo(tracks(faixa()), cluster(simples([1], 1, 0x82))))).toBeNull();
    const o = lerOpusDoWebm(arquivo(tracks(faixa({ num: 2 })), cluster(simples([1], 1, 0x82), simples([5], 2))))!;
    expect(o.pacotes.map((p) => Array.from(p))).toEqual([[5]]);
  });
  it("tamanho desconhecido num elemento que não é mestre: null", () => {
    expect(lerOpusDoWebm(arquivo(tracks(faixa()), cluster(cat([0xa3], DESCONHECIDO, [0x81, 0, 0, 0x80, 1]))))).toBeNull();
  });
  it("OpusHead inválido (curto, sem assinatura, versão ≠ 0, 0 canais): null", () => {
    const sem = (cab: number[]) => lerOpusDoWebm(arquivo(tracks(faixa({ privado: cab })), cluster(simples([1]))));
    expect(sem(opusHead().slice(0, 10))).toBeNull();
    expect(sem(opusHead().map((x, i) => (i === 0 ? 0x58 : x)))).toBeNull();
    expect(sem(opusHead().map((x, i) => (i === 8 ? 0x10 : x)))).toBeNull();
    expect(sem(opusHead(0))).toBeNull();
  });
  it("canais ≠ 1: estéreo com mapeamento 0 é aceito; mapeamento ≠ 0 exige a tabela de canais", () => {
    const com = (cab: number[]) => lerOpusDoWebm(arquivo(tracks(faixa({ privado: cab })), cluster(simples([1]))));
    expect(com(opusHead(2))!.cabecalho[9]).toBe(2);
    expect(com(opusHead(2, 1))).toBeNull(); // faltam os 2 bytes + tabela
    expect(com([...opusHead(2, 1), 1, 1, 0, 1])).not.toBeNull();
  });
  it("cortado no meio do último bloco: o bloco incompleto é descartado, os anteriores ficam", () => {
    const inteiro = arquivo(tracks(faixa()), cluster(simples([1, 2, 3]), simples([4, 5, 6, 7])));
    const o = lerOpusDoWebm(inteiro.subarray(0, inteiro.length - 2))!;
    expect(o.pacotes.map((p) => Array.from(p))).toEqual([[1, 2, 3]]);
  });
  it("cortado antes do primeiro bloco ou no meio da faixa: null", () => {
    const inteiro = arquivo(tracks(faixa()), cluster(simples([1])));
    expect(lerOpusDoWebm(inteiro.subarray(0, 30))).toBeNull();
    expect(lerOpusDoWebm(inteiro.subarray(0, inteiro.length - 8))).toBeNull();
  });
  it("fixture real cortada em qualquer ponto não lança", () => {
    const webm = bytesDe(OPUS_WEBM_AO_VIVO);
    for (let n = 0; n < webm.length; n += 37) expect(() => lerOpusDoWebm(webm.subarray(0, n))).not.toThrow();
  });
});

describe("opusHeadValido", () => {
  it("exige 19 bytes, assinatura, versão 0 e ao menos 1 canal", () => {
    expect(opusHeadValido(Uint8Array.from(opusHead()))).toBe(true);
    expect(opusHeadValido(new Uint8Array(5))).toBe(false);
    expect(opusHeadValido(Uint8Array.from(opusHead(0)))).toBe(false);
  });
});
