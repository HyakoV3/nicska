import { IDBFactory, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { Armazenamento, TAMANHO_DA_PAGINA } from "../src/lib/armazenamento";
import { ranking } from "../src/lib/ranking";
import { lerBackup, lerCompartilhado, montarBackup, montarCompartilhado, novidades, paraImportavel, type Percurso, type TentativaGuardada } from "../src/lib/documento";

vi.stubGlobal("IDBKeyRange", IDBKeyRange);

const novo = () => new Armazenamento(() => new IDBFactory());
const percurso = (id: string, criado = 1000): Percurso => ({ id, nome: `Percurso ${id}`, disparos_minimos: 6, criado_em: criado });
let n = 0;
const tentativa = (percursoId: string, quando: number, extra: Partial<TentativaGuardada> = {}): TentativaGuardada => ({
  id: `t${++n}`,
  percurso_id: percursoId,
  data: new Date(quando).toISOString(),
  quando,
  atraso_ms: 2000,
  inicio: "detectado",
  disparos_ms: [1500, 1750, 2000],
  editada: { apagados: 0, inseridos: 0 },
  detector: { versao: 1, sensibilidade: 0.6, tempo_morto_ms: 60 },
  ...extra,
});
const audio = (bytes: number) => ({ blob: new Blob([new Uint8Array(bytes)], { type: "audio/webm" }), tipo: "audio/webm", segundos: 5 });

describe("percursos", () => {
  it("guarda, lista (do mais novo ao mais antigo) e atualiza pelo id", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1", 1000));
    await a.salvarPercurso(percurso("p2", 2000));
    expect((await a.percursos()).map((p) => p.id)).toEqual(["p2", "p1"]);
    await a.salvarPercurso({ ...percurso("p1", 1000), nome: "Renomeado" });
    expect((await a.percursos()).find((p) => p.id === "p1")!.nome).toBe("Renomeado");
    expect(await a.percursos()).toHaveLength(2);
  });

  it("apagar o percurso leva as tentativas e os áudios dele, e só dele", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarPercurso(percurso("p2"));
    const t1 = await a.salvarTentativa(tentativa("p1", 1), audio(100));
    const t2 = await a.salvarTentativa(tentativa("p2", 2), audio(100));
    await a.salvarTentativa(tentativa("p1", 3));
    expect(await a.apagarPercurso("p1")).toBe(2);
    expect((await a.percursos()).map((p) => p.id)).toEqual(["p2"]);
    expect((await a.tentativas("p1")).itens).toEqual([]);
    expect(await a.audio(t1.id)).toBeNull();
    expect(await a.audio(t2.id)).not.toBeNull();
  });
});

