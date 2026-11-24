<script lang="ts">
  import type { Snippet } from "svelte";
  import Icone from "./Icone.svelte";

  // Cartão recolhível (<details>): o desenho dos cartões do player e de Ajustes. Mostra o título e, à direita, um resumo opcional
  // (visível mesmo com o cartão fechado: recolher não esconde o que importa) e o sinal de abrir ou fechar. O estado de aberto é de quem usa
  // (`bind:aberto`), que o lembra ou não. `name` junta cartões num acordeão nativo (abrir um fecha os outros); `grade` dá ao corpo o
  // espaçamento em grade do player. O título é um <h2> DENTRO do <summary> (o HTML permite título no summary): o leitor de tela continua achando os
  // cartões pela navegação por títulos, e o <summary> segue sendo o botão que abre e fecha (conferido na árvore de acessibilidade do Chrome). O resumo é
  // um texto ou um trecho (por exemplo, um ícone e um número). `aoAlternar` avisa só quando a PESSOA abre ou fecha (clique, Enter ou Espaço no título),
  // com o novo estado: uma abertura feita pelo programa (um link que leva a este cartão) não passa por ele, e assim quem lembra o estado grava só o
  // que a pessoa escolheu.
  let {
    titulo,
    resumo,
    aberto = $bindable(false),
    name,
    id,
    grade = false,
    aoAlternar,
    children,
  }: {
    titulo: string;
    resumo?: string | Snippet;
    aberto?: boolean;
    name?: string;
    id?: string;
    grade?: boolean;
    aoAlternar?: (aberto: boolean) => void;
    children: Snippet;
  } = $props();
</script>

<details class="cartao" {id} {name} bind:open={aberto}>
  <summary onclick={() => aoAlternar?.(!aberto)}>
    <h2 class="titulo">{titulo}</h2>
    <span class="direita">
      {#if resumo}<span class="resumo">{#if typeof resumo === "string"}{resumo}{:else}{@render resumo()}{/if}</span>{/if}
      <Icone nome={aberto ? "fechar" : "abrir"} tamanho={24} />
    </span>
  </summary>
  <div class="corpo" class:grade>{@render children()}</div>
</details>

<style>
  summary {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; min-height: 3rem; box-sizing: border-box;
    padding: 0.5rem 0.9rem; font-weight: 600; cursor: pointer; list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  /* O <h2> não muda o desenho: o tamanho e o peso são os do summary. */
  .titulo { margin: 0; font: inherit; }
  .direita { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
  .resumo { display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 400; color: var(--suave); font-size: 0.9rem; text-align: end; }
  .corpo { padding: 0.2rem 0.9rem 0.9rem; }
  .corpo.grade { display: grid; gap: 0.8rem; }
</style>
