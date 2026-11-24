import { afterEach, describe, expect, it, vi } from "vitest";
import { compartilharVideoDeTeste, nomeComExtensao } from "../src/lib/spike/compartilhar";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).NkCompartilhar;
  vi.restoreAllMocks();
});

describe("compartilharVideoDeTeste (spike)", () => {
  it("entrega o vídeo à ponte como está: MIME de vídeo, extensão certa e nenhum remux para Ogg", async () => {
    const partes: string[] = [];
    const p = { comecar: vi.fn(() => true), parte: vi.fn((b: string) => (partes.push(b), true)), enviar: vi.fn(() => true), cancelar: vi.fn() };
    (globalThis as Record<string, unknown>).NkCompartilhar = p;
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "video/webm;codecs=vp9,opus" });
    const r = await compartilharVideoDeTeste(blob, "teste.ogg");
    expect(p.comecar).toHaveBeenCalledWith("teste.webm", "video/webm");
    expect(partes.join("")).toBe(btoa(String.fromCharCode(1, 2, 3, 4)));
    expect(r).toMatchObject({ caminho: "ponte", resultado: "ok", mime: "video/webm", nome: "teste.webm", bytes: 4 });
  });
  it("mp4 e json ganham a extensão do tipo", async () => {
    expect(nomeComExtensao("a", "video/mp4")).toBe("a.mp4");
    expect(nomeComExtensao("a.mp4", "video/mp4")).toBe("a.mp4");
    expect(nomeComExtensao("r.txt", "application/json")).toBe("r.json");
  });
  it("sem ponte nem Web Share, diz que está indisponível", async () => {
    vi.stubGlobal("navigator", {});
    const r = await compartilharVideoDeTeste(new Blob(["x"], { type: "video/mp4" }), "v");
    expect(r.resultado).toBe("indisponivel");
    vi.unstubAllGlobals();
  });
  it("a ponte recusando vira erro", async () => {
    (globalThis as Record<string, unknown>).NkCompartilhar = { comecar: () => false, parte: () => true, enviar: () => true, cancelar: () => {} };
    expect((await compartilharVideoDeTeste(new Blob(["x"], { type: "video/mp4" }), "v")).resultado).toBe("erro");
  });
});
