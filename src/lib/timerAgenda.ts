// Os temporizadores de uma tentativa: o que o Timer agenda (apito, fim do atraso, tempo máximo, silêncio) e cancela de uma vez.
export class Agenda {
  private cancelamentos: (() => void)[] = [];
  private cancelaSilencio: (() => void) | null = null;

  /** `em`: agenda `fn` para daqui a `ms` e devolve o cancelamento (o relógio real, ou um falso nos testes). */
  constructor(private readonly em: (ms: number, fn: () => void) => () => void) {}

  agendar(ms: number, fn: () => void): () => void {
    const cancela = this.em(ms, fn);
    this.cancelamentos.push(cancela);
    return cancela;
  }

  /** O silêncio recomeça a cada disparo: só o último agendamento vale. */
  reiniciarSilencio(ms: number, fn: () => void): void {
    this.cancelaSilencio?.();
    this.cancelaSilencio = this.agendar(ms, fn);
  }

  cancelarTudo(): void {
    for (const c of this.cancelamentos) c();
    this.cancelamentos = [];
    this.cancelaSilencio = null;
  }
}
