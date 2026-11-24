// Faixas (histograma), escala de eixo e distribuição de séries para os gráficos. Funções puras; tudo em ms. Parte de `estatisticas.ts`.

export type Faixa = { iniMs: number; fimMs: number; n: number };

const LARGURAS_MS = [10, 20, 25, 50, 100, 200, 500, 1000];

/** Distribuição dos valores em faixas de largura redonda (a menor que dê até `maximo` faixas). Vazio sem valores. */
export function histograma(valores: readonly number[], maximo = 12): Faixa[] {
  if (!valores.length) return [];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const largura = LARGURAS_MS.find((l) => Math.floor(max / l) - Math.floor(min / l) + 1 <= maximo) ?? LARGURAS_MS.at(-1)!;
  const ini = Math.floor(min / largura) * largura;
  const faixas: Faixa[] = [];
  for (let a = ini; a <= max; a += largura) faixas.push({ iniMs: a, fimMs: a + largura, n: 0 });
  for (const v of valores) faixas[Math.min(faixas.length - 1, Math.floor((v - ini) / largura))].n++;
  return faixas;
}

/** Escala "bonita" para um eixo: do mínimo ao máximo arredondados e os marcadores entre eles (3 a 6). */
const MARCAS_ALVO = 4;
export function escala(min: number, max: number): { min: number; max: number; marcas: number[] } {
  if (!(max > min)) {
    const c = Number.isFinite(min) ? min : 0;
    return { min: Math.max(0, c - 500), max: c + 500, marcas: [Math.max(0, c - 500), c, c + 500] };
  }
  const bruto = (max - min) / MARCAS_ALVO;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? 10 * pot;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = ini; v <= fim + passo / 1000; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
  return { min: ini, max: fim, marcas };
}

/** A distribuição de várias séries (uma por sessão) nas MESMAS faixas, em % de cada série, para compará-las no mesmo gráfico. */
export function distribuicao(series: readonly (readonly number[])[], maximo = 12): { faixas: { iniMs: number; fimMs: number }[]; porcentagens: number[][] } {
  const base = histograma(series.flat(), maximo);
  if (!base.length) return { faixas: [], porcentagens: series.map(() => []) };
  const largura = base[0].fimMs - base[0].iniMs;
  const ini = base[0].iniMs;
  const porcentagens = series.map((vs) => {
    const contagem = base.map(() => 0);
    for (const v of vs) contagem[Math.min(base.length - 1, Math.floor((v - ini) / largura))]++;
    return contagem.map((n) => (vs.length ? (n / vs.length) * 100 : 0));
  });
  return { faixas: base.map(({ iniMs, fimMs }) => ({ iniMs, fimMs })), porcentagens };
}
