// O que do arquivo importado é novo no aparelho, e como as tentativas se agrupam (sessões). Funções puras.
import type { Atirador, Importavel, Novidades, Percurso, Sessao, TentativaGuardada } from "./tipos";

export type JaAqui = { percursos: ReadonlySet<string>; tentativas: ReadonlySet<string>; atiradores?: ReadonlySet<string> };

function semAtirador(t: TentativaGuardada): TentativaGuardada {
  const { atirador_id: _a, ...resto } = t;
  return resto;
}

/**
 * O que do arquivo ainda não existe no aparelho (por `id`): nada é sobrescrito, e importar duas vezes não duplica. As tentativas de OUTRA pessoa entram com o
 * `atirador_id` dela (e ela entra na lista de atiradores); as minhas (do meu backup) entram sem `atirador_id`. `meuId` é o atirador deste aparelho.
 */
export function novidades(imp: Importavel, aqui: JaAqui, meuId?: string): Novidades {
  const conhecidos = aqui.atiradores ?? new Set<string>();
  const minhas = (t: TentativaGuardada) => t.atirador_id === undefined || t.atirador_id === meuId;
  const tentativas = imp.tentativas.filter((t) => !aqui.tentativas.has(t.id)).map((t) => (t.atirador_id === meuId ? semAtirador(t) : t));
  const quem = new Map<string, Atirador>();
  for (const a of [imp.atirador, ...imp.atiradores]) quem.set(a.id, a);
  const citados = new Set(tentativas.filter((t) => !minhas(t) && t.atirador_id !== undefined).map((t) => t.atirador_id!));
  const atiradores = [...citados].filter((id) => id !== meuId && !conhecidos.has(id)).map((id) => quem.get(id) ?? { id, nome: id.slice(0, 8) });
  return { atiradores, percursos: imp.percursos.filter((p: Percurso) => !aqui.percursos.has(p.id)), tentativas, jaExistiam: imp.tentativas.length - tentativas.length };
}

/** O dia (local, `AAAA-MM-DD`) de uma tentativa: a sessão é um percurso num dia. */
export const diaDaTentativa = (t: Pick<TentativaGuardada, "data">): string => t.data.slice(0, 10);

/** Agrupa as tentativas de um percurso em sessões (um dia cada), da mais nova para a mais antiga; dentro do dia, da mais nova para a mais antiga. */
export function agruparEmSessoes(tentativas: readonly TentativaGuardada[]): Sessao[] {
  const mapa = new Map<string, Sessao>();
  const maisNovaPrimeiro = [...tentativas].sort(porMaisNova);
  for (const t of maisNovaPrimeiro) {
    const chave = `${t.percurso_id}|${diaDaTentativa(t)}`;
    const s = mapa.get(chave) ?? novaSessao(t);
    mapa.set(chave, s);
    s.tentativas.push(t);
  }
  return [...mapa.values()];
}

const novaSessao = (t: TentativaGuardada): Sessao => ({ percursoId: t.percurso_id, dia: diaDaTentativa(t), tentativas: [] });

const porMaisNova = (a: TentativaGuardada, b: TentativaGuardada): number => b.quando - a.quando;