describe("tentativas", () => {
  it("guarda a tentativa com o áudio e devolve os dois", async () => {
    const a = novo();
    const t = await a.salvarTentativa(tentativa("p1", 1000), audio(1000));
    expect(t.audio).toEqual({ tipo: "audio/webm", segundos: 5, bytes: 1000 });
    const lida = (await a.tentativas("p1")).itens[0];
    expect(lida).toEqual(t);
    expect((await a.audio(t.id))?.size).toBe(1000);
  });

  it("sem áudio, não há áudio guardado", async () => {
    const a = novo();
    const t = await a.salvarTentativa(tentativa("p1", 1000));
    expect(t.audio).toBeUndefined();
    expect(await a.audio(t.id)).toBeNull();
  });

  it("a lista de um percurso vem da mais nova para a mais antiga e não mistura percursos", async () => {
    const a = novo();
    const x = await a.salvarTentativa(tentativa("p1", 1000));
    const y = await a.salvarTentativa(tentativa("p1", 3000));
    const z = await a.salvarTentativa(tentativa("p1", 2000));
    await a.salvarTentativa(tentativa("p2", 2500));
    expect((await a.tentativas("p1")).itens.map((t) => t.id)).toEqual([y.id, z.id, x.id]);
  });

  it("pagina sem repetir nem pular, inclusive com o mesmo instante, e diz quando acabou", async () => {
    const a = novo();
    const ids: string[] = [];
    for (let i = 0; i < TAMANHO_DA_PAGINA + 5; i++) ids.push((await a.salvarTentativa(tentativa("p1", 1000 + Math.floor(i / 2) * 10))).id); // pares com o mesmo instante
    const p1 = await a.tentativas("p1", 10);
    expect(p1.itens).toHaveLength(10);
    expect(p1.temMais).toBe(true);
    const u = p1.itens[9];
    const p2 = await a.tentativas("p1", 10, { quando: u.quando, id: u.id });
    const u2 = p2.itens[9];
    const p3 = await a.tentativas("p1", 10, { quando: u2.quando, id: u2.id });
    const vistos = [...p1.itens, ...p2.itens, ...p3.itens].map((t) => t.id);
    expect(new Set(vistos).size).toBe(ids.length);
    expect(vistos).toHaveLength(ids.length);
    expect(p3.temMais).toBe(false);
    expect((await a.todasDoPercurso("p1")).map((t) => t.id)).toEqual(vistos);
  });

  it("apagar uma tentativa leva o áudio dela", async () => {
    const a = novo();
    const t = await a.salvarTentativa(tentativa("p1", 1), audio(10));
    await a.apagarTentativa(t.id);
    expect((await a.tentativas("p1")).itens).toEqual([]);
    expect(await a.audio(t.id)).toBeNull();
  });

  it("resumo por percurso: quantas, a última e o melhor tempo total", async () => {
    const a = novo();
    await a.salvarTentativa(tentativa("p1", 1000, { disparos_ms: [1000, 2500] }));
    await a.salvarTentativa(tentativa("p1", 5000, { disparos_ms: [900, 2000] }));
    await a.salvarTentativa(tentativa("p1", 3000, { disparos_ms: [] }));
    expect(await a.resumoPorPercurso()).toEqual({ p1: { tentativas: 3, ultima: 5000, melhorMs: 2000 } });
  });

  it("resumo geral soma percursos, tentativas e bytes de áudio", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarTentativa(tentativa("p1", 1), audio(300));
    await a.salvarTentativa(tentativa("p1", 2), audio(200));
    expect(await a.resumo()).toEqual({ percursos: 1, tentativas: 2, bytesDeAudio: 500 });
  });
});

