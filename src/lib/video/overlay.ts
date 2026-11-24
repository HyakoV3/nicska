// O que o overlay da reprodução mostra num instante do vídeo (caminho B de docs/archive/ideia-gravar-video.md: vídeo cru + overlay desenhado por cima). Função
// pura: recebe o tempo do vídeo e os disparos ATUAIS (os da Revisão, já editados) e devolve a fase, o cronômetro, os splits e o resultado. Assim uma
// correção na Revisão muda o overlay no quadro seguinte, sem regravar nada. As contas de splits, total e HF são as de `tentativa.ts`, não outras.
import { hitFactor, pontuar, resumir, type Pontos } from "../tentativa";

/** Quanto tempo (ms) o último disparo fica destacado depois de acontecer. */
export const DESTAQUE_MS = 400;
/** Quanto dura o clarão do apito (ms): curto, só na reprodução (CONS-033). */
export const CLARAO_MS = 250;
/** Quantos splits cabem empilhados acima do total (os mais recentes; os de antes continuam na tabela da Revisão). */
export const SPLITS_VISIVEIS = 5;

/** A opacidade de cada split pela IDADE (0 = o mais recente): os mais antigos esmaecem, o último a caber é quase transparente e o próximo que chegar o tira da lista. */
export function opacidadeDoSplit(idade: number): number {
  return Math.max(0.2, 1 - 0.2 * Math.max(0, idade));
}

/** De quem é a tentativa, para o avatar e o nome do canto inferior esquerdo. */
export type AtiradorDoOverlay = { id: string; nome: string };

/**
 * O que o overlay precisa. `zeroNoVideoS` é o apito já levado ao vídeo (`zeroNoVideoS` de alinhamento.ts, sem prender em 0); `disparosMs` são ms desde o
 * apito, em ordem. O resto é só para desenhar (cabeçalho, avatar) e a função pura ignora.
 */
export type DadosDoOverlay = {
  zeroNoVideoS: number;
  disparosMs: readonly number[];
  pontos?: Pontos | null;
  incompleta?: boolean;
  atirador?: AtiradorDoOverlay | null;
  percurso?: string;
  divisao?: string;
  /** ISO 8601 de quando a tentativa começou. */
  data?: string;
  /**
   * Ao vivo (a tela cheia da gravação, V2b): a tentativa ainda corre, então o último disparo não é o fim (sem resultado, o cronômetro segue), todo disparo
   * já chegou (conta mesmo que o relógio da tela esteja uns ms atrás) e não há clarão (CONS-033: o clarão é só na reprodução).
   */
  aoVivo?: boolean;
};

export type FaseDoOverlay = "antes" | "correndo" | "fim";
/** Um disparo já ocorrido: o número (1 em diante), o split (para o anterior; o 1º é o tempo até ele) e o instante (ms desde o apito). */
export type SplitDoOverlay = { n: number; splitMs: number; instanteMs: number };
export type ResultadoDoOverlay = { totalMs: number; primeiroMs: number; n: number; pontos: number | null; hf: number | null; incompleta: boolean };

export type EstadoDoOverlay = {
  fase: FaseDoOverlay;
  /** ms desde o apito (0 antes dele; no fim, para no total). */
  decorridoMs: number;
  nDisparos: number;
  splits: SplitDoOverlay[];
  /** O número do disparo recém-ocorrido (destaque de `DESTAQUE_MS`), ou nulo. */
  recente: number | null;
  /** Na hora do apito, por `CLARAO_MS`. */
  clarao: boolean;
  /** Só na fase "fim". */
  resultado: ResultadoDoOverlay | null;
};

/** Os ms desde o apito no instante `tempoNoVideoS`; NaN ou infinito vale "antes" (um tempo que não se sabe não pode adiantar o cronômetro). */
function msDesdeOApito(tempoNoVideoS: number, zeroNoVideoS: number): number {
  const ms = (tempoNoVideoS - zeroNoVideoS) * 1000;
  return Number.isFinite(ms) ? ms : -1;
}

/** Os splits dos disparos até `ms` (inclusive: no instante exato do tiro ele já conta), pelos splits do `resumir`. */
function splitsAte(disparosMs: readonly number[], ms: number): SplitDoOverlay[] {
  const { primeiro, splits } = resumir(disparosMs);
  const ocorridos = disparosMs.filter((d) => d <= ms).length;
  return disparosMs.slice(0, ocorridos).map((d, i) => ({ n: i + 1, splitMs: i === 0 ? primeiro! : splits[i - 1], instanteMs: d }));
}

/** O resultado final: total, 1º disparo, quantos, pontos e HF (o mesmo `hitFactor` da Revisão e do Histórico) e o selo de incompleta. */
function resultadoDe(dados: DadosDoOverlay): ResultadoDoOverlay {
  const r = resumir(dados.disparosMs);
  const pontos = dados.pontos ? pontuar(dados.pontos) : null;
  const hf = pontos === null ? null : hitFactor(pontos, r.total);
  return { totalMs: r.total!, primeiroMs: r.primeiro!, n: r.n, pontos, hf, incompleta: dados.incompleta === true };
}

const ANTES: EstadoDoOverlay = { fase: "antes", decorridoMs: 0, nDisparos: 0, splits: [], recente: null, clarao: false, resultado: null };

/** O que mostrar no instante `tempoNoVideoS` (s desde o começo do vídeo). Sem disparos não há fim conhecido: o cronômetro corre, como corria a escuta. */
export function estadoDoOverlay(tempoNoVideoS: number, dados: DadosDoOverlay): EstadoDoOverlay {
  const ms = msDesdeOApito(tempoNoVideoS, dados.zeroNoVideoS);
  if (ms < 0) return { ...ANTES, splits: [] };
  const d = dados.disparosMs;
  const total = d.length ? d[d.length - 1] : null;
  const fim = !dados.aoVivo && total !== null && ms >= total;
  const splits = splitsAte(d, dados.aoVivo ? Number.POSITIVE_INFINITY : ms);
  const ultimo = splits.at(-1);
  return {
    fase: fim ? "fim" : "correndo",
    decorridoMs: fim ? total : ms,
    nDisparos: splits.length,
    splits,
    recente: ultimo && ms - ultimo.instanteMs < DESTAQUE_MS ? ultimo.n : null,
    clarao: !dados.aoVivo && ms < CLARAO_MS,
    resultado: fim ? resultadoDe(dados) : null,
  };
}

/** A data do cabeçalho ("23/11/2026" no pt), no idioma da tela; vazia se a data não se lê. */
export function dataDoCabecalho(iso: string | undefined, idioma: string): string {
  const quando = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(quando)) return "";
  return new Intl.DateTimeFormat(idioma, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(quando));
}
