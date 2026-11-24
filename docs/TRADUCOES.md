# Traduções (idiomas da interface)

A interface está em **português** (referência), **espanhol** e **inglês**. O idioma inicial segue o
idioma do aparelho (se for um dos disponíveis) e a escolha do usuário fica salva no aparelho.

## Adicionar um idioma

1. Copie `src/lib/i18n/pt.ts` para `src/lib/i18n/<codigo>.ts` (por exemplo `fr.ts`).
2. Troque o cabeçalho por `import type { Dicionario } from "./pt";` e declare
   `export const fr: Dicionario = { ... }`, traduzindo **só os valores**. Não mude as chaves.
3. Registre o idioma em `src/lib/i18n/index.svelte.ts`:
   `import { fr } from "./fr";` e, em `IDIOMAS`, `fr: { nome: "Français", dic: fr },`.

O TypeScript (`npm run check`) acusa chave faltando ou sobrando. Os trechos entre chaves, como
`{n}`, `{nome}` e `{voz}`, são preenchidos pelo app: mantenha-os no texto traduzido, na posição
que fizer sentido na sua língua.

## Plurais

Frases com número usam **chaves de plural**: uma chave por forma, com o mesmo prefixo, por exemplo
`plural.tentativas.um` ("{n} tentativa") e `plural.tentativas.outros` ("{n} tentativas"). O app escolhe a forma pela regra
de plural do idioma (`Intl.PluralRules`) e, no código, usa `i18n.tn("plural.tentativas", n)`.

Sufixos aceitos: `.zero`, `.um`, `.dois`, `.poucos`, `.muitos` e `.outros`. **`.outros` é obrigatório**
(é a forma de reserva); as demais só são necessárias se a língua as usar. O verificador de chaves exige
`.outros` em toda chave plural. Português e inglês só precisam de `.um` e `.outros`; o `.zero` existe para
casos como "0 disparos", porque no português do CLDR o zero seria tratado como singular.

## O que não é traduzido (ainda)

- **Mensagens de erro da importação do JSON** são traduzidas pela interface: a validação (`src/lib/documento.ts`) lança `ErroDeDocumento` com um código
  estável e os dados (`versao`, `grande_demais`, `json_invalido`, `dados_invalidos`), e `src/lib/erros.ts` o transforma no texto `erro.rust.<codigo>`
  do idioma escolhido (o prefixo `erro.rust` vem do plano de validar em Rust, que não foi feito). Ao criar um erro novo, acrescente o código em
  `ERROS_DO_RUST` e o texto nos três idiomas (um teste confere). O detalhe de sistema que algumas mensagens carregam continua como o sistema o devolve.
- **Nomes de percursos e de atiradores** são do usuário e nunca são traduzidos.
