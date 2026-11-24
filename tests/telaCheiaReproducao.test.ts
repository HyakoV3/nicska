import { describe, expect, it, vi } from "vitest";
import { emTelaCheia, entrarTelaCheia, estaEmTelaCheia, rotuloDaTelaCheia, sairTelaCheiaDoVideo, telaCheiaDisponivel } from "../src/lib/video/telaCheiaReproducao";

const doc = (o: object = {}) => o as never;
const el = (o: object = {}) => o as never;

describe("tela cheia da reprodução do vídeo", () => {
  it("disponível só se o navegador permite e o elemento sabe pedir (padrão ou webkit)", () => {
    expect(telaCheiaDisponivel(doc({ fullscreenEnabled: true }))).toBe(true);
    expect(telaCheiaDisponivel(doc({ webkitFullscreenEnabled: true }))).toBe(true);
    expect(telaCheiaDisponivel(doc({ fullscreenEnabled: false }))).toBe(false);
    expect(telaCheiaDisponivel(doc({}))).toBe(false);
    expect(telaCheiaDisponivel(doc({ fullscreenEnabled: true }), el({}))).toBe(false);
    expect(telaCheiaDisponivel(doc({ fullscreenEnabled: true }), el({ webkitRequestFullscreen: () => {} }))).toBe(true);
  });
  it("sabe qual elemento está em tela cheia", () => {
    const a = {} as Element;
    expect(emTelaCheia(doc({ fullscreenElement: a }))).toBe(a);
    expect(emTelaCheia(doc({ webkitFullscreenElement: a }))).toBe(a);
    expect(emTelaCheia(doc({ fullscreenElement: null }))).toBeNull();
    expect(estaEmTelaCheia(a, doc({ fullscreenElement: a }))).toBe(true);
    expect(estaEmTelaCheia({} as Element, doc({ fullscreenElement: a }))).toBe(false);
    expect(estaEmTelaCheia(null, doc({ fullscreenElement: null }))).toBe(false);
  });
  it("entra pela API padrão, cai no prefixo webkit e devolve false se recusar", async () => {
    const padrao = vi.fn().mockResolvedValue(undefined);
    expect(await entrarTelaCheia(el({ requestFullscreen: padrao }))).toBe(true);
    expect(padrao).toHaveBeenCalled();
    const web = vi.fn();
    expect(await entrarTelaCheia(el({ webkitRequestFullscreen: web }))).toBe(true);
    expect(web).toHaveBeenCalled();
    expect(await entrarTelaCheia(el({}))).toBe(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await entrarTelaCheia(el({ requestFullscreen: () => Promise.reject(new Error("x")) }))).toBe(false);
  });
  it("sai só se estiver em tela cheia, com o prefixo se for o caso, sem lançar", async () => {
    const sair = vi.fn().mockResolvedValue(undefined);
    await sairTelaCheiaDoVideo(doc({ fullscreenElement: {}, exitFullscreen: sair }));
    expect(sair).toHaveBeenCalledTimes(1);
    await sairTelaCheiaDoVideo(doc({ fullscreenElement: null, exitFullscreen: sair }));
    expect(sair).toHaveBeenCalledTimes(1);
    const web = vi.fn();
    await sairTelaCheiaDoVideo(doc({ webkitFullscreenElement: {}, webkitExitFullscreen: web }));
    expect(web).toHaveBeenCalled();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(sairTelaCheiaDoVideo(doc({ fullscreenElement: {}, exitFullscreen: () => Promise.reject(new Error("x")) }))).resolves.toBeUndefined();
  });
  it("o rótulo diz o que o toque faz", () => {
    expect(rotuloDaTelaCheia(false)).toBe("revisao_video.tela_cheia");
    expect(rotuloDaTelaCheia(true)).toBe("revisao_video.sair_tela_cheia");
  });
});
