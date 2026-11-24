import { afterEach, describe, expect, it, vi } from "vitest";
import { compartilharVideo, formaDoEnvio, nomeDoVideo, videoParaEnviar } from "../src/lib/compartilhar";
import { extensaoDoVideo, tipoDoVideo, trechoDoPercurso } from "../src/lib/compartilhar/video";

// Enviar o vídeo da tentativa (V2b): a escolha dos botões, o nome e o tipo do arquivo, o preparo (duração corrigida) e a entrega como VÍDEO, sem a
// conversão para Ogg do áudio.

afterEach(() => {
  delete (globalThis as Record<string, unknown>).NkCompartilhar;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe("que botões aparecem", () => {
  it("só áudio: um botão; com vídeo e áudio: a pílula; só vídeo: o do vídeo; nada: nada", () => {
    expect(formaDoEnvio({ audio: true, video: false }, true)).toBe("audio");
    expect(formaDoEnvio({ audio: true, video: true }, true)).toBe("pilula");
    expect(formaDoEnvio({ audio: false, video: true }, true)).toBe("video");
    expect(formaDoEnvio({ audio: false, video: false }, true)).toBe("nenhum");
  });
  it("sem compartilhamento no aparelho (nem ponte nem Web Share), nenhum botão", () => {
    expect(formaDoEnvio({ audio: true, video: true }, false)).toBe("nenhum");
  });
});

describe("nome e tipo do vídeo", () => {
  const quando = new Date(2026, 10, 23, 14, 7).getTime();
  it("nicska-<percurso>-<data>.webm, com o percurso sem acento nem símbolo", () => {
    expect(nomeDoVideo(quando, "video/webm;codecs=vp9,opus", "Classificação 3 — Ação!")).toBe("nicska-classificacao-3-acao-2026-11-23-1407.webm");
    expect(nomeDoVideo(quando, "video/webm")).toBe("nicska-2026-11-23-1407.webm");
    expect(nomeDoVideo(quando, "video/webm", "!!!")).toBe("nicska-2026-11-23-1407.webm");
  });
  it("MP4 só se o aparelho gravou MP4; tipo vazio ou estranho vale WebM", () => {
    expect(nomeDoVideo(quando, "video/mp4;codecs=avc1", "X")).toBe("nicska-x-2026-11-23-1407.mp4");
    expect(tipoDoVideo("")).toBe("video/webm");
    expect(tipoDoVideo("audio/webm")).toBe("video/webm");
    expect(tipoDoVideo("video/webm;codecs=vp8,opus")).toBe("video/webm");
    expect(extensaoDoVideo("video/mp4")).toBe("mp4");
  });
  it("o trecho do percurso é curto e sem hífen sobrando", () => {
    const longo = trechoDoPercurso("a".repeat(39) + " bbb");
    expect(longo.length).toBeLessThanOrEqual(40);
    expect(longo.endsWith("-")).toBe(false);
    expect(trechoDoPercurso(undefined)).toBe("");
  });
});

describe("preparo do vídeo", () => {
  it("monta o vídeo da loja e corrige a duração pelo mesmo preparo da reprodução", async () => {
    const cru = new Blob(["x"], { type: "video/webm" });
    const pronto = new Blob(["xy"], { type: "video/webm" });
    const preparar = vi.fn(async () => pronto);
    expect(await videoParaEnviar({ video: async () => cru }, "t1", preparar)).toBe(pronto);
    expect(preparar).toHaveBeenCalledWith(cru);
  });
  it("sem vídeo guardado: nulo", async () => {
    expect(await videoParaEnviar({ video: async () => null }, "t1", vi.fn())).toBeNull();
  });
});

describe("envio do vídeo", () => {
  it("pela ponte vai com o tipo de VÍDEO e os bytes como são (sem Ogg)", async () => {
    const { p, partes } = ponteFalsa();
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);
    expect(await compartilharVideo(new Blob([bytes], { type: "video/webm;codecs=vp9,opus" }), "nicska-x.webm", "Enviar vídeo")).toBe("ok");
    expect(p.comecar).toHaveBeenCalledWith("nicska-x.webm", "video/webm");
    expect(p.enviar).toHaveBeenCalledWith("Enviar vídeo");
    expect(Uint8Array.from(atob(partes.join("")), (c) => c.charCodeAt(0))).toEqual(bytes);
  });
  it("um blob sem tipo vai como video/webm", async () => {
    const { p } = ponteFalsa();
    await compartilharVideo(new Blob([new Uint8Array([1])]), "v.webm", "Enviar vídeo");
    expect(p.comecar).toHaveBeenCalledWith("v.webm", "video/webm");
  });
  it("a ponte recusou: erro (a tela avisa como no áudio)", async () => {
    ponteFalsa({ comecar: vi.fn(() => false) });
    expect(await compartilharVideo(new Blob(["x"], { type: "video/webm" }), "v.webm", "Enviar vídeo")).toBe("erro");
  });
  it("fora do Android, pela Web Share API com o arquivo de vídeo; fechar a folha é cancelado, não erro", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { canShare: () => true, share });
    expect(await compartilharVideo(new Blob(["x"], { type: "video/webm" }), "v.webm", "Enviar vídeo")).toBe("ok");
    const arquivo = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0];
    expect(arquivo.type).toBe("video/webm");
    expect(arquivo.name).toBe("v.webm");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("navigator", { canShare: () => true, share: async () => Promise.reject(new DOMException("x", "AbortError")) });
    expect(await compartilharVideo(new Blob(["x"], { type: "video/webm" }), "v.webm", "Enviar vídeo")).toBe("cancelado");
  });
});
