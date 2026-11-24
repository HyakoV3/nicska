// A fase de escuta de uma tentativa: o instante zero (o apito), a janela onde um tom ainda vale como apito e os disparos que chegaram antes de se conhecer o zero.
// Não conhece relógio nem escuta: recebe o estado do Timer e o tempo do evento (s, no relógio do áudio) e diz o que fazer.
import { ESPERA_DO_APITO_MS, FOLGA_ANTES_DO_APITO_S, type EstadoDoTimer } from "./timerTipos";

/** O que o Timer deve fazer com um evento da escuta (nada, quando a fase o ignora). */
export type Acao = { acao: "reabrir" } | { acao: "comecar"; tempo: number } | { acao: "disparo"; ms: number } | null;
type Evento = { tipo: "apito" | "disparo"; tempo: number };

export class FaseDeEscuta {
  /** O zero da tentativa (s no relógio do áudio); nulo até o apito ser ouvido ou estimado. */
  zero: number | null = null;
  /** O instante em que o apito sai (agendado + latência de saída), s. */
  estimado: number | null = null;
  private janela: { ini: number; fim: number } | null = null;
  private pendentes: number[] = []; // disparos (s) antes de se conhecer o zero

  reiniciar(): void {
    this.zero = null;
    this.estimado = null;
    this.janela = null;
    this.pendentes = [];
  }

  /** O apito foi agendado: só vale como apito o tom que começa perto do instante agendado (antes é outra coisa: voz, o timer da baia vizinha; muito depois, já passou). */
  definirApito(quando: number, atraso: number): void {
    this.estimado = quando + atraso;
    this.janela = { ini: quando - FOLGA_ANTES_DO_APITO_S, fim: this.estimado + ESPERA_DO_APITO_MS / 1000 };
  }

  /** Um tom de apito no instante `tempo`. Em `preparando` (CONS-022) o detector já roda mas o apito ainda nem foi agendado: o tom é de outra coisa e o detector precisa continuar procurando. */
  private apito(tempo: number, estado: EstadoDoTimer): Acao {
    if (estado === "preparando") return { acao: "reabrir" };
    if (this.zero !== null || (estado !== "atraso" && estado !== "apito")) return null;
    const j = this.janela;
    return !j || tempo < j.ini || tempo > j.fim ? { acao: "reabrir" } : { acao: "comecar", tempo };
  }

  /** O que fazer com um evento do detector no estado `estado` do Timer. */
  classificar(e: Evento, estado: EstadoDoTimer): Acao {
    if (e.tipo === "apito") return this.apito(e.tempo, estado);
    const ms = this.disparo(e.tempo, estado);
    return ms === null ? null : { acao: "disparo", ms };
  }

  /** Um disparo no instante `tempo`: devolve os ms desde o zero, ou nulo se não conta (antes do zero, ou o zero ainda é desconhecido e ele fica guardado). */
  private disparo(tempo: number, estado: EstadoDoTimer): number | null {
    if (this.zero === null) {
      if (estado === "atraso" || estado === "apito") this.pendentes.push(tempo); // pode ser tiro de quem já ouviu o apito
      return null;
    }
    if (estado !== "escutando" || tempo < this.zero) return null;
    return Math.round((tempo - this.zero) * 1000);
  }

  /** O apito não foi ouvido a tempo: ainda dá para começar pelo instante estimado? */
  podeEstimar(estado: EstadoDoTimer): boolean {
    return this.zero === null && (estado === "atraso" || estado === "apito");
  }

  /** Fixa o zero e devolve (ms) os disparos guardados que vieram depois dele. */
  comecar(zero: number): number[] {
    this.zero = zero;
    const antes = this.pendentes.filter((t) => t >= zero).map((t) => Math.round((t - zero) * 1000));
    this.pendentes = [];
    return antes;
  }
}
