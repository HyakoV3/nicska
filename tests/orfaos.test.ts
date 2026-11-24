import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { Armazenamento } from "../src/lib/armazenamento";
import { CARENCIA_MS, acharOrfaos, emLotes, resumoDosOrfaos, type VideoParaVarredura } from "../src/lib/video/orfaos";
import { DIA_MS } from "../src/lib/video/politica";

vi.stubGlobal("IDBKeyRange", IDBKeyRange);

const AGORA = 50 * DIA_MS;
const SESSAO = AGORA - 60_000; // a sessão começou há 1 min
const v = (id: string, extra: Partial<VideoParaVarredura> = {}): VideoParaVarredura => ({ id, bytes: 1000, pedacos: 3, atualizadoEm: AGORA - 2 * DIA_MS, finalizado: true, ...extra });
const achar = (videos: VideoParaVarredura[], o: { pedacos?: string[]; tentativas?: string[]; protegidos?: string[] } = {}) =>
  acharOrfaos({ videos, idsDePedacos: o.pedacos ?? videos.map((x) => x.id), idsDeTentativas: o.tentativas ?? [], protegidos: o.protegidos, inicioDaSessao: SESSAO, agora: AGORA });

describe("acharOrfaos (puro)", () => {
  it("vídeo antigo sem tentativa é órfão", () => {
    expect(achar([v("a")]).videos).toEqual([{ id: "a", motivo: "sem_tentativa", bytes: 1000 }]);
  });
  it("vídeo de tentativa salva fica, completo ou não", () => {
    const r = achar([v("a"), v("b", { finalizado: false })], { tentativas: ["a", "b"] });
    expect(r.videos).toEqual([]);
  });
  it("gravação em andamento (tocada agora, sessão atual) e resultado pendente (desta sessão) ficam", () => {
    const andamento = v("g", { finalizado: false, atualizadoEm: AGORA - 500 });
    const pendente = v("p", { atualizadoEm: AGORA - 30_000 }); // gravado e parado nesta sessão, na tela da Revisão
    expect(achar([andamento, pendente]).videos).toEqual([]);
  });
  it("a carência vale mesmo se o app abriu há muito: o toque recente de outra instância protege", () => {
    const r = acharOrfaos({ videos: [v("x", { atualizadoEm: AGORA - CARENCIA_MS / 2 })], idsDePedacos: ["x"], idsDeTentativas: [], inicioDaSessao: AGORA, agora: AGORA });
    expect(r.videos).toEqual([]);
  });
  it("ids protegidos pelo chamador ficam, mesmo antigos", () => {
    expect(achar([v("a")], { protegidos: ["a"] }).videos).toEqual([]);
  });
  it("fixado nunca é órfão", () => {
    expect(achar([v("a", { fixado: true }), v("b", { fixado: true, finalizado: false })]).videos).toEqual([]);
  });
  it("incompleto: nunca finalizado, ou sem nenhum pedaço; meta antiga (sem o campo) vale como finalizada", () => {
    const r = achar([v("a", { finalizado: false }), v("b", { pedacos: 0, bytes: 0 }), v("c", { finalizado: undefined })]);
    expect(r.videos.map((x) => [x.id, x.motivo])).toEqual([["a", "incompleto"], ["b", "incompleto"], ["c", "sem_tentativa"]]);
  });
  it("pedaço solto: pedaços cujo id não tem registro; os de vídeo registrado ou protegido ficam", () => {
    const r = achar([v("a")], { pedacos: ["a", "a", "x", "x", "y"], protegidos: ["y"] });
    expect(r.pedacosSoltos).toEqual(["x"]);
  });
  it("resumo e lotes", () => {
    const r = achar([v("a"), v("b", { bytes: 500 })], { pedacos: ["a", "b", "z"] });
    expect(resumoDosOrfaos(r)).toEqual({ n: 3, bytes: 1500 });
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(emLotes([], 2)).toEqual([]);
  });
});

describe("limparOrfaos no banco", () => {
  const bloco = new Blob([new Uint8Array(10)], { type: "video/webm" });
  it("apaga só o solto: órfão, incompleto e pedaço solto; mantém tentativa salva, fixado e o desta sessão", async () => {
    const a = new Armazenamento(() => new IDBFactory());
    const antes = Date.now() - 3 * DIA_MS;
    const criar = async (id: string, finalizar = true) => {
      await a.iniciarVideo(id, "video/webm");
      await a.gravarPedaco(id, 0, bloco);
      if (finalizar) await a.finalizarVideo(id, false);
    };
    for (const id of ["orfao", "salvo", "fixo", "meio"]) await criar(id, id !== "meio");
    await a.fixarVideo("fixo", true);
    // `salvo` tem tentativa: grava direto na loja, como a camada de cima faria
    const b = await (a as unknown as { abrir(): Promise<IDBDatabase> }).abrir();
    await new Promise<void>((ok, no) => {
      const t = b.transaction(["tentativas", "videos", "videos_pedacos"], "readwrite");
      t.objectStore("tentativas").put({ id: "salvo", percurso_id: "p", quando: 1 });
      // pedaço sem registro e o envelhecimento dos registros acima
      t.objectStore("videos_pedacos").put(bloco, ["fantasma", 0]);
      for (const id of ["orfao", "salvo", "fixo", "meio"]) {
        const r = t.objectStore("videos").get(id);
        r.onsuccess = () => t.objectStore("videos").put({ ...r.result, atualizadoEm: antes }, id);
      }
      t.oncomplete = () => ok();
      t.onerror = () => no(t.error);
    });
    await criar("agora"); // desta sessão
    const r = await a.limparOrfaos(Date.now() - 1000);
    expect(r.n).toBe(3); // orfao, meio, fantasma
    expect(await a.metaDoVideo("orfao")).toBeNull();
    expect(await a.metaDoVideo("meio")).toBeNull();
    for (const id of ["salvo", "fixo", "agora"]) expect(await a.video(id)).not.toBeNull();
    expect((await a.limparOrfaos(Date.now() - 1000)).n).toBe(0);
  });
});
