import { describe, expect, it } from "vitest";
import { CHAVE_ESTILO, ESTILOS, ehEstilo, migrarEstilo } from "../src/lib/estilos";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Lê o arquivo direto do disco: o Vitest devolve texto vazio para `.css?raw`, então o `?raw` não serve para o tema.css.
const ler = (caminho: string): string => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf-8");
const appHtml = ler("src/app.html");
const temaCss = ler("src/lib/tema.css");

const outros = ESTILOS.filter((x) => x !== "normal");

describe("migração dos estilos antigos", () => {
  it("pergaminho vira titânio, marinho vira telemetria, e o resto que não vale volta ao normal", () => {
    expect(migrarEstilo("pergaminho")).toBe("titanio");
    expect(migrarEstilo("marinho")).toBe("telemetria");
    for (const e of ESTILOS) expect(migrarEstilo(e)).toBe(e);
    for (const ruim of ["", "sepia", null, undefined, 3, "toString", "constructor"]) expect(migrarEstilo(ruim)).toBe("normal");
  });
});

describe("estilos de cor", () => {
  it("o normal vem primeiro e só os valores da lista valem", () => {
    expect(ESTILOS[0]).toBe("normal");
    for (const e of ESTILOS) expect(ehEstilo(e)).toBe(true);
    for (const ruim of ["", "Normal", "escuro", "claro", "sepia", null, undefined, 3, {}]) expect(ehEstilo(ruim)).toBe(false);
  });

  // O script de src/app.html aplica o estilo antes da primeira pintura e repete a lista à mão: se um estilo entrar ou sair
  // de ESTILOS e não do script, a tela piscaria (ou ficaria no normal) a cada abertura.
  describe("o script do app.html acompanha o módulo estilos.ts", () => {
    it("lê a mesma chave do localStorage", () => {
      expect(appHtml).toContain(`localStorage.getItem("${CHAVE_ESTILO}")`);
    });

    it("aplica exatamente os estilos que não são o normal (nem a mais, nem a menos)", () => {
      // A condição que atribui o atributo: só pode citar os estilos diferentes do normal.
      const condicao = appHtml.match(/if \(e === [^)]*\) document\.documentElement\.dataset\.estilo = e;/)?.[0] ?? "";
      expect(condicao, "não achei a linha que aplica o estilo").not.toBe("");
      const citados = [...condicao.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(citados.sort()).toEqual([...outros].sort());
    });

    // Executa o script de verdade num contexto isolado: aplica o que está salvo e não cria variável global.
    const executar = (salvo: Record<string, string>) => {
      const script = appHtml.match(/<script>([\s\S]*?)<\/script[^>]*>/i)?.[1] ?? "";
      const documento = { documentElement: { dataset: {} as Record<string, string> } };
      const contexto: Record<string, unknown> = {
        localStorage: { getItem: (k: string) => salvo[k] ?? null },
        document: documento,
      };
      runInNewContext(script, contexto);
      return { aplicado: documento.documentElement.dataset, globais: Object.keys(contexto).sort() };
    };

    it("aplica o modo e o estilo salvos antes da primeira pintura", () => {
      expect(executar({ tema: "escuro", estilo: "telemetria" }).aplicado).toEqual({ tema: "escuro", estilo: "telemetria" });
      expect(executar({ tema: "claro", estilo: "titanio" }).aplicado).toEqual({ tema: "claro", estilo: "titanio" });
      // os valores antigos do projeto de origem migram: pergaminho → titânio, marinho → telemetria
      expect(executar({ estilo: "pergaminho" }).aplicado).toEqual({ estilo: "titanio" });
      expect(executar({ estilo: "marinho" }).aplicado).toEqual({ estilo: "telemetria" });
      // o modo "sistema" e o estilo "normal" não levam atributo, e valor desconhecido é ignorado
      expect(executar({ tema: "sistema", estilo: "normal" }).aplicado).toEqual({});
      expect(executar({ tema: "roxo", estilo: "sepia" }).aplicado).toEqual({});
      expect(executar({}).aplicado).toEqual({});
    });

    it("não deixa variáveis globais (window.t, window.e)", () => {
      expect(executar({ tema: "escuro", estilo: "telemetria" }).globais).toEqual(["document", "localStorage"]);
    });
  });

  it("o tema.css tem os três blocos (claro, escuro do sistema e escuro escolhido) de cada estilo", () => {
    for (const e of outros) {
      const claro = temaCss.match(new RegExp(`^:root\\[data-estilo="${e}"\\] \\{`, "m"));
      // O escuro do sistema só vale com o aparelho no escuro: precisa estar DENTRO do @media.
      const escuroSistema = temaCss.match(
        new RegExp(
          `@media \\(prefers-color-scheme: dark\\) \\{\\s*:root\\[data-estilo="${e}"\\]:not\\(\\[data-tema="claro"\\], \\[data-tema="alto-contraste"\\]\\) \\{`,
        ),
      );
      const escuroEscolhido = temaCss.match(new RegExp(`^:root\\[data-estilo="${e}"\\]\\[data-tema="escuro"\\] \\{`, "m"));
      expect(claro, `${e}: falta o bloco claro`).not.toBeNull();
      expect(escuroSistema, `${e}: falta o escuro do sistema dentro do @media`).not.toBeNull();
      expect(escuroEscolhido, `${e}: falta o escuro escolhido`).not.toBeNull();
    }
  });
});

