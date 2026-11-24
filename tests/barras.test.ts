import { afterEach, describe, expect, it, vi } from "vitest";
import { fundoEhEscuro, luminancia, paraHex, sincronizarBarras } from "../src/lib/barras";

describe("barras do sistema (Android)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lê hex curto e longo e rgb()", () => {
    expect(luminancia("#000000")).toBeCloseTo(0, 5);
    expect(luminancia("#fff")).toBeCloseTo(1, 5);
    expect(luminancia(" #FFFFFF ")).toBeCloseTo(1, 5);
    expect(luminancia("rgb(255, 255, 255)")).toBeCloseTo(1, 5);
    expect(luminancia("rgba(0 0 0 / 1)")).toBeCloseTo(0, 5);
    for (const ruim of ["", "azul", "#12", "#gggggg", "var(--fundo)"]) expect(luminancia(ruim)).toBeNull();
  });

  it("paraHex entrega #rrggbb para a ponte nativa", () => {
    expect(paraHex("#FFF")).toBe("#ffffff");
    expect(paraHex(" #071A34 ")).toBe("#071a34");
    expect(paraHex("rgb(7, 26, 52)")).toBe("#071a34");
    expect(paraHex("azul")).toBeNull();
  });

  it("os fundos das seis paletas e do alto contraste: escuros são escuros, claros são claros", () => {
    const escuros = ["#14181f", "#24262a", "#071a34", "#000000"]; // normal, titânio, telemetria (escuros) e alto contraste
    const claros = ["#f7f8fa", "#eeede9", "#e9eef7"]; // normal, titânio, telemetria (claros)
    for (const c of escuros) expect(fundoEhEscuro(c), c).toBe(true);
    for (const c of claros) expect(fundoEhEscuro(c), c).toBe(false);
    expect(fundoEhEscuro("não é cor")).toBe(false);
  });

  it("sincronizarBarras avisa a ponte com o fundo real; sem ponte não faz nada", () => {
    const barras = vi.fn();
    vi.stubGlobal("NkTema", { barras });
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => " #071a34" }));
    sincronizarBarras();
    expect(barras).toHaveBeenCalledWith(true, "#071a34");
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "#f7f8fa" }));
    sincronizarBarras();
    expect(barras).toHaveBeenLastCalledWith(false, "#f7f8fa");
    vi.unstubAllGlobals();
    expect(() => sincronizarBarras()).not.toThrow();
  });
});
