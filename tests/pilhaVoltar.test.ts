import { describe, expect, it } from "vitest";
import { criarPilhaVoltar } from "../src/lib/pilhaVoltar";

describe("pilhaVoltar", () => {
  it("fecha o nível de cima, um por vez, na ordem inversa", () => {
    const p = criarPilhaVoltar();
    const log: string[] = [];
    p.empilhar(() => log.push("detalhe"));
    p.empilhar(() => log.push("edicao"));
    expect(p.voltar()).toBe(true);
    expect(log).toEqual(["edicao"]);
    expect(p.voltar()).toBe(true);
    expect(log).toEqual(["edicao", "detalhe"]);
    expect(p.tamanho).toBe(0);
  });
  it("sem níveis, voltar devolve false e não faz nada", () => {
    expect(criarPilhaVoltar().voltar()).toBe(false);
  });
  it("remover tira o nível sem chamar fechar, e só uma vez", () => {
    const p = criarPilhaVoltar();
    let fechou = 0;
    const id = p.empilhar(() => fechou++);
    expect(p.remover(id)).toBe(true);
    expect(p.remover(id)).toBe(false);
    expect(p.voltar()).toBe(false);
    expect(fechou).toBe(0);
  });
  it("remover um nível do meio preserva a ordem dos outros", () => {
    const p = criarPilhaVoltar();
    const log: string[] = [];
    p.empilhar(() => log.push("a"));
    const b = p.empilhar(() => log.push("b"));
    p.empilhar(() => log.push("c"));
    p.remover(b);
    p.voltar();
    p.voltar();
    expect(log).toEqual(["c", "a"]);
  });
  it("tem diz se o nível ainda está na pilha", () => {
    const p = criarPilhaVoltar();
    const id = p.empilhar(() => {});
    expect(p.tem(id)).toBe(true);
    p.remover(id);
    expect(p.tem(id)).toBe(false);
  });
});
