// Montar os documentos que saem do aparelho: o backup (`nicska-backup/1`) e o percurso compartilhado (`nicska/1`). Funções puras.
import { opcional } from "./util";
import { FORMATO_BACKUP, FORMATO_COMPARTILHADO, type Atirador, type Backup, type Compartilhado, type Percurso, type TentativaGuardada } from "./tipos";

/** O que um backup leva: o dono do aparelho, os percursos, as tentativas e (se há) as outras pessoas cujas tentativas foram importadas. */
export type ConteudoDoBackup = { atirador: Atirador; percursos: Percurso[]; tentativas: TentativaGuardada[]; outros?: Atirador[] };

const semAudio = ({ audio: _audio, ...resto }: TentativaGuardada) => resto;

export function montarBackup(app: string, { atirador, percursos, tentativas, outros = [] }: ConteudoDoBackup, agora: Date = new Date()): Backup {
  const comOutros = opcional(outros.length, { atiradores: outros });
  return {
    formato: FORMATO_BACKUP,
    app,
    exportado_em: agora.toISOString(),
    atirador,
    ...comOutros,
    percursos,
    // O áudio fica no aparelho: o backup leva só os números (e o hash que amarra o áudio à tentativa).
    tentativas: tentativas.map(semAudio),
  };
}

const semCamposLocais = ({ audio: _audio, quando: _quando, percurso_id: _p, atirador_id: _a, ...resto }: TentativaGuardada) => resto;

/** Monta o JSON de um percurso para compartilhar: só as minhas tentativas (de `tentativas`, as já filtradas por quem chama), sem áudio. */
export function montarCompartilhado(app: string, atirador: Atirador, percurso: Percurso, tentativas: readonly TentativaGuardada[]): Compartilhado {
  const quem = { id: atirador.id, nome: atirador.nome };
  const comDivisao = opcional(atirador.divisao, { divisao: atirador.divisao });
  return {
    formato: FORMATO_COMPARTILHADO,
    app,
    atirador: quem,
    ...comDivisao,
    percurso: percursoParaCompartilhar(percurso),
    tentativas: tentativas.map(semCamposLocais),
  };
}

/** Do percurso, só o que o compartilhado leva (sem o que é local do aparelho). */
function percursoParaCompartilhar({ id, nome, disparos_minimos, pontos_maximos }: Percurso): Compartilhado["percurso"] {
  return { id, nome, ...opcional(disparos_minimos, { disparos_minimos }), ...opcional(pontos_maximos, { pontos_maximos }) };
}
