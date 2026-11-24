// A linha do ranking de UM atirador: as contas sobre as tentativas dele e os motivos de dúvida (CONS-025). Parte de `ranking.ts`.
import type { Atirador, TentativaGuardada } from "./documento";
import { media } from "./estatisticas";
import type { Linha } from "./ranking";
import { hitFactor, pontuar } from "./tentativa";

/** O tempo total de uma tentativa (último disparo), ou null sem disparos. */
export const totalMs = (t: Pick<TentativaGuardada, "disparos_ms">): number | null => (t.disparos_ms.length ? t.disparos_ms[t.disparos_ms.length - 1] : null);

const hfDe = (t: TentativaGuardada): number | null => (t.pontos ? hitFactor(pontuar(t.pontos), totalMs(t)) : null);
const pouco = (t: TentativaGuardada) => t.inicio === "estimado" || t.incompleta === true || t.editada.apagados + t.editada.inseridos > 0;
const faltando = (t: TentativaGuardada, minimos?: number) => minimos !== undefined && t.disparos_ms.length < minimos;

export function linhaDe(ts: readonly TentativaGuardada[], quem: { atirador: Atirador; eu: boolean; minimos?: number }): Linha {
  const { atirador, eu, minimos } = quem;
  const totais = ts.map((t) => totalMs(t)!);
  const hfs = ts.map(hfDe).filter((x): x is number => x !== null);
  const motivos = { firmeza: ts.filter(pouco).length, faltando: ts.filter((t) => faltando(t, minimos)).length };
  const duvidosas = ts.filter((t) => pouco(t) || faltando(t, minimos)).length;
  return { atirador, eu, tentativas: ts.length, pontuadas: hfs.length, melhorMs: Math.min(...totais), mediaMs: media(totais), melhorHf: hfs.length ? Math.max(...hfs) : null, mediaHf: media(hfs), duvidosas, motivos, posicao: 0 };
}
