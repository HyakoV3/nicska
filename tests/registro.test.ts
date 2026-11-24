import { describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { Armazenamento } from "../src/lib/armazenamento";
import { montarTentativa, podeSalvar, sha256Hex, tocarDescartavel } from "../src/lib/registro";
import { resumir } from "../src/lib/tentativa";
import type { Resultado } from "../src/lib/timer";

const resultado = (audio: Resultado["audio"]): Resultado => ({
  data: "2026-11-22T10:00:00-03:00",
  atrasoMs: 2310.4,
  inicio: "detectado",
  disparosMs: [1500, 1750],
  resumo: resumir([1500, 1750]),
  detector: { versao: 1, sensibilidade: 0.6, tempoMortoMs: 60 },
  audio,
  zeroNoAudioS: 0.5,
});

describe("montarTentativa", () => {
  it("leva a revisão (disparos, edição, início, ajustes) e o hash do áudio", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const t = await montarTentativa(resultado({ blob, tipo: "audio/webm", segundos: 3, inicioCtx: 0 } as never), "p1", { disparosMs: [1500], apagados: 1, inseridos: 0, inicio: "estimado", sensibilidade: 0.7, tempoMortoMs: 80 }, "x1");
    expect(t).toMatchObject({ id: "x1", percurso_id: "p1", quando: Date.parse("2026-11-22T10:00:00-03:00"), atraso_ms: 2310, inicio: "estimado", disparos_ms: [1500], editada: { apagados: 1, inseridos: 0 }, detector: { versao: 1, sensibilidade: 0.7, tempo_morto_ms: 80 } });
    expect(t.audio_sha256).toBe(await sha256Hex(blob));
    expect(t.audio_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("uma escuta cortada no meio (CONS-023) grava a tentativa marcada como incompleta; a normal não leva o campo", async () => {
    const rev = { disparosMs: [1500], apagados: 0, inseridos: 0, inicio: "detectado" as const, sensibilidade: 0.6, tempoMortoMs: 60 };
    expect((await montarTentativa({ ...resultado(null), incompleta: true }, "p1", rev)).incompleta).toBe(true);
    expect("incompleta" in (await montarTentativa(resultado(null), "p1", rev))).toBe(false);
  });
  it("leva a pontuação quando há", async () => {
    const pontos = { A: 4, C: 2, D: 0, M: 1, NS: 0, procedimentais: 0, fator: "major" as const };
    const t = await montarTentativa(resultado(null), "p1", { disparosMs: [1500], apagados: 0, inseridos: 0, inicio: "detectado", sensibilidade: 0.6, tempoMortoMs: 60, pontos });
    expect(t.pontos).toEqual(pontos);
  });
  it("sem áudio, sem hash", async () => {
    const t = await montarTentativa(resultado(null), "p1", { disparosMs: [], apagados: 0, inseridos: 0, inicio: "detectado", sensibilidade: 0.6, tempoMortoMs: 60 });
    expect(t).not.toHaveProperty("audio_sha256");
  });
});

const REV = { disparosMs: [1500, 1750], apagados: 0, inseridos: 0, inicio: "detectado" as const, sensibilidade: 0.6, tempoMortoMs: 60 };

describe("id estável por resultado (CONS-002)", () => {
  it("salvar duas vezes com o mesmo id grava um só registro e a edição atualiza o mesmo", async () => {
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
    const arm = new Armazenamento(() => new IDBFactory());
    await arm.salvarPercurso({ id: "p1", nome: "P", criado_em: 1 });
    const r = resultado(null);
    await arm.salvarTentativa(await montarTentativa(r, "p1", REV, "id-fixo"));
    await arm.salvarTentativa(await montarTentativa(r, "p1", { ...REV, disparosMs: [1500], apagados: 1 }, "id-fixo"));
    const { itens: tentativas } = await arm.tentativas("p1", 50);
    expect(tentativas).toHaveLength(1);
    expect(tentativas[0].disparos_ms).toEqual([1500]);
  });
  it("sem id, cada montagem ganha um id novo (por isso quem salva passa o id do resultado)", async () => {
    const a = await montarTentativa(resultado(null), "p1", REV);
    const b = await montarTentativa(resultado(null), "p1", REV);
    expect(a.id).not.toBe(b.id);
  });
});

describe("podeSalvar (CONS-001)", () => {
  it("só com percurso, sem salvar em andamento e ainda não salva", () => {
    expect(podeSalvar({ temPercurso: false, salvando: false, salva: false })).toBe(false);
    expect(podeSalvar({ temPercurso: true, salvando: false, salva: false })).toBe(true);
    expect(podeSalvar({ temPercurso: true, salvando: true, salva: false })).toBe(false);
    expect(podeSalvar({ temPercurso: true, salvando: false, salva: true })).toBe(false);
  });
});

describe("tocarDescartavel (CONS-008)", () => {
  it("não salva: o 1º toque arma, o 2º executa", () => {
    const a = tocarDescartavel(true, false);
    expect(a).toEqual({ executa: false, armado: true });
    expect(tocarDescartavel(true, a.armado)).toEqual({ executa: true, armado: false });
  });
  it("já salva: executa direto", () => {
    expect(tocarDescartavel(false, false)).toEqual({ executa: true, armado: false });
  });
});
