// A tela cheia do modo vídeo (V2b), como função pura: em que passo ela está e o que o botão e o Voltar do Android fazem em cada um. A tela (TelaCheia.svelte)
// só aplica. Passos: "enquadrar" (a câmera em tela cheia, Começar ou Sair), "iniciando" (tocou em Começar e o Timer ainda não respondeu), "antes" (Standby
// até o apito: um toque cancela) e "correndo" (a escuta: só SEGURAR para), e "fechada" (a aba normal). O fim, o cancelamento e o erro do Timer fecham.
import type { EstadoDoTimer } from "../timerTipos";

export type FaseDaTelaCheia = "fechada" | "enquadrar" | "iniciando" | "antes" | "correndo";
/** O botão do alto: um toque cancela antes do apito; com a tentativa correndo, só segurando (um toque solto não para nada). */
export type AcaoDoBotao = "cancelar" | "segurar";
/** O Voltar do Android: no enquadrar, sai; antes do apito, cancela; correndo, não faz nada além de mostrar a dica de segurar. */
export type AcaoDoVoltar = "sair" | "cancelar" | "dica";

const ANTES_DO_APITO: readonly EstadoDoTimer[] = ["preparando", "atraso", "apito"];

/** O Standby no modo vídeo abre o enquadrar (de onde estiver fechada); já aberta, fica como está. */
export const abrirTelaCheia = (f: FaseDaTelaCheia): FaseDaTelaCheia => (f === "fechada" ? "enquadrar" : f);

/** Começar só vale no enquadrar. */
export const comecarNaTelaCheia = (f: FaseDaTelaCheia): FaseDaTelaCheia => (f === "enquadrar" ? "iniciando" : f);

/** Sair só vale no enquadrar (depois do Começar, quem sai é o Timer: cancelar ou parar). */
export const sairDaTelaCheia = (f: FaseDaTelaCheia): FaseDaTelaCheia => (f === "enquadrar" ? "fechada" : f);

/**
 * O Timer mudou de estado: o passo segue o Timer depois do Começar. Em "iniciando", um "parado" ainda é o de antes do Standby (espera); qualquer outro
 * fim (resultado, erro, ou parado depois de já ter começado, que é o cancelar) fecha e volta à aba, onde estão a Revisão ou o aviso de erro.
 */
export function faseAposTimer(f: FaseDaTelaCheia, estado: EstadoDoTimer): FaseDaTelaCheia {
  if (f === "fechada" || f === "enquadrar") return f;
  if (ANTES_DO_APITO.includes(estado)) return "antes";
  if (estado === "escutando") return "correndo";
  return f === "iniciando" && estado === "parado" ? f : "fechada";
}

/** O que o botão do alto faz; nulo onde ele não aparece (fechada ou enquadrar, que têm Começar e Sair). */
export function acaoDoBotao(f: FaseDaTelaCheia): AcaoDoBotao | null {
  if (f === "correndo") return "segurar";
  return f === "iniciando" || f === "antes" ? "cancelar" : null;
}

/** O que o Voltar do Android faz; nulo com a tela fechada (aí ele segue o comportamento normal). */
export function acaoDoVoltar(f: FaseDaTelaCheia): AcaoDoVoltar | null {
  if (f === "fechada") return null;
  if (f === "enquadrar") return "sair";
  return f === "correndo" ? "dica" : "cancelar";
}
