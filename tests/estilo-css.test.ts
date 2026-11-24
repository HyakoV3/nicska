import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda do CSS: cores só por tokens (src/lib/tema.css é o único lugar com hex) e tamanhos só em rem (px só em medidas lidas do layout, no JavaScript).
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });
const codigo = arquivos("src").filter((p) => /\.(svelte|css|html)$/.test(p) && !p.endsWith("tema.css"));
// Tira os comentários: neles os exemplos de cor e de px são só texto.
const semComentarios = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("CSS: tokens e rem", () => {
  it("nenhum componente tem cor hexadecimal solta", () => {
    for (const p of codigo) expect(semComentarios(readFileSync(p, "utf8")).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g) ?? [], p).toEqual([]);
  });
  it("nenhum componente usa px (só rem; o JavaScript mede o layout em px)", () => {
    for (const p of codigo) {
      const css = semComentarios(readFileSync(p, "utf8"));
      // Aceita px só dentro de código JS de medição (setProperty / IntersectionObserver); no CSS de <style> e nos arquivos .css, nunca.
      const estilos = p.endsWith(".css") ? css : (css.match(/<style[\s\S]*?<\/style>/g) ?? []).join("\n");
      expect(estilos.match(/\d\s*px\b/g) ?? [], p).toEqual([]);
    }
  });
});
