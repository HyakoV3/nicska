import { describe, expect, it } from "vitest";
import { DURACAO_ULTIMO_MS, gerarSrt, instanteSrt, nomeDaLegenda, type TextosDaLegenda } from "../src/lib/legenda";

const f = (ms: number) => (ms / 1000).toFixed(2).replace(".", ",");
const textos: TextosDaLegenda = {
  apito: "Apito",
  primeiro: (n, ms) => `Tiro ${n} · ${f(ms)} s`,
  split: (n, ms) => `Tiro ${n} · split ${f(ms)} s`,
  total: (ms) => `Total ${f(ms)} s`,
};

describe("instanteSrt", () => {
  it("usa HH:MM:SS,mmm com vírgula e zeros à esquerda", () => {
    expect(instanteSrt(0)).toBe("00:00:00,000");
    expect(instanteSrt(1480)).toBe("00:00:01,480");
    expect(instanteSrt(61005)).toBe("00:01:01,005");
    expect(instanteSrt(3723004)).toBe("01:02:03,004");
  });
  it("arredonda ao ms e não deixa estourar o campo (999,6 ms vira 1 s)", () => {
    expect(instanteSrt(999.6)).toBe("00:00:01,000");
    expect(instanteSrt(1234.4)).toBe("00:00:01,234");
    expect(instanteSrt(-5)).toBe("00:00:00,000");
    expect(instanteSrt(Number.NaN)).toBe("00:00:00,000");
  });
});

describe("gerarSrt", () => {
  const srt = gerarSrt([1480, 1730, 2700], textos);
  it("começa no apito (instante zero) e numera de 1 em 1", () => {
    expect(srt.startsWith("1\n00:00:00,000 --> 00:00:01,480\nApito\n\n2\n")).toBe(true);
  });
  it("cada disparo vai até o próximo; o 1º com o tempo e os outros com o split", () => {
    expect(srt).toContain("2\n00:00:01,480 --> 00:00:01,730\nTiro 1 · 1,48 s\n");
    expect(srt).toContain("3\n00:00:01,730 --> 00:00:02,700\nTiro 2 · split 0,25 s\n");
    expect(srt).toContain(`4\n00:00:02,700 --> 00:00:0${2 + DURACAO_ULTIMO_MS / 1000},700\nTiro 3 · split 0,97 s\n`);
  });
  it("o total vem depois do último disparo", () => {
    expect(srt).toContain("5\n00:00:03,700 --> 00:00:06,700\nTotal 2,70 s\n");
    expect(srt.endsWith("\n")).toBe(true);
    expect(srt).not.toContain("\r");
  });
  it("não tem entrada de apito se o 1º disparo é no instante zero", () => {
    expect(gerarSrt([0, 500], textos)).not.toContain("Apito");
  });
  it("ordena disparos fora de ordem e arredonda fracionados", () => {
    const s = gerarSrt([2000.4, 1000.6], textos);
    expect(s).toContain("00:00:01,001 --> 00:00:02,000\nTiro 1");
    expect(s).toContain("Tiro 2 · split 1,00 s");
  });
  it("disparos no mesmo instante dão entradas com fim depois do início", () => {
    expect(gerarSrt([1000, 1000], textos)).toContain("00:00:01,000 --> 00:00:01,001\nTiro 1");
  });
  it("sem disparos não há legenda", () => {
    expect(gerarSrt([], textos)).toBe("");
  });
});

describe("nomeDaLegenda", () => {
  it("termina em .srt e limpa o nome do percurso", () => {
    const n = nomeDaLegenda(new Date(2026, 10, 24, 9, 5).getTime(), "Bill Drill / Açaí");
    expect(n).toBe("nicska-Bill-Drill-Acai-2026-11-24-0905.srt");
    expect(nomeDaLegenda(0)).toMatch(/^nicska-\d{4}-\d{2}-\d{2}-\d{4}\.srt$/);
  });
});
