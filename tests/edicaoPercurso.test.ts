import { describe, expect, it } from "vitest";
import type { Percurso } from "../src/lib/documento";
import { camposDe, percursoEditado } from "../src/lib/edicaoPercurso";

const base: Percurso = { id: "p1", nome: "Bill Drill", disparos_minimos: 6, divisao: "Open", criado_em: 123 };

describe("edição do percurso", () => {
  it("os campos começam com os valores do percurso", () => {
    expect(camposDe(base)).toEqual({ nome: "Bill Drill", disparos: "6", pontos: "", divisao: "Open" });
  });
  it("mantém id e criado_em e normaliza o nome", () => {
    expect(percursoEditado(base, { nome: "  Novo  ", disparos: "8", pontos: "40", divisao: "" })).toEqual({ id: "p1", nome: "Novo", disparos_minimos: 8, pontos_maximos: 40, criado_em: 123 });
  });
  it("campo vazio ou fora da faixa some; nome vazio recusa", () => {
    expect(percursoEditado(base, { nome: "X", disparos: "", pontos: "0", divisao: "" })).toEqual({ id: "p1", nome: "X", criado_em: 123 });
    expect(percursoEditado(base, { nome: "X", disparos: "501", pontos: "1.5", divisao: "" })).toEqual({ id: "p1", nome: "X", criado_em: 123 });
    expect(percursoEditado(base, { nome: "   ", disparos: "", pontos: "", divisao: "" })).toBeNull();
  });
  it("corta o nome em 80 caracteres", () => {
    expect(percursoEditado(base, { nome: "a".repeat(100), disparos: "", pontos: "", divisao: "" })!.nome).toHaveLength(80);
  });
});
