import { describe, expect, it } from "vitest";
import { formatadorDeNumero, numeroComCasas, tamanhoDoCacheDeNumeros } from "../src/lib/formatarNumero";
import { formatarSegundos } from "../src/lib/tentativa";

describe("cache de Intl.NumberFormat", () => {
  it("o mesmo idioma e as mesmas casas devolvem o MESMO formatador", () => {
    expect(formatadorDeNumero("pt", 2)).toBe(formatadorDeNumero("pt", 2));
    expect(formatadorDeNumero("pt", 2, 2)).toBe(formatadorDeNumero("pt", 2));
  });
  it("idioma ou casas diferentes são formatadores diferentes", () => {
    expect(formatadorDeNumero("pt", 2)).not.toBe(formatadorDeNumero("en", 2));
    expect(formatadorDeNumero("pt", 2)).not.toBe(formatadorDeNumero("pt", 4));
    expect(formatadorDeNumero("pt", 0, 2)).not.toBe(formatadorDeNumero("pt", 2));
  });
  it("não cresce ao repetir a conta", () => {
    formatarSegundos(1480, "es");
    const antes = tamanhoDoCacheDeNumeros();
    for (let i = 0; i < 50; i++) formatarSegundos(i * 37, "es");
    expect(tamanhoDoCacheDeNumeros()).toBe(antes);
  });
  it("o texto é o de sempre", () => {
    expect(formatarSegundos(1480, "pt")).toBe("1,48");
    expect(formatarSegundos(1480, "en")).toBe("1.48");
    expect(formatarSegundos(-5, "pt")).toBe("0,00");
    expect(numeroComCasas(10.37039, 4, "pt")).toBe("10,3704");
  });
});
