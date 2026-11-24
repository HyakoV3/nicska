import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { definirImersivo, manterImersivo } from "../src/lib/telaImersiva";

// O modo imersivo da tela cheia do vídeo (V2b): o wrapper com a ponte falsa e, como em orientacao.test.ts, a estrutura do lado Kotlin (que não compila aqui).
const PASTA = "src-tauri/gen/android/app/src/main/java/io/github/hyakov3/nicska";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Um documento falso: guarda o ouvinte de visibilidade para o teste disparar. */
function documentoFalso() {
  const ouvintes = new Set<() => void>();
  return {
    hidden: false,
    addEventListener: (_n: string, f: () => void) => ouvintes.add(f),
    removeEventListener: (_n: string, f: () => void) => ouvintes.delete(f),
    disparar() {
      ouvintes.forEach((f) => f());
    },
    get ouvindo() {
      return ouvintes.size;
    },
  };
}

describe("modo imersivo (wrapper)", () => {
  it("no Android chama a ponte com o booleano", () => {
    const ponte = { imersivo: vi.fn() };
    vi.stubGlobal("NkTela", ponte);
    expect(definirImersivo(true)).toBe(true);
    definirImersivo(false);
    expect(ponte.imersivo.mock.calls).toEqual([[true], [false]]);
  });
  it("fora do Android: não faz nada e não quebra", () => {
    expect(definirImersivo(true)).toBe(false);
    const d = documentoFalso();
    expect(() => manterImersivo(d as unknown as Document).soltar()).not.toThrow();
  });
  it("uma ponte que lança não derruba quem chama", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("NkTela", { imersivo: () => { throw new Error("x"); } });
    expect(definirImersivo(true)).toBe(false);
  });
  it("manterImersivo liga, liga de novo ao voltar ao primeiro plano e solta uma vez só", () => {
    const ponte = { imersivo: vi.fn() };
    vi.stubGlobal("NkTela", ponte);
    const d = documentoFalso();
    const im = manterImersivo(d as unknown as Document);
    d.hidden = true;
    d.disparar(); // oculto: nada
    d.hidden = false;
    d.disparar(); // voltou: esconde as barras de novo
    im.soltar();
    im.soltar();
    expect(ponte.imersivo.mock.calls).toEqual([[true], [true], [false]]);
    expect(d.ouvindo).toBe(0);
  });
});

describe("modo imersivo (Kotlin)", () => {
  const kt = readFileSync(`${PASTA}/PonteTela.kt`, "utf8");
  const atividade = readFileSync(`${PASTA}/MainActivity.kt`, "utf8");
  it("a ponte expõe imersivo(ligado: Boolean) como @JavascriptInterface", () => {
    expect(kt).toMatch(/^package io\.github\.hyakov3\.nicska$/m);
    expect(kt).toMatch(/class PonteTela\(private val atividade: MainActivity\)/);
    expect(kt).toMatch(/@JavascriptInterface\s+fun imersivo\(ligado: Boolean\)/);
    expect(kt).toContain("import android.webkit.JavascriptInterface");
  });
  it("esconde e mostra as barras do sistema pelo WindowInsetsControllerCompat, na thread de UI", () => {
    expect(kt).toContain("atividade.runOnUiThread {");
    expect(kt).toContain("WindowCompat.getInsetsController(janela, janela.decorView)");
    expect(kt).toContain("controle.hide(WindowInsetsCompat.Type.systemBars())");
    expect(kt).toContain("controle.show(WindowInsetsCompat.Type.systemBars())");
    expect(kt).toContain("WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE");
    for (const i of ["androidx.core.view.WindowCompat", "androidx.core.view.WindowInsetsCompat", "androidx.core.view.WindowInsetsControllerCompat"]) expect(kt).toContain(`import ${i}`);
  });
  it("o androidx.core já está no projeto (a PonteTema usa o mesmo WindowCompat)", () => {
    expect(readFileSync(`${PASTA}/PonteTema.kt`, "utf8")).toContain("import androidx.core.view.WindowCompat");
  });
  it("a MainActivity registra a ponte como NkTela (o nome que o TypeScript usa)", () => {
    expect(atividade).toContain('webView.addJavascriptInterface(PonteTela(this), "NkTela")');
    expect(readFileSync("src/lib/telaImersiva.ts", "utf8")).toContain("NkTela");
  });
});
