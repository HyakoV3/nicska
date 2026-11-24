import { describe, expect, it } from "vitest";
import { formatarSegundos, hitFactor, pontuar, resumir } from "../src/lib/tentativa";

describe("resumir", () => {
  it("o exemplo do roadmap: 1º 1,48 s, splits 0,250/0,245/0,235/0,250/0,240, total 2,70 s", () => {
    const r = resumir([1480, 1730, 1975, 2210, 2460, 2700]);
    expect(r.n).toBe(6);
    expect(r.primeiro).toBe(1480);
    expect(r.splits).toEqual([250, 245, 235, 250, 240]);
    expect(r.maiorSplit).toBe(250);
    expect(r.menorSplit).toBe(235);
    expect(r.total).toBe(2700);
  });

  it("sem disparos e com um só", () => {
    expect(resumir([])).toEqual({ n: 0, primeiro: null, splits: [], maiorSplit: null, menorSplit: null, total: null });
    expect(resumir([900])).toEqual({ n: 1, primeiro: 900, splits: [], maiorSplit: null, menorSplit: null, total: 900 });
  });
});

describe("pontuação e hit factor", () => {
  it("minor: A5, C3, D1; o exemplo (5 A e 1 C) dá 28 pontos e HF 10,3704", () => {
    const p = pontuar({ A: 5, C: 1, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" });
    expect(p).toBe(28);
    expect(hitFactor(p, 2700)!).toBeCloseTo(10.3704, 4);
  });

  // D6 (CONS-027): o HF usa o tempo arredondado a centésimos, o mesmo da tela (confirmado: IPSC 9.2.1.1 e 9.7.1; o half up é convenção do app).
  it("HF usa o tempo de 2 casas: 28 pontos em 2,704 s mostram 2,70 s e HF 10,3704 (não 10,3550)", () => {
    expect(hitFactor(28, 2704)!).toBeCloseTo(10.3704, 4);
    expect(hitFactor(28, 2704)).toBe(hitFactor(28, 2700));
    expect(formatarSegundos(2704, "pt-BR")).toBe("2,70");
  });

  it("arredonda half up em centésimos e rejeita tempo que arredonda a zero", () => {
    expect(hitFactor(10, 2705)).toBe(hitFactor(10, 2710)); // 2,705 s sobe para 2,71
    expect(hitFactor(10, 2704)).toBe(hitFactor(10, 2700));
    expect(hitFactor(10, 4)).toBeNull();
  });

  it("major: C4 e D2; miss, no-shoot e procedimental tiram 10 cada", () => {
    expect(pontuar({ A: 0, C: 1, D: 1, M: 0, NS: 0, procedimentais: 0, fator: "major" })).toBe(6);
    expect(pontuar({ A: 2, C: 0, D: 0, M: 1, NS: 1, procedimentais: 1, fator: "minor" })).toBe(-20);
  });

  it("HF sem tempo é nulo e pontos negativos valem 0", () => {
    expect(hitFactor(10, null)).toBeNull();
    expect(hitFactor(10, 0)).toBeNull();
    expect(hitFactor(-20, 2000)).toBe(0);
  });
});

describe("formatarSegundos", () => {
  it("duas casas e o separador do idioma", () => {
    expect(formatarSegundos(1480, "pt")).toBe("1,48");
    expect(formatarSegundos(1480, "en")).toBe("1.48");
    expect(formatarSegundos(NaN, "pt")).toBe("0,00");
    expect(formatarSegundos(-5, "pt")).toBe("0,00");
  });
});
