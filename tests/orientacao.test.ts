import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { soltarOrientacao, travarOrientacao } from "../src/lib/orientacao";

// A orientação travada durante a gravação do vídeo (C8): o wrapper com a ponte falsa e, a estrutura do lado Kotlin (que não compila aqui).
const PASTA = "src-tauri/gen/android/app/src/main/java/io/github/hyakov3/nicska";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("orientação da tela (wrapper)", () => {
  it("no Android chama a ponte, sem passar nada a ela", () => {
    const ponte = { travar: vi.fn(), soltar: vi.fn() };
    vi.stubGlobal("NkOrientacao", ponte);
    expect(travarOrientacao()).toBe(true);
    soltarOrientacao();
    expect(ponte.travar).toHaveBeenCalledWith();
    expect(ponte.soltar).toHaveBeenCalledWith();
  });
  it("fora do Android: não faz nada e não quebra", () => {
    expect(travarOrientacao()).toBe(false);
    expect(() => soltarOrientacao()).not.toThrow();
  });
  it("uma ponte que lança não derruba quem chama", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("NkOrientacao", { travar: () => { throw new Error("x"); }, soltar: () => { throw new Error("x"); } });
    expect(travarOrientacao()).toBe(false);
    expect(() => soltarOrientacao()).not.toThrow();
  });
});

describe("orientação da tela (Kotlin)", () => {
  const kt = readFileSync(`${PASTA}/PonteOrientacao.kt`, "utf8");
  const atividade = readFileSync(`${PASTA}/MainActivity.kt`, "utf8");
  it("a ponte expõe travar() e soltar() sem parâmetros, como @JavascriptInterface", () => {
    expect(kt).toMatch(/@JavascriptInterface\s+fun travar\(\)/);
    expect(kt).toMatch(/@JavascriptInterface\s+fun soltar\(\)/);
  });
  it("trava na orientação atual e solta para o sistema, sempre na thread de UI", () => {
    expect(kt).toMatch(/runOnUiThread \{ atividade\.requestedOrientation = ActivityInfo\.SCREEN_ORIENTATION_LOCKED \}/);
    expect(kt).toMatch(/runOnUiThread \{ atividade\.requestedOrientation = ActivityInfo\.SCREEN_ORIENTATION_UNSPECIFIED \}/);
  });
  it("a MainActivity registra a ponte como NkOrientacao (o nome que o TypeScript usa)", () => {
    expect(atividade).toContain('webView.addJavascriptInterface(PonteOrientacao(this), "NkOrientacao")');
    expect(readFileSync("src/lib/orientacao.ts", "utf8")).toContain("NkOrientacao");
  });
});
