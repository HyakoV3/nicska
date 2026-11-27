import { describe, expect, it } from "vitest";
import { abrirBateria, avisoDeEnergia, lerEnergia } from "../src/lib/energia";

describe("avisoDeEnergia", () => {
  it("economia ligada avisa, mesmo carregando ou sem bateria", () => {
    expect(avisoDeEnergia(null, true)).toBe(true);
    expect(avisoDeEnergia({ nivel: 0.9, carregando: true }, true)).toBe(true);
  });
  it("bateria em 15% ou menos e fora da tomada avisa; carregando ou acima de 15% não", () => {
    expect(avisoDeEnergia({ nivel: 0.15, carregando: false }, false)).toBe(true);
    expect(avisoDeEnergia({ nivel: 0.08, carregando: false }, null)).toBe(true);
    expect(avisoDeEnergia({ nivel: 0.08, carregando: true }, false)).toBe(false);
    expect(avisoDeEnergia({ nivel: 0.16, carregando: false }, false)).toBe(false);
  });
  it("sem dados (não sabe) não avisa", () => {
    expect(avisoDeEnergia(null, null)).toBe(false);
    expect(avisoDeEnergia(null, false)).toBe(false);
  });
});

describe("lerEnergia", () => {
  it("sem ponte (navegador, testes): tudo nulo", () => {
    expect(lerEnergia(null)).toEqual({ economia: null, termico: null });
    expect(lerEnergia()).toEqual({ economia: null, termico: null });
  });
  it("lê 1, 0 e -1 da ponte; o estado térmico negativo vira nulo", () => {
    expect(lerEnergia({ economia: () => 1, termico: () => 2 })).toEqual({ economia: true, termico: 2 });
    expect(lerEnergia({ economia: () => 0, termico: () => 0 })).toEqual({ economia: false, termico: 0 });
    expect(lerEnergia({ economia: () => -1, termico: () => -1 })).toEqual({ economia: null, termico: null });
  });
  it("uma ponte que lança ou só tem parte dos métodos não derruba", () => {
    expect(lerEnergia({ economia: () => { throw new Error("x"); }, termico: () => 3 })).toEqual({ economia: null, termico: 3 });
    expect(lerEnergia({})).toEqual({ economia: null, termico: null });
  });
});

describe("abrirBateria", () => {
  it("sem getBattery ou com falha: nulo", async () => {
    expect(await abrirBateria({})).toBeNull();
    expect(await abrirBateria(undefined)).toBeNull();
    expect(await abrirBateria({ getBattery: () => Promise.reject(new Error("negado")) })).toBeNull();
  });
  it("o leitor é vivo (lê o valor de agora) e limita o nível a 0..1", async () => {
    const g = { level: 0.5, charging: false };
    const ler = (await abrirBateria({ getBattery: async () => g }))!;
    expect(ler()).toEqual({ nivel: 0.5, carregando: false });
    g.level = 0.07;
    g.charging = true;
    expect(ler()).toEqual({ nivel: 0.07, carregando: true });
    g.level = 7;
    expect(ler()?.nivel).toBe(1);
    expect(ler.call(null)).not.toBeNull();
    (g as { level: unknown }).level = "x";
    expect(ler()).toBeNull();
  });
});
