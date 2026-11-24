import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CONS-013: o nome do projeto irmão ("Biblioteca Musical") não pode voltar aos textos nem ao vendor das OpusTags.
const arquivos = ["src/lib/i18n/pt.ts", "src/lib/i18n/en.ts", "src/lib/i18n/es.ts", "src/lib/ogg.ts"];

describe("resíduo do nome antigo", () => {
  for (const a of arquivos) {
    it(`${a} não contém "Biblioteca"`, () => {
      expect(readFileSync(a, "utf8")).not.toMatch(/Biblioteca/i);
    });
  }
});
