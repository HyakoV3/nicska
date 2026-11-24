import { describe, expect, it } from "vitest";
import { BITS_POR_SEGUNDO, FORMATOS_PREFERIDOS, escolherFormato, motivoDoErro } from "../src/lib/audioComum";

describe("formato da gravação", () => {
  it("escolhe o primeiro formato preferido que o navegador grava", () => {
    expect(escolherFormato(() => true)).toBe("audio/ogg;codecs=opus");
    expect(escolherFormato((t) => t === "audio/webm;codecs=opus" || t === "audio/webm")).toBe("audio/webm;codecs=opus");
    expect(escolherFormato((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(escolherFormato((t) => t === "audio/webm")).toBe("audio/webm");
  });
  it("sem nenhum, devolve nulo (o MediaRecorder escolhe o seu)", () => {
    expect(escolherFormato(() => false)).toBeNull();
  });
  it("o Opus vem antes do resto", () => {
    expect(FORMATOS_PREFERIDOS[0]).toContain("opus");
  });
});

describe("motivo do erro", () => {
  const erro = (name: string) => Object.assign(new Error("x"), { name });
  it("traduz o erro do navegador", () => {
    expect(motivoDoErro(erro("NotAllowedError"))).toBe("negada");
    expect(motivoDoErro(erro("SecurityError"))).toBe("negada");
    expect(motivoDoErro(erro("NotFoundError"))).toBe("sem_microfone");
    expect(motivoDoErro(erro("NotSupportedError"))).toBe("indisponivel");
    expect(motivoDoErro(erro("AbortError"))).toBe("falhou");
  });
  it("o que não é erro conhecido vira falha", () => {
    expect(motivoDoErro("texto")).toBe("falhou");
    expect(motivoDoErro(null)).toBe("falhou");
    expect(motivoDoErro({ name: "NotAllowedError" })).toBe("negada");
  });
});

describe("bitrate", () => {
  it("o bitrate é compacto, de voz", () => {
    expect(BITS_POR_SEGUNDO).toBe(64000);
  });
});
