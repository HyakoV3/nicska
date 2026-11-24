// Os colaboradores do Timer (temporizadores, fase de escuta, instantâneo), montados em um lugar só: o Timer depende deles, não os instancia.
import { Agenda } from "./timerAgenda";
import { FaseDeEscuta } from "./timerFase";
import { Painel } from "./timerPainel";
import type { Dependencias, Instantaneo } from "./timerTipos";

export type Colaboradores = { agenda: Agenda; fase: FaseDeEscuta; painel: Painel };

/** `notificar`: chamado a cada mudança do instantâneo. */
export function criarColaboradores(d: Dependencias, notificar: (i: Instantaneo) => void): Colaboradores {
  return { agenda: new Agenda(d.em), fase: new FaseDeEscuta(), painel: new Painel(notificar) };
}