describe("pontuação de uma tentativa já salva", () => {
  const pontos = { A: 5, C: 1, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" as const };
  it("define, troca e tira a pontuação, sem mexer no áudio nem nos outros campos", async () => {
    const a = novo();
    const t = await a.salvarTentativa(tentativa("p1", 1000), audio(100));
    const com = await a.definirPontos(t.id, pontos);
    expect(com?.pontos).toEqual(pontos);
    expect(com?.audio).toEqual(t.audio);
    expect((await a.audio(t.id))?.size).toBe(100);
    expect((await a.tentativas("p1")).itens[0].pontos).toEqual(pontos);
    expect((await a.definirPontos(t.id, { ...pontos, A: 6 }))?.pontos?.A).toBe(6);
    const sem = await a.definirPontos(t.id, null);
    expect(sem).not.toHaveProperty("pontos");
    expect((await a.tentativas("p1")).itens[0]).not.toHaveProperty("pontos");
  });
  it("tentativa que não existe devolve nulo e nada é criado", async () => {
    const a = novo();
    expect(await a.definirPontos("nao-existe", pontos)).toBeNull();
    expect((await a.resumo()).tentativas).toBe(0);
  });
  it("a pontuação vai e volta pelo backup", async () => {
    const a = novo();
    const t = await a.salvarTentativa(tentativa("p1", 1000));
    await a.definirPontos(t.id, pontos);
    const { percursos, tentativas } = await a.tudo();
    const doc = lerBackup(JSON.stringify(montarBackup("x", { atirador: { id: "a", nome: "A" }, percursos: [percurso("p1"), ...percursos], tentativas })));
    expect(doc.tentativas[0].pontos).toEqual(pontos);
  });
});

describe("trocar o percurso de uma tentativa salva", () => {
  it("move a tentativa (mesmo id, áudio e pontos intactos) e o índice, o resumo e as listas acompanham", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarPercurso(percurso("p2"));
    const t = await a.salvarTentativa(tentativa("p1", 1000, { pontos: { A: 5, C: 0, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" } }), audio(100));
    const fica = await a.salvarTentativa(tentativa("p1", 2000));
    const nova = await a.trocarPercurso(t.id, "p2");
    expect(nova).toMatchObject({ id: t.id, percurso_id: "p2", pontos: t.pontos, audio: t.audio });
    expect((await a.tentativas("p1")).itens.map((x) => x.id)).toEqual([fica.id]);
    expect((await a.tentativas("p2")).itens.map((x) => x.id)).toEqual([t.id]);
    expect((await a.todasDoPercurso("p2")).map((x) => x.id)).toEqual([t.id]);
    const r = await a.resumoPorPercurso();
    expect([r.p1.tentativas, r.p2.tentativas]).toEqual([1, 1]);
    expect((await a.audio(t.id))?.size).toBe(100);
    expect((await a.resumo()).tentativas).toBe(2);
  });
  it("o backup leva a tentativa já no percurso novo, com o mesmo id (a importação deduplica por ele)", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarPercurso(percurso("p2"));
    const t = await a.salvarTentativa(tentativa("p1", 1000));
    await a.trocarPercurso(t.id, "p2");
    const { percursos, tentativas } = await a.tudo();
    const doc = lerBackup(JSON.stringify(montarBackup("x", { atirador: { id: "a", nome: "A" }, percursos, tentativas })));
    expect(doc.tentativas.map((x) => [x.id, x.percurso_id])).toEqual([[t.id, "p2"]]);
    expect(novidades(paraImportavel(doc), await a.ids(), "a")).toMatchObject({ tentativas: [], jaExistiam: 1 });
  });
  it("o ranking do percurso de destino passa a contar a tentativa movida, e o de origem deixa de contá-la", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarPercurso(percurso("p2"));
    const rapida = await a.salvarTentativa(tentativa("p1", 1000, { disparos_ms: [800, 1500] }));
    await a.salvarTentativa(tentativa("p2", 2000, { disparos_ms: [900, 3000] }));
    const eu = { id: "eu", nome: "Eu" };
    const melhor = async (id: string) => ranking(await a.todasDoPercurso(id), { eu, outros: [] }).linhas[0]?.melhorMs;
    expect(await melhor("p2")).toBe(3000);
    await a.trocarPercurso(rapida.id, "p2");
    expect(await melhor("p2")).toBe(1500);
    expect(await melhor("p1")).toBeUndefined();
  });
  it("devolve nulo (sem criar nada) se a tentativa ou o percurso de destino não existem", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    const t = await a.salvarTentativa(tentativa("p1", 1000));
    expect(await a.trocarPercurso("nao-existe", "p1")).toBeNull();
    expect(await a.trocarPercurso(t.id, "fantasma")).toBeNull();
    expect((await a.tentativas("p1")).itens.map((x) => x.id)).toEqual([t.id]);
    expect((await a.resumoPorPercurso()).fantasma).toBeUndefined();
  });
  it("mover para o mesmo percurso não muda nada", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    const t = await a.salvarTentativa(tentativa("p1", 1000));
    expect(await a.trocarPercurso(t.id, "p1")).toEqual(t);
  });
});

