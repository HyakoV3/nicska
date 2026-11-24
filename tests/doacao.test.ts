import { afterEach, describe, expect, it, vi } from "vitest";
import { URL_DA_DOACAO, abrirDoacao } from "../src/lib/doacao";
import { readFileSync } from "node:fs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("doação ao desenvolvedor", () => {
  it("a URL é a do PayPal, em reais, com o identificador do desenvolvedor", () => {
    const u = new URL(URL_DA_DOACAO);
    expect(u.protocol).toBe("https:");
    expect(u.hostname).toBe("www.paypal.com");
    expect(u.pathname).toBe("/donate");
    expect(u.searchParams.get("business")).toBe("ZTYE426U4GSXN");
    expect(u.searchParams.get("currency_code")).toBe("BRL");
    expect(u.searchParams.get("no_recurring")).toBe("0");
  });

  it("no Android usa a ponte nativa e NÃO passa endereço nenhum a ela (a URL é fixa no Kotlin)", () => {
    const abrir = vi.fn(() => true);
    vi.stubGlobal("NkDoacao", { abrir });
    expect(abrirDoacao()).toBe(true);
    expect(abrir).toHaveBeenCalledWith();
  });

  it("a ponte devolve false (sem navegador): o aviso aparece", () => {
    vi.stubGlobal("NkDoacao", { abrir: () => false });
    expect(abrirDoacao()).toBe(false);
  });

  it("sem a ponte (Chrome) abre em outra aba, sem enviar o opener", () => {
    const abrir = vi.fn(() => ({}));
    vi.stubGlobal("window", { open: abrir });
    expect(abrirDoacao()).toBe(true);
    expect(abrir).toHaveBeenCalledWith(URL_DA_DOACAO, "_blank", "noopener,noreferrer");
  });

  it("janela bloqueada (open devolve null) conta como falha", () => {
    vi.stubGlobal("window", { open: () => null });
    expect(abrirDoacao()).toBe(false);
  });

  it("a URL do TypeScript é a mesma do código nativo, e o Kotlin não aceita endereço vindo do JavaScript", () => {
    const kt = readFileSync("src-tauri/gen/android/app/src/main/java/io/github/hyakov3/nicska/PonteDoacao.kt", "utf8");
    expect(kt).toContain(`"${URL_DA_DOACAO}"`);
    expect(kt).toMatch(/fun abrir\(\): Boolean/); // sem parâmetros
  });
});
