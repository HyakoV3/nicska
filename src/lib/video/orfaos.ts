// Vídeos órfãos (puro): o que sobra no IndexedDB quando o app morre, ou a pessoa sai, com um resultado NÃO salvo. Só a retenção por espaço/prazo os apagaria, e muito depois.
// Três tipos de lixo (nenhum deles aparece em tela alguma):
//  - "sem_tentativa": registro em `videos` cujo id não é de nenhuma tentativa salva (o vídeo usa o MESMO id da tentativa; salvar é o que o reivindica);
//  - "incompleto": registro iniciado e nunca finalizado (`finalizado === false`, ou sem nenhum pedaço), de uma gravação que não chegou ao fim;
//  - pedaços soltos: chaves de `videos_pedacos` cujo id não tem registro em `videos` (sobras de uma apagada pela metade; `iniciarVideo`/`apagarVideo` são atômicos, então nunca é transitório).
// Segurança (nunca apagar o que ainda pode ser salvo): um vídeo só é órfão se foi tocado pela última vez ANTES do início da sessão atual do app E há mais de `CARENCIA_MS`.
// Uma gravação em andamento ou um resultado na tela aguardando Salvar/Descartar pertencem à sessão atual (seu `atualizadoEm` é depois do início dela), e o resultado não
// sobrevive ao app fechar (a Revisão não é restaurada), então um vídeo de sessão anterior sem tentativa é lixo certo. A carência de 1 h cobre ainda relógio mexido e uma segunda
// janela/instância; `protegidos` (ids vivos que o chamador conhece) é a terceira cerca. Vídeos fixados nunca são apagados. Tentativa salva sempre guarda o vídeo dela.

export const CARENCIA_MS = 60 * 60 * 1000;
export type MotivoDeOrfao = "sem_tentativa" | "incompleto";

/** O que a varredura precisa saber de cada registro de `videos`. `finalizado` é ausente nas metas antigas (valem como finalizadas). */
export type VideoParaVarredura = { id: string; bytes: number; pedacos: number; atualizadoEm: number; fixado?: boolean; finalizado?: boolean };
export type EntradaDaVarredura = {
  videos: VideoParaVarredura[];
  /** Os ids (sem repetir ou não) dos pedaços guardados em `videos_pedacos`. */
  idsDePedacos: Iterable<string>;
  /** Os ids de todas as tentativas salvas. */
  idsDeTentativas: Iterable<string>;
  /** Ids vivos que não podem ser tocados (gravação em andamento, resultado na tela). */
  protegidos?: Iterable<string>;
  /** Quando esta sessão do app começou (ms). */
  inicioDaSessao: number;
  agora?: number;
  carenciaMs?: number;
};
export type Orfaos = { videos: { id: string; motivo: MotivoDeOrfao; bytes: number }[]; pedacosSoltos: string[] };

export function acharOrfaos(e: EntradaDaVarredura): Orfaos {
  const agora = e.agora ?? Date.now();
  const corte = Math.min(e.inicioDaSessao, agora - (e.carenciaMs ?? CARENCIA_MS));
  const salvas = new Set(e.idsDeTentativas);
  const protegidos = new Set(e.protegidos ?? []);
  const registrados = new Set(e.videos.map((v) => v.id));
  const videos: Orfaos["videos"] = [];
  for (const v of e.videos) {
    if (v.fixado || protegidos.has(v.id) || v.atualizadoEm >= corte) continue;
    if (salvas.has(v.id)) continue; // a tentativa salva reivindica o vídeo, completo ou não (a retenção cuida dele)
    videos.push({ id: v.id, motivo: v.finalizado === false || v.pedacos === 0 ? "incompleto" : "sem_tentativa", bytes: v.bytes });
  }
  const pedacosSoltos = [...new Set(e.idsDePedacos)].filter((id) => !registrados.has(id) && !protegidos.has(id));
  return { videos, pedacosSoltos };
}

/** Quantos itens e bytes a limpeza apaga (pedaços soltos não têm tamanho conhecido: contam 0 bytes). */
export const resumoDosOrfaos = (o: Orfaos) => ({ n: o.videos.length + o.pedacosSoltos.length, bytes: o.videos.reduce((s, v) => s + v.bytes, 0) });

/** Fatias de até `tamanho` itens: a limpeza apaga um lote por vez, cedendo o fio entre eles. */
export function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) r.push(itens.slice(i, i + tamanho));
  return r;
}