describe("tentativas de outras pessoas (Etapa 8)", () => {
  const outro = { id: "o1", nome: "Ana", divisao: "Open" };
  const dela = [tentativa("p1", 5000, { id: "x1", disparos_ms: [1000, 1300] }), tentativa("p1", 6000, { id: "x2", disparos_ms: [900, 1250] })];
  const compartilhado = () => lerCompartilhado(JSON.stringify(montarCompartilhado("x", outro, percurso("p1"), dela)));

  it("importa o percurso e as tentativas dela, guarda quem é, e importar de novo não duplica", async () => {
    const a = novo();
    const n = novidades(compartilhado(), await a.ids(), "eu");
    expect(n.atiradores).toEqual([outro]);
    await a.importar(n);
    expect((await a.percursos()).map((p) => p.id)).toEqual(["p1"]);
    expect(await a.atiradores()).toEqual([outro]);
    expect((await a.tentativas("p1")).itens.map((t) => [t.id, t.atirador_id])).toEqual([["x2", "o1"], ["x1", "o1"]]);
    const de_novo = novidades(compartilhado(), await a.ids(), "eu");
    expect(de_novo).toMatchObject({ atiradores: [], percursos: [], tentativas: [], jaExistiam: 2 });
    await a.importar(de_novo);
    expect((await a.resumo()).tentativas).toBe(2);
  });

  it("as minhas listas (histórico, resumo, gráficos) não misturam as dela; quem pede por dono só vê as dele", async () => {
    const a = novo();
    await a.salvarTentativa(tentativa("p1", 1000, { id: "m1", disparos_ms: [1500] }));
    await a.importar(novidades(compartilhado(), await a.ids(), "eu"));
    expect((await a.tentativas("p1")).itens).toHaveLength(3); // sem dono: tudo (o ranking precisa disso)
    expect((await a.tentativas("p1", 10, undefined, "eu")).itens.map((t) => t.id)).toEqual(["m1"]);
    expect((await a.todasDoPercurso("p1", "eu")).map((t) => t.id)).toEqual(["m1"]);
    expect(await a.resumoPorPercurso("eu")).toEqual({ p1: { tentativas: 1, ultima: 1000, melhorMs: 1500 } });
    expect((await a.resumoPorPercurso()).p1.tentativas).toBe(3);
    expect((await a.tentativas("p1", 10, undefined, "o1")).itens.map((t) => t.id)).toEqual(["x2", "x1", "m1"]); // as dele e as sem dono (que são "minhas" para qualquer dono)
  });

  it("o backup leva as tentativas e as pessoas importadas, e restaura tudo igual", async () => {
    const a = novo();
    await a.salvarTentativa(tentativa("p1", 1000, { id: "m1" }));
    await a.importar(novidades(compartilhado(), await a.ids(), "eu"));
    const tudo = await a.tudo();
    const texto = JSON.stringify(montarBackup("x", { atirador: { id: "eu", nome: "Eu" }, percursos: tudo.percursos, tentativas: tudo.tentativas, outros: tudo.atiradores }, new Date("2026-11-22T12:00:00Z")));
    await a.apagarTudo();
    expect(await a.atiradores()).toEqual([]);
    const doc = paraImportavel(lerBackup(texto));
    await a.importar(novidades(doc, await a.ids(), "eu"));
    const volta = await a.tudo();
    expect(volta.atiradores).toEqual([outro]);
    expect(volta.tentativas.map((t) => [t.id, t.atirador_id])).toEqual(tudo.tentativas.map((t) => [t.id, t.atirador_id]));
  });
});

