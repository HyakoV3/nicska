import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRAZO_CONFIRMACAO_MS, criarConfirmacao } from "../src/lib/confirmacao";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("confirmação em dois toques (CONS-052)", () => {
  it("o 1º toque arma, o 2º no mesmo item confirma", () => {
    const vistos: (string | null)[] = [];
    const c = criarConfirmacao((id) => vistos.push(id));
    expect(c.pedir("a")).toBe(false);
    expect(c.pedir("a")).toBe(true);
    expect(vistos).toEqual(["a", null]);
  });
  it("tocar em outro item rearma no novo, sem confirmar nenhum", () => {
    const c = criarConfirmacao(() => {});
    expect(c.pedir("a")).toBe(false);
    expect(c.pedir("b")).toBe(false);
    expect(c.pedir("b")).toBe(true);
  });
  it("passado o prazo o 2º toque deixa de valer: pede de novo", () => {
    const vistos: (string | null)[] = [];
    const c = criarConfirmacao((id) => vistos.push(id));
    c.pedir("a");
    vi.advanceTimersByTime(PRAZO_CONFIRMACAO_MS - 1);
    expect(vistos).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(vistos).toEqual(["a", null]);
    expect(c.pedir("a")).toBe(false);
  });
  it("o 2º toque para o relógio (não desarma depois por engano um novo armar)", () => {
    const vistos: (string | null)[] = [];
    const c = criarConfirmacao((id) => vistos.push(id), 1000);
    c.pedir("a");
    vi.advanceTimersByTime(900);
    c.pedir("a"); // confirma
    c.pedir("b");
    vi.advanceTimersByTime(900); // o relógio de "a" teria disparado aqui
    expect(vistos.at(-1)).toBe("b");
    vi.advanceTimersByTime(100);
    expect(vistos.at(-1)).toBeNull();
  });
  it("cancelar desarma e para o relógio; cancelar sem nada armado não avisa", () => {
    const vistos: (string | null)[] = [];
    const c = criarConfirmacao((id) => vistos.push(id));
    c.cancelar();
    expect(vistos).toEqual([]);
    c.pedir("a");
    c.cancelar();
    vi.advanceTimersByTime(PRAZO_CONFIRMACAO_MS * 2);
    expect(vistos).toEqual(["a", null]);
  });
});
