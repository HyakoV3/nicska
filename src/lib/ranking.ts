// O ranking local de um percurso (Etapa 9, docs/archive/roadmap-desenvolvimento.md seção 7): funções puras sobre as tentativas guardadas, minhas e de quem foi importado.
// Tempo puro só compara quando todo acerto vale igual; com pontuação em todos, o critério é o hit factor. Quem tem início "estimado", tentativa editada ou menos disparos que o mínimo do percurso (CONS-025) é marcado,
// porque o JSON é texto e não prova nada (seção 7, "Confiança"): o ranking é entre amigos ou clube.
import type { Atirador, TentativaGuardada } from "./documento";
import { linhaDe, totalMs } from "./rankingLinha";

export type Criterio = "hf" | "tempo";

export type Linha = {
  atirador: Atirador;
  /** É a pessoa deste aparelho. */
  eu: boolean;
  /** Tentativas com pelo menos um disparo. */
  tentativas: number;
  /** Dessas, as que têm pontuação (só elas entram em `melhorHf` e `mediaHf`). */
  pontuadas: number;
  melhorMs: number | null;
  mediaMs: number | null;
  melhorHf: number | null;
  mediaHf: number | null;
  /** Tentativas duvidosas (qualquer motivo, contadas uma vez): o tempo delas é menos firme. */
  duvidosas: number;
  /** Os motivos: início estimado ou editada à mão (`firmeza`) e menos disparos que `disparos_minimos` do percurso (`faltando`). Uma tentativa pode ter os dois. */
  motivos: { firmeza: number; faltando: number };
  posicao: number;
};

export type Ranking = { criterio: Criterio; linhas: Linha[] };

/** Quem está no ranking: `eu` é o atirador do aparelho; `outros` as pessoas importadas. */
export type Pessoas = { eu: Atirador; outros: readonly Atirador[] };
/** `divisao` filtra por divisão do atirador ("" = todas); `disparosMinimos` é o do percurso (sem ele, só início estimado e edição marcam). */
export type Filtro = Pessoas & { divisao?: string; disparosMinimos?: number };

export { totalMs };

const porId = ({ eu, outros }: Pessoas) => new Map<string, Atirador>([...outros.map((a) => [a.id, a] as const), [eu.id, eu]]); // o do aparelho vale por último: o nome atual dele ganha

type Grupos = Map<string, TentativaGuardada[]>;
type PessoasPorId = Map<string, Atirador>;

/** Agrupa as tentativas COM disparo por atirador (sem `atirador_id` = o do aparelho). */
function agrupar(tentativas: readonly TentativaGuardada[], euId: string): Grupos {
  const grupos: Grupos = new Map();
  for (const t of tentativas.filter((x) => x.disparos_ms.length)) {
    const id = t.atirador_id ?? euId;
    grupos.set(id, [...(grupos.get(id) ?? []), t]);
  }
  return grupos;
}

/** Uma linha por atirador do agrupamento, só dos da divisão pedida. */
function linhasDe(grupos: Grupos, filtro: Filtro, pessoas: PessoasPorId): Linha[] {
  const quem = (id: string): Atirador => pessoas.get(id) ?? { id, nome: id.slice(0, 8) };
  const daDivisao = (id: string) => !filtro.divisao || quem(id).divisao === filtro.divisao;
  return [...grupos]
    .filter(([id]) => daDivisao(id))
    .map(([id, ts]) => linhaDe(ts, { atirador: quem(id), eu: id === filtro.eu.id, minimos: filtro.disparosMinimos }));
}

/** Ordena pelo critério e dá a posição (empate = mesma posição). */
function ordenar(linhas: Linha[], criterio: Criterio): void {
  const chave = (l: Linha) => (criterio === "hf" ? -l.melhorHf! : l.melhorMs!);
  linhas.sort((a, b) => chave(a) - chave(b) || a.atirador.nome.localeCompare(b.atirador.nome) || a.atirador.id.localeCompare(b.atirador.id));
  linhas.forEach((l, i) => (l.posicao = i > 0 && chave(l) === chave(linhas[i - 1]) ? linhas[i - 1].posicao : i + 1));
}

/**
 * Ranking de UM percurso. Critério: hit factor se TODOS os atiradores listados têm alguma tentativa pontuada, senão o melhor tempo. Empate = mesma posição.
 * Quem não declarou divisão só entra em "todas".
 */
export function ranking(tentativas: readonly TentativaGuardada[], filtro: Filtro): Ranking {
  const pessoas = porId(filtro);
  const linhas = linhasDe(agrupar(tentativas, filtro.eu.id), filtro, pessoas);
  const criterio: Criterio = linhas.length > 0 && linhas.every((l) => l.melhorHf !== null) ? "hf" : "tempo";
  ordenar(linhas, criterio);
  return { criterio, linhas };
}

/** As divisões declaradas pelos atiradores que têm tentativa no percurso (para o filtro), em ordem alfabética. */
export function divisoesPresentes(tentativas: readonly TentativaGuardada[], pessoas: Pessoas): string[] {
  const por = porId(pessoas);
  const ids = new Set(tentativas.map((t) => t.atirador_id ?? pessoas.eu.id));
  return [...new Set([...ids].map((id) => por.get(id)?.divisao).filter((d): d is string => !!d))].sort();
}
