// Créditos e licenças de terceiros mostrados em Ajustes ("Créditos e licenças"). A fonte de cada dado está em
// docs/licencas-de-terceiros.md. Nomes, autoria e textos de licença ficam no original; só a descrição do uso é traduzida
// (chave `licencas.uso.<id>`).
import { TEXTO_APACHE_2, TEXTO_MIT, TEXTO_OFL_1_1 } from "./licencas-textos";

export type TipoTexto = "mit" | "apache2" | "ofl" | "reservado";

export type Credito = {
  id: string;
  nome: string;
  autoria: string;
  /** Rótulo curto da licença, como aparece na lista. */
  licenca: string;
  url?: string;
  /** As licenças que se aplicam, na ordem em que o texto é mostrado. */
  textos: { tipo: TipoTexto; direitos?: string }[];
};

export const CREDITOS: readonly Credito[] = [
  {
    id: "sora",
    nome: "Sora",
    autoria: "The Sora Project Authors",
    licenca: "SIL OFL 1.1",
    url: "https://github.com/sora-xor/sora-font",
    textos: [{ tipo: "ofl", direitos: "Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)" }],
  },
  {
    id: "icones",
    nome: "Google Material Icons e Material Symbols",
    autoria: "Material Design Authors (Google)",
    licenca: "Apache 2.0",
    url: "https://github.com/google/material-design-icons",
    textos: [{ tipo: "apache2" }],
  },
  {
    id: "svelte",
    nome: "Svelte e SvelteKit",
    autoria: "Svelte Contributors",
    licenca: "MIT",
    url: "https://github.com/sveltejs/svelte",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2016-2025 Svelte Contributors (Svelte)\nCopyright (c) 2020 SvelteKit contributors (SvelteKit)" }],
  },
  {
    id: "tauri",
    nome: "Tauri",
    autoria: "Tauri Apps Contributors",
    licenca: "MIT ou Apache 2.0",
    url: "https://github.com/tauri-apps/tauri",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2017 - Present Tauri Apps Contributors" }],
  },
  {
    id: "mp4-muxer",
    nome: "mp4-muxer",
    autoria: "Vanilagy",
    licenca: "MIT",
    url: "https://github.com/Vanilagy/mp4-muxer",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2023 Vanilagy" }],
  },
] as const;

/** O crédito não tem licença (só "direitos reservados")? Aí o rótulo e o botão não podem prometer um texto de licença: a tela usa `creditos.reservado` e `creditos.ver_direitos`. */
export function semLicenca(c: Credito): boolean {
  return c.textos.length > 0 && c.textos.every((x) => x.tipo === "reservado");
}

/** O texto de uma licença para um crédito (com a linha de direitos autorais, quando há). */
export function textoDaLicenca(t: Credito["textos"][number]): string {
  return TEXTO_POR_TIPO[t.tipo](t.direitos ?? "");
}

const TEXTO_POR_TIPO: Record<TipoTexto, (direitos: string) => string> = {
  mit: (direitos) => `MIT License\n\n${direitos}\n\n${TEXTO_MIT}`,
  apache2: () => TEXTO_APACHE_2,
  ofl: (direitos) => `${direitos}\n\n${TEXTO_OFL_1_1}`,
  reservado: (direitos) => direitos,
};
