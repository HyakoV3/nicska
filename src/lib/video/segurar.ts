// "Segure para parar" (V2b): com a tentativa correndo na tela cheia, o botão do alto só para depois de ~1 s pressionado. Um toque acidental (a mão no tripé, o
// celular no bolso de quem filma) não pode encerrar a tentativa no meio. O progresso sobe em passos fixos (sem depender de animação, então vale igual com
// "menos movimento" e nos testes com relógio falso); soltar antes do fim zera e diz que foi cedo (a tela mostra a dica).

/** Quanto é preciso segurar para parar (ms). */
export const SEGURAR_MS = 1000;
/** De quanto em quanto o progresso sobe (ms). */
export const PASSO_DO_SEGURAR_MS = 50;

export class Segurar {
  /** De 0 a 1: quanto do tempo já foi segurado. */
  progresso = 0;
  /** Chamado a cada passo (e ao zerar), com o progresso. */
  aoMudar: ((progresso: number) => void) | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private seguradoMs = 0;

  constructor(
    private readonly aoCompletar: () => void,
    private readonly duracaoMs = SEGURAR_MS,
  ) {}

  get segurando(): boolean {
    return this.relogio !== null;
  }

  /** O dedo (ou a tecla) desceu. Já segurando, nada (a tecla repete o evento enquanto fica apertada). */
  comecar(): void {
    if (this.relogio !== null) return;
    this.seguradoMs = 0;
    this.relogio = setInterval(() => this.passo(), PASSO_DO_SEGURAR_MS);
  }

  /** O dedo subiu, saiu do botão ou o toque foi cancelado. Devolve `true` se foi cedo demais (estava segurando e não completou). */
  soltar(): boolean {
    if (this.relogio === null) return false;
    this.parar();
    return true;
  }

  private passo(): void {
    this.seguradoMs += PASSO_DO_SEGURAR_MS;
    this.progresso = Math.min(1, this.seguradoMs / this.duracaoMs);
    this.aoMudar?.(this.progresso);
    if (this.progresso < 1) return;
    this.parar();
    this.aoCompletar();
  }

  /** Para o relógio e zera o progresso (também ao desmontar a tela). */
  parar(): void {
    if (this.relogio !== null) clearInterval(this.relogio);
    this.relogio = null;
    this.seguradoMs = 0;
    this.progresso = 0;
    this.aoMudar?.(0);
  }
}
