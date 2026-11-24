// Idiomas da interface. Para adicionar um idioma: crie <codigo>.ts (copie pt.ts, traduza os
// valores e mantenha as chaves) e registre em IDIOMAS abaixo. Veja docs/TRADUCOES.md.
import { pt, type Chave, type Dicionario } from "./pt";
import { es } from "./es";
import { en } from "./en";

export const IDIOMAS = {
  pt: { nome: "Português", dic: pt as Dicionario },
  es: { nome: "Español", dic: es },
  en: { nome: "English", dic: en },
} satisfies Record<string, { nome: string; dic: Dicionario }>;

export type Idioma = keyof typeof IDIOMAS;
const CHAVE = "idioma";

/** Base de uma chave plural: "plural.tentativas" para as chaves "plural.tentativas.um" e "plural.tentativas.outros". */
export type BasePlural = Chave extends infer K ? (K extends `${infer B}.outros` ? B : never) : never;

// Categorias de plural do CLDR -> sufixo da chave. "outros" é a forma de reserva e é obrigatória.
const SUFIXOS: Record<Intl.LDMLPluralRule, string> = {
  zero: "zero",
  one: "um",
  two: "dois",
  few: "poucos",
  many: "muitos",
  other: "outros",
};

/** Os valores de `{nome}` de um texto. */
type Parametros = Record<string, string | number>;

const ehIdioma = (x: unknown): x is Idioma => typeof x === "string" && x in IDIOMAS;

function inicial(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (ehIdioma(salvo)) return salvo;
  } catch {
    /* sem armazenamento: usa o idioma do sistema */
  }
  const sistema = (typeof navigator !== "undefined" ? navigator.language : "pt").slice(0, 2).toLowerCase();
  return ehIdioma(sistema) ? sistema : "pt";
}

function preencher(texto: string, params?: Parametros): string {
  let s = texto;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

let atual = $state<Idioma>(inicial());

export const i18n = {
  get idioma(): Idioma {
    return atual;
  },
  set idioma(v: Idioma) {
    atual = v;
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      /* preferência não salva */
    }
  },
  /** Texto na língua atual; `{nome}` é substituído pelos parâmetros. Falta de chave cai no português. */
  t(chave: Chave, params?: Parametros): string {
    return preencher(IDIOMAS[atual].dic[chave] ?? pt[chave], params);
  },
  /**
   * Texto com plural: escolhe a forma pela regra da língua atual (Intl.PluralRules).
   * `{n}` recebe o número, a menos que `params` traga outro `n` (ex.: "+2" com sinal).
   * Ordem de busca: forma exata do plural, depois ".outros", depois o português.
   */
  tn(base: BasePlural, n: number, params?: Parametros): string {
    const dic = IDIOMAS[atual].dic as Record<string, string>;
    const categoria = n === 0 && `${base}.zero` in dic ? "zero" : SUFIXOS[new Intl.PluralRules(atual).select(n)];
    const texto =
      dic[`${base}.${categoria}`] ?? dic[`${base}.outros`] ?? (pt as Record<string, string>)[`${base}.outros`];
    return preencher(texto, { n, ...params });
  },
};
