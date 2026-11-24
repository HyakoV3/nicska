import { afterEach, describe, expect, it, vi } from "vitest";
import { OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";
import { BYTES_POR_PEDACO, PREFIXO_ERRO_RECEBIDO, arquivoRecebido, compartilharArquivo, interpretarRecebido, nomeDoArquivo, podeCompartilhar, tipoSemCodec } from "../src/lib/compartilhar";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).NkCompartilhar;
  vi.restoreAllMocks();
  vi.unstubAllGlobals(); // devolve o localStorage de verdade (ou a falta dele), mesmo que um teste falhe no meio
});

describe("nomes e tipos", () => {
  it("tira o codec do tipo", () => {
    expect(tipoSemCodec("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(tipoSemCodec("")).toBe("audio/*");
  });
  it("nome do arquivo com data e extensão do formato", () => {
    const t = new Date(2026, 10, 7, 9, 5).getTime();
    expect(nomeDoArquivo(t, "audio/webm;codecs=opus")).toBe("nicska-2026-11-07-0905.webm");
    expect(nomeDoArquivo(t, "audio/mp4")).toBe("nicska-2026-11-07-0905.m4a");
    expect(nomeDoArquivo(t, "audio/ogg;codecs=opus")).toBe("nicska-2026-11-07-0905.ogg");
  });
});

describe("ponte do Android", () => {
  function ponteFalsa(sobrescrever: Record<string, unknown> = {}) {
    const partes: string[] = [];
    const p = {
      comecar: vi.fn(() => true),
      parte: vi.fn((b: string) => (partes.push(b), true)),
      enviar: vi.fn(() => true),
      cancelar: vi.fn(),
      ...sobrescrever,
    };
    (globalThis as Record<string, unknown>).NkCompartilhar = p;
    return { p, partes };
  }

  it("WebM/Opus vai como Ogg/Opus (.ogg, tipo audio/ogg); WebM que não se entende segue como está", async () => {
    const { p, partes } = ponteFalsa();
    const webm = bytesDe(OPUS_WEBM_AO_VIVO);
    expect(await compartilharArquivo(new Blob([webm], { type: "audio/webm;codecs=opus" }), "g.webm", "Enviar")).toBe("ok");
    expect(p.comecar).toHaveBeenLastCalledWith("g.ogg", "audio/ogg");
    expect(atob(partes.join("")).startsWith("OggS")).toBe(true);
    partes.length = 0;
    expect(await compartilharArquivo(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "h.weba", "Enviar")).toBe("original");
    expect(p.comecar).toHaveBeenLastCalledWith("h.weba", "audio/webm");
  });

  it("quando a conversão não dá, o resultado diz que foi o original (para avisar a pessoa)", async () => {
    ponteFalsa();
    expect(await compartilharArquivo(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "h.webm", "Enviar")).toBe("original");
    expect(await compartilharArquivo(new Blob(["{}"], { type: "application/json" }), "b.json", "Enviar")).toBe("ok");
  });

  it("só aparece quando há ponte ou Web Share", () => {
    expect(podeCompartilhar()).toBe(false);
    ponteFalsa();
    expect(podeCompartilhar()).toBe(true);
  });

  it("entrega o áudio em pedaços íntegros e abre a folha", async () => {
    const { p, partes } = ponteFalsa();
    const bytes = new Uint8Array(BYTES_POR_PEDACO * 2 + 10).map((_, i) => i % 251);
    const r = await compartilharArquivo(new Blob([bytes], { type: "audio/webm;codecs=opus" }), "a.webm", "Enviar");
    expect(r).toBe("original"); // bytes de teste que não são um WebM de verdade: segue o original, íntegro
    expect(p.comecar).toHaveBeenCalledWith("a.webm", "audio/webm");
    expect(partes).toHaveLength(3);
    const juntos = partes.map((b) => atob(b)).join("");
    expect(juntos).toHaveLength(bytes.length);
    expect(Array.from(juntos, (c) => c.charCodeAt(0))).toEqual(Array.from(bytes));
    expect(p.enviar).toHaveBeenCalledWith("Enviar");
  });

  it("erro se a ponte não cria o arquivo, falha num pedaço ou não abre a folha", async () => {
    ponteFalsa({ comecar: () => false });
    expect(await compartilharArquivo(new Blob(["x"]), "a", "t")).toBe("erro");
    const { p } = ponteFalsa({ parte: () => false });
    expect(await compartilharArquivo(new Blob(["x"]), "a", "t")).toBe("erro");
    expect(p.enviar).not.toHaveBeenCalled();
    ponteFalsa({ enviar: () => false });
    expect(await compartilharArquivo(new Blob(["x"]), "a", "t")).toBe("erro");
  });

  it("cancela na ponte quando falha depois de começar", async () => {
    const { p } = ponteFalsa({ parte: () => false });
    expect(await compartilharArquivo(new Blob(["x"]), "a", "t")).toBe("erro");
    expect(p.cancelar).toHaveBeenCalledTimes(1);
    const b = ponteFalsa();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const quebrado = { size: 5, type: "audio/webm", slice: () => ({ arrayBuffer: () => Promise.reject(new Error("leitura")) }) } as unknown as Blob;
    expect(await compartilharArquivo(quebrado, "a", "t")).toBe("erro");
    expect(b.p.cancelar).toHaveBeenCalledTimes(1);
    expect(b.p.enviar).not.toHaveBeenCalled();
  });

  it("envia um de cada vez, sem misturar os arquivos", async () => {
    const eventos: string[] = [];
    ponteFalsa({
      comecar: (n: string) => (eventos.push(`começa ${n}`), true),
      parte: () => (eventos.push("parte"), true),
      enviar: () => (eventos.push("envia"), true),
    });
    const a = new Blob([new Uint8Array(BYTES_POR_PEDACO * 2)]);
    await Promise.all([compartilharArquivo(a, "um", "t"), compartilharArquivo(new Blob(["x"]), "dois", "t")]);
    expect(eventos).toEqual(["começa um", "parte", "parte", "envia", "começa dois", "parte", "envia"]);
  });

  it("uma exceção da ponte vira erro, não derruba", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ponteFalsa({ comecar: () => { throw new Error("x"); } });
    expect(await compartilharArquivo(new Blob(["x"]), "a", "t")).toBe("erro");
  });
});

describe("arquivo recebido de outro app (CONS-032)", () => {
  const ponte = (p: Record<string, unknown>) => ((globalThis as Record<string, unknown>).NkCompartilhar = p);

  it("sem ponte (fora do Android) ou sem arquivo: null", () => {
    expect(arquivoRecebido()).toBeNull();
    ponte({ arquivoRecebido: () => "", erroRecebido: () => "" });
    expect(arquivoRecebido()).toBeNull();
    ponte({ arquivoRecebido: () => "" }); // ponte sem erroRecebido
    expect(arquivoRecebido()).toBeNull();
  });
  it("devolve o texto", () => {
    ponte({ arquivoRecebido: () => '{"formato":"nicska/1"}' });
    expect(interpretarRecebido(arquivoRecebido()!)).toEqual({ texto: '{"formato":"nicska/1"}' });
  });
  it("tira o BOM do começo (e só dele)", () => {
    const r = interpretarRecebido('\uFEFF{"a":"\uFEFF"}');
    expect(r).toEqual({ texto: '{"a":"\uFEFF"}' });
    expect(() => JSON.parse((r as { texto: string }).texto)).not.toThrow();
  });
  it("a leitura que falhou na ponte vira { erro }, não silêncio", () => {
    ponte({ arquivoRecebido: () => "", erroRecebido: () => "SecurityException" });
    const bruto = arquivoRecebido()!;
    expect(bruto.startsWith(PREFIXO_ERRO_RECEBIDO)).toBe(true);
    expect(interpretarRecebido(bruto)).toEqual({ erro: "SecurityException" });
  });
  it("o texto vale mais que o erro, e a ponte não é perguntada de novo à toa", () => {
    const erroRecebido = vi.fn(() => "x");
    ponte({ arquivoRecebido: () => "{}", erroRecebido });
    expect(arquivoRecebido()).toBe("{}");
    expect(erroRecebido).not.toHaveBeenCalled();
  });
});

describe("Web Share API (sem ponte)", () => {
  const nav = (canShare: (d: { files: File[] }) => boolean, share = vi.fn(async () => {})) => {
    vi.stubGlobal("navigator", { canShare, share });
    return share;
  };
  const webmQuebrado = () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });

  it("compartilha o arquivo e devolve ok", async () => {
    const share = nav(() => true);
    expect(await compartilharArquivo(new Blob(["{}"], { type: "application/json" }), "b.json", "Enviar")).toBe("ok");
    expect(share).toHaveBeenCalledTimes(1);
  });
  it("sem suporte a arquivos: erro", async () => {
    nav(() => false);
    expect(await compartilharArquivo(new Blob(["{}"], { type: "application/json" }), "b.json", "Enviar")).toBe("erro");
  });
  it("fechar a folha é cancelado, não erro", async () => {
    nav(() => true, vi.fn(async () => { throw new DOMException("x", "AbortError"); }));
    expect(await compartilharArquivo(new Blob(["{}"]), "b.json", "Enviar")).toBe("cancelado");
  });
  it("WebM que não converte segue como original", async () => {
    nav(() => true);
    expect(await compartilharArquivo(webmQuebrado(), "h.webm", "Enviar")).toBe("original");
  });
  it("se o navegador não aceita o Ogg convertido, tenta o WebM original e avisa", async () => {
    const aceita = (d: { files: File[] }) => !d.files[0]!.name.endsWith(".ogg");
    const share = nav(aceita);
    const r = await compartilharArquivo(new Blob([bytesDe(OPUS_WEBM_AO_VIVO)], { type: "audio/webm;codecs=opus" }), "g.webm", "Enviar");
    expect(r).toBe("original");
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]!.name).toBe("g.webm");
  });
});
