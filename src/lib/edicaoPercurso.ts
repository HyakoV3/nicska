// A edição de um percurso (Histórico): do que a pessoa digitou ao `Percurso` que se grava. Sem interface.
import type { Percurso } from "./documento";

export type CamposDoPercurso = { nome: string; disparos: string; pontos: string; divisao: string };

export const camposDe = (p: Percurso): CamposDoPercurso => ({ nome: p.nome, disparos: p.disparos_minimos?.toString() ?? "", pontos: p.pontos_maximos?.toString() ?? "", divisao: p.divisao ?? "" });

/** Um inteiro de 1 a `max` ou undefined (campo vazio ou fora da faixa: o dado opcional some). */
const inteiro = (v: string, max: number): number | undefined => (v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max ? Number(v) : undefined);

/** `{ [chave]: valor }` só quando o valor é "verdadeiro" (campo opcional preenchido). */
const se = <K extends keyof Percurso>(chave: K, valor: Percurso[K] | undefined | null | "" | 0) => (valor ? { [chave]: valor } : {});

/** O percurso com os campos editados (mesmo `id` e `criado_em`); null se o nome está vazio. */
export function percursoEditado(base: Percurso, c: CamposDoPercurso): Percurso | null {
  if (!c.nome.trim()) return null;
  const extras: Partial<Percurso> = {
    ...se("disparos_minimos", inteiro(c.disparos, 500)),
    ...se("pontos_maximos", inteiro(c.pontos, 100000)),
    ...se("divisao", c.divisao),
  };
  return { id: base.id, nome: c.nome.trim().slice(0, 80), ...extras, criado_em: base.criado_em };
}
