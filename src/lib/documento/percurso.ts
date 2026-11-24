// Leitura do percurso e do atirador de um documento.
import { ehNumero, ehObjeto, type Objeto, inteiroEm, invalido, listaAte, semRepetidos, texto, textoDoId, textoOpcional } from "./campos";
import { opcional } from "./util";
import { LIMITES, type Atirador, type Percurso } from "./tipos";

/** Um inteiro de 1 a `max`, ou undefined se o campo não veio. */
const inteiroOpcional = (x: unknown, max: number, onde: string): number | undefined => (x == null ? undefined : inteiroEm(x, 1, max, onde));

/** Os campos opcionais do percurso (disparos mínimos, pontos máximos e divisão), na ordem do documento (docs/FORMATO.md). */
function lerOpcionais(x: Objeto, onde: string) {
  const disparos = inteiroOpcional(x.disparos_minimos, LIMITES.disparos, `${onde}.disparos_minimos`);
  const pontos = inteiroOpcional(x.pontos_maximos, 100_000, `${onde}.pontos_maximos`);
  const divisao = textoOpcional(x.divisao, LIMITES.texto, `${onde}.divisao`);
  const comDisparos = opcional(disparos !== undefined, { disparos_minimos: disparos });
  const comPontos = opcional(pontos !== undefined, { pontos_maximos: pontos });
  const comDivisao = opcional(divisao, { divisao });
  return { ...comDisparos, ...comPontos, ...comDivisao };
}

export function lerPercurso(x: unknown, i: number): Percurso {
  const onde = `percursos[${i}]`;
  if (!ehObjeto(x)) return invalido(onde, "objeto");
  const id = textoDoId(x.id, `${onde}.id`);
  const nome = texto(x.nome, LIMITES.texto, `${onde}.nome`);
  const opcionais = lerOpcionais(x, onde);
  // A ordem das chaves é a do documento (docs/FORMATO.md): ler e escrever de volta dá o mesmo texto.
  return { id, nome, ...opcionais, criado_em: ehNumero(x.criado_em, 0, 8.64e15) ? Math.round(x.criado_em) : 0 };
}

export function lerAtirador(x: unknown, onde: string): Atirador {
  const a = ehObjeto(x) ? x : invalido(onde, "ausente");
  const atirador: Atirador = { id: textoDoId(a.id, `${onde}.id`), nome: texto(a.nome, LIMITES.texto, `${onde}.nome`) };
  const divisao = textoOpcional(a.divisao, LIMITES.texto, `${onde}.divisao`);
  if (divisao) atirador.divisao = divisao;
  return atirador;
}

/** A lista `atiradores` do backup (as outras pessoas), ou undefined se o backup não tem. */
export function lerOutrosAtiradores(x: unknown): Atirador[] | undefined {
  if (x == null) return undefined;
  const outros = listaAte(x, LIMITES.atiradores, "atiradores").map((a, i) => lerAtirador(a, `atiradores[${i}]`));
  semRepetidos(outros, "atiradores");
  return outros;
}
