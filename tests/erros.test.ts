import { describe, expect, it } from "vitest";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";
import { pt } from "../src/lib/i18n/pt";
import { ERROS_DO_RUST, traduzirErro } from "../src/lib/erros";

// Tradutor falso: devolve a chave e os parâmetros, para conferir o que a função entrega.
const t = (c: string, p?: Record<string, string | number>) => `${c} ${JSON.stringify(p ?? {})}`;
const tr = (s: string) => traduzirErro(s, t as never);
// Como o Rust monta o erro: um JSON com o código e os argumentos.
const rust = (...v: string[]) => JSON.stringify(v);

describe("traduzirErro (erros do Rust)", () => {
  it("código sem argumentos", () => {
    expect(tr(rust("grande_demais"))).toBe("erro.rust.grande_demais {}");
  });

  it("código com argumentos, na ordem do Rust", () => {
    expect(tr(rust("versao", "2", "1"))).toBe('erro.rust.versao {"versao":"2","esperado":"1"}');
  });

  it("os dados podem ter qualquer caractere, inclusive '|', aspas e barra invertida", () => {
    expect(tr(rust("json_invalido", "A|B, C\"D"))).toBe(String.raw`erro.rust.json_invalido {"detalhe":"A|B, C\"D"}`);
    expect(tr(rust("json_invalido", "expected value | line 1 column 3"))).toBe('erro.rust.json_invalido {"detalhe":"expected value | line 1 column 3"}');
  });

  it("argumento que faltou vira texto vazio, e o que sobrou é ignorado", () => {
    expect(tr(rust("versao", "2"))).toBe('erro.rust.versao {"versao":"2","esperado":""}');
    expect(tr(rust("grande_demais", "sobra"))).toBe("erro.rust.grande_demais {}");
  });

  it("texto que não é um desses JSON, ou de código desconhecido, volta como está (inclusive nomes herdados do objeto)", () => {
    for (const s of ["falha qualquer", "", "toString", "__proto__", "[", "[1,2]", "[]", '{"a":1}', rust("constructor"), rust("toString", "x"), rust("__proto__")]) {
      expect(tr(s), s).toBe(s);
    }
  });

  it("todo código tem texto nos três idiomas, com exatamente os parâmetros que a função envia", () => {
    for (const [codigo, nomes] of Object.entries(ERROS_DO_RUST)) {
      for (const [idioma, dic] of [["pt", pt], ["es", es], ["en", en]] as const) {
        const texto = (dic as Record<string, string>)[`erro.rust.${codigo}`];
        expect(texto, `${idioma} ${codigo}`).toBeTypeOf("string");
        expect([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `${idioma} ${codigo}`).toEqual([...nomes].sort());
      }
    }
  });
});
