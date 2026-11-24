import { describe, expect, it } from "vitest";
import type { TentativaGuardada } from "../src/lib/documento";
import { desvioPadrao, distribuicao, escala, histograma, media, mediana, medidas, resumoDaSessao } from "../src/lib/estatisticas";

const tent = (id: string, disparos: number[]): TentativaGuardada => ({
  id,
  percurso_id: "p",
  data: "2026-11-22T10:00:00-03:00",
  quando: 0,
  atraso_ms: 2000,
  inicio: "detectado",
  disparos_ms: disparos,
  editada: { apagados: 0, inseridos: 0 },
  detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 },
});

describe("medidas", () => {
  it("média, mediana (par e ímpar), desvio amostral e melhor", () => {
    expect(media([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(desvioPadrao([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(medidas([3000, 2500, 2800])).toMatchObject({ n: 3, melhor: 2500, mediana: 2800 });
  });
  it("sem dados ou com um dado só não inventa números", () => {
    expect(medidas([])).toEqual({ n: 0, media: null, mediana: null, desvio: null, melhor: null });
    expect(desvioPadrao([5])).toBeNull();
    expect(medidas([5]).desvio).toBeNull();
    expect(medidas([5]).media).toBe(5);
  });
});

describe("resumo da sessão", () => {
  it("total, 1º disparo e todos os splits juntos; tentativas sem disparos ficam de fora", () => {
    const r = resumoDaSessao("2026-11-22", [tent("a", [1500, 1750, 2000]), tent("b", [1400, 1700]), tent("c", [])]);
    expect(r.tentativas).toBe(2);
    expect(r.total).toMatchObject({ n: 2, media: 2000 - 150, melhor: 1700 });
    expect(r.primeiro).toMatchObject({ n: 2, melhor: 1400, media: 1450 });
    expect(r.splits).toMatchObject({ n: 3, melhor: 250, media: (250 + 250 + 300) / 3 });
  });
  it("sessão sem tentativas válidas", () => {
    const r = resumoDaSessao("d", [tent("c", [])]);
    expect(r.tentativas).toBe(0);
    expect(r.total.media).toBeNull();
  });
});

describe("histograma", () => {
  it("conta cada valor numa faixa só e a soma fecha", () => {
    const v = [200, 210, 240, 255, 260, 300, 410];
    const h = histograma(v);
    expect(h.reduce((a, f) => a + f.n, 0)).toBe(v.length);
    expect(h.length).toBeLessThanOrEqual(12);
    expect(h[0].iniMs).toBeLessThanOrEqual(200);
    expect(h.at(-1)!.fimMs).toBeGreaterThan(410);
    for (const f of h) expect(f.fimMs - f.iniMs).toBe(h[0].fimMs - h[0].iniMs);
  });
  it("valores iguais cabem numa faixa e a lista vazia dá nada", () => {
    expect(histograma([250, 250]).reduce((a, f) => a + f.n, 0)).toBe(2);
    expect(histograma([])).toEqual([]);
  });
  it("uma faixa larga demais é evitada: splits de 100 ms a 3 s cabem em até 12 faixas", () => {
    expect(histograma([100, 3000]).length).toBeLessThanOrEqual(12);
  });
});

describe("escala do eixo", () => {
  it("arredonda para fora e dá marcas redondas", () => {
    const e = escala(1480, 2710);
    expect(e.min).toBeLessThanOrEqual(1480);
    expect(e.max).toBeGreaterThanOrEqual(2710);
    expect(e.marcas[0]).toBe(e.min);
    expect(e.marcas.at(-1)).toBe(e.max);
    expect(e.marcas.length).toBeGreaterThanOrEqual(3);
    expect(e.marcas.length).toBeLessThanOrEqual(8);
  });
  it("um valor só (ou todos iguais) ainda dá um eixo", () => {
    const e = escala(2000, 2000);
    expect(e.max).toBeGreaterThan(e.min);
    expect(e.min).toBeGreaterThanOrEqual(0);
  });
});

describe("distribuição para comparar sessões", () => {
  it("as séries usam as mesmas faixas e cada uma soma 100%", () => {
    const d = distribuicao([[200, 220, 240, 600], [210, 230, 250]]);
    expect(d.porcentagens).toHaveLength(2);
    for (const p of d.porcentagens) {
      expect(p).toHaveLength(d.faixas.length);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    }
    expect(d.faixas.at(-1)!.fimMs).toBeGreaterThan(600);
  });
  it("série vazia dá zeros e sem nenhum valor não há faixas", () => {
    expect(distribuicao([[200], []]).porcentagens[1].every((x) => x === 0)).toBe(true);
    expect(distribuicao([[], []]).faixas).toEqual([]);
  });
});
