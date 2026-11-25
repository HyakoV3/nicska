import { describe, expect, it } from "vitest";
import { centesimosDe, deveAtualizar } from "../src/lib/video/aoVivo";

describe("centesimosDe", () => {
  it("é o valor que o cronômetro mostra (2 casas) e -1 no STAND BY", () => {
    expect(centesimosDe(1.484)).toBe(148);
    expect(centesimosDe(1.486)).toBe(149);
    expect(centesimosDe(0)).toBe(0);
    expect(centesimosDe(-1)).toBe(-1);
    expect(centesimosDe(Number.NaN)).toBe(-1);
  });
});

describe("deveAtualizar: só se o centésimo mudou E passou o intervalo da taxa", () => {
  it("valor igual nunca atualiza, por mais tempo que tenha passado", () => {
    expect(deveAtualizar(148, 148, 0, 10_000, 30)).toBe(false);
  });
  it("valor novo antes do intervalo não atualiza; depois, sim", () => {
    expect(deveAtualizar(148, 149, 1000, 1010, 30)).toBe(false); // 10 ms < ~28 ms
    expect(deveAtualizar(148, 149, 1000, 1034, 30)).toBe(true);
  });
  it("a folga deixa passar um quadro de 60 Hz a 30 Hz (jitter) sem cair para 20 Hz", () => {
    expect(deveAtualizar(1, 2, 1000, 1000 + 1000 / 60 * 2 - 1, 30)).toBe(true); // 2 quadros menos 1 ms
    expect(deveAtualizar(1, 2, 1000, 1000 + 1000 / 60, 30)).toBe(false); // 1 quadro só
  });
  it("a 60 Hz basta um quadro; a 10 Hz, uns 85 ms", () => {
    expect(deveAtualizar(1, 2, 1000, 1000 + 16.7, 60)).toBe(true);
    expect(deveAtualizar(1, 2, 1000, 1050, 10)).toBe(false);
    expect(deveAtualizar(1, 2, 1000, 1090, 10)).toBe(true);
  });
  it("a primeira vez (nada mostrado) sempre passa", () => {
    expect(deveAtualizar(Number.NaN, 0, Number.NEGATIVE_INFINITY, 5, 10)).toBe(true);
  });
  it("taxa inválida vale sem limite de taxa", () => {
    expect(deveAtualizar(1, 2, 1000, 1000, 0)).toBe(true);
    expect(deveAtualizar(1, 1, 1000, 2000, 0)).toBe(false);
  });
});
