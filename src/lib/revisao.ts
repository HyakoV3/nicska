// Revisão de uma tentativa: apagar ou inserir disparos, reprocessar o áudio guardado com outros ajustes e desenhar o envelope. Funções puras
// (a decodificação do áudio, que precisa do navegador, fica em `revisaoAudio.ts`). Os instantes são ms desde o apito.
import { analisar, type JanelaDoApito, type OpcoesDetector } from "./detector";
import { FOLGA_ANTES_DO_APITO_S } from "./timerTipos";

/** Os disparos de uma tentativa em revisão e o que a pessoa mudou à mão (vai para `editada` no JSON). */
export type Edicao = { disparosMs: number[]; apagados: number; inseridos: number };

export const edicaoDe = (disparosMs: readonly number[]): Edicao => ({ disparosMs: [...disparosMs], apagados: 0, inseridos: 0 });

export const foiEditada = (e: Edicao): boolean => e.apagados > 0 || e.inseridos > 0;

/** Dois disparos mais perto que isto (ms) são o mesmo para quem insere: o toque não cria um duplicado ao lado de outro. */
export const DISTANCIA_MINIMA_MS = 20;

/** Tira o disparo `indice`. Índice inválido não muda nada. */
export function apagarDisparo(e: Edicao, indice: number): Edicao {
  if (!Number.isInteger(indice) || indice < 0 || indice >= e.disparosMs.length) return e;
  return { ...e, disparosMs: e.disparosMs.filter((_, i) => i !== indice), apagados: e.apagados + 1 };
}

/** Põe um disparo em `ms` (arredondado), mantendo a ordem. Antes do apito, negativo ou colado a outro (< 20 ms), não insere. */
export function inserirDisparo(e: Edicao, ms: number): Edicao {
  if (!Number.isFinite(ms)) return e;
  const v = Math.round(ms);
  if (v < 0 || e.disparosMs.some((d) => Math.abs(d - v) < DISTANCIA_MINIMA_MS)) return e;
  const disparosMs = [...e.disparosMs, v].sort((a, b) => a - b);
  return { ...e, disparosMs, inseridos: e.inseridos + 1 };
}

export type Reprocessado = {
  /** `detectado` se o apito foi ouvido no áudio; senão usa `zeroEstimadoS`. */
  inicio: "detectado" | "estimado";
  /** O instante zero no áudio (s desde o começo dele). */
  zeroS: number;
  disparosMs: number[];
};

/** O áudio guardado já decodificado: amostras mono e a taxa (Hz) delas. */
export type AudioDecodificado = { amostras: ArrayLike<number>; taxa: number };

/**
 * O que o `reprocessar` recebe. `opcoes` são os ajustes do detector (sensibilidade, tempo morto...); `zeroEstimadoS` é o zero da escuta na linha do
 * tempo do áudio, usado quando o apito não é ouvido. Objeto de opções para que ajustes novos (ex.: janela do apito, modo fone) entrem sem mudar a assinatura.
 */
export type OpcoesReprocesso = {
  opcoes?: Partial<OpcoesDetector>;
  zeroEstimadoS: number | null;
  /** Como a tentativa original começou (`inicio` do resultado). Sem ele, o reprocesso é a análise pura, sem janela nem modo fone. */
  inicioOriginal?: "detectado" | "estimado";
};

/**
 * A janela do apito e o modo fone do ao vivo, reconstruídos do que a tentativa guarda (CONS-024). Limitação: o formato não guarda o instante agendado
 * do apito nem se havia fone, só o zero (`zeroEstimadoS`, que vale o apito ouvido se `detectado`) e o `inicio`. Então:
 * - `estimado`: o apito não foi usado (fone, ou não ouvido na janela): `esperarApito: false`, o zero fica o da escuta, como ao vivo (não distingue fone de "não ouvido");
 * - `detectado`: só vale um tom que começa a ±`FOLGA_ANTES_DO_APITO_S` do zero original (o ao vivo aceitava de `agendado - folga` até `estimado + 1,5 s`; o instante agendado é desconhecido).
 */
export function opcoesDoAoVivo({ opcoes = {}, zeroEstimadoS, inicioOriginal }: OpcoesReprocesso): { opcoes: Partial<OpcoesDetector>; janela?: JanelaDoApito } {
  if (inicioOriginal === "estimado") return { opcoes: { ...opcoes, esperarApito: false } };
  if (inicioOriginal === "detectado" && zeroEstimadoS !== null) return { opcoes, janela: { iniS: zeroEstimadoS - FOLGA_ANTES_DO_APITO_S, fimS: zeroEstimadoS + FOLGA_ANTES_DO_APITO_S } };
  return { opcoes };
}

