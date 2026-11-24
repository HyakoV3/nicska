// O que se tira dos instantes dos disparos (ms desde o apito): 1º disparo, splits, total e hit factor. Só os instantes são guardados; o resto é derivado
// (docs/FORMATO.md). Funções puras.

export type Resumo = {
  /** Quantos disparos. */
  n: number;
  /** Tempo do 1º disparo (ms), ou null sem disparos. */
  primeiro: number | null;
  /** Tempo entre cada disparo e o anterior (ms): n − 1 valores. */
  splits: number[];
  /** Maior split (ms), ou null com menos de 2 disparos. */
  maiorSplit: number | null;
  /** Menor split (ms), ou null com menos de 2 disparos. */
  menorSplit: number | null;
  /** Tempo do último disparo (ms), o total da tentativa; null sem disparos. */
  total: number | null;
};

export function resumir(disparosMs: readonly number[]): Resumo {
  const n = disparosMs.length;
  const splits: number[] = [];
  for (let i = 1; i < n; i++) splits.push(disparosMs[i] - disparosMs[i - 1]);
  return {
    n,
    primeiro: n > 0 ? disparosMs[0] : null,
    splits,
    maiorSplit: splits.length ? Math.max(...splits) : null,
    menorSplit: splits.length ? Math.min(...splits) : null,
    total: n > 0 ? disparosMs[n - 1] : null,
  };
}

/** Pontos de uma tentativa: A, C, D, M, NS e procedimentais, com o fator minor ou major. Miss, no-shoot e procedimental valem −10 cada. */
export type Pontos = { A: number; C: number; D: number; M: number; NS: number; procedimentais: number; fator: "minor" | "major" };

export function pontuar(p: Pontos): number {
  const c = p.fator === "major" ? 4 : 3;
  const d = p.fator === "major" ? 2 : 1;
  return 5 * p.A + c * p.C + d * p.D - 10 * (p.M + p.NS + p.procedimentais);
}

/**
 * Hit factor = pontos ÷ tempo (s), com o tempo ARREDONDADO a centésimos de segundo (half up): o mesmo valor que a tela mostra, para o resultado fechar com a conta
 * manual (28 pontos em 2,704 s: tempo 2,70 e HF 10,3704, não 10,3550). Decisão D6; confirmado: IPSC Handgun Rules 2026, 9.2.1.1 e 9.7.1 (tempo com 2 casas; HF com 4, CBTP Art.13 III). O regulamento NÃO diz se o tempo cronometrado é
 * arredondado ou truncado: o half up é convenção do app.
 * Sem tempo ou com pontos negativos, vale 0 (pontos nunca ficam abaixo de zero na pista). O HF é sempre derivado, nunca guardado (docs/FORMATO.md).
 */
export function hitFactor(pontos: number, totalMs: number | null): number | null {
  if (totalMs === null) return null;
  const centesimos = Math.round(totalMs / 10);
  if (!(centesimos > 0)) return null;
  return Math.max(0, pontos) / (centesimos / 100);
}

/** "1,48" (segundos com duas casas, separador do idioma). Valor inválido ou negativo vale "0,00". */
export function formatarSegundos(ms: number, idioma: string): string {
  const v = Number.isFinite(ms) && ms > 0 ? ms / 1000 : 0;
  return new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
