import { describe, expect, it } from "vitest";
import { aplicarFiltro, altoContraste, coresDoDuotone, duotone, FILTROS, luminancia, pixelar, posterizar, pretoEBranco, sepia } from "../src/lib/avatarFiltros";

const px = (...v: number[]) => new Uint8ClampedArray(v);

describe("filtros de pixel (puros)", () => {
  it("preto e branco iguala os canais pela luminância e mantém o alfa", () => {
    const d = pretoEBranco(px(255, 0, 0, 200));
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[0]).toBe(Math.round(luminancia(255, 0, 0)));
    expect(d[3]).toBe(200);
  });
  it("sépia deixa o vermelho acima do verde e do azul e satura em 255", () => {
    const d = sepia(px(255, 255, 255, 255));
    expect([d[0], d[1], d[2]]).toEqual([255, 255, 239]);
    const c = sepia(px(100, 100, 100, 255));
    expect(c[0]).toBeGreaterThan(c[1]);
    expect(c[1]).toBeGreaterThan(c[2]);
  });
  it("alto contraste afasta os tons do cinza médio e o fator 1 não muda nada", () => {
    expect(Array.from(altoContraste(px(100, 128, 160, 255), 2))).toEqual([72, 128, 192, 255]);
    expect(Array.from(altoContraste(px(10, 20, 30, 255), 1))).toEqual([10, 20, 30, 255]);
    expect(Array.from(altoContraste(px(0, 250, 128, 255), 3))).toEqual([0, 255, 128, 255]);
  });
  it("duotone leva preto à cor escura e branco à clara", () => {
    const cores = { escuro: [10, 20, 30] as const, claro: [200, 210, 220] as const };
    expect(Array.from(duotone(px(0, 0, 0, 255, 255, 255, 255, 255), cores))).toEqual([10, 20, 30, 255, 200, 210, 220, 255]);
  });
  it("as cores do duotone vêm da cor do tema: escura mais escura, clara mais clara", () => {
    const { escuro, claro } = coresDoDuotone([200, 40, 50]);
    expect(escuro[0]).toBeLessThan(200);
    expect(claro[1]).toBeGreaterThan(40);
  });
  it("posterizar reduz a poucos níveis e quantiza 2 níveis em 0 ou 255", () => {
    expect(Array.from(posterizar(px(10, 120, 250, 255), 2))).toEqual([0, 0, 255, 255]);
    const d = posterizar(px(0, 100, 200, 255, 50, 150, 255, 255), 4);
    expect(new Set([d[0], d[1], d[2], d[4], d[5], d[6]]).size).toBeLessThanOrEqual(4);
    for (const v of [d[0], d[1], d[2]]) expect([0, 85, 170, 255]).toContain(v);
  });
  it("pixelar faz cada bloco ficar com a cor média", () => {
    // 2x2: com 1 célula, tudo vira a média dos 4
    const d = pixelar(px(0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 100, 100, 100, 255), { largura: 2, altura: 2 }, 1);
    for (let i = 0; i < 16; i += 4) expect(Array.from(d.slice(i, i + 4))).toEqual([100, 100, 100, 255]);
  });
  it("pixelar com células a mais que pixels não muda a imagem e aguenta bordas fora da grade", () => {
    const orig = [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255];
    expect(Array.from(pixelar(px(...orig), { largura: 3, altura: 1 }, 16))).toEqual(orig);
    const d = pixelar(new Uint8ClampedArray(5 * 5 * 4).fill(90), { largura: 5, altura: 5 }, 2);
    expect(d.every((v) => v === 90)).toBe(true);
  });
  it("aplicarFiltro cobre todos os filtros e o original não mexe", () => {
    const ctx = { largura: 2, altura: 1, tema: [200, 40, 50] as const };
    for (const id of FILTROS) {
      const d = aplicarFiltro(id, px(30, 90, 150, 255, 220, 200, 10, 255), ctx);
      expect(d.length).toBe(8);
    }
    expect(Array.from(aplicarFiltro("original", px(1, 2, 3, 4), ctx))).toEqual([1, 2, 3, 4]);
  });
});
