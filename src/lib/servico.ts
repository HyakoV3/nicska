// Ponte com o serviço em primeiro plano do Android. Enquanto o timer está **armado** (do toque em "Standby" até o fim da escuta), o serviço segura
// o app vivo, com o microfone aberto e o apito agendado, mesmo com a tela bloqueada ou o app em segundo plano. O lado Android é `ServicoAudio.kt`
// e a ponte `PonteServico.kt`, exposta à WebView como `window.NkServico`. Fora do Android (navegador, computador, testes) a ponte não existe e
// tudo aqui não faz nada.

type Ponte = { armar?(): void; desarmar?(): void; temFone?(): boolean };

const ponte = (): Ponte | null => (globalThis as { NkServico?: Ponte }).NkServico ?? null;

type Globais = { __nkParadoPelaNotificacao?: () => void; __nkServicoFalhou?: () => void };
const globais = () => globalThis as Globais;

/**
 * Arma o serviço. Devolve `true` se o Android o assumiu (aí o app NÃO deve parar de escutar ao sair da tela); fora do Android, ou se a ponte falhar,
 * devolve `false` e o app continua parando ao ir para segundo plano (o navegador tira o microfone da página escondida).
 */
export function armarServico(): boolean {
  try {
    const p = ponte();
    if (!p?.armar) return false;
    p.armar();
    return true;
  } catch (e) {
    console.warn("servico: a ponte do serviço falhou", e);
    return false;
  }
}

/** A tentativa terminou (ou nunca começou): solta o serviço. Sem efeito fora do Android. */
export function desarmarServico(): void {
  try {
    ponte()?.desarmar?.();
  } catch (e) {
    console.warn("servico: a ponte do serviço falhou", e);
  }
}

/** O botão "Parar" da notificação: `quando` deve parar de verdade. Devolve a função que remove o aviso. */
export function aoPararPelaNotificacao(quando: () => void): () => void {
  const g = globais();
  g.__nkParadoPelaNotificacao = quando;
  return () => {
    if (g.__nkParadoPelaNotificacao === quando) delete g.__nkParadoPelaNotificacao;
  };
}

/**
 * O Android recusou ou derrubou o serviço depois de a ponte já ter dito que o assumira: `quando` deve tirar a proteção (e, com o app em segundo
 * plano, parar, porque o microfone se foi). Devolve a função que remove o aviso.
 */
export function aoFalharServico(quando: () => void): () => void {
  const g = globais();
  g.__nkServicoFalhou = quando;
  return () => {
    if (g.__nkServicoFalhou === quando) delete g.__nkServicoFalhou;
  };
}

/**
 * Há um fone de ouvido (com fio, USB ou Bluetooth) ligado? Com ele o apito sai nele e o início da tentativa fica estimado.
 * Fora do Android, ou se a ponte falhar, devolve `false`.
 */
export function foneConectado(): boolean {
  try {
    return ponte()?.temFone?.() === true;
  } catch (e) {
    console.warn("servico: não deu para saber se há fone", e);
    return false;
  }
}
