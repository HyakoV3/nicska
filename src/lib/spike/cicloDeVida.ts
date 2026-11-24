// SPIKE S3, passo 6 (EXPERIMENTAL, descartável): observa o ciclo de vida da página e anexa cada evento à linha do tempo, junto com o estado das trilhas e do gravador.
import { evento } from "./estado.svelte";
import type { Entrada } from "./relatorio";

export type Sonda = () => Entrada;
let sondaAtual: Sonda = () => ({});

/** Quem grava registra aqui como ler o estado das trilhas e do gravador; nulo ao terminar. */
export const definirSonda = (s: Sonda | null): void => void (sondaAtual = s ?? (() => ({})));

function registrar(tipo: string): void {
  evento(tipo, { visibilidade: document.visibilityState, orientacao: screen.orientation?.type ?? null, ...sondaAtual() });
}

const DOCUMENTO = ["visibilitychange", "freeze", "resume"] as const;
const JANELA = ["pagehide", "pageshow", "orientationchange", "blur", "focus"] as const;

/** Começa a observar; devolve como parar. */
export function observarCicloDeVida(): () => void {
  const parar: Array<() => void> = [];
  const ligar = (alvo: EventTarget, nome: string) => {
    const f = () => registrar(nome);
    alvo.addEventListener(nome, f);
    parar.push(() => alvo.removeEventListener(nome, f));
  };
  DOCUMENTO.forEach((n) => ligar(document, n));
  JANELA.forEach((n) => ligar(window, n));
  if (screen.orientation) ligar(screen.orientation, "change");
  registrar("observacao-iniciada");
  return () => parar.forEach((f) => f());
}

/** O estado de uma trilha, para a sonda. */
export const estadoDaTrilha = (t: MediaStreamTrack | null | undefined): Entrada | null =>
  t ? { kind: t.kind, muted: t.muted, enabled: t.enabled, readyState: t.readyState } : null;
