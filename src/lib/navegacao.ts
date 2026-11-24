import { afterNavigate, goto, pushState } from "$app/navigation";
import { criarPilhaVoltar } from "./pilhaVoltar";

/**
 * Devolve a função "voltar" da tela. Se a pessoa chegou por navegação dentro do app, volta no
 * histórico (a lista reaparece como estava); se a tela foi aberta direto (ex.: app restaurado),
 * vai para a tela inicial. Chamar durante a inicialização do componente.
 */
export function usarVoltar() {
  let veioDeDentro = false;
  afterNavigate((n) => {
    veioDeDentro = n.from !== null;
  });
  return () => (veioDeDentro ? history.back() : goto("/", { replaceState: true }));
}

const pilha = criarPilhaVoltar();
let ignorarPop = 0;
let ouvindo = false;
/** `pushState` que esperam o `popstate` de um `history.back()` nosso ainda em andamento (o `back()` é assíncrono: um `pushState` no meio o desfaria). */
let adiados: (() => void)[] = [];

function aoVoltar() {
  if (ignorarPop > 0) {
    ignorarPop--; // o popstate de um `history.back()` nosso (nível fechado pela tela)
    if (ignorarPop === 0) {
      const prontos = adiados;
      adiados = [];
      prontos.forEach((empurrar) => empurrar());
    }
    return;
  }
  pilha.voltar();
}

/**
 * Registra um nível interno aberto (detalhe, menu, edição, confirmação): enquanto ele existir, o Voltar do sistema chama `fechar` em vez de sair da tela.
 * Devolve a função de desfazer, para o `$effect` que o abriu: se o nível foi fechado pela própria tela (não pelo Voltar), ela tira a entrada que criou no histórico.
 * Níveis abertos ao sair da tela deixam uma entrada vazia no histórico (um Voltar a mais ao retornar): limitação conhecida.
 */
export function registrarNivel(fechar: () => void): () => void {
  if (!ouvindo) {
    window.addEventListener("popstate", aoVoltar);
    ouvindo = true;
  }
  const id = pilha.empilhar(fechar);
  let entrou = false;
  const empurrar = () => {
    if (!pilha.tem(id)) return; // fechado enquanto esperava: não chegou a criar a entrada
    pushState("", {});
    entrou = true;
  };
  if (ignorarPop > 0) adiados.push(empurrar);
  else empurrar();
  return () => {
    if (!pilha.remover(id)) return; // já foi fechado pelo Voltar: a entrada do histórico já saiu
    if (!entrou) return;
    ignorarPop++;
    history.back();
  };
}
