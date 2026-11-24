// A pilha de níveis internos de uma tela (detalhe de um percurso, menu aberto, edição, confirmação). O Voltar do sistema fecha o de cima, um por vez.
// Lógica pura, sem DOM: quem liga isto ao histórico do WebView é `registrarNivel` (navegacao.ts).
export type PilhaVoltar = ReturnType<typeof criarPilhaVoltar>;

export function criarPilhaVoltar() {
  let proximo = 1;
  let itens: { id: number; fechar: () => void }[] = [];
  return {
    get tamanho() {
      return itens.length;
    },
    /** Abre um nível; `fechar` é chamado quando o Voltar o fecha. Devolve o id para `remover`. */
    empilhar(fechar: () => void): number {
      const id = proximo++;
      itens.push({ id, fechar });
      return id;
    },
    /** O nível ainda está na pilha? */
    tem: (id: number): boolean => itens.some((i) => i.id === id),
    /** Tira o nível sem chamar `fechar` (ele já foi fechado pela tela). Devolve se ele ainda estava na pilha. */
    remover(id: number): boolean {
      const tinha = this.tem(id);
      itens = itens.filter((i) => i.id !== id);
      return tinha;
    },
    /** O Voltar do sistema: fecha o nível de cima. Devolve false se não havia nenhum (o Voltar segue o comportamento normal). */
    voltar(): boolean {
      const topo = itens.pop();
      topo?.fechar();
      return topo !== undefined;
    },
  };
}
