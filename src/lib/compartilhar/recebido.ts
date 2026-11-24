// O arquivo que outro app mandou abrir no Nicska ("Abrir com" ou "Compartilhar"), entregue pela ponte do Android (`PonteCompartilhar.kt`, `window.NkCompartilhar`).

/** O que a tela faz com um arquivo que outro app mandou abrir: o texto, ou o erro da leitura (a ponte lê fora da thread principal e avisa se falhou). */
export type ArquivoRecebido = { texto: string } | { erro: string };

/**
 * Marca (um texto que nenhum arquivo de verdade começa com: tem NUL) que `arquivoRecebido` devolve no lugar do texto quando a ponte não conseguiu ler o arquivo.
 * Assim o erro passa pelo mesmo caminho do texto (`inicio.recebido`, uma string) sem mudar a tela inicial; `interpretarRecebido` o desfaz.
 */
export const PREFIXO_ERRO_RECEBIDO = "\u0000erro:";

type PonteRecebido = { arquivoRecebido?: () => string; erroRecebido?: () => string };

/**
 * O texto do arquivo que outro app mandou abrir no Nicska ("Abrir com" ou "Compartilhar"), uma vez só; null se não há (ou fora do Android). Se a leitura falhou
 * na ponte, devolve `PREFIXO_ERRO_RECEBIDO` + o motivo (use `interpretarRecebido`).
 */
export function arquivoRecebido(): string | null {
  const p = (globalThis as { NkCompartilhar?: PonteRecebido }).NkCompartilhar;
  const texto = p?.arquivoRecebido?.();
  if (texto) return texto;
  const erro = p?.erroRecebido?.();
  return erro ? PREFIXO_ERRO_RECEBIDO + erro : null;
}

/** Separa o texto do erro do que `arquivoRecebido` devolveu e tira o BOM do começo do texto (`﻿`: editores do Windows o gravam e o `JSON.parse` o recusa). */
export function interpretarRecebido(bruto: string): ArquivoRecebido {
  if (bruto.startsWith(PREFIXO_ERRO_RECEBIDO)) return { erro: bruto.slice(PREFIXO_ERRO_RECEBIDO.length) };
  return { texto: bruto.replace(/^﻿/, "") };
}