/**
 * Roda o detector de novo sobre o áudio guardado, com outros ajustes. A mesma `analisar` da escuta ao vivo, com a janela do apito e o modo fone dela quando se sabe o `inicioOriginal`
 * (ver `opcoesDoAoVivo`): com os mesmos ajustes e o mesmo áudio dá o mesmo resultado. Sem apito ouvido no áudio, o zero é `zeroEstimadoS` (o da escuta, convertido para a linha do tempo do áudio); sem
 * ele também, devolve null.
 */
export function reprocessar(audio: AudioDecodificado, o: OpcoesReprocesso): Reprocessado | null {
  const { amostras, taxa } = audio;
  const { zeroEstimadoS } = o;
  const { opcoes, janela } = opcoesDoAoVivo(o);
  const r = analisar(amostras, taxa, opcoes, janela);
  const zeroS = r.apito !== null ? r.apito / taxa : zeroEstimadoS;
  if (zeroS === null) return null;
  const disparosMs = r.disparos.map((a) => Math.round((a / taxa - zeroS) * 1000)).filter((ms) => ms >= 0);
  return { inicio: r.apito !== null ? "detectado" : "estimado", zeroS, disparosMs };
}

/** O pico absoluto das amostras em `[ini, fim)`. */
function pico(amostras: ArrayLike<number>, { ini, fim }: { ini: number; fim: number }): number {
  let m = 0;
  for (let i = ini; i < fim; i++) m = Math.max(m, Math.abs(amostras[i]));
  return m;
}

/** O envelope para a tela: o pico absoluto de cada fatia de `1000 / pontosPorSegundo` ms. */
export function envelopeParaTela({ amostras, taxa }: AudioDecodificado, pontosPorSegundo = 200): Float32Array {
  const fatia = Math.max(1, Math.round(taxa / pontosPorSegundo));
  const out = new Float32Array(Math.ceil(amostras.length / fatia));
  for (let p = 0; p < out.length; p++) out[p] = pico(amostras, { ini: p * fatia, fim: Math.min(amostras.length, (p + 1) * fatia) });
  return out;
}

/** O máximo de pontos do envelope que a linha do tempo desenha (a figura tem 1000 unidades de largura: mais que isso é traço invisível). */
export const PONTOS_MAXIMOS_DA_LINHA = 1000;

/**
 * Os índices `[ini, fim)` do envelope decimados em no máximo `maximo` pontos: cada ponto é o PICO do grupo (o contorno visual não perde um tiro).
 * Devolve `{ indice, pico }` por grupo, onde `indice` é o do primeiro ponto do grupo (para posicionar). Com até `maximo` pontos, devolve todos como estão.
 */
export function decimarEnvelope(envelope: ArrayLike<number>, ini: number, fim: number, maximo = PONTOS_MAXIMOS_DA_LINHA): { indice: number; pico: number }[] {
  const a = Math.max(0, ini);
  const b = Math.min(envelope.length, fim);
  const n = b - a;
  if (n <= 0) return [];
  const grupo = Math.max(1, Math.ceil(n / Math.max(1, maximo)));
  const out: { indice: number; pico: number }[] = [];
  for (let i = a; i < b; i += grupo) {
    let m = 0;
    for (let k = i; k < Math.min(b, i + grupo); k++) m = Math.max(m, envelope[k]);
    out.push({ indice: i, pico: m });
  }
  return out;
}

/** A janela da linha do tempo, em ms desde o apito: de 0,5 s antes dele até 1,5 s depois do último disparo (ou 3 s se não há disparos). */
export function janelaDaLinha(disparosMs: readonly number[], duracaoMs: number): { iniMs: number; fimMs: number } {
  const ultimo = disparosMs.length ? disparosMs[disparosMs.length - 1] : 1500;
  return { iniMs: -500, fimMs: Math.max(1000, Math.min(duracaoMs, ultimo + 1500)) };
}

/** Posição (0 a 1) de um instante na janela. */
export const posicaoNaLinha = (ms: number, j: { iniMs: number; fimMs: number }): number => (ms - j.iniMs) / (j.fimMs - j.iniMs);

/** O instante (ms) de uma posição (0 a 1) da linha, limitada à janela. */
export const instanteNaLinha = (pos: number, j: { iniMs: number; fimMs: number }): number => Math.round(j.iniMs + Math.min(1, Math.max(0, pos)) * (j.fimMs - j.iniMs));

/** O disparo mais perto de `ms` dentro de `toleranciaMs`, ou -1 (em empate de distância vale o último). */
export function disparoPerto(disparosMs: readonly number[], alvo: { ms: number; toleranciaMs: number }): number {
  const dentro = disparosMs.map((d, i) => ({ i, x: Math.abs(d - alvo.ms) })).filter((o) => o.x <= alvo.toleranciaMs);
  return dentro.reduce((m, o) => (o.x <= m.x ? o : m), { i: -1, x: Infinity }).i;
}

/** A taxa (Hz) em que o áudio guardado é decodificado para a revisão: a mesma em que a escuta costuma rodar. */
export const TAXA_DA_REVISAO = 48000;
