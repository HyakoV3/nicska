import { describe, expect, it, vi } from "vitest";
import type { Idioma } from "../src/lib/i18n/index.svelte";

// O vitest não compila as runes do Svelte: `$state` vira identidade e o módulo é importado depois.
vi.stubGlobal("$state", <T>(v: T) => v);
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const { i18n } = await import("../src/lib/i18n/index.svelte");

const ESPERADO: Record<Idioma, Record<"plural.tentativas" | "plural.disparos", [string, string, string]>> = {
  pt: {
    "plural.tentativas": ["0 tentativas", "1 tentativa", "2 tentativas"],
    "plural.disparos": ["0 disparos", "1 disparo", "2 disparos"],
  },
  en: {
    "plural.tentativas": ["0 attempts", "1 attempt", "2 attempts"],
    "plural.disparos": ["0 shots", "1 shot", "2 shots"],
  },
  es: {
    "plural.tentativas": ["0 intentos", "1 intento", "2 intentos"],
    "plural.disparos": ["0 disparos", "1 disparo", "2 disparos"],
  },
};

describe("plural com zero explícito (CONS-041)", () => {
  for (const idioma of Object.keys(ESPERADO) as Idioma[]) {
    for (const [base, formas] of Object.entries(ESPERADO[idioma])) {
      it(`${idioma} ${base}: 0, 1 e 2`, () => {
        i18n.idioma = idioma;
        expect([0, 1, 2].map((n) => i18n.tn(base as keyof (typeof ESPERADO)["pt"], n))).toEqual(formas);
      });
    }
  }
});
