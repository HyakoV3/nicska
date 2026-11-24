import { beforeEach, describe, expect, it, vi } from "vitest";
import { idEstavelPorNome } from "../src/lib/drills";
import { MAXIMO_DE_NOMES, lembrar, normalizar, sugerir, type NomeLembrado } from "../src/lib/nomesDePercurso";
import { lerNomesDePercurso, salvarNomesDePercurso } from "../src/lib/preferencias";

const n = (nome: string, disparos?: number): NomeLembrado => (disparos ? { nome, disparos } : { nome });

describe("lembrar nomes", () => {
  it("o mais recente fica no topo e o mesmo nome (sem acento nem maiúsculas) não duplica", () => {
    let l: NomeLembrado[] = [];
    l = lembrar(l, n("Estágio 1", 8));
    l = lembrar(l, n("Plate Rack", 6));
    l = lembrar(l, n("estagio  1", 10));
    expect(l.map((x) => x.nome)).toEqual(["estagio  1", "Plate Rack"]);
    expect(l).toHaveLength(2);
    expect(l[0].disparos).toBe(10);
  });
  it("nome vazio não entra e a lista é cortada no máximo", () => {
    expect(lembrar([], n("   "))).toEqual([]);
    let l: NomeLembrado[] = [];
    for (let i = 0; i < MAXIMO_DE_NOMES + 10; i++) l = lembrar(l, n(`P${i}`));
    expect(l).toHaveLength(MAXIMO_DE_NOMES);
    expect(l[0].nome).toBe(`P${MAXIMO_DE_NOMES + 9}`);
  });
});

describe("sugerir enquanto digita", () => {
  const lista = [n("Plate Rack", 6), n("Estágio Fácil", 8), n("Rack de Placas", 6), n("Mozambique", 3)];
  it("não oferece nada com o campo vazio", () => {
    expect(sugerir(lista, "", [])).toEqual([]);
    expect(sugerir(lista, "   ", [])).toEqual([]);
  });
  it("casa sem acento nem maiúsculas, começando primeiro", () => {
    expect(sugerir(lista, "estagio", []).map((x) => x.nome)).toEqual(["Estágio Fácil"]);
    expect(sugerir(lista, "rack", []).map((x) => x.nome)).toEqual(["Rack de Placas", "Plate Rack"]);
  });
  it("não repete o que já existe como percurso nem o que já está escrito por inteiro", () => {
    expect(sugerir(lista, "rack", ["plate rack"]).map((x) => x.nome)).toEqual(["Rack de Placas"]);
    expect(sugerir(lista, "Mozambique", [])).toEqual([]);
  });
  it("limita a quantidade", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => n(`Prova ${i}`));
    expect(sugerir(muitas, "prova", [])).toHaveLength(5);
    expect(sugerir(muitas, "prova", [], 2)).toHaveLength(2);
  });
});

describe("id estável pelo nome escrito", () => {
  it("quem escreve o nome de um percurso-modelo cai no mesmo id, sem acento nem maiúsculas", () => {
    expect(idEstavelPorNome("Bill Drill")).toBe("drill-bill-drill");
    expect(idEstavelPorNome("  bill   DRILL ")).toBe("drill-bill-drill");
    expect(idEstavelPorNome("el presidente")).toBe("drill-el-presidente");
  });
  it("aceita o nome traduzido e recusa o que não é modelo", () => {
    expect(idEstavelPorNome("Draw", (d) => (d.chave ? "Draw" : d.nome))).toBe("drill-saque");
    expect(idEstavelPorNome("Meu percurso")).toBeNull();
    expect(idEstavelPorNome("")).toBeNull();
  });
});

describe("nomes guardados no aparelho", () => {
  let mem: Record<string, string>;
  beforeEach(() => {
    mem = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, x: string) => void (mem[k] = x) });
  });
  it("guarda e lê; lixo vira lista vazia", () => {
    expect(lerNomesDePercurso()).toEqual([]);
    salvarNomesDePercurso([n("A", 3), n("B")]);
    expect(lerNomesDePercurso()).toEqual([{ nome: "A", disparos: 3 }, { nome: "B" }]);
    mem["prefs.nomesDePercurso"] = JSON.stringify({ itens: [1, null, { nome: 5 }, { nome: "ok", disparos: "x" }] });
    expect(lerNomesDePercurso()).toEqual([{ nome: "ok" }]);
    mem["prefs.nomesDePercurso"] = "{quebrado";
    expect(lerNomesDePercurso()).toEqual([]);
  });
});