describe("backup: exportar, limpar os dados e importar devolve exatamente o mesmo", () => {
  it("ida e volta, e importar de novo não duplica", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1", 1000));
    await a.salvarPercurso(percurso("p2", 2000));
    await a.salvarTentativa(tentativa("p1", 1000), audio(50));
    await a.salvarTentativa(tentativa("p1", 2000, { pontos: { A: 5, C: 1, D: 0, M: 0, NS: 0, procedimentais: 0, fator: "minor" } }));
    await a.salvarTentativa(tentativa("p2", 3000, { inicio: "estimado", editada: { apagados: 1, inseridos: 2 } }));
    const atirador = { id: "a1", nome: "Atirador Teste" };
    const { percursos, tentativas } = await a.tudo();
    const texto = JSON.stringify(montarBackup("0.1.0", { atirador, percursos, tentativas }, new Date("2026-11-22T12:00:00Z")));

    await a.apagarTudo(); // "limpar os dados do app"
    expect(await a.resumo()).toEqual({ percursos: 0, tentativas: 0, bytesDeAudio: 0 });

    const doc = lerBackup(texto);
    const ids = await a.ids();
    const n = novidades(paraImportavel(doc), ids);
    expect(n.tentativas).toHaveLength(3);
    await a.importar(n);

    const depois = await a.tudo();
    const semAudio = tentativas.map(({ audio: _a, ...r }) => r);
    expect(depois.percursos).toEqual(percursos);
    expect(depois.tentativas).toEqual(semAudio);
    expect(JSON.stringify(montarBackup("0.1.0", { atirador, percursos: depois.percursos, tentativas: depois.tentativas }, new Date("2026-11-22T12:00:00Z")))).toBe(texto);

    const ids2 = await a.ids();
    const outra = novidades(paraImportavel(doc), ids2);
    expect(outra).toEqual({ atiradores: [], percursos: [], tentativas: [], jaExistiam: 3 });
    await a.importar(outra);
    expect((await a.resumo()).tentativas).toBe(3);
  });

  it("importar não sobrescreve o que já existe no aparelho (por id)", async () => {
    const a = novo();
    await a.salvarPercurso({ ...percurso("p1"), nome: "O meu" });
    const doc = lerBackup(JSON.stringify(montarBackup("x", { atirador: { id: "a", nome: "A" }, percursos: [{ ...percurso("p1"), nome: "O do arquivo" }], tentativas: [] })));
    const ids = await a.ids();
    await a.importar(novidades(paraImportavel(doc), ids));
    expect((await a.percursos())[0].nome).toBe("O meu");
  });
});

describe("importarDocumento: ler os ids e gravar numa transação só (CONS-044)", () => {
  const outra = { id: "ana", nome: "Ana" };
  const arquivo = () => lerCompartilhado(JSON.stringify(montarCompartilhado("x", outra, percurso("p1"), [tentativa("p1", 1000, { id: "t1" }), tentativa("p1", 2000, { id: "t2" })])));

  it("importa o novo e devolve o que entrou; importar de novo não duplica", async () => {
    const a = novo();
    const n = await a.importarDocumento(arquivo(), "eu");
    expect([n.percursos.length, n.tentativas.length, n.atiradores.length, n.jaExistiam]).toEqual([1, 2, 1, 0]);
    expect((await a.resumo()).tentativas).toBe(2);
    expect((await a.atiradores()).map((x) => x.id)).toEqual(["ana"]);
    const de_novo = await a.importarDocumento(arquivo(), "eu");
    expect(de_novo).toEqual({ atiradores: [], percursos: [], tentativas: [], jaExistiam: 2 });
    expect((await a.resumo()).tentativas).toBe(2);
  });

  it("duas importações ao mesmo tempo: a segunda já vê os ids da primeira (nada é contado em dobro)", async () => {
    const a = novo();
    const [x, y] = await Promise.all([a.importarDocumento(arquivo(), "eu"), a.importarDocumento(arquivo(), "eu")]);
    expect(x.tentativas.length + y.tentativas.length).toBe(2);
    expect(x.jaExistiam + y.jaExistiam).toBe(2);
    expect((await a.resumo()).tentativas).toBe(2);
  });

  it("não sobrescreve o que já existe e, se a gravação falha, não fica nada pela metade", async () => {
    const a = novo();
    await a.salvarPercurso({ ...percurso("p1"), nome: "O meu" });
    const imp = arquivo();
    const original = IDBObjectStore.prototype.put;
    let chamadas = 0;
    const espiao = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
      if (++chamadas === 3) throw new Error("cota estourada");
      return original.apply(this, args);
    });
    await expect(a.importarDocumento(imp, "eu")).rejects.toThrow("cota estourada");
    espiao.mockRestore();
    expect((await a.resumo()).tentativas).toBe(0);
    expect(await a.atiradores()).toEqual([]);
    await a.importarDocumento(imp, "eu");
    expect((await a.percursos())[0].nome).toBe("O meu");
    expect((await a.resumo()).tentativas).toBe(2);
  });
});

