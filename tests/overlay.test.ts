import { describe, expect, it } from "vitest";
import { zeroNoVideoS } from "../src/lib/video/alinhamento";
import { CLARAO_MS, DESTAQUE_MS, SPLITS_VISIVEIS, dataDoCabecalho, estadoDoOverlay, opacidadeDoSplit, type DadosDoOverlay } from "../src/lib/video/overlay";
import { edicaoDe, apagarDisparo, inserirDisparo } from "../src/lib/revisao";

// O overlay da reprodução: o que aparece em cada instante do vídeo, a partir do apito já levado ao vídeo e dos disparos atuais da Revisão.

// Apito aos 2 s do vídeo; disparos a 1,50 s, 1,80 s e 2,30 s do apito.
const dados = (o: Partial<DadosDoOverlay> = {}): DadosDoOverlay => ({ zeroNoVideoS: 2, disparosMs: [1500, 1800, 2300], ...o });

describe("estadoDoOverlay: fases", () => {
  it("antes do apito: STAND BY, cronômetro em zero, nada de disparos", () => {
    const e = estadoDoOverlay(1.2, dados());
    expect(e).toMatchObject({ fase: "antes", decorridoMs: 0, nDisparos: 0, splits: [], recente: null, clarao: false, resultado: null });
  });
  it("tempo negativo ou inválido vale antes (não adianta o cronômetro)", () => {
    for (const t of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(estadoDoOverlay(t, dados()).fase, String(t)).toBe("antes");
  });
  it("no apito: corre do zero, com o clarão só nos primeiros ms", () => {
    expect(estadoDoOverlay(2, dados())).toMatchObject({ fase: "correndo", decorridoMs: 0, clarao: true });
    expect(estadoDoOverlay(2 + (CLARAO_MS - 1) / 1000, dados()).clarao).toBe(true);
    expect(estadoDoOverlay(2 + CLARAO_MS / 1000, dados()).clarao).toBe(false);
  });
  it("correndo: tempo desde o apito, em ms", () => {
    const e = estadoDoOverlay(3, dados());
    expect(e.fase).toBe("correndo");
    expect(e.decorridoMs).toBeCloseTo(1000, 6);
    expect(e.nDisparos).toBe(0);
  });
  it("exatamente no tiro, ele já conta e fica destacado", () => {
    const e = estadoDoOverlay(3.5, dados());
    expect(e.nDisparos).toBe(1);
    expect(e.splits).toEqual([{ n: 1, splitMs: 1500, instanteMs: 1500 }]);
    expect(e.recente).toBe(1);
  });
  it("o destaque some depois de DESTAQUE_MS", () => {
    const espacados = dados({ disparosMs: [1500, 3000] });
    expect(estadoDoOverlay(3.5 + (DESTAQUE_MS - 10) / 1000, espacados).recente).toBe(1);
    expect(estadoDoOverlay(3.5 + (DESTAQUE_MS + 10) / 1000, espacados).recente).toBeNull();
  });
  it("splits: o 1º é o tempo até ele, os outros a diferença para o anterior", () => {
    const e = estadoDoOverlay(4.0, dados());
    expect(e.splits.map((s) => s.splitMs)).toEqual([1500, 300]);
  });
  it("depois do último: fim, cronômetro parado no total e o resultado", () => {
    const e = estadoDoOverlay(9, dados());
    expect(e.fase).toBe("fim");
    expect(e.decorridoMs).toBe(2300);
    expect(e.splits.map((s) => s.splitMs)).toEqual([1500, 300, 500]);
    expect(e.resultado).toEqual({ totalMs: 2300, primeiroMs: 1500, n: 3, pontos: null, hf: null, incompleta: false });
  });
  it("no instante do último disparo já é o fim", () => {
    expect(estadoDoOverlay(4.3, dados()).fase).toBe("fim");
  });
});

describe("estadoDoOverlay: casos de borda", () => {
  it("sem disparos não há fim: o cronômetro corre", () => {
    const e = estadoDoOverlay(30, dados({ disparosMs: [] }));
    expect(e).toMatchObject({ fase: "correndo", nDisparos: 0, resultado: null });
    expect(e.decorridoMs).toBeCloseTo(28000, 6);
  });
  it("incompleta leva o selo; pontos dão o total e o HF (o mesmo da Revisão)", () => {
    const pontos = { A: 4, C: 2, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" as const };
    const e = estadoDoOverlay(9, dados({ pontos, incompleta: true }));
    expect(e.resultado?.incompleta).toBe(true);
    expect(e.resultado?.pontos).toBe(26);
    expect(e.resultado?.hf).toBeCloseTo(26 / 2.3, 9);
  });
  it("apito antes do primeiro quadro (zero negativo): o vídeo começa já correndo", () => {
    const zero = zeroNoVideoS({ zeroNoAudioS: 0.3, inicioDoVideoMs: 800 });
    expect(zero).toBeCloseTo(-0.5, 9);
    const e = estadoDoOverlay(0, dados({ zeroNoVideoS: zero }));
    expect(e.fase).toBe("correndo");
    expect(e.decorridoMs).toBeCloseTo(500, 6);
  });
  it("disparo editado na Revisão: o overlay acompanha (apagar e inserir)", () => {
    let ed = edicaoDe([1500, 1800, 2300]);
    ed = apagarDisparo(ed, 1);
    expect(estadoDoOverlay(9, dados({ disparosMs: ed.disparosMs })).splits.map((s) => s.splitMs)).toEqual([1500, 800]);
    ed = inserirDisparo(ed, 3000);
    const e = estadoDoOverlay(4.5, dados({ disparosMs: ed.disparosMs }));
    expect(e.fase).toBe("correndo");
    expect(e.nDisparos).toBe(2);
    expect(estadoDoOverlay(9, dados({ disparosMs: ed.disparosMs })).resultado?.totalMs).toBe(3000);
  });
});

describe("zeroNoVideoS e dataDoCabecalho", () => {
  it("zero no vídeo = zero no áudio − deslocamento; inválido vale 0", () => {
    expect(zeroNoVideoS({ zeroNoAudioS: 4.5, inicioDoVideoMs: 1200 })).toBeCloseTo(3.3, 9);
    expect(zeroNoVideoS({ zeroNoAudioS: Number.NaN, inicioDoVideoMs: 0 })).toBe(0);
  });
  it("a data no idioma; inválida ou ausente fica vazia", () => {
    expect(dataDoCabecalho("2026-11-23T10:00:00-03:00", "pt-BR")).toMatch(/23\/11\/2026/);
    expect(dataDoCabecalho("ontem", "pt-BR")).toBe("");
    expect(dataDoCabecalho(undefined, "pt-BR")).toBe("");
  });
});

describe("esmaecer os splits mais antigos", () => {
  it("o mais recente é opaco e cada idade a mais esmaece, sem sumir por inteiro", () => {
    expect(opacidadeDoSplit(0)).toBe(1);
    const ops = Array.from({ length: SPLITS_VISIVEIS }, (_, i) => opacidadeDoSplit(i));
    expect(ops).toEqual([...ops].sort((a, b) => b - a));
    expect(new Set(ops).size).toBe(SPLITS_VISIVEIS);
    expect(Math.min(...ops)).toBeGreaterThan(0);
    expect(opacidadeDoSplit(50)).toBe(0.2);
    expect(opacidadeDoSplit(-3)).toBe(1);
  });
});
