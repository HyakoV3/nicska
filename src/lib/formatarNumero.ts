// Formatador de número com cache: criar um `Intl.NumberFormat` custa caro (o motor lê os dados do idioma), e o overlay ao vivo formata vários textos a cada
// atualização do cronômetro. Um formatador por idioma e número de casas, criado na primeira vez e reaproveitado. Funções puras fora o cache.

const cache = new Map<string, Intl.NumberFormat>();

/** O formatador do `idioma` com `minimo` a `maximo` casas decimais (o mesmo objeto nas próximas chamadas). */
export function formatadorDeNumero(idioma: string, minimo: number, maximo: number = minimo): Intl.NumberFormat {
  const chave = `${idioma}|${minimo}|${maximo}`;
  let f = cache.get(chave);
  if (!f) {
    f = new Intl.NumberFormat(idioma, { minimumFractionDigits: minimo, maximumFractionDigits: maximo });
    cache.set(chave, f);
  }
  return f;
}

/** `v` com exatamente `casas` casas decimais, no separador do idioma. */
export const numeroComCasas = (v: number, casas: number, idioma: string): string => formatadorDeNumero(idioma, casas).format(v);

/** Quantos formatadores o cache guarda (para os testes). */
export const tamanhoDoCacheDeNumeros = (): number => cache.size;
