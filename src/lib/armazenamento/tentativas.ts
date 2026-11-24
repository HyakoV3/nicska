// Consultas das tentativas e a exclusão de um percurso inteiro. A sessão (um percurso num dia) não é guardada: sai das tentativas (`agruparEmSessoes`), então não há
// como as duas ficarem em desacordo. Guardar e corrigir uma tentativa e o áudio: `escritaDeTentativas.ts`.
import { percorrer, transacao } from "../banco";
import type { TentativaGuardada } from "../documento";
import type { Pagina, Posicao, ResumoDoPercurso } from "./base";
import { ArmazenamentoDeEscritaDeTentativas } from "./escritaDeTentativas";
import { apagarVideoNa } from "./videosBase";

export { LIMITE_PARA_GUARDAR_MS } from "./escritaDeTentativas";

/** Quantas tentativas o histórico carrega por vez. */
export const TAMANHO_DA_PAGINA = 20;

/** A tentativa é minha: sem `atirador_id` (as feitas aqui) ou com o meu. Sem `donoId`, vale todas. */
const doDono = (x: TentativaGuardada, donoId?: string): boolean => donoId === undefined || x.atirador_id === undefined || x.atirador_id === donoId;

const tempoTotal = (t: TentativaGuardada): number | null => (t.disparos_ms.length ? t.disparos_ms[t.disparos_ms.length - 1] : null);

const posicaoDa = (t: TentativaGuardada): Posicao => ({ quando: t.quando, id: t.id });

type Resumos = Record<string, ResumoDoPercurso>;

/** Soma a tentativa `x` ao resumo do percurso dela. */
function somarAoResumo(mapa: Resumos, x: TentativaGuardada): void {
  const m = (mapa[x.percurso_id] ??= { tentativas: 0, ultima: 0, melhorMs: null });
  m.tentativas++;
  m.ultima = Math.max(m.ultima, x.quando);
  const total = tempoTotal(x);
  if (total !== null && (m.melhorMs === null || total < m.melhorMs)) m.melhorMs = total;
}

const faixaDoPercurso = (percursoId: string, topo: IDBValidKey, abertaEmCima = false) => globalThis.IDBKeyRange.bound([percursoId, -Infinity, ""], topo, false, abertaEmCima);

/** Tudo o que se pede a uma página: de qual percurso, quantas, a partir de onde e de quem. */
export type PedidoDePagina = { percursoId: string; limite?: number; antes?: Posicao; donoId?: string };

/** Apaga o percurso e as tentativas e áudios dele, na transação `t`. Devolve quantas tentativas foram. */
async function apagarNa(t: IDBTransaction, id: string): Promise<number> {
  t.objectStore("percursos").delete(id);
  let n = 0;
  await percorrer(t.objectStore("tentativas").index("porPercurso").openCursor(faixaDoPercurso(id, [id, Infinity, "￿"])), (c) => {
    n++;
    t.objectStore("audios").delete((c.value as TentativaGuardada).id);
    apagarVideoNa(t, (c.value as TentativaGuardada).id);
    c.delete();
  });
  return n;
}

/** Uma página (`limite` tentativas, mais a sobra de uma que diz se há próxima) na transação `t`. */
async function lerPagina(t: IDBTransaction, { percursoId, limite = TAMANHO_DA_PAGINA, antes, donoId }: PedidoDePagina): Promise<Pagina> {
  const topo: IDBValidKey = antes ? [percursoId, antes.quando, antes.id] : [percursoId, Infinity, "￿"];
  const coletadas: TentativaGuardada[] = [];
  await percorrer(t.objectStore("tentativas").index("porPercurso").openCursor(faixaDoPercurso(percursoId, topo, !!antes), "prev"), (c) => {
    if (coletadas.length > limite) return true; // uma a mais que o limite: só para saber se há próxima página
    if (doDono(c.value as TentativaGuardada, donoId)) coletadas.push(c.value as TentativaGuardada);
  });
  return { itens: coletadas.slice(0, limite), temMais: coletadas.length > limite };
}

/** O resumo por percurso, lido na transação `t`. */
async function resumir(t: IDBTransaction, donoId?: string): Promise<Resumos> {
  const mapa: Resumos = {};
  await percorrer(t.objectStore("tentativas").openCursor(), (c) => {
    if (doDono(c.value as TentativaGuardada, donoId)) somarAoResumo(mapa, c.value as TentativaGuardada);
  });
  return mapa;
}

export class ArmazenamentoDeTentativas extends ArmazenamentoDeEscritaDeTentativas {
  /** Apaga o percurso e, junto, as tentativas e os áudios dele, numa transação só. Devolve quantas tentativas foram. */
  async apagarPercurso(id: string): Promise<number> {
    const b = await this.abrir();
    return transacao(b, ["percursos", "tentativas", "audios", "videos", "videos_pedacos"], "readwrite", (t) => apagarNa(t, id));
  }

  /** Uma página das tentativas de um percurso, da mais nova para a mais antiga, começando depois de `antes` (ou do começo). */
  async tentativas(percursoId: string, limite: number = TAMANHO_DA_PAGINA, antes?: Posicao, donoId?: string): Promise<Pagina> {
    return this.pagina({ percursoId, limite, antes, donoId });
  }

  private async pagina(pedido: PedidoDePagina): Promise<Pagina> {
    const b = await this.abrir();
    return transacao(b, ["tentativas"], "readonly", (t) => lerPagina(t, pedido));
  }

  /** Todas as tentativas de um percurso (para os gráficos e o ranking), da mais nova para a mais antiga. */
  async todasDoPercurso(percursoId: string, donoId?: string): Promise<TentativaGuardada[]> {
    const pedido = (antes?: Posicao): PedidoDePagina => ({ percursoId, limite: 200, antes, donoId });
    let p = await this.pagina(pedido());
    const todas = [...p.itens];
    while (p.temMais) {
      p = await this.pagina(pedido(posicaoDa(p.itens[p.itens.length - 1])));
      todas.push(...p.itens);
    }
    return todas;
  }

  /** Por percurso: quantas tentativas, quando foi a última e o melhor (menor) tempo total. Uma leitura só, para a lista do histórico. */
  async resumoPorPercurso(donoId?: string): Promise<Resumos> {
    const b = await this.abrir();
    return transacao(b, ["tentativas"], "readonly", (t) => resumir(t, donoId));
  }
}
