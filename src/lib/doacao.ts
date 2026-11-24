// A doação ao desenvolvedor (Ajustes). O app é gratuito e NÃO tem a permissão INTERNET no release: um link dentro da WebView não carregaria. No Android a
// página abre no NAVEGADOR do sistema pela ponte nativa `NkDoacao` (PonteDoacao.kt), que guarda a URL no código nativo (o JavaScript não passa endereço).
// Fora do Android (Chrome, testes) cai para `window.open`. O endereço abaixo é o MESMO do Kotlin: um teste confere os parâmetros.

/** A página de doação do PayPal (BRL, doação única ou recorrente à escolha de quem doa). */
export const URL_DA_DOACAO = "https://www.paypal.com/donate?business=ZTYE426U4GSXN&no_recurring=0&currency_code=BRL";

type PonteDeDoacao = { abrir(): boolean };

/** Abre a página de doação fora do app. Devolve false se não deu para abrir (aparelho sem navegador, janela bloqueada). */
export function abrirDoacao(): boolean {
  const ponte = (globalThis as { NkDoacao?: PonteDeDoacao }).NkDoacao;
  if (ponte) return ponte.abrir();
  return typeof window !== "undefined" && window.open(URL_DA_DOACAO, "_blank", "noopener,noreferrer") !== null;
}
