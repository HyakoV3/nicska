import { describe, expect, it } from "vitest";
import { CORES_DAS_INICIAIS, corDasIniciais, iniciais, LIMITE_DO_ARQUIVO, paraRgb, recusarArquivo } from "../src/lib/avatar";
import { arrastar, ladoDeOrigem, limitarZoom, retanguloDeOrigem, ZOOM_MAXIMO } from "../src/lib/avatarRecorte";

describe("iniciais", () => {
  it("usa a primeira e a última palavra, em maiúscula", () => {
    expect(iniciais("ana maria silva")).toBe("AS");
    expect(iniciais("Beto")).toBe("B");
    expect(iniciais("  éder   luís ")).toBe("ÉL");
  });
  it("ignora vazios, pontuação e emoji", () => {
    expect(iniciais("")).toBe("?");
    expect(iniciais("   ")).toBe("?");
    expect(iniciais("🔥🔥")).toBe("?");
    expect(iniciais("🔥 Caio")).toBe("C");
    expect(iniciais("\ud83d")).toBe("?");
    expect(iniciais("-- João --")).toBe("J");
  });
});

describe("cor das iniciais", () => {
  it("é determinística e sai dos tokens", () => {
    expect(corDasIniciais("abc")).toBe(corDasIniciais("abc"));
    for (const id of ["a", "b", "carlos", "x9", ""]) expect(CORES_DAS_INICIAIS).toContain(corDasIniciais(id));
    expect(new Set(Array.from({ length: 40 }, (_, i) => corDasIniciais(`id${i}`))).size).toBeGreaterThan(1);
    for (const c of CORES_DAS_INICIAIS) expect(c).toMatch(/^var\(--grafico-[a-d]\)$/);
  });
});

describe("arquivo e cor", () => {
  it("recusa o que passa de 15 MB e o que não é imagem", () => {
    expect(recusarArquivo({ size: LIMITE_DO_ARQUIVO + 1, type: "image/jpeg" })).toBe("grande");
    expect(recusarArquivo({ size: 1000, type: "application/pdf" })).toBe("nao_imagem");
    expect(recusarArquivo({ size: 1000, type: "image/webp" })).toBeNull();
    expect(recusarArquivo({ size: 1000, type: "" })).toBeNull();
  });
  it("lê cores hex e rgb", () => {
    expect(paraRgb(" #c92b31 ")).toEqual([201, 43, 49]);
    expect(paraRgb("#fff")).toEqual([255, 255, 255]);
    expect(paraRgb("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(paraRgb("nada")).toEqual([128, 128, 128]);
  });
});

describe("recorte (geometria)", () => {
  const base = { largura: 400, altura: 200, zoom: 1, deslocX: 0, deslocY: 0 };
  it("sem zoom é o maior quadrado, centrado", () => {
    expect(retanguloDeOrigem(base)).toEqual({ x: 100, y: 0, lado: 200 });
  });
  it("o zoom encolhe o quadrado de origem", () => {
    expect(ladoDeOrigem(400, 200, 2)).toBe(100);
    expect(retanguloDeOrigem({ ...base, zoom: 2 })).toEqual({ x: 150, y: 50, lado: 100 });
  });
  it("o deslocamento move o quadrado e nunca sai da imagem", () => {
    expect(retanguloDeOrigem({ ...base, zoom: 2, deslocX: 30, deslocY: -20 })).toEqual({ x: 180, y: 30, lado: 100 });
    expect(retanguloDeOrigem({ ...base, zoom: 2, deslocX: 9999, deslocY: 9999 })).toEqual({ x: 300, y: 100, lado: 100 });
    expect(retanguloDeOrigem({ ...base, zoom: 2, deslocX: -9999, deslocY: -9999 })).toEqual({ x: 0, y: 0, lado: 100 });
    expect(retanguloDeOrigem({ ...base, deslocY: 50 }).y).toBe(0); // sem folga vertical
  });
  it("zoom é limitado e valor inválido vira 1", () => {
    expect(limitarZoom(0.2)).toBe(1);
    expect(limitarZoom(99)).toBe(ZOOM_MAXIMO);
    expect(limitarZoom(NaN)).toBe(1);
    expect(retanguloDeOrigem({ ...base, zoom: NaN }).lado).toBe(200);
  });
  it("arrastar para a direita mostra o que está à esquerda e fica dentro da imagem", () => {
    const r = arrastar({ ...base, zoom: 2 }, { dx: 50, dy: 0, janelaPx: 100 });
    expect(r.deslocX).toBe(-50); // 100px de origem em 100px de tela: 1 para 1
    const longe = arrastar({ ...base, zoom: 2 }, { dx: 99999, dy: -99999, janelaPx: 100 });
    expect(retanguloDeOrigem(longe)).toEqual({ x: 0, y: 100, lado: 100 });
    expect(longe.deslocX).toBe(-150);
    expect(arrastar(base, { dx: 5, dy: 5, janelaPx: 0 })).toEqual(base);
  });
});