describe("avatares", () => {
  const foto = (bytes: number, tipo = "image/webp") => new Blob([new Uint8Array(bytes).fill(7)], { type: tipo });

  it("guarda, lê, troca e apaga a foto de um atirador, cada um com a sua", async () => {
    const a = novo();
    expect(await a.lerAvatar("eu")).toBeNull();
    await a.salvarAvatar("eu", foto(10));
    await a.salvarAvatar("ana", foto(20, "image/jpeg"));
    const lida = await a.lerAvatar("eu");
    expect(lida?.tipo).toBe("image/webp");
    expect(lida?.dados.size).toBe(10);
    expect(lida!.atualizadoEm).toBeGreaterThan(0);
    await a.salvarAvatar("eu", foto(30));
    expect((await a.lerAvatar("eu"))?.dados.size).toBe(30);
    expect((await a.lerAvatar("ana"))?.tipo).toBe("image/jpeg");
    await a.apagarAvatar("eu");
    expect(await a.lerAvatar("eu")).toBeNull();
    expect(await a.lerAvatar("ana")).not.toBeNull();
    await a.apagarAvatar("nao-existe");
  });

  it("apagarTudo leva os avatares também", async () => {
    const a = novo();
    await a.salvarPercurso(percurso("p1"));
    await a.salvarAvatar("eu", foto(10));
    await a.apagarTudo();
    expect(await a.lerAvatar("eu")).toBeNull();
    expect(await a.percursos()).toEqual([]);
  });

  it("o avatar não entra no backup", async () => {
    const a = novo();
    await a.salvarAvatar("eu", foto(10));
    expect(Object.keys(await a.tudo())).toEqual(["atiradores", "percursos", "tentativas"]);
  });

  it("migra do banco v2 para o v3 sem perder nada e cria a loja avatares", async () => {
    const fabrica = new IDBFactory();
    await new Promise<void>((ok, falha) => {
      const r = fabrica.open("nk-dados", 2);
      r.onupgradeneeded = () => {
        const b = r.result;
        b.createObjectStore("percursos", { keyPath: "id" });
        b.createObjectStore("tentativas", { keyPath: "id" }).createIndex("porPercurso", ["percurso_id", "quando", "id"]);
        b.createObjectStore("audios");
        b.createObjectStore("atiradores", { keyPath: "id" });
      };
      r.onsuccess = () => {
        const t = r.result.transaction(["percursos", "tentativas", "atiradores"], "readwrite");
        t.objectStore("percursos").put(percurso("velho"));
        t.objectStore("tentativas").put(tentativa("velho", 5000, { id: "t-velha" }));
        t.objectStore("atiradores").put({ id: "ana", nome: "Ana" });
        t.oncomplete = () => (r.result.close(), ok());
        t.onerror = () => falha(t.error);
      };
      r.onerror = () => falha(r.error);
    });
    const a = new Armazenamento(() => fabrica);
    expect((await a.percursos()).map((p) => p.id)).toEqual(["velho"]);
    expect((await a.atiradores()).map((x) => x.id)).toEqual(["ana"]);
    expect((await a.todasDoPercurso("velho")).map((t) => t.id)).toEqual(["t-velha"]);
    expect(await a.lerAvatar("eu")).toBeNull();
    await a.salvarAvatar("eu", foto(5));
    expect((await a.lerAvatar("eu"))?.dados.size).toBe(5);
    await a.fechar();
  });
});
