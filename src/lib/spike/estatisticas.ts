// SPIKE S1 (EXPERIMENTAL, descartável): contas puras do relatório (intervalos entre estalos, bytes por segundo, fps, seek, deriva do relógio).

const arredondar = (n: number, casas = 2): number => Math.round(n * 10 ** casas) / 10 ** casas;

/** Números não finitos (Infinity do `video.duration`) não sobrevivem ao JSON: viram texto. */
export const numeroOuTexto = (n: number): number | string => (Number.isFinite(n) ? n : String(n));

/** Intervalos (ms) entre estalos consecutivos; `tempos` em segundos. Não depende de onde a gravação começou. */
export function intervalosEntreEstalos(tempos: number[]): number[] {
  const saida: number[] = [];
  for (let i = 1; i < tempos.length; i++) saida.push(arredondar((tempos[i]! - tempos[i - 1]!) * 1000));
  return saida;
}

/** Diferença (ms, `b` menos `a`) entre os intervalos de duas execuções, na mesma ordem; nulo se o número de estalos difere (não dá para parear). */
export function diferencaDeIntervalos(a: number[], b: number[]): number[] | null {
  if (a.length === 0 || a.length !== b.length) return null;
  return a.map((x, i) => arredondar(b[i]! - x));
}

/** Bytes gravados por segundo; 0 se a duração não é positiva. */
export function bytesPorSegundo(bytes: number, segundos: number): number {
  return segundos > 0 ? Math.round(bytes / segundos) : 0;
}

/** Quanto o tamanho real é do esperado pelo bitrate (1 = igual): `bits` em bits por segundo. */
export function razaoDoEsperado(bytes: number, segundos: number, bits: number): number {
  const esperado = (bits / 8) * segundos;
  return esperado > 0 ? arredondar(bytes / esperado) : 0;
}

export type ResumoFps = { quadros: number; fpsMedio: number; intervaloMedianoMs: number; maiorIntervaloMs: number; atrasados: number; percentualAtrasados: number };

const mediana = (xs: number[]): number => {
  const o = [...xs].sort((a, b) => a - b);
  return o.length ? o[Math.floor(o.length / 2)]! : 0;
};

/** Resume os instantes (ms, do `requestVideoFrameCallback`) em que cada quadro foi apresentado. "Atrasado": intervalo acima de 1,5 vez a mediana. */
export function resumirFps(instantesMs: number[]): ResumoFps {
  const iv = instantesMs.slice(1).map((t, i) => t - instantesMs[i]!);
  const med = mediana(iv);
  const total = iv.reduce((s, x) => s + x, 0);
  const atrasados = med > 0 ? iv.filter((x) => x > med * 1.5).length : 0;
  return {
    quadros: instantesMs.length,
    fpsMedio: total > 0 ? arredondar((iv.length / total) * 1000) : 0,
    intervaloMedianoMs: arredondar(med),
    maiorIntervaloMs: arredondar(Math.max(0, ...iv)),
    atrasados,
    percentualAtrasados: iv.length ? arredondar((atrasados / iv.length) * 100) : 0,
  };
}

/** Os três pontos do teste de seek (1/3, 1/2, 2/3 da duração), em segundos. */
export const alvosDeSeek = (duracao: number): number[] => [duracao / 3, duracao / 2, (duracao * 2) / 3].map((x) => arredondar(x, 3));

/** Erro do seek em ms: positivo se o vídeo parou depois do alvo. */
export const erroDeSeek = (alvo: number, atual: number): number => arredondar((atual - alvo) * 1000);

/** Percentual de quadros descartados (0 se não há quadros). */
export const percentualDescartado = (descartados: number, total: number): number => (total > 0 ? arredondar((descartados / total) * 100, 3) : 0);

export type AmostraDeRelogio = { perfMs: number; ctxS: number };
export type Deriva = { derivaMaximaMs: number; maiorSaltoMs: number };

/** Compara o relógio do `AudioContext` com o `performance.now()`: se o áudio travou ou o contexto parou, o desvio cresce de uma amostra para a outra. */
export function derivaDoRelogio(amostras: AmostraDeRelogio[]): Deriva {
  if (amostras.length < 2) return { derivaMaximaMs: 0, maiorSaltoMs: 0 };
  const a0 = amostras[0]!;
  const desvios = amostras.map((a) => (a.ctxS - a0.ctxS) * 1000 - (a.perfMs - a0.perfMs));
  const saltos = desvios.slice(1).map((d, i) => Math.abs(d - desvios[i]!));
  return { derivaMaximaMs: arredondar(Math.max(...desvios.map(Math.abs))), maiorSaltoMs: arredondar(Math.max(...saltos)) };
}
