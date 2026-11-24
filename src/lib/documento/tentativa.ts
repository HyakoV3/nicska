// Leitura de uma tentativa: uma tabela de leitores, um por grupo de campos, na ordem das chaves do documento (docs/FORMATO.md). Acrescentar um campo é acrescentar
// um leitor à tabela.
import type { Pontos } from "../tentativa";
import { dataIsoExiste, ehInteiro, ehNumero, ehObjeto, inteiroEm, invalido, listaAte, texto, textoDoId } from "./campos";
import { LIMITES, type TentativaGuardada } from "./tipos";

/** O que os leitores precisam saber do arquivo: os percursos dele e, no formato compartilhado, o único percurso (as tentativas não o repetem). */
export type ContextoDeLeitura = { percursos: ReadonlySet<string>; percursoImplicito?: string };

type Leitor = (x: Record<string, unknown>, onde: string, ctx: ContextoDeLeitura) => Partial<TentativaGuardada>;

function lerPontos(x: unknown, onde: string): Pontos {
  if (!ehObjeto(x)) return invalido(onde, "objeto");
  const campo = (k: string) => inteiroEm(x[k], 0, 1000, `${onde}.${k}`);
  if (x.fator !== "minor" && x.fator !== "major") invalido(`${onde}.fator`, "minor_ou_major");
  return { A: campo("A"), C: campo("C"), D: campo("D"), M: campo("M"), NS: campo("NS"), procedimentais: campo("procedimentais"), fator: x.fator as "minor" | "major" };
}

const lerId: Leitor = (x, onde) => ({ id: textoDoId(x.id, `${onde}.id`) });

const lerPercursoDaTentativa: Leitor = (x, onde, ctx) => {
  const percursoId = ctx.percursoImplicito ?? textoDoId(x.percurso_id, `${onde}.percurso_id`);
  if (!ctx.percursos.has(percursoId)) invalido(`${onde}.percurso_id`, "percurso_fora_do_arquivo");
  return { percurso_id: percursoId };
};

const lerData: Leitor = (x, onde) => {
  const data = texto(x.data, 40, `${onde}.data`);
  if (!dataIsoExiste(data)) invalido(`${onde}.data`, "data_iso_8601");
  return { data, quando: Date.parse(data) };
};

const lerAtraso: Leitor = (x, onde) => ({ atraso_ms: inteiroEm(x.atraso_ms, 0, 60_000, `${onde}.atraso_ms`) });

const lerInicio: Leitor = (x, onde) => {
  if (x.inicio !== "detectado" && x.inicio !== "estimado") invalido(`${onde}.inicio`, "detectado_ou_estimado");
  return { inicio: x.inicio as "detectado" | "estimado" };
};

const lerDisparos: Leitor = (x, onde) => {
  const disparos = listaAte(x.disparos_ms, LIMITES.disparos, `${onde}.disparos_ms`);
  let anterior = -1;
  for (const d of disparos) {
    if (!ehInteiro(d, 0, LIMITES.disparoMs) || d <= anterior) invalido(`${onde}.disparos_ms`, `crescente_0_a_${LIMITES.disparoMs}`);
    anterior = d as number;
  }
  return { disparos_ms: disparos as number[] };
};

const lerIncompleta: Leitor = (x, onde) => {
  if (x.incompleta === undefined || x.incompleta === false) return {};
  return x.incompleta === true ? { incompleta: true as const } : invalido(`${onde}.incompleta`, "true");
};

const lerEditada: Leitor = (x, onde) => {
  const e = ehObjeto(x.editada) ? x.editada : { apagados: 0, inseridos: 0 };
  return { editada: { apagados: inteiroEm(e.apagados, 0, LIMITES.disparos, `${onde}.editada`), inseridos: inteiroEm(e.inseridos, 0, LIMITES.disparos, `${onde}.editada`) } };
};

/**
 * O detector: `versao` é um inteiro de 1 em diante. Uma versão FUTURA (de um app mais novo) não recusa o arquivo inteiro: é aceita e guardada como veio, lendo só
 * os campos conhecidos (docs/FORMATO.md promete que campos novos dentro de `nicska/1` são ignorados).
 */
const lerDetector: Leitor = (x, onde) => {
  if (!ehObjeto(x.detector)) return invalido(`${onde}.detector`, "ausente");
  const d = x.detector;
  const versao = inteiroEm(d.versao, 1, 1000, `${onde}.detector.versao`);
  if (!ehNumero(d.sensibilidade, 0, 1) || !ehNumero(d.tempo_morto_ms, 0, 10_000)) invalido(`${onde}.detector`, "sensibilidade_0_a_1_tempo_morto_0_a_10000");
  return { detector: { versao, sensibilidade: d.sensibilidade as number, tempo_morto_ms: d.tempo_morto_ms as number } };
};

const lerAtiradorDaTentativa: Leitor = (x, onde) => (x.atirador_id != null ? { atirador_id: textoDoId(x.atirador_id, `${onde}.atirador_id`) } : {});

const lerPontosDaTentativa: Leitor = (x, onde) => (x.pontos != null ? { pontos: lerPontos(x.pontos, `${onde}.pontos`) } : {});

const lerHash: Leitor = (x, onde) => {
  if (x.audio_sha256 == null) return {};
  if (typeof x.audio_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(x.audio_sha256)) invalido(`${onde}.audio_sha256`, "sha256_hexadecimal");
  return { audio_sha256: x.audio_sha256 as string };
};

const LEITORES: readonly Leitor[] = [lerId, lerPercursoDaTentativa, lerData, lerAtraso, lerInicio, lerDisparos, lerEditada, lerIncompleta, lerDetector, lerAtiradorDaTentativa, lerPontosDaTentativa, lerHash];

/** Lê a tentativa de posição `indice` na lista do arquivo (o caminho dos erros). */
export function lerTentativa(x: unknown, { indice, ...ctx }: ContextoDeLeitura & { indice: number }): TentativaGuardada {
  const onde = `tentativas[${indice}]`;
  if (!ehObjeto(x)) return invalido(onde, "objeto");
  return Object.assign({}, ...LEITORES.map((ler) => ler(x, onde, ctx))) as TentativaGuardada;
}
