// O instantâneo do Timer e o aviso de que ele mudou (a tela guarda cópias no `$state`).
import type { Instantaneo } from "./timerTipos";

export const instantaneoVazio = (): Instantaneo => ({ estado: "parado", erro: null, atrasoMs: null, disparosMs: [], inicio: null, avisoDeFone: false, resultado: null });

export class Painel {
  atual: Instantaneo = instantaneoVazio();

  constructor(private readonly aoMudar: (i: Instantaneo) => void) {}

  mudar(p: Partial<Instantaneo>): void {
    this.atual = { ...this.atual, ...p };
    this.aoMudar(this.atual);
  }

  /** Esquece a tentativa anterior e já mostra `p` (uma única notificação). Sem `p`, volta a parado. */
  recomecar(p: Partial<Instantaneo> = {}): void {
    this.atual = { ...instantaneoVazio(), ...p };
    this.aoMudar(this.atual);
  }
}
