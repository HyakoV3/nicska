// Os nomes de percurso que a pessoa já digitou (puro): a base das sugestões ao criar um percurso. O app não oferece nome pronto nenhum; aprende com o que ela escreve.
// Só neste aparelho. Casa sem acento, sem maiúsculas e sem espaço repetido, do mais recente ao mais antigo, com os que COMEÇAM pelo digitado antes dos que só o contêm.

export type NomeLembrado = { nome: string; disparos?: number };

/** Quantos nomes se guardam (os mais recentes). */
export const MAXIMO_DE_NOMES = 50;

/** A forma de comparar nomes: minúsculas, sem acento, espaços colapsados. */
export const normalizar = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Põe `item` no topo (recente), tirando o que tinha o mesmo nome, e corta no máximo. Nome vazio não entra. */
export function lembrar(lista: NomeLembrado[], item: NomeLembrado): NomeLembrado[] {
  const nome = item.nome.trim();
  if (!nome) return lista;
  const chave = normalizar(nome);
  return [{ ...item, nome }, ...lista.filter((x) => normalizar(x.nome) !== chave)].slice(0, MAXIMO_DE_NOMES);
}

/** Até `limite` nomes para o que está sendo digitado: nada se o campo está vazio; fora os que já existem como percurso e o que já está escrito por inteiro. */
export function sugerir(lista: NomeLembrado[], digitado: string, existentes: string[], limite = 5): NomeLembrado[] {
  const busca = normalizar(digitado);
  if (!busca) return [];
  const fora = new Set(existentes.map(normalizar));
  const candidatos = lista.filter((x) => {
    const n = normalizar(x.nome);
    return n !== busca && !fora.has(n) && n.includes(busca);
  });
  const comeca = candidatos.filter((x) => normalizar(x.nome).startsWith(busca));
  return [...comeca, ...candidatos.filter((x) => !comeca.includes(x))].slice(0, limite);
}
