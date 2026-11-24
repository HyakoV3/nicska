import { describe, expect, it } from "vitest";
import type { TentativaGuardada } from "../src/lib/documento";
import { divisoesPresentes, ranking } from "../src/lib/ranking";

const eu = { id: "eu", nome: "Eu", divisao: "Production" };
const ana = { id: "ana", nome: "Ana", divisao: "Open" };
const beto = { id: "beto", nome: "Beto", divisao: "Production" };
let n = 0;
const t = (quem: string | undefined, disparos: number[], extra: Partial<TentativaGuardada> = {}): TentativaGuardada => ({
  id: `t${++n}`, percurso_id: "p", data: "2026-11-22T10:00:00-03:00", quando: n, atraso_ms: 1000, inicio: "detectado", disparos_ms: disparos,
  editada: { apagados: 0, inseridos: 0 }, detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 }, ...(quem ? { atirador_id: quem } : {}), ...extra,
});
const pts = (A: number, C = 0) => ({ A, C, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" as const });

describe("ranking", () => {
  it("sem pontuação, ordena pelo melhor tempo e conta tentativas, melhor e média", () => {
    const r = ranking([t(undefined, [1000, 2000]), t(undefined, [1000, 2400]), t("ana", [900, 1800]), t("beto", [1200, 3000])], { eu, outros: [ana, beto] });
    expect(r.criterio).toBe("tempo");
    expect(r.linhas.map((l) => [l.posicao, l.atirador.nome, l.melhorMs, l.mediaMs, l.tentativas])).toEqual([[1, "Ana", 1800, 1800, 1], [2, "Eu", 2000, 2200, 2], [3, "Beto", 3000, 3000, 1]]);
    expect(r.linhas.find((l) => l.eu)?.atirador.nome).toBe("Eu");
  });

  it("com pontuação em todos, ordena por hit factor (melhor e média)", () => {
    const r = ranking([t(undefined, [1000, 2000], { pontos: pts(4) }), t("ana", [1000, 4000], { pontos: pts(5, 1) })], { eu, outros: [ana] });
    expect(r.criterio).toBe("hf");
    expect(r.linhas.map((l) => [l.atirador.nome, l.melhorHf])).toEqual([["Eu", 10], ["Ana", 7]]); // 20 pts / 2 s e 28 pts / 4 s
  });

  it("se um dos atiradores não pontuou, volta ao tempo (não compara HF com nada)", () => {
    const r = ranking([t(undefined, [2000], { pontos: pts(5) }), t("ana", [1000])], { eu, outros: [ana] });
    expect(r.criterio).toBe("tempo");
    expect(r.linhas[0].atirador.nome).toBe("Ana");
  });

  it("empate divide a posição; tentativas sem disparo não contam", () => {
    const r = ranking([t(undefined, [1500]), t("ana", [1500]), t("beto", [2500]), t("beto", [])], { eu, outros: [ana, beto] });
    expect(r.linhas.map((l) => l.posicao)).toEqual([1, 1, 3]);
    expect(r.linhas.find((l) => l.atirador.id === "beto")?.tentativas).toBe(1);
  });

  it("marca como duvidosas as de início estimado ou editadas", () => {
    const r = ranking([t(undefined, [1000], { inicio: "estimado" }), t(undefined, [1100], { editada: { apagados: 1, inseridos: 0 } }), t(undefined, [1200])], { eu, outros: [] });
    expect(r.linhas[0].duvidosas).toBe(2);
  });

  // CONS-025 (IPSC-001): menos disparos que `disparos_minimos` do percurso é duvidosa, mesmo sem início estimado nem edição.
  it("marca como duvidosa a tentativa com menos disparos que o mínimo do percurso, e diz o motivo", () => {
    const ts = [t(undefined, [1000, 2000, 3000]), t(undefined, [800, 1600]), t("ana", [900, 1800, 2700])];
    const r = ranking(ts, { eu, outros: [ana], disparosMinimos: 3 });
    const meu = r.linhas.find((l) => l.eu)!;
    expect(meu.duvidosas).toBe(1);
    expect(meu.motivos).toEqual({ firmeza: 0, faltando: 1 });
    expect(r.linhas.find((l) => !l.eu)!.duvidosas).toBe(0);
    expect(ranking(ts, { eu, outros: [ana] }).linhas.find((l) => l.eu)!.duvidosas).toBe(0); // sem o mínimo, nada a comparar
  });

  it("uma tentativa com os dois motivos conta uma vez em duvidosas e uma em cada motivo", () => {
    const r = ranking([t(undefined, [1000], { inicio: "estimado" })], { eu, outros: [], disparosMinimos: 2 });
    expect(r.linhas[0].duvidosas).toBe(1);
    expect(r.linhas[0].motivos).toEqual({ firmeza: 1, faltando: 1 });
  });

  // IPSC-003: melhorHf/mediaHf só olham as pontuadas; a contagem diz quantas são.
  it("conta as tentativas e, separadas, as pontuadas", () => {
    const r = ranking([t(undefined, [1000, 2000], { pontos: pts(4) }), t(undefined, [1000, 3000])], { eu, outros: [] });
    expect(r.linhas[0].tentativas).toBe(2);
    expect(r.linhas[0].pontuadas).toBe(1);
    expect(r.linhas[0].melhorHf).toBe(10);
  });

  it("o HF do ranking usa o tempo de 2 casas (28 pontos em 2,704 s = 10,3704)", () => {
    const r = ranking([t(undefined, [2704], { pontos: pts(5, 1) })], { eu, outros: [] });
    expect(r.linhas[0].melhorHf!).toBeCloseTo(10.3704, 4);
  });

  it("filtra por divisão e lista as presentes; quem não declarou só entra em 'todas'", () => {
    const sem = { id: "sem", nome: "Sem" };
    const ts = [t(undefined, [1000]), t("ana", [900]), t("beto", [1100]), t("sem", [800])];
    expect(ranking(ts, { eu, outros: [ana, beto, sem], divisao: "Production" }).linhas.map((l) => l.atirador.nome)).toEqual(["Eu", "Beto"]);
    expect(ranking(ts, { eu, outros: [ana, beto, sem] }).linhas).toHaveLength(4);
    expect(divisoesPresentes(ts, { eu, outros: [ana, beto, sem] })).toEqual(["Open", "Production"]);
  });

  it("atirador desconhecido (arquivo de backup sem a lista) aparece pelo id", () => {
    expect(ranking([t("zzzzzzzzzz", [1000])], { eu, outros: [] }).linhas[0].atirador.nome).toBe("zzzzzzzz");
  });
});
