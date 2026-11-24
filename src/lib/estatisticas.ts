// As contas dos gráficos e da comparação de sessões (Etapa 6). Funções puras sobre as tentativas guardadas; tudo em ms.
import type { TentativaGuardada } from "./documento";
import { resumir } from "./tentativa";

export const media = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Desvio-padrão amostral (n − 1): com uma amostra só, ou nenhuma, não há dispersão a medir (null). */
export function desvioPadrao(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = media(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export type Medidas = { n: number; media: number | null; mediana: number | null; desvio: number | null; melhor: number | null };

/** Média, mediana, desvio e melhor (menor) valor. */
export function medidas(xs: readonly number[]): Medidas {
  return { n: xs.length, media: media(xs), mediana: mediana(xs), desvio: desvioPadrao(xs), melhor: xs.length ? Math.min(...xs) : null };
}

export type ResumoDaSessao = {
  dia: string;
  /** Tentativas com pelo menos um disparo (as sem disparos não entram nas contas). */
  tentativas: number;
  total: Medidas;
  primeiro: Medidas;
  /** Todos os splits da sessão juntos (a consistência do ritmo). */
  splits: Medidas;
};

/** As medidas de uma sessão: total (último disparo), 1º disparo e todos os splits. */
export function resumoDaSessao(dia: string, tentativas: readonly TentativaGuardada[]): ResumoDaSessao {
  const validas = tentativas.filter((t) => t.disparos_ms.length > 0);
  const resumos = validas.map((t) => resumir(t.disparos_ms));
  return {
    dia,
    tentativas: validas.length,
    total: medidas(resumos.map((r) => r.total!)),
    primeiro: medidas(resumos.map((r) => r.primeiro!)),
    splits: medidas(resumos.flatMap((r) => r.splits)),
  };
}

// Histograma, escala e distribuição de séries moram em `distribuicoes.ts`; reexportados aqui para os importadores de sempre.
export * from "./distribuicoes";
