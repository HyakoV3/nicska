// Os validadores de campo, pequenos e sem estado, que os leitores de documento combinam. Um campo inválido joga `ErroDeDocumento("dados_invalidos")` com
// `detalhe` = `<caminho do campo>: <regra>`: o caminho e a regra são códigos técnicos (não frases em português), iguais em qualquer idioma da interface.
import { ErroDeDocumento, LIMITES } from "./tipos";

export const invalido = (onde: string, regra: string): never => {
  throw new ErroDeDocumento("dados_invalidos", { detalhe: `${onde}: ${regra}` });
};

export type Objeto = Record<string, unknown>;
export const ehObjeto = (x: unknown): x is Objeto => typeof x === "object" && x !== null && !Array.isArray(x);
export const ehInteiro = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
export const ehNumero = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;

/** Um texto de 1 a `max` caracteres (já sem os espaços das pontas). */
export function texto(x: unknown, max: number, onde: string): string {
  if (typeof x !== "string" || x.trim() === "" || x.length > max) invalido(onde, `texto_1_a_${max}`);
  return (x as string).trim();
}

export const textoOpcional = (x: unknown, max: number, onde: string): string | undefined => (x === undefined || x === null ? undefined : texto(x, max, onde));

export const inteiroEm = (x: unknown, min: number, max: number, onde: string): number => (ehInteiro(x, min, max) ? x : invalido(onde, `inteiro_${min}_a_${max}`));

/** Uma lista com no máximo `max` itens. */
export const listaAte = (x: unknown, max: number, onde: string): unknown[] => (Array.isArray(x) && x.length <= max ? x : invalido(onde, `lista_ate_${max}`));

/** Os `id` de `itens` não se repetem. */
export function semRepetidos(itens: readonly { id: string }[], onde: string): void {
  if (new Set(itens.map((i) => i.id)).size !== itens.length) invalido(onde, "id_repetido");
}

/** Mede o texto em BYTES (UTF-8): é o que o arquivo ocupa e o que o Android lê. */
export const bytesDoTexto = (t: string): number => new TextEncoder().encode(t).length;

/** A data ISO 8601 (`AAAA-MM-DDThh:mm...`) existe no calendário? `Date.parse` aceita 31/02 e o empurra para março; aqui se confere o dia escrito. */
export function dataIsoExiste(data: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(data);
  if (!m || !Number.isFinite(Date.parse(data))) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export const textoDoId = (x: unknown, onde: string): string => texto(x, LIMITES.id, onde);