// Modo "alto contraste" (I-06): quarto modo, de paleta própria, que ignora o estilo.
describe("modo alto contraste", () => {
  const fonteTema = ler("src/lib/tema.svelte.ts");
  const temas = [...(fonteTema.match(/export const TEMAS = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const tokensDo = (bloco: string) => [...bloco.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]).sort();
  const blocoAlto = temaCss.match(/^:root\[data-tema="alto-contraste"\] \{([^}]*)\}/m)?.[1] ?? "";
  const blocoNormal = [...temaCss.matchAll(/^:root \{([^}]*)\}/gm)].map((m) => m[1]).find((b) => b.includes("--fundo")) ?? "";

  it("é um dos modos de TEMAS (o Automático continua sendo o primeiro)", () => {
    expect(temas[0]).toBe("sistema");
    expect(temas).toContain("alto-contraste");
  });

  it("o script do app.html aplica exatamente os modos que não são o Automático", () => {
    const condicao = appHtml.match(/if \(t === [^)]*\) document\.documentElement\.dataset\.tema = t;/)?.[0] ?? "";
    expect(condicao, "não achei a linha que aplica o modo").not.toBe("");
    const citados = [...condicao.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(citados.sort()).toEqual(temas.filter((x) => x !== "sistema").sort());
  });

  it("aplica o alto contraste salvo antes da primeira pintura, com qualquer estilo", () => {
    const script = appHtml.match(/<script>([\s\S]*?)<\/script[^>]*>/i)?.[1] ?? "";
    const documento = { documentElement: { dataset: {} as Record<string, string> } };
    runInNewContext(script, {
      localStorage: { getItem: (k: string) => ({ tema: "alto-contraste", estilo: "telemetria" })[k] ?? null },
      document: documento,
    });
    expect(documento.documentElement.dataset).toEqual({ tema: "alto-contraste", estilo: "telemetria" });
  });

  it("o tema.css tem o bloco do modo, com todos os tokens do :root padrão", () => {
    expect(blocoAlto, "falta o bloco :root[data-tema=\"alto-contraste\"]").not.toBe("");
    expect(tokensDo(blocoAlto)).toEqual(tokensDo(blocoNormal));
    expect(blocoAlto).toContain("color-scheme: dark");
  });

  it("o bloco vem DEPOIS dos blocos dos estilos (empata na especificidade e vence pela ordem)", () => {
    const posAlto = temaCss.search(/^:root\[data-tema="alto-contraste"\] \{/m);
    const ultimoEstilo = temaCss.lastIndexOf(':root[data-estilo="');
    expect(posAlto).toBeGreaterThan(ultimoEstilo);
  });

  it("os três escuros do sistema (normal, titânio e telemetria) excluem o modo", () => {
    const excluem = temaCss.match(/:not\(\[data-tema="claro"\], \[data-tema="alto-contraste"\]\) \{/g) ?? [];
    const escurosDoSistema = temaCss.match(/@media \(prefers-color-scheme: dark\) \{\s*:root/g) ?? [];
    expect(escurosDoSistema).toHaveLength(1 + outros.length);
    expect(excluem).toHaveLength(escurosDoSistema.length);
  });
});
