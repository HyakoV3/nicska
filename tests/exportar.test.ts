import { describe, expect, it, vi } from "vitest";

const enviados: Blob[] = [];
vi.mock("../src/lib/compartilhar", () => ({
  podeCompartilhar: () => true,
  compartilharArquivo: async (b: Blob) => (enviados.push(b), "ok"),
}));

import { entregarJson } from "../src/lib/dados";
import { LIMITES, lerBackup, montarBackup } from "../src/lib/documento";

const backup = () => montarBackup("x", { atirador: { id: "a", nome: "A" }, percursos: [{ id: "p1", nome: "Bill Drill", criado_em: 1 }], tentativas: [] }, new Date("2026-11-22T12:00:00Z"));

describe("exportação do backup", () => {
  it("sai sem indentação e volta igual (a leitura aceita com e sem)", async () => {
    const r = await entregarJson(backup(), "b.json");
    const texto = await enviados.at(-1)!.text();
    expect(texto).toBe(JSON.stringify(backup()));
    expect(texto).not.toContain("\n");
    expect(r).toEqual({ bytes: texto.length, acimaDoLimite: false });
    expect(lerBackup(texto)).toEqual(lerBackup(JSON.stringify(backup(), null, 2)));
  });
  it("avisa quando passa do limite (limite injetado)", async () => {
    expect((await entregarJson(backup(), "b.json", 10)).acimaDoLimite).toBe(true);
    expect(LIMITES.bytes).toBe(20 * 1024 * 1024);
  });
});
