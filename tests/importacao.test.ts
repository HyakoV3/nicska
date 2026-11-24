import { beforeEach, describe, expect, it, vi } from "vitest";

const guardado = vi.hoisted(() => ({
  ids: { percursos: new Set<string>(), tentativas: new Set<string>(), atiradores: new Set<string>() },
  importar: vi.fn(async () => {}),
}));
vi.mock("../src/lib/armazenamento", () => ({ armazenamento: { ids: async () => guardado.ids, importar: guardado.importar } }));

import { montarBackup, montarCompartilhado, type Percurso, type TentativaGuardada } from "../src/lib/documento";
import { comoDeOutro, confirmarImportacao, novidadesDoDono, precisaPerguntarDono, prepararImportacao } from "../src/lib/importacao";
import { lerDocumento } from "../src/lib/documento";

const MEU = "meu-id";
const percurso: Percurso = { id: "p1", nome: "Bill Drill", disparos_minimos: 6, criado_em: 1000 };
const tentativa = (id: string, extra: Partial<TentativaGuardada> = {}): TentativaGuardada => ({
  id,
  percurso_id: "p1",
  data: "2026-11-10T10:00:00-03:00",
  quando: Date.parse("2026-11-10T10:00:00-03:00"),
  atraso_ms: 2000,
  inicio: "detectado",
  disparos_ms: [1500, 1750],
  editada: { apagados: 0, inseridos: 0 },
  detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 },
  ...extra,
});
const backupDe = (id: string, nome: string, tentativas: TentativaGuardada[]) => JSON.stringify(montarBackup("t", { atirador: { id, nome }, percursos: [percurso], tentativas }));
const compartilhadoDe = (id: string, nome: string, tentativas: TentativaGuardada[]) => JSON.stringify(montarCompartilhado("t", { id, nome }, percurso, tentativas));

beforeEach(() => {
  guardado.ids = { percursos: new Set(), tentativas: new Set(), atiradores: new Set() };
  guardado.importar.mockClear();
});

describe("pergunta de dono do backup (DADOS-001)", () => {
  it("backup de outro atirador com tentativas sem dono: pergunta", () => {
    expect(precisaPerguntarDono(lerDocumento(backupDe("ana", "Ana", [tentativa("a1")])), MEU)).toBe(true);
  });
  it("o meu backup (mesmo id), um percurso compartilhado ou um backup sem tentativas: não pergunta", () => {
    expect(precisaPerguntarDono(lerDocumento(backupDe(MEU, "Eu", [tentativa("a1")])), MEU)).toBe(false);
    expect(precisaPerguntarDono(lerDocumento(compartilhadoDe("ana", "Ana", [tentativa("a1")])), MEU)).toBe(false);
    expect(precisaPerguntarDono(lerDocumento(backupDe("ana", "Ana", [])), MEU)).toBe(false);
  });
  it("backup só com tentativas que já têm dono: não pergunta", () => {
    expect(precisaPerguntarDono(lerDocumento(backupDe("ana", "Ana", [tentativa("a1", { atirador_id: "beto" })])), MEU)).toBe(false);
  });
});

describe("dono das tentativas", () => {
  const doc = lerDocumento(backupDe("ana", "Ana", [tentativa("a1"), tentativa("a2", { atirador_id: "beto" })]));
  it("comoDeOutro dá a tentativa sem dono ao atirador do arquivo e deixa as outras", () => {
    expect(comoDeOutro(doc).tentativas.map((t) => t.atirador_id)).toEqual(["ana", "beto"]);
  });
  it("'meu': entra sem atirador_id (restaurar); 'outro': entra como da Ana, e ela vira atirador", () => {
    const meu = novidadesDoDono({ doc, aqui: guardado.ids, meuId: MEU, dono: "meu" });
    expect(meu.tentativas.find((t) => t.id === "a1")!.atirador_id).toBeUndefined();
    const outro = novidadesDoDono({ doc, aqui: guardado.ids, meuId: MEU, dono: "outro" });
    expect(outro.tentativas.find((t) => t.id === "a1")!.atirador_id).toBe("ana");
    expect(outro.atiradores.map((a) => a.id).sort()).toEqual(["ana", "beto"]);
  });
});

describe("prévia e confirmação (CONS-014)", () => {
  it("a prévia conta o que entraria e NÃO grava", async () => {
    guardado.ids.tentativas.add("a2");
    const previa = await prepararImportacao(compartilhadoDe("ana", "Ana", [tentativa("a1"), tentativa("a2")]), MEU);
    expect(previa.doc.atirador.nome).toBe("Ana");
    expect(previa.novas.tentativas.map((t) => t.id)).toEqual(["a1"]);
    expect(previa.novas.percursos.map((p) => p.nome)).toEqual(["Bill Drill"]);
    expect(previa.novas.jaExistiam).toBe(1);
    expect(previa.perguntaDono).toBe(false);
    expect(guardado.importar).not.toHaveBeenCalled();
  });
  it("arquivo inválido joga na prévia (nada gravado)", async () => {
    await expect(prepararImportacao("isto não é json", MEU)).rejects.toThrow();
    expect(guardado.importar).not.toHaveBeenCalled();
  });
  it("confirmar grava uma vez, com o dono escolhido", async () => {
    const previa = await prepararImportacao(backupDe("ana", "Ana", [tentativa("a1")]), MEU);
    expect(previa.perguntaDono).toBe(true);
    const n = await confirmarImportacao({ previa, meuId: MEU, dono: "outro" });
    expect(guardado.importar).toHaveBeenCalledTimes(1);
    expect(guardado.importar).toHaveBeenCalledWith(n);
    expect(n.tentativas[0]!.atirador_id).toBe("ana");
  });
  it("o que entrou entre a prévia e o toque em Importar não duplica", async () => {
    const previa = await prepararImportacao(compartilhadoDe("ana", "Ana", [tentativa("a1")]), MEU);
    guardado.ids.tentativas.add("a1");
    const n = await confirmarImportacao({ previa, meuId: MEU, dono: "meu" });
    expect(n.tentativas).toEqual([]);
    expect(n.jaExistiam).toBe(1);
  });
});
